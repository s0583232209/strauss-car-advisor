/**
 * End-to-end through the API layer: real routes, real business services, a file repository in a
 * temporary folder, and a fake model (no network).
 */

import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ChatStreamEvent, SessionState, SupportTicket } from '../shared/types.ts';
import { createApp } from '../server/api/app.ts';
import { configureLlm } from '../server/bl/agent/llm.ts';
import { createAdminService } from '../server/bl/services/adminService.ts';
import { createSessionService } from '../server/bl/services/sessionService.ts';
import { createTicketService } from '../server/bl/services/ticketService.ts';
import { FileRepository } from '../server/dal/fileRepository.ts';

const REP_TOKEN = 'rep-token-for-tests-123';
const ADMIN_TOKEN = 'admin-token-for-tests-456';

let server: Server;
let base: string;
let dataDir: string;
let modelCalls = 0;

beforeAll(async () => {
  process.env.AGENT_DEBUG_LOG = 'off';
  dataDir = mkdtempSync(path.join(os.tmpdir(), 'yoetz-api-'));
  const repo = new FileRepository(dataDir);
  // Fake model: always answers with plain text (no tools, no numbers)
  configureLlm({
    transport: async () => {
      modelCalls++;
      return { text: 'קיבלתי, ממשיכים.', model: 'fake-model' };
    },
  });
  const app = createApp({
    config: { isProduction: false, trustProxy: false, allowedOrigins: ['https://allowed.example'], repAccessToken: REP_TOKEN, adminAccessToken: ADMIN_TOKEN },
    sessions: createSessionService(repo),
    tickets: createTicketService(repo),
    admin: createAdminService(repo),
    extractPayslip: async () => ({ base: { value: 15000, confidence: 'high', sourceQuote: 'שכר יסוד' }, injected: { value: 'x' } }),
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(() => {
  server?.close();
  rmSync(dataDir, { recursive: true, force: true });
});

const call = (method: string, p: string, body?: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}${p}`, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

async function newSession(): Promise<SessionState> {
  const res = await call('POST', '/sessions');
  expect(res.status).toBe(201);
  return res.json();
}

async function sendMessage(id: string, text: string): Promise<{ events: ChatStreamEvent[]; session: SessionState }> {
  const res = await call('POST', `/sessions/${id}/messages`, { text });
  expect(res.headers.get('content-type')).toContain('application/x-ndjson');
  const events = (await res.text()).trim().split('\n').map((l) => JSON.parse(l) as ChatStreamEvent);
  const result = events.find((e) => e.type === 'result');
  if (!result || result.type !== 'result') throw new Error('no result event');
  return { events, session: result.session };
}

describe('sessions API', () => {
  it('a new session starts with the greeting and an empty profile, and never exposes agent state', async () => {
    const s = await newSession();
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].role).toBe('assistant');
    expect(s.profile).toEqual({});
    expect(Object.keys(s).sort()).toEqual(['id', 'lastComparison', 'messages', 'profile']);
  });

  it('a message runs one agent turn on the server and streams status lines before the result', async () => {
    const s = await newSession();
    const before = modelCalls;
    const { events, session } = await sendMessage(s.id, 'שלום, אני רוצה לעבור לרכב חשמלי');
    expect(modelCalls).toBeGreaterThan(before);
    expect(events.some((e) => e.type === 'status')).toBe(true);
    expect(events[events.length - 1].type).toBe('result');
    expect(session.messages.map((m) => m.role)).toEqual(['assistant', 'user', 'assistant']);
    expect(session.messages[2].content).toBe('קיבלתי, ממשיכים.');
    // Saved on the server: a fresh read shows the same conversation
    const reread: SessionState = await (await call('GET', `/sessions/${s.id}`)).json();
    expect(reread.messages).toHaveLength(3);
  });

  it('message ids are unique across sessions (one shared database)', async () => {
    const a = await newSession();
    const b = await newSession();
    expect(a.messages[0].id).not.toBe(b.messages[0].id);
  });

  it('rejects malformed ids, unknown sessions and invalid bodies', async () => {
    expect((await call('GET', '/sessions/not-a-uuid')).status).toBe(400);
    expect((await call('GET', '/sessions/00000000-0000-4000-8000-000000000000')).status).toBe(404);
    const s = await newSession();
    expect((await call('POST', `/sessions/${s.id}/messages`, { text: '' })).status).toBe(400);
    expect((await call('POST', `/sessions/${s.id}/messages`, { text: 'x'.repeat(2001) })).status).toBe(400);
    expect((await call('POST', `/sessions/${s.id}/messages`, { text: 'hi', extra: 1 })).status).toBe(400);
  });

  it('profile edits are validated: unknown fields, negative or out-of-range numbers are refused', async () => {
    const s = await newSession();
    expect((await call('PATCH', `/sessions/${s.id}/profile`, { updates: { base: -5 } })).status).toBe(400);
    expect((await call('PATCH', `/sessions/${s.id}/profile`, { updates: { pensionPct: 60 } })).status).toBe(400);
    expect((await call('PATCH', `/sessions/${s.id}/profile`, { updates: { isAdmin: true } })).status).toBe(400);
    const ok = await call('PATCH', `/sessions/${s.id}/profile`, { updates: { base: 14200, group: 'ב' } });
    expect(ok.status).toBe(200);
    expect((await ok.json()).profile).toMatchObject({ base: 14200, group: 'ב' });
  });

  it('a sample employee loads a baseline comparison computed by the server engine', async () => {
    const s = await newSession();
    const res = await call('POST', `/sessions/${s.id}/sample`, { employeeId: 'E-001' });
    expect(res.status).toBe(200);
    const state: SessionState = await res.json();
    expect(state.profile.id).toBe('E-001');
    expect(state.lastComparison).not.toBeNull();
    expect((await call('POST', `/sessions/${s.id}/sample`, { employeeId: 'NOPE-1' })).status).toBe(404);
  });
});

describe('rep flow: ask → answer → delivered to the chat', () => {
  it('asking a rep needs a comparison; the answer reaches the chat once on sync', async () => {
    const s = await newSession();
    expect((await call('POST', `/sessions/${s.id}/tickets`)).status).toBe(409);

    await call('POST', `/sessions/${s.id}/sample`, { employeeId: 'E-001' });
    const asked: SessionState = await (await call('POST', `/sessions/${s.id}/tickets`)).json();
    const ticketId = asked.messages[asked.messages.length - 1].content.match(/TICK-\d+/)?.[0];
    expect(ticketId).toBeDefined();

    // The queue is protected; the badge count is public
    expect((await call('GET', '/tickets')).status).toBe(401);
    expect((await call('GET', '/tickets', undefined, { Authorization: 'Bearer wrong-token-0000000' })).status).toBe(401);
    expect((await (await call('GET', '/tickets/summary')).json()).open).toBeGreaterThanOrEqual(1);
    const queue: SupportTicket[] = await (await call('GET', '/tickets', undefined, { Authorization: `Bearer ${REP_TOKEN}` })).json();
    expect(queue.some((t) => t.id === ticketId)).toBe(true);

    const answered = await call('POST', `/tickets/${ticketId}/answer`, { status: 'answered', text: 'אושר' }, { Authorization: `Bearer ${REP_TOKEN}` });
    expect(answered.status).toBe(200);

    const synced: SessionState = await (await call('POST', `/sessions/${s.id}/sync`, {})).json();
    const repMessages = synced.messages.filter((m) => m.role === 'rep');
    expect(repMessages).toHaveLength(1);
    expect(repMessages[0].content).toContain('אושר');
    // A second sync does not deliver it again
    const again: SessionState = await (await call('POST', `/sessions/${s.id}/sync`, {})).json();
    expect(again.messages.filter((m) => m.role === 'rep')).toHaveLength(1);
  });
});

describe('admin API', () => {
  it('requires the admin token, and the rep token is not enough', async () => {
    expect((await call('GET', '/admin/overview')).status).toBe(401);
    expect((await call('GET', '/admin/overview', undefined, { Authorization: `Bearer ${REP_TOKEN}` })).status).toBe(401);
    const res = await call('GET', '/admin/overview', undefined, { Authorization: `Bearer ${ADMIN_TOKEN}` });
    expect(res.status).toBe(200);
    const overview = await res.json();
    expect(overview.catalog.length).toBeGreaterThan(0);
    expect(overview.storage).toBe('file');
  });

  it('refuses rules without the fields the engine needs', async () => {
    const res = await call('PUT', '/admin/rules', { rules: { budgets: {} } }, { Authorization: `Bearer ${ADMIN_TOKEN}` });
    expect(res.status).toBe(400);
  });

  it('imports a Tax Authority CSV on the server and looks a record up', async () => {
    const csv = 'שנת רישום,קוד סוג רכב,קוד תוצר,קוד דגם,כינוי מסחרי,שווי שימוש,מחיר מחירון\n2025,1,99999,00001,TEST CAR,1234,150000\n';
    const auth = { Authorization: `Bearer ${ADMIN_TOKEN}` };
    // The real file is windows-1255: Hebrew letters U+05D0–U+05EA are bytes 0xE0–0xFA
    const cp1255 = Uint8Array.from([...csv].map((ch) => (ch >= 'א' && ch <= 'ת' ? 0xe0 + ch.charCodeAt(0) - 0x5d0 : ch.charCodeAt(0))));
    const up = await fetch(`${base}/admin/tax-records`, { method: 'POST', headers: { 'Content-Type': 'text/csv', ...auth }, body: cp1255 });
    expect(up.status).toBe(200);
    expect((await up.json()).count).toBe(1);
    const found = await (await call('GET', '/admin/tax-records/lookup?year=2025&type=1&product=99999&model=00001', undefined, auth)).json();
    expect(found.result).toMatchObject({ value: 1234, commercialName: 'TEST CAR', listPrice: 150000 });
    expect((await call('DELETE', '/admin/tax-records', undefined, auth)).status).toBe(204);
  });
});

describe('payslip API', () => {
  it('validates the file and returns only the known fields', async () => {
    expect((await call('POST', '/payslip/extract', { fileData: 'aGVsbG8=', mimeType: 'text/html' })).status).toBe(400);
    expect((await call('POST', '/payslip/extract', { fileData: 'not base64!', mimeType: 'image/png' })).status).toBe(400);
    const res = await call('POST', '/payslip/extract', { fileData: 'aGVsbG8=', mimeType: 'image/png' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.base).toEqual({ value: 15000, confidence: 'high', sourceQuote: 'שכר יסוד' });
    expect(data.injected).toBeUndefined();
    expect(data.pensionPct).toEqual({ value: null, confidence: 'low', sourceQuote: '' });
  });
});

describe('API security', () => {
  it('refuses cross-origin requests from origins not on the list, allows listed ones', async () => {
    expect((await call('GET', '/meta', undefined, { Origin: 'https://evil.example' })).status).toBe(403);
    const ok = await call('GET', '/meta', undefined, { Origin: 'https://allowed.example' });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://allowed.example');
  });

  it('sets security headers and hides the framework', async () => {
    const res = await call('GET', '/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  it('the old open model proxy no longer exists', async () => {
    expect((await call('POST', '/gemini/generate', { messages: [] })).status).toBe(404);
  });

  it('oversized JSON bodies are refused', async () => {
    const s = await newSession();
    const res = await call('PATCH', `/sessions/${s.id}/profile`, { updates: { occupation: 'x'.repeat(200_000) } });
    expect(res.status).toBe(413);
  });
});
