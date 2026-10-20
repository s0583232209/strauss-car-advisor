/**
 * Car pros and cons: the model draft is cleaned (no numbers, at most 3 per side), only the admin
 * drafts and approves, and employees see approved text of the active catalog only.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AdminHighlightsRow, Car, CarHighlights } from '../shared/types.ts';
import { createApp } from '../server/api/app.ts';
import { getCatalog, resetReferenceData, setReferenceData } from '../server/bl/engine/referenceData.ts';
import { highlightsPrompt } from '../server/bl/llm/gemini.ts';
import { createAdminService } from '../server/bl/services/adminService.ts';
import { createAuthService } from '../server/bl/services/authService.ts';
import { cleanDraft, createHighlightsService, type HighlightsDrafter } from '../server/bl/services/highlightsService.ts';
import { createSessionService } from '../server/bl/services/sessionService.ts';
import { createTicketService } from '../server/bl/services/ticketService.ts';
import { FileRepository } from '../server/dal/fileRepository.ts';
import { FakeGateway, loginCookie, roleRepo } from './fakeAuth.ts';

describe('cleanDraft', () => {
  it('keeps at most 3 short lines per side, without numbers, bullets or repeats', () => {
    const draft = cleanDraft({
      pros: ['- נסיעה שקטה', 'נסיעה שקטה', 'טווח של 400 ק"מ', '  תא   מטען מרווח ', 'נוח בעיר', 'בטיחות טובה'],
      cons: ['• טעינה ארוכה', 7, 'א'.repeat(200), 'מושב אחורי צפוף'],
    });
    expect(draft).toEqual({
      pros: ['נסיעה שקטה', 'תא מטען מרווח', 'נוח בעיר'],
      cons: ['טעינה ארוכה', 'מושב אחורי צפוף'],
    });
  });

  it('an answer that is not { pros, cons } gives empty lists', () => {
    expect(cleanDraft(null)).toEqual({ pros: [], cons: [] });
    expect(cleanDraft({ pros: 'נסיעה שקטה' })).toEqual({ pros: [], cons: [] });
  });
});

describe('highlightsPrompt', () => {
  it('sends only the car identity, never its price or benefit value', () => {
    const car = getCatalog().find((c) => c.id === 'CAR-03')!;
    const prompt = highlightsPrompt(car);
    expect(prompt).toContain('BYD DOLPHIN');
    expect(prompt).not.toContain(String(car.listPrice));
    expect(prompt).not.toContain(String(car.benefit));
  });
});

describe('car highlights API', () => {
  let dataDir: string;
  let base: string;
  let admin: string;
  let employee: string;
  let server: Server;
  let modelAnswer: () => Promise<unknown>;
  const drafted: string[] = [];

  const drafter: HighlightsDrafter = async (car: Car) => {
    drafted.push(car.id);
    return modelAnswer();
  };
  const goodAnswer = async () => ({
    pros: ['נסיעה שקטה', 'חסכוני בעיר', 'מולטימדיה נוחה'],
    cons: ['תא מטען קטן', 'טעינה בדרכים', 'מושב אחורי צפוף'],
  });

  const call = (method: string, url: string, cookie: string, body?: unknown) =>
    fetch(`${base}${url}`, {
      method,
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const approvedForEmployee = async () => (await (await call('GET', '/highlights', employee)).json()) as Record<string, CarHighlights>;

  async function start(withDrafter: boolean) {
    const repo = new FileRepository(dataDir);
    const adminService = createAdminService(repo);
    await adminService.init();
    const app = createApp({
      config: { isProduction: false, trustProxy: false, allowedOrigins: [] },
      sessions: createSessionService(repo),
      tickets: createTicketService(repo),
      admin: adminService,
      auth: createAuthService(new FakeGateway(), roleRepo),
      highlights: createHighlightsService(repo, withDrafter ? drafter : null, () => 1_000),
      extractPayslip: async () => ({}),
    });
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    admin = await loginCookie(base, 'admin@example.com');
    employee = await loginCookie(base, 'employee1@example.com');
  }

  beforeAll(() => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'yoetz-highlights-'));
  });

  beforeEach(async () => {
    rmSync(dataDir, { recursive: true, force: true });
    drafted.length = 0;
    modelAnswer = goodAnswer;
    await start(true);
  });

  afterEach(() => {
    server.close();
    resetReferenceData('catalog');
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('a draft is hidden from employees until the admin approves it', async () => {
    const res = await call('POST', '/admin/highlights/CAR-03/draft', admin);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ carId: 'CAR-03', status: 'draft', carLabel: 'בי ווי די BYD DOLPHIN 2025' });
    expect(drafted).toEqual(['CAR-03']);
    expect(await approvedForEmployee()).toEqual({});

    const rows = (await (await call('GET', '/admin/highlights', admin)).json()) as AdminHighlightsRow[];
    expect(rows).toHaveLength(getCatalog().length);
    expect(rows.find((r) => r.carId === 'CAR-03')).toMatchObject({ stale: false, record: { status: 'draft' } });

    const edited = { pros: ['נסיעה שקטה', 'חסכוני בעיר'], cons: ['תא מטען קטן'] };
    expect((await call('PUT', '/admin/highlights/CAR-03', admin, edited)).status).toBe(200);
    expect(await approvedForEmployee()).toEqual({ 'CAR-03': edited });
  });

  it('approved text is kept after a restart and removed on delete', async () => {
    await call('PUT', '/admin/highlights/CAR-01', admin, { pros: ['קטן ונוח לחנייה'], cons: ['מנוע חלש בעליות'] });
    server.close();
    await start(true);
    expect(Object.keys(await approvedForEmployee())).toEqual(['CAR-01']);

    expect((await call('DELETE', '/admin/highlights/CAR-01', admin)).status).toBe(204);
    expect(await approvedForEmployee()).toEqual({});
  });

  it('text written for another car under the same id is not shown and is marked stale', async () => {
    await call('PUT', '/admin/highlights/CAR-03', admin, { pros: ['נסיעה שקטה'], cons: ['טעינה בדרכים'] });
    setReferenceData(
      'catalog',
      getCatalog().map((c) => (c.id === 'CAR-03' ? { ...c, model: 'BYD ATTO 3' } : c))
    );
    expect(await approvedForEmployee()).toEqual({});
    const rows = (await (await call('GET', '/admin/highlights', admin)).json()) as AdminHighlightsRow[];
    expect(rows.find((r) => r.carId === 'CAR-03')?.stale).toBe(true);
  });

  it('only the admin may draft or approve; every user may read', async () => {
    expect((await call('POST', '/admin/highlights/CAR-03/draft', employee)).status).toBe(403);
    expect((await call('PUT', '/admin/highlights/CAR-03', employee, { pros: ['א'], cons: ['ב'] })).status).toBe(403);
    expect((await call('GET', '/highlights', employee)).status).toBe(200);
    expect(drafted).toEqual([]);
  });

  it('rejects an unknown car and an invalid approval', async () => {
    expect((await call('POST', '/admin/highlights/CAR-99/draft', admin)).status).toBe(404);
    const four = { pros: ['א', 'ב', 'ג', 'ד'], cons: ['ה'] };
    expect((await call('PUT', '/admin/highlights/CAR-03', admin, four)).status).toBe(400);
    expect((await call('PUT', '/admin/highlights/CAR-03', admin, { pros: [' '], cons: ['ה'] })).status).toBe(400);
    expect((await call('PUT', '/admin/highlights/CAR-03', admin, { pros: ['א'], cons: ['ב'], extra: 1 })).status).toBe(400);
  });

  it('a model failure or an answer with only numbers saves nothing and tells the admin why', async () => {
    modelAnswer = async () => {
      throw Object.assign(new Error('quota'), { status: 429 });
    };
    const failed = await call('POST', '/admin/highlights/CAR-03/draft', admin);
    expect(failed.status).toBe(503);
    expect((await failed.json()).error).toContain('המודל לא זמין');

    modelAnswer = async () => ({ pros: ['טווח של 400 ק"מ'], cons: ['רק 5 מושבים'] });
    const invalid = await call('POST', '/admin/highlights/CAR-03/draft', admin);
    expect(invalid.status).toBe(502);
    expect((await invalid.json()).error).toContain('טיוטה לא תקינה');

    const rows = (await (await call('GET', '/admin/highlights', admin)).json()) as AdminHighlightsRow[];
    expect(rows.every((r) => r.record === null)).toBe(true);
  });

  it('without a Gemini key drafting is refused with a message; manual approval still works', async () => {
    server.close();
    await start(false);
    const res = await call('POST', '/admin/highlights/CAR-03/draft', admin);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain('Gemini');
    expect((await call('PUT', '/admin/highlights/CAR-03', admin, { pros: ['א'], cons: ['ב'] })).status).toBe(200);
  });
});
