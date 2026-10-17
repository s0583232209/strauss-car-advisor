/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Gemini client (server only; the API key never leaves the server).
 * Ordered model list with fallback on 429/503/404/timeout, per-model cooldown, and a time budget
 * so one agent turn never waits past its limit.
 */

import { GoogleGenAI } from '@google/genai';
import type { LlmCallResult, LlmMessage, LlmRequest } from '../agent/llm.ts';

export interface GeminiConfig {
  apiKey: string;
  models: string[];
  modelTimeoutMs: number;
}

/** What the agent sends for one model call */
export type GenerateRequest = LlmRequest;

/** Error with the HTTP-like status of the failure (429, 503, 504...) */
export type StatusError = Error & { status?: number };

// Skip a model for a while after it fails, so each agent turn does not re-hit an exhausted model.
// A timeout (408) costs a full modelTimeoutMs per call, so a slow model is skipped for 10 minutes
const COOLDOWN_MS: Record<number, number> = { 429: 60000, 503: 30000, 404: 600000, 408: 600000 };

const PAYSLIP_PROMPT = `
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

/** Agent conversation → Gemini contents (raw model turns are passed back unchanged: thought signatures) */
export function toGeminiContents(messages: LlmMessage[]): any[] {
  return messages.map((m) => {
    if (m.role === 'model_content') return m.content;
    if (m.role === 'tool_responses') {
      return {
        role: 'user',
        parts: m.responses.map((r) => ({
          functionResponse: { name: r.name, ...(r.id ? { id: r.id } : {}), response: r.response },
        })),
      };
    }
    return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] };
  });
}

export function createGemini(config: GeminiConfig) {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const cooldownUntil = new Map<string, number>();

  async function generateWithFallback(
    params: Omit<Parameters<typeof ai.models.generateContent>[0], 'model'>,
    preferredModel?: string,
    budgetMs?: number
  ): Promise<{ response: Awaited<ReturnType<typeof ai.models.generateContent>>; model: string }> {
    const now = Date.now();
    const deadline = budgetMs && budgetMs > 0 ? now + budgetMs : Infinity;
    const available = config.models.filter((m) => (cooldownUntil.get(m) || 0) <= now);
    // If every model is cooling down, still try them all rather than failing immediately
    let candidates = available.length > 0 ? available : config.models;
    // Within one agent turn keep the model that produced the previous turn (thought signatures are model-specific)
    if (preferredModel && candidates.includes(preferredModel)) {
      candidates = [preferredModel, ...candidates.filter((m) => m !== preferredModel)];
    }
    let lastError: StatusError | null = null;

    for (const model of candidates) {
      const left = deadline - Date.now();
      if (left <= 0) break;
      // Cut short by the caller's budget, not by the model: such a timeout says nothing about the model
      const cutByBudget = left < config.modelTimeoutMs;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(config.modelTimeoutMs, left));
      try {
        const response = await ai.models.generateContent({
          ...params,
          model,
          config: { ...(params.config || {}), abortSignal: controller.signal },
        });
        cooldownUntil.delete(model);
        return { response, model };
      } catch (error: any) {
        const timedOut = controller.signal.aborted;
        const status = timedOut ? 408 : Number(error?.status) || 500;
        // A timeout is reported as 503 so the agent's backoff logic retries
        lastError = timedOut
          ? Object.assign(new Error(`Gemini model ${model} timed out after ${config.modelTimeoutMs}ms`), { status: 503 })
          : error;
        if (!(status in COOLDOWN_MS)) throw error; // not a capacity/model problem: do not mask it
        if (timedOut && cutByBudget) break;
        cooldownUntil.set(model, Date.now() + COOLDOWN_MS[status]);
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

  /** One agent model call: text, or function calls with the raw model turn to send back */
  async function generate(req: GenerateRequest): Promise<LlmCallResult> {
    const sdkConfig: Record<string, unknown> = {};
    if (req.systemInstruction) sdkConfig.systemInstruction = req.systemInstruction;
    if (req.tools?.length) {
      sdkConfig.tools = [
        { functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) },
      ];
    }
    if (req.responseMimeType) sdkConfig.responseMimeType = req.responseMimeType;
    if (req.responseSchema) sdkConfig.responseSchema = req.responseSchema;

    const contents = toGeminiContents(req.messages);
    const { response, model } = await generateWithFallback(
      { contents: contents.length > 0 ? contents : 'שלום', config: sdkConfig },
      req.preferredModel,
      req.budgetMs
    );

    const functionCalls = response.functionCalls?.map((fc: any) => ({
      name: fc.name,
      args: fc.args,
      ...(fc.id ? { id: fc.id } : {}),
    }));
    const hasCalls = Boolean(functionCalls && functionCalls.length > 0);
    return {
      text: response.text || '',
      functionCalls: hasCalls ? functionCalls : undefined,
      // The raw model turn must be sent back with the function responses on the next call
      modelContent: hasCalls ? response.candidates?.[0]?.content : undefined,
      model,
    };
  }

  /** Reads a payslip image/PDF into { field: { value, confidence, sourceQuote } } */
  async function extractPayslip(fileData: string, mimeType: string): Promise<unknown> {
    const { response } = await generateWithFallback({
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: fileData } }, { text: PAYSLIP_PROMPT }] }],
      config: { responseMimeType: 'application/json' },
    });
    return JSON.parse(response.text || '{}');
  }

  function status() {
    const now = Date.now();
    return {
      hasGeminiKey: Boolean(config.apiKey),
      models: config.models.map((m) => ({
        model: m,
        coolingDownSec: Math.max(0, Math.round(((cooldownUntil.get(m) || 0) - now) / 1000)),
      })),
    };
  }

  return { generate, extractPayslip, status };
}

export type Gemini = ReturnType<typeof createGemini>;
