/**
 * Adding users (admin only): the auth service with a fake identity provider, and POST /api/admin/users.
 * No network: the fake gateway stands in for Supabase Auth.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthUser } from '../shared/types.ts';
import { createApp } from '../server/api/app.ts';
import { createAdminService } from '../server/bl/services/adminService.ts';
import { createAuthService, type AuthService } from '../server/bl/services/authService.ts';
import { createSessionService } from '../server/bl/services/sessionService.ts';
import { createTicketService } from '../server/bl/services/ticketService.ts';
import { FileRepository } from '../server/dal/fileRepository.ts';
import { FakeGateway, loginCookie, roleRepo } from './fakeAuth.ts';

const NEW_PASSWORD = 'Strong-pass-42';

describe('auth service: createUser', () => {
  it('creates the user with the role, and they can log in at once', async () => {
    const auth = createAuthService(new FakeGateway(), roleRepo);
    const user = await auth.createUser('svc-new@example.com', NEW_PASSWORD, 'rep');
    expect(user).toMatchObject({ email: 'svc-new@example.com', role: 'rep' });
    expect((await auth.login('svc-new@example.com', NEW_PASSWORD)).user).toEqual(user);
  });

  it('an existing email is 409 and a weak password is 400', async () => {
    const gateway = new FakeGateway();
    const auth = createAuthService(gateway, roleRepo);
    expect((await auth.createUser('rep@example.com', NEW_PASSWORD, 'employee').catch((e) => e)).status).toBe(409);
    expect((await auth.createUser('svc-weak@example.com', gateway.weakPassword, 'employee').catch((e) => e)).status).toBe(400);
  });

  it('when saving the role fails, the new user is deleted so the admin can try again', async () => {
    const gateway = new FakeGateway();
    const failing = { ...roleRepo, setUserRole: async () => Promise.reject(new Error('db down')) };
    const auth = createAuthService(gateway, failing);
    await expect(auth.createUser('svc-undo@example.com', NEW_PASSWORD, 'admin')).rejects.toThrow('db down');
    expect(gateway.deleted).toHaveLength(1);
    expect(gateway.users.has('svc-undo@example.com')).toBe(false);
  });
});

describe('POST /api/admin/users', () => {
  let dataDir: string;
  const servers: Server[] = [];

  async function start(auth: AuthService | null): Promise<string> {
    const repo = new FileRepository(dataDir);
    const app = createApp({
      config: { isProduction: false, trustProxy: false, allowedOrigins: [] },
      sessions: createSessionService(repo),
      tickets: createTicketService(repo),
      admin: createAdminService(repo),
      auth,
      extractPayslip: async () => ({}),
    });
    const server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    servers.push(server);
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  }

  beforeAll(() => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'yoetz-users-'));
  });

  afterAll(() => {
    for (const s of servers) s.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  const create = (base: string, body: unknown, cookie?: string) =>
    fetch(`${base}/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    });

  it('an admin adds a user, who can then log in with the role that was chosen', async () => {
    const base = await start(createAuthService(new FakeGateway(), roleRepo));
    const admin = await loginCookie(base, 'admin@example.com');
    const res = await create(base, { email: ' API-New@Example.com ', password: NEW_PASSWORD, role: 'rep' }, admin);
    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const user = (await res.json()) as AuthUser;
    expect(user).toMatchObject({ email: 'api-new@example.com', role: 'rep' });
    expect(JSON.stringify(user)).not.toContain(NEW_PASSWORD);

    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'api-new@example.com', password: NEW_PASSWORD }),
    });
    expect(login.status).toBe(200);
    expect(((await login.json()) as AuthUser).role).toBe('rep');
  });

  it('only admins: no login 401, employee and rep 403', async () => {
    const base = await start(createAuthService(new FakeGateway(), roleRepo));
    const body = { email: 'api-denied@example.com', password: NEW_PASSWORD, role: 'admin' };
    expect((await create(base, body)).status).toBe(401);
    expect((await create(base, body, await loginCookie(base, 'employee1@example.com'))).status).toBe(403);
    expect((await create(base, body, await loginCookie(base, 'rep@example.com'))).status).toBe(403);
  });

  it('existing email 409, invalid bodies 400', async () => {
    const base = await start(createAuthService(new FakeGateway(), roleRepo));
    const admin = await loginCookie(base, 'admin@example.com');
    expect((await create(base, { email: 'rep@example.com', password: NEW_PASSWORD, role: 'employee' }, admin)).status).toBe(409);
    expect((await create(base, { email: 'not-an-email', password: NEW_PASSWORD, role: 'employee' }, admin)).status).toBe(400);
    expect((await create(base, { email: 'api-short@example.com', password: 'short', role: 'employee' }, admin)).status).toBe(400);
    expect((await create(base, { email: 'api-role@example.com', password: NEW_PASSWORD, role: 'owner' }, admin)).status).toBe(400);
    expect((await create(base, { email: 'api-extra@example.com', password: NEW_PASSWORD, role: 'employee', id: 'x' }, admin)).status).toBe(400);
  });

  it('without Supabase there are no users to add: 503 with a message', async () => {
    const base = await start(null);
    const res = await create(base, { email: 'api-dev@example.com', password: NEW_PASSWORD, role: 'employee' });
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toMatch(/Supabase/);
  });
});
