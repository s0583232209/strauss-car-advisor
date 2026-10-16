/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '25mb' }));

// Initialize GoogleGenAI SDK on server-side only
const geminiApiKey = process.env.GEMINI_API_KEY || '';
// Ordered model list from GEMINI_MODEL (comma-separated). On 429/503/404 or timeout the next model is tried.
const geminiModels = (process.env.GEMINI_MODEL || 'gemini-3.8-flash')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
// Kept well below the agent's 30s turn limit (src/agent/loop.ts) so a hanging model still leaves time to fall back
const MODEL_TIMEOUT_MS = Number(process.env.GEMINI_MODEL_TIMEOUT_MS) || 10000;
// Skip a model for a while after it fails, so each agent turn does not re-hit an exhausted model.
// A timeout (408) costs a full MODEL_TIMEOUT_MS per call, so a slow model is skipped for 10 minutes
const COOLDOWN_MS: Record<number, number> = { 429: 60000, 503: 30000, 404: 600000, 408: 600000 };
const modelCooldownUntil = new Map<string, number>();

const ai = new GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * Calls generateContent on the first available model, falling back on 429/503/404/timeout.
 * budgetMs (optional): total time left for the caller; no model is started or waited for beyond it.
 */
async function generateWithFallback(
  params: Omit<Parameters<typeof ai.models.generateContent>[0], 'model'>,
  preferredModel?: string,
  budgetMs?: number
): Promise<{ response: Awaited<ReturnType<typeof ai.models.generateContent>>; model: string }> {
  const now = Date.now();
  const deadline = budgetMs && budgetMs > 0 ? now + budgetMs : Infinity;
  const available = geminiModels.filter((m) => (modelCooldownUntil.get(m) || 0) <= now);
  // If every model is cooling down, still try them all rather than failing immediately
  let candidates = available.length > 0 ? available : geminiModels;
  // Within one agent turn keep the model that produced the previous turn (thought signatures are model-specific)
  if (preferredModel && candidates.includes(preferredModel)) {
    candidates = [preferredModel, ...candidates.filter((m) => m !== preferredModel)];
  }
  let lastError: any = null;

  for (const model of candidates) {
    const left = deadline - Date.now();
    if (left <= 0) break;
    // Cut short by the caller's budget, not by the model: such a timeout says nothing about the model
    const cutByBudget = left < MODEL_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(MODEL_TIMEOUT_MS, left));
    try {
      const response = await ai.models.generateContent({
        ...params,
        model,
        config: { ...(params.config || {}), abortSignal: controller.signal },
      });
      modelCooldownUntil.delete(model);
      return { response, model };
    } catch (error: any) {
      const timedOut = controller.signal.aborted;
      const status = timedOut ? 408 : Number(error?.status) || 500;
      // A timeout is reported to the client as 503 so its backoff logic retries
      lastError = timedOut
        ? Object.assign(new Error(`Gemini model ${model} timed out after ${MODEL_TIMEOUT_MS}ms`), { status: 503 })
        : error;
      if (!(status in COOLDOWN_MS)) throw error; // not a capacity/model problem: do not mask it
      if (timedOut && cutByBudget) break;
      modelCooldownUntil.set(model, Date.now() + COOLDOWN_MS[status]);
      console.warn(`Gemini model ${model} unavailable (${status}); trying next model`);
    } finally {
      clearTimeout(timer);
    }
  }
  if (Date.now() >= deadline) {
    throw Object.assign(new Error('The caller time budget ran out before a model answered'), { status: 504 });
  }
  throw lastError || new Error('No Gemini model available');
}

// Endpoint: Health check
app.get('/api/health', (_req: Request, res: Response) => {
  const now = Date.now();
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(geminiApiKey),
    models: geminiModels.map((m) => ({
      model: m,
      coolingDownSec: Math.max(0, Math.round(((modelCooldownUntil.get(m) || 0) - now) / 1000)),
    })),
    timestamp: new Date().toISOString(),
  });
});

// Endpoint: LLM content generation & function calling
app.post('/api/gemini/generate', async (req: Request, res: Response) => {
  try {
    const { messages, tools, systemInstruction, responseMimeType, responseSchema, inlineData, preferredModel, budgetMs } =
      req.body;

    // Convert tool declarations to GenAI format if provided
    let sdkTools: any[] | undefined = undefined;
    if (tools && Array.isArray(tools) && tools.length > 0) {
      sdkTools = [
        {
          functionDeclarations: tools.map((t: any) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    // Build contents structure
    const contents: any[] = [];

    if (inlineData) {
      contents.push({
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: inlineData.mimeType,
              data: inlineData.data,
            },
          },
          {
            text: messages?.[messages.length - 1]?.content || 'נא לחלץ את שדות התלוש',
          },
        ],
      });
    } else if (Array.isArray(messages)) {
      for (const m of messages) {
        if (m.role === 'model_content' && m.content) {
          // Raw model turn (functionCall parts + thought signatures) passed back unchanged, as Gemini 3 requires
          contents.push(m.content);
        } else if (m.role === 'tool_responses' && Array.isArray(m.responses)) {
          contents.push({
            role: 'user',
            parts: m.responses.map((r: any) => ({
              functionResponse: { name: r.name, ...(r.id ? { id: r.id } : {}), response: r.response },
            })),
          });
        } else {
          contents.push({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          });
        }
      }
    }

    const config: any = {};
    if (systemInstruction) config.systemInstruction = systemInstruction;
    if (sdkTools) config.tools = sdkTools;
    if (responseMimeType) config.responseMimeType = responseMimeType;
    if (responseSchema) config.responseSchema = responseSchema;

    const { response, model } = await generateWithFallback(
      {
        contents: contents.length > 0 ? contents : 'שלום',
        config,
      },
      typeof preferredModel === 'string' ? preferredModel : undefined,
      typeof budgetMs === 'number' ? budgetMs : undefined
    );

    // Check for function calls
    const functionCalls = response.functionCalls?.map((fc: any) => ({
      name: fc.name,
      args: fc.args,
      ...(fc.id ? { id: fc.id } : {}),
    }));
    const hasCalls = Boolean(functionCalls && functionCalls.length > 0);

    res.json({
      text: response.text || '',
      functionCalls: hasCalls ? functionCalls : undefined,
      // The raw model turn must be sent back with the function responses on the next call
      modelContent: hasCalls ? response.candidates?.[0]?.content : undefined,
      model,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    res.status(status).json({
      error: error?.message || 'שגיאה בעיבוד הבקשה מול מודל השפה',
      status,
    });
  }
});

// Endpoint: Payslip Multimodal OCR & Extraction
app.post('/api/gemini/extract-payslip', async (req: Request, res: Response) => {
  try {
    const { fileData, mimeType } = req.body;
    if (!fileData || !mimeType) {
      res.status(400).json({ error: 'חסרים נתוני קובץ או סוג קובץ' });
      return;
    }

    const extractionPrompt = `
נתח את תלוש השכר / חוזה העסקה המצורף.
חלץ בדיוק רב את השדות הבאים (אם שדה חסר או לא ברור החזר null):
- occupation: תפקיד / עיסוק
- base: שכר בסיס / יסוד (מספר)
- commissions: עמלות / פרמיות (מספר)
- bonus: בונוס חודשי (מספר)
- pensionPct: אחוז ניכוי תגמולים/פנסיה (מספר, למשל 6)
- studyFundPct: אחוז ניכוי קרן השתלמות (מספר, למשל 2.5)
- creditPoints: נקודות זיכוי (מספר, למשל 2.25 או 2.75)
- currentCar: דגם רכב חברה קיים אם מופיע (מחרוזת)
- carParticipation: ניכוי השתתפות ברכב (מספר)
- maintenance: דמי אחזקת רכב (מספר)
- childrenUpTo23: מספר ילדים עד גיל 23 אם מופיע (מספר)

עבור כל שדה החזר אובייקט עם { "value": ערך_או_null, "confidence": "high"|"medium"|"low", "sourceQuote": "ציטוט מהמסמך" }.
`;

    const { response } = await generateWithFallback({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: fileData,
              },
            },
            {
              text: extractionPrompt,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({
      error: error?.message || 'שגיאה בפענוח תלוש השכר',
    });
  }
});

// Serve frontend with Vite middlewares in development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server listening on http://127.0.0.1:${PORT}`);
  });
}

startServer();
