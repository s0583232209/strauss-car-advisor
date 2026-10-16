import { afterEach, describe, expect, it, vi } from 'vitest';
import { callLlm, LlmDeadlineError } from '../src/agent/llm.ts';

const reply = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('callLlm deadline', () => {
  it('a passed deadline throws LlmDeadlineError without calling the server', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      callLlm({ messages: [{ role: 'user', content: 'deadline-passed' }], deadline: Date.now() - 1 })
    ).rejects.toBeInstanceOf(LlmDeadlineError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a 503 with no time left for the backoff does not retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(503));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      callLlm({ messages: [{ role: 'user', content: 'no-time-to-retry' }], deadline: Date.now() + 500 })
    ).rejects.toBeInstanceOf(LlmDeadlineError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends the time left to the server as budgetMs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { text: 'שלום' }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await callLlm({ messages: [{ role: 'user', content: 'budget' }], deadline: Date.now() + 20000 });
    expect(res.text).toBe('שלום');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.budgetMs).toBeGreaterThan(0);
    expect(body.budgetMs).toBeLessThanOrEqual(20000);
  });

  it('without a deadline no budget is sent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { text: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);
    await callLlm({ messages: [{ role: 'user', content: 'no-deadline' }] });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).budgetMs).toBeUndefined();
  });
});
