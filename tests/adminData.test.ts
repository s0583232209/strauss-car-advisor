/**
 * Admin uploads (end to end through the API): the data workbook and the rules file are checked and
 * compared first, change nothing until applied, then drive the calculations and survive a restart.
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import catalogData from '../server/data/catalog.json';
import defaultRules from '../server/data/strauss-rules.json';
import type { AdminOverview, Car, DataFilePreview, RulesPreview } from '../shared/types.ts';
import { createApp } from '../server/api/app.ts';
import { getCatalog, getEmployees } from '../server/bl/engine/referenceData.ts';
import { getRules } from '../server/bl/engine/rules.ts';
import { buildScenario } from '../server/bl/engine/scenario.ts';
import { createAdminService } from '../server/bl/services/adminService.ts';
import { createAuthService } from '../server/bl/services/authService.ts';
import { createSessionService } from '../server/bl/services/sessionService.ts';
import { createTicketService } from '../server/bl/services/ticketService.ts';
import { FileRepository } from '../server/dal/fileRepository.ts';
import type { Repository } from '../server/dal/index.ts';
import { FakeGateway, loginCookie, roleRepo } from './fakeAuth.ts';
import { CATALOG_HEADER, carRow, makeXlsx } from './xlsxFixture.ts';

const catalog = catalogData as Car[];
const original = readFileSync(new URL('../data/raw/catalog.xlsx', import.meta.url));
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The catalog sheet with CAR-03's benefit value changed */
const changedCatalog = (benefit: number) =>
  makeXlsx({ 'קטלוג רכבים': [CATALOG_HEADER, ...catalog.map((c) => carRow(c.id === 'CAR-03' ? { ...c, benefit } : c))] });

describe('admin data uploads', () => {
  let dataDir: string;
  let base: string;
  let admin: string;
  const servers: Server[] = [];

  async function start(dir: string): Promise<string> {
    const repo = new FileRepository(dir);
    const adminService = createAdminService(repo);
    await adminService.init();
    const app = createApp({
      config: { isProduction: false, trustProxy: false, allowedOrigins: [] },
      sessions: createSessionService(repo),
      tickets: createTicketService(repo),
      admin: adminService,
      auth: createAuthService(new FakeGateway(), roleRepo),
      extractPayslip: async () => ({}),
    });
    const server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    servers.push(server);
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  }

  const send = (url: string, method: string, body: Buffer | object, cookie = admin) =>
    fetch(url, {
      method,
      headers: { Cookie: cookie, 'Content-Type': Buffer.isBuffer(body) ? XLSX : 'application/json' },
      body: Buffer.isBuffer(body) ? new Uint8Array(body) : JSON.stringify(body),
    });
  const overview = async () => (await (await fetch(`${base}/admin/overview`, { headers: { Cookie: admin } })).json()) as AdminOverview;

  beforeAll(async () => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'yoetz-admin-data-'));
  });

  beforeEach(async () => {
    rmSync(dataDir, { recursive: true, force: true });
    base = await start(dataDir);
    admin = await loginCookie(base, 'admin@example.com');
  });

  afterAll(() => {
    for (const s of servers) s.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('the original workbook previews as unchanged data', async () => {
    const res = await send(`${base}/admin/data/preview`, 'POST', original);
    expect(res.status).toBe(200);
    const preview = (await res.json()) as DataFilePreview;
    expect(preview.canApply).toBe(true);
    expect(preview.tables.map((t) => t.kind)).toEqual(['catalog', 'occupations', 'employees']);
    const [cars, occupations, employees] = preview.tables;
    expect(cars.diff).toEqual({ added: [], removed: [], changed: [], unchanged: 20 });
    expect(occupations.diff.unchanged).toBe(14);
    // E-GEN-B exists only in employees.json
    expect(employees.diff.removed).toEqual(['E-GEN-B · שירה (מהנדסת תהליך - קבוצה ב\')']);
  });

  it('preview shows a change and saves nothing; apply makes the calculation use it, also after a restart', async () => {
    const preview = (await (await send(`${base}/admin/data/preview`, 'POST', changedCatalog(2700))).json()) as DataFilePreview;
    expect(preview.tables[0].diff.changed).toEqual([
      { row: 'CAR-03 · BYD DOLPHIN', changes: [{ field: 'שווי שימוש', before: '2590', after: '2700' }] },
    ]);
    expect(getCatalog().find((c) => c.id === 'CAR-03')?.benefit).toBe(2590);
    expect((await overview()).sources.catalog).toBe('default');

    expect((await send(`${base}/admin/data/apply`, 'POST', changedCatalog(2700))).status).toBe(200);
    const after = await overview();
    expect(after.sources.catalog).toBe('uploaded');
    expect(after.catalog.find((c) => c.id === 'CAR-03')?.benefit).toBe(2700);
    // Only the uploaded table changed
    expect(after.sources.employees).toBe('default');
    expect(getEmployees()).toHaveLength(7);

    const david = getEmployees().find((e) => e.id === 'E-002')!;
    expect(buildScenario(david, { type: 'change_car', targetCarId: 'CAR-03' }).altState.benefitValue).toBe(2700);

    // A new server on the same storage starts with the uploaded table
    base = await start(dataDir);
    admin = await loginCookie(base, 'admin@example.com');
    expect((await overview()).catalog.find((c) => c.id === 'CAR-03')?.benefit).toBe(2700);

    // Back to the built-in file
    expect((await fetch(`${base}/admin/data/catalog`, { method: 'DELETE', headers: { Cookie: admin } })).status).toBe(204);
    const reset = await overview();
    expect(reset.sources.catalog).toBe('default');
    expect(reset.catalog.find((c) => c.id === 'CAR-03')?.benefit).toBe(2590);
  });

  it('a file with errors cannot be applied and changes nothing', async () => {
    const bad = makeXlsx({ 'קטלוג רכבים': [CATALOG_HEADER, ...catalog.map((c) => carRow(c.id === 'CAR-03' ? { ...c, fuel: 'דיזל' } : c))] });
    const preview = (await (await send(`${base}/admin/data/preview`, 'POST', bad)).json()) as DataFilePreview;
    expect(preview.canApply).toBe(false);
    expect(preview.tables[0].errors[0]).toMatch(/^שורה 4, הנעה/);
    const res = await send(`${base}/admin/data/apply`, 'POST', bad);
    expect(res.status).toBe(400);
    expect((await overview()).sources.catalog).toBe('default');
  });

  it('a file that is not Excel, or has none of the sheets, is a clear 400', async () => {
    const csv = await send(`${base}/admin/data/preview`, 'POST', Buffer.from('id,name\n1,a'));
    expect(csv.status).toBe(400);
    expect(((await csv.json()) as { error: string }).error).toMatch(/Excel/);
    const other = makeXlsx({ 'גיליון1': [['a']] });
    expect(((await (await send(`${base}/admin/data/preview`, 'POST', other)).json()) as DataFilePreview).canApply).toBe(false);
    expect((await send(`${base}/admin/data/apply`, 'POST', other)).status).toBe(400);
  });

  it('only admins may upload', async () => {
    const employee = await loginCookie(base, 'employee1@example.com');
    const rep = await loginCookie(base, 'rep@example.com');
    expect((await send(`${base}/admin/data/preview`, 'POST', original, employee)).status).toBe(403);
    expect((await send(`${base}/admin/data/apply`, 'POST', original, rep)).status).toBe(403);
    expect((await fetch(`${base}/admin/data/catalog`, { method: 'DELETE', headers: { Cookie: employee } })).status).toBe(403);
    expect((await fetch(`${base}/admin/data/cars`, { method: 'DELETE', headers: { Cookie: admin } })).status).toBe(400);
  });

  it('another instance picks up an upload (and a reset) within 30 seconds', async () => {
    // Storage shared by all instances; this service plays an instance that did not do the upload
    let stored: unknown[] | null = null;
    const repo = { getRules: async () => null, getReferenceData: async (k: string) => (k === 'catalog' ? stored : null) };
    let clock = 1_000_000;
    const other = createAdminService(repo as unknown as Repository, () => clock);
    await other.init();
    const benefit = () => getCatalog().find((c) => c.id === 'CAR-03')?.benefit;

    stored = catalog.map((c) => (c.id === 'CAR-03' ? { ...c, benefit: 2800 } : c));
    clock += 10_000;
    await other.syncIfStale();
    expect(benefit()).toBe(2590);
    clock += 25_000;
    await other.syncIfStale();
    expect(benefit()).toBe(2800);

    stored = null;
    clock += 31_000;
    await other.syncIfStale();
    expect(benefit()).toBe(2590);
  });

  it('rules file: preview lists the changes in words and saves nothing; a broken file is reported', async () => {
    const rules = structuredClone(defaultRules);
    rules.budgets['א'] = 3600;
    rules.electric.netBonus = 300;
    const preview = (await (await send(`${base}/admin/rules/preview`, 'POST', { rules })).json()) as RulesPreview;
    expect(preview.errors).toEqual([]);
    expect(preview.changes).toEqual([
      { field: 'תקציב קבוצה א', before: '3500', after: '3600' },
      { field: 'החזר חשמל נטו', before: '250', after: '300' },
    ]);
    expect(getRules().budgets['א']).toBe(3500);

    const broken = (await (await send(`${base}/admin/rules/preview`, 'POST', { rules: { budgets: {} } })).json()) as RulesPreview;
    expect(broken.errors[0]).toMatch(/חסר שדות חובה/);
  });
});
