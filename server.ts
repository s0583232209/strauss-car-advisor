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
const ai = new GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Endpoint: Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(geminiApiKey),
    timestamp: new Date().toISOString(),
  });
});

// Endpoint: LLM content generation & function calling
app.post('/api/gemini/generate', async (req: Request, res: Response) => {
  try {
    const { messages, tools, systemInstruction, responseMimeType, responseSchema, inlineData } = req.body;

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
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        });
      }
    }

    const config: any = {};
    if (systemInstruction) config.systemInstruction = systemInstruction;
    if (sdkTools) config.tools = sdkTools;
    if (responseMimeType) config.responseMimeType = responseMimeType;
    if (responseSchema) config.responseSchema = responseSchema;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents.length > 0 ? contents : 'שלום',
      config,
    });

    // Check for function calls
    const functionCalls = response.functionCalls?.map((fc: any) => ({
      name: fc.name,
      args: fc.args,
    }));

    res.json({
      text: response.text || '',
      functionCalls: functionCalls && functionCalls.length > 0 ? functionCalls : undefined,
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

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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
