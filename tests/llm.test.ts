import { describe, expect, it, vi } from 'vitest';
import { callLlm, configureLlm, LlmDeadlineError } from '../server/bl/agent/llm.ts';

/** A transport failure as the Gemini client throws it */
const statusError = (status: number) => Object.assign(new Error(`status ${status}`), { status });

describe('callLlm deadline', () => {
  it('a passed deadline throws LlmDeadlineError without calling the model', async () => {
    const transport = vi.fn();
    configureLlm({ transport });
    await expect(
      callLlm({ messages: [{ role: 'user', content: 'deadline-passed' }], deadline: Date.now() - 1 })
    ).rejects.toBeInstanceOf(LlmDeadlineError);
    expect(transport).not.toHaveBeenCalled();
  });

  it('a 503 with no time left for the backoff does not retry', async () => {
    const transport = vi.fn().mockRejectedValue(statusError(503));
    configureLlm({ transport });
    await expect(
      callLlm({ messages: [{ role: 'user', content: 'no-time-to-retry' }], deadline: Date.now() + 500 })
    ).rejects.toBeInstanceOf(LlmDeadlineError);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('sends the time left to the model client as budgetMs', async () => {
    const transport = vi.fn().mockResolvedValue({ text: 'שלום' });
    configureLlm({ transport });
    const res = await callLlm({ messages: [{ role: 'user', content: 'budget' }], deadline: Date.now() + 20000 });
    expect(res.text).toBe('שלום');
    const request = transport.mock.calls[0][0];
    expect(request.budgetMs).toBeGreaterThan(0);
    expect(request.budgetMs).toBeLessThanOrEqual(20000);
  });

  it('without a deadline no budget is sent', async () => {
    const transport = vi.fn().mockResolvedValue({ text: 'ok' });
    configureLlm({ transport });
    await callLlm({ messages: [{ role: 'user', content: 'no-deadline' }] });
    expect(transport.mock.calls[0][0].budgetMs).toBeUndefined();
  });

  it('fails clearly when no transport is configured', async () => {
    configureLlm({ transport: undefined as never });
    await expect(callLlm({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow('not configured');
  });
});
