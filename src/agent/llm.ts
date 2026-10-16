/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// In-memory request cache to save quota on repeated calls
const requestCache = new Map<string, any>();

/** One conversation entry sent to the server proxy. */
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
  /** Model that produced the previous turn; the server tries it first */
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

/**
 * Executes LLM call through server proxy (/api/gemini/generate)
 * with exponential backoff on 429/503, in-memory cache, and fallback provider.
 */
export async function callLlm(options: LlmCallOptions): Promise<LlmCallResult> {
  const cacheKey = JSON.stringify({
    messages: options.messages,
    systemInstruction: options.systemInstruction,
    hasTools: Boolean(options.tools?.length),
    hasImage: Boolean(options.inlineData),
  });

  if (requestCache.has(cacheKey) && !options.inlineData) {
    return requestCache.get(cacheKey);
  }

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
      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: options.messages,
          tools: options.tools,
          systemInstruction: options.systemInstruction,
          responseMimeType: options.responseMimeType,
          responseSchema: options.responseSchema,
          inlineData: options.inlineData,
          preferredModel: options.preferredModel,
          // The server stops trying models when this runs out
          ...(Number.isFinite(deadline) && { budgetMs: timeLeft() }),
        }),
        // A second of grace so the server's own budget error arrives first
        ...(Number.isFinite(deadline) && { signal: AbortSignal.timeout(timeLeft() + 1000) }),
      });

      if (response.status === 429 || response.status === 503) {
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
          throw new Error('התקבל עומס מכסות (429) מהספק החינמי. אנא נסו שוב בעוד מספר שניות.');
        }
        await sleep(delay);
        delay *= 2;
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`שגיאת שרת (${response.status}): ${errorBody}`);
      }

      const result: LlmCallResult = await response.json();
      options.onThrottled?.(false);

      if (!options.inlineData) {
        requestCache.set(cacheKey, result);
      }

      return result;
    } catch (err: any) {
      if (err instanceof LlmDeadlineError) throw err;
      // Out of time (also a fetch aborted by the deadline signal): no retry, no fallback
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

/** Fallback to OpenAI-compatible provider (e.g. OpenRouter/Groq) if configured in env */
async function tryFallbackProvider(options: LlmCallOptions): Promise<LlmCallResult | null> {
  const baseUrl = (import.meta.env.VITE_FALLBACK_BASE_URL as string) || '';
  const apiKey = (import.meta.env.VITE_FALLBACK_KEY as string) || '';
  const model = (import.meta.env.VITE_FALLBACK_MODEL as string) || 'meta-llama/llama-3.3-70b-instruct';

  if (!baseUrl || !apiKey) return null;

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
