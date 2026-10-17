/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// In-memory request cache to save quota on repeated calls (bounded: the server is shared by all users)
const requestCache = new Map<string, LlmCallResult>();
const CACHE_MAX = 200;

/** One model call as the transport receives it */
export interface LlmRequest {
  messages: LlmMessage[];
  tools?: Array<{ name: string; description: string; parameters: unknown }>;
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: unknown;
  inlineData?: { mimeType: string; data: string };
  preferredModel?: string;
  /** Total time left for the caller; no model is started or waited for beyond it */
  budgetMs?: number;
}

/** Sends one model call; throws an Error with `status` (429, 503, 504...) on failure */
export type LlmTransport = (request: LlmRequest) => Promise<LlmCallResult>;

export interface FallbackProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

let transport: LlmTransport | null = null;
let fallbackProvider: FallbackProviderConfig | null = null;

/** Wired once at server startup (server/index.ts); tests pass a fake transport */
export function configureLlm(options: { transport: LlmTransport; fallback?: FallbackProviderConfig | null }): void {
  transport = options.transport;
  fallbackProvider = options.fallback ?? null;
  requestCache.clear();
}

/** One conversation entry sent to the model. */
export type LlmMessage =
  | { role: 'user' | 'assistant'; content: string }
  // Raw model turn with functionCall parts, sent back unchanged (Gemini 3 thought signatures)
  | { role: 'model_content'; content: unknown }
  // Results of the tool calls of the previous model turn, in the same order
  | { role: 'tool_responses'; responses: Array<{ name: string; id?: string; response: Record<string, unknown> }> };

export interface LlmCallOptions {
  messages: LlmMessage[];
  tools?: any[];
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: any;
  inlineData?: { mimeType: string; data: string };
  /** Model that produced the previous turn; the model client tries it first */
  preferredModel?: string;
  /** Epoch ms after which no request, retry or fallback is started; then LlmDeadlineError is thrown */
  deadline?: number;
  onThrottled?: (isThrottled: boolean, message?: string) => void;
}

/** The caller's time limit ran out before the model answered */
export class LlmDeadlineError extends Error {
  constructor() {
    super('LLM call exceeded the turn deadline');
    this.name = 'LlmDeadlineError';
  }
}

export interface LlmCallResult {
  text: string;
  functionCalls?: Array<{ name: string; args: any; id?: string }>;
  modelContent?: unknown;
  model?: string;
  isFallback?: boolean;
}

/** Sleep with jitter helper */
function sleep(ms: number): Promise<void> {
  const jitter = Math.random() * 300;
  return new Promise((resolve) => setTimeout(resolve, ms + jitter));
}

const isCapacityError = (err: any) => Number(err?.status) === 429 || Number(err?.status) === 503;

/**
 * Executes one LLM call through the configured transport (Gemini, server side)
 * with exponential backoff on 429/503, in-memory cache, and fallback provider.
 */
export async function callLlm(options: LlmCallOptions): Promise<LlmCallResult> {
  if (!transport) throw new Error('LLM transport is not configured (configureLlm)');
  const send = transport;

  const cacheKey = JSON.stringify({
    messages: options.messages,
    systemInstruction: options.systemInstruction,
    hasTools: Boolean(options.tools?.length),
    hasImage: Boolean(options.inlineData),
  });

  const cached = requestCache.get(cacheKey);
  if (cached && !options.inlineData) return cached;

  const maxTries = 4;
  let delay = 1000;
  let lastError: Error | null = null;
  const deadline = options.deadline ?? Infinity;
  const timeLeft = () => deadline - Date.now();
  const deadlineHit = (): LlmDeadlineError => {
    options.onThrottled?.(false);
    return new LlmDeadlineError();
  };

  for (let attempt = 1; attempt <= maxTries; attempt++) {
    if (timeLeft() <= 0) throw deadlineHit();
    try {
      const result = await send({
        messages: options.messages,
        tools: options.tools,
        systemInstruction: options.systemInstruction,
        responseMimeType: options.responseMimeType,
        responseSchema: options.responseSchema,
        inlineData: options.inlineData,
        preferredModel: options.preferredModel,
        // The model client stops trying models when this runs out
        ...(Number.isFinite(deadline) && { budgetMs: timeLeft() }),
      });

      options.onThrottled?.(false);
      if (!options.inlineData) {
        if (requestCache.size >= CACHE_MAX) requestCache.delete(requestCache.keys().next().value!);
        requestCache.set(cacheKey, result);
      }
      return result;
    } catch (err: any) {
      if (err instanceof LlmDeadlineError) throw err;

      if (isCapacityError(err)) {
        options.onThrottled?.(
          true,
          'המערכת מתמודדת עם עומס בקשות זמני (429/503). ממתינים מעט ומנסים שנית...'
        );
        if (timeLeft() <= delay) throw deadlineHit();
        if (attempt === maxTries) {
          // Try fallback if available
          const fallbackRes = await tryFallbackProvider(options);
          if (fallbackRes) {
            options.onThrottled?.(false);
            return fallbackRes;
          }
          options.onThrottled?.(false);
          throw new Error('התקבל עומס מכסות (429) מהספק החינמי. אנא נסו שוב בעוד מספר שניות.');
        }
        await sleep(delay);
        delay *= 2;
        continue;
      }

      // Out of time: no retry, no fallback
      if (timeLeft() <= delay) throw deadlineHit();
      lastError = err;
      if (attempt === maxTries) break;
      await sleep(delay);
      delay *= 2;
    }
  }

  if (timeLeft() <= 0) throw deadlineHit();
  // Attempt fallback provider before failing
  const fallbackRes = await tryFallbackProvider(options);
  if (fallbackRes) {
    options.onThrottled?.(false);
    return fallbackRes;
  }

  options.onThrottled?.(false);
  throw lastError || new Error('שגיאה בתקשורת עם מודל השפה');
}

/** Fallback to an OpenAI-compatible provider (e.g. OpenRouter/Groq) if configured on the server */
async function tryFallbackProvider(options: LlmCallOptions): Promise<LlmCallResult | null> {
  if (!fallbackProvider) return null;
  const { baseUrl, apiKey, model } = fallbackProvider;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(options.systemInstruction ? [{ role: 'system', content: options.systemInstruction }] : []),
          // The OpenAI-compatible fallback has no Gemini function-calling turns: send text turns only
          ...options.messages
            .filter((m): m is Extract<LlmMessage, { content: string }> => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    return {
      text: content,
      isFallback: true,
    };
  } catch {
    return null;
  }
}
