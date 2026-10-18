/**
 * Login: the auth service with a fake identity provider, and the /api/auth routes with their cookies.
 * No network: the fake gateway stands in for Supabase Auth.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AuthStatus, AuthUser, UserRole } from '../shared/types.ts';
import { createApp } from '../server/api/app.ts';
import { createAdminService } from '../server/bl/services/adminService.ts';
import { AuthError, createAuthService, type AuthService } from '../server/bl/services/authService.ts';
import { createSessionService } from '../server/bl/services/sessionService.ts';
import { createTicketService } from '../server/bl/services/ticketService.ts';
import { FileRepository } from '../server/dal/fileRepository.ts';
import type { AuthAttempt, AuthGateway } from '../server/dal/types.ts';

const PASSWORD = 'correct horse battery';

/** In-memory stand-in for Supabase Auth */
class FakeGateway implements AuthGateway {
  users = new Map([
    ['employee1@example.com', 'u-employee'],
    ['rep@example.com', 'u-rep'],
    ['norole@example.com', 'u-norole'],
  ]);
  access = new Map<string, string>(); // access token → user id
  refreshTokens = new Map<string, string>(); // refresh token → user id
  getUserCalls = 0;
  signedOut: string[] = [];
  rateLimited = false;
  private n = 0;

  private issue(userId: string): AuthAttempt {
    const n = ++this.n;
    this.access.set(`at-${n}`, userId);
    this.refreshTokens.set(`rt-${n}`, userId);
    const email = [...this.users].find(([, id]) => id === userId)![0];
    return { ok: true, tokens: { accessToken: `at-${n}`, refreshToken: `rt-${n}`, expiresIn: 3600, user: { id: userId, email } } };
  }

  async signInWithPassword(email: string, password: string): Promise<AuthAttempt> {
    if (this.rateLimited) return { ok: false, reason: 'rate_limited' };
    const id = this.users.get(email);
    return id && password === PASSWORD ? this.issue(id) : { ok: false, reason: 'invalid' };
  }

  async refresh(refreshToken: string): Promise<AuthAttempt> {
    const id = this.refreshTokens.get(refreshToken);
    if (!id) return { ok: false, reason: 'invalid' };
    this.refreshTokens.delete(refreshToken); // single use, like Supabase
    return this.issue(id);
  }

  async getUser(accessToken: string) {
    this.getUserCalls++;
    const id = this.access.get(accessToken);
    if (!id) return null;
    return { id, email: [...this.users].find(([, u]) => u === id)![0] };
  }

  async signOut(accessToken: string) {
    this.signedOut.push(accessToken);
    this.access.delete(accessToken);
  }
}

const roles: Record<string, UserRole> = { 'u-employee': 'employee', 'u-rep': 'rep' };
const roleRepo = { getUserRole: async (id: string) => roles[id] ?? null };

describe('auth service', () => {
  let gateway: FakeGateway;
  let clock: number;
  let auth: AuthService;

  beforeEach(() => {
    gateway = new FakeGateway();
    clock = 1_000_000;
    auth = createAuthService(gateway, roleRepo, () => clock);
  });

  it('login returns the tokens and the role from app_users', async () => {
    const { tokens, user } = await auth.login('rep@example.com', PASSWORD);
    expect(user).toEqual({ id: 'u-rep', email: 'rep@example.com', role: 'rep' });
    expect(tokens.accessToken).toBeTruthy();
  });

  it('a wrong password is 401, and the message does not say which part was wrong', async () => {
    const err = await auth.login('rep@example.com', 'wrong').catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.status).toBe(401);
    const unknown = await auth.login('nobody@example.com', PASSWORD).catch((e) => e);
    expect(unknown.message).toBe(err.message);
  });

  it('a user without an app_users row is refused and their new session is revoked', async () => {
    const err = await auth.login('norole@example.com', PASSWORD).catch((e) => e);
    expect(err.status).toBe(403);
    expect(gateway.signedOut).toHaveLength(1);
  });

  it('provider rate limiting becomes 429', async () => {
    gateway.rateLimited = true;
    expect((await auth.login('rep@example.com', PASSWORD).catch((e) => e)).status).toBe(429);
  });

  it('verify caches a token for a minute, then asks the provider again', async () => {
    const { tokens } = await auth.login('employee1@example.com', PASSWORD);
    expect(await auth.verify(tokens.accessToken)).toMatchObject({ role: 'employee' });
    expect(gateway.getUserCalls).toBe(0); // login already verified it
    clock += 61_000;
    expect(await auth.verify(tokens.accessToken)).toMatchObject({ role: 'employee' });
    expect(gateway.getUserCalls).toBe(1);
  });

  it('verify refuses unknown tokens', async () => {
    expect(await auth.verify('forged')).toBeNull();
  });

  it('logout drops the cached token, so it stops working at once', async () => {
    const { tokens } = await auth.login('employee1@example.com', PASSWORD);
    await auth.logout(tokens.accessToken);
    expect(await auth.verify(tokens.accessToken)).toBeNull();
  });

  it('a refresh token works once', async () => {
    const { tokens } = await auth.login('employee1@example.com', PASSWORD);
    const renewed = await auth.refresh(tokens.refreshToken);
    expect(renewed?.user.role).toBe('employee');
    expect(await auth.refresh(tokens.refreshToken)).toBeNull();
  });
});

describe('/api/auth', () => {
  let dataDir: string;
  const servers: Server[] = [];

  async function start(opts: { auth: AuthService | null; isProduction?: boolean }): Promise<string> {
    const repo = new FileRepository(dataDir);
    const app = createApp({
      config: { isProduction: opts.isProduction ?? false, trustProxy: false, allowedOrigins: [], repAccessToken: undefined, adminAccessToken: undefined },
      sessions: createSessionService(repo),
      tickets: createTicketService(repo),
      admin: createAdminService(repo),
      auth: opts.auth,
      extractPayslip: async () => ({}),
    });
    const server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    servers.push(server);
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth`;
  }

  beforeAll(() => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'yoetz-auth-'));
  });

  afterAll(() => {
    for (const s of servers) s.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  const post = (url: string, body?: unknown, cookie?: string) =>
    fetch(url, {
      method: 'POST',
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  const me = (base: string, cookie?: string) => fetch(`${base}/me`, { headers: cookie ? { Cookie: cookie } : {} });
  /** "name=value" pairs from Set-Cookie, for the next request */
  const cookiesOf = (res: Response) => res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

  it('login sets httpOnly, SameSite=Strict cookies and returns the user without any token', async () => {
    const base = await start({ auth: createAuthService(new FakeGateway(), roleRepo) });
    const res = await post(`${base}/login`, { email: ' Rep@Example.com ', password: PASSWORD });
    expect(res.status).toBe(200);
    const user = (await res.json()) as AuthUser;
    expect(user).toEqual({ id: 'u-rep', email: 'rep@example.com', role: 'rep' });
    expect(JSON.stringify(user)).not.toMatch(/at-|rt-/);

    const cookies = res.headers.getSetCookie();
    const access = cookies.find((c) => c.startsWith('yoetz_at='))!;
    const refresh = cookies.find((c) => c.startsWith('yoetz_rt='))!;
    expect(access).toMatch(/HttpOnly/);
    expect(access).toMatch(/SameSite=Strict/);
    expect(access).toMatch(/Path=\/api(;|$)/);
    expect(access).not.toMatch(/Secure/); // http://127.0.0.1 in development
    expect(refresh).toMatch(/Path=\/api\/auth/);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('cookies are Secure in production', async () => {
    const base = await start({ auth: createAuthService(new FakeGateway(), roleRepo), isProduction: true });
    const res = await post(`${base}/login`, { email: 'rep@example.com', password: PASSWORD });
    for (const c of res.headers.getSetCookie()) expect(c).toMatch(/; Secure/);
  });

  it('me: the user with a cookie, no user without one', async () => {
    const base = await start({ auth: createAuthService(new FakeGateway(), roleRepo) });
    expect(await (await me(base)).json()).toEqual({ enabled: true, user: null });
    const login = await post(`${base}/login`, { email: 'employee1@example.com', password: PASSWORD });
    const status = (await (await me(base, cookiesOf(login))).json()) as AuthStatus;
    expect(status).toEqual({ enabled: true, user: { id: 'u-employee', email: 'employee1@example.com', role: 'employee' } });
  });

  it('me renews an expired access token from the refresh cookie', async () => {
    const gateway = new FakeGateway();
    const base = await start({ auth: createAuthService(gateway, roleRepo) });
    const login = await post(`${base}/login`, { email: 'employee1@example.com', password: PASSWORD });
    const refreshOnly = cookiesOf(login).split('; ').filter((c) => c.startsWith('yoetz_rt=')).join('; ');
    const res = await me(base, refreshOnly);
    expect(((await res.json()) as AuthStatus).user?.role).toBe('employee');
    expect(res.headers.getSetCookie().some((c) => c.startsWith('yoetz_at=at-2'))).toBe(true);
  });

  it('a used refresh token clears the cookies', async () => {
    const base = await start({ auth: createAuthService(new FakeGateway(), roleRepo) });
    const res = await me(base, 'yoetz_rt=rt-unknown');
    expect(((await res.json()) as AuthStatus).user).toBeNull();
    expect(res.headers.getSetCookie().every((c) => /Max-Age=0/.test(c))).toBe(true);
  });

  it('logout revokes the session and clears both cookies', async () => {
    const gateway = new FakeGateway();
    const base = await start({ auth: createAuthService(gateway, roleRepo) });
    const login = await post(`${base}/login`, { email: 'rep@example.com', password: PASSWORD });
    const cookie = cookiesOf(login);
    const out = await post(`${base}/logout`, undefined, cookie);
    expect(out.status).toBe(204);
    expect(out.headers.getSetCookie()).toHaveLength(2);
    expect(out.headers.getSetCookie().every((c) => /Max-Age=0/.test(c))).toBe(true);
    expect(gateway.signedOut).toEqual(['at-1']);
    // The old access cookie no longer works
    expect(((await (await me(base, cookie.split('; ')[0])).json()) as AuthStatus).user).toBeNull();
  });

  it('wrong credentials 401, no role 403, invalid bodies 400', async () => {
    const base = await start({ auth: createAuthService(new FakeGateway(), roleRepo) });
    expect((await post(`${base}/login`, { email: 'rep@example.com', password: 'nope' })).status).toBe(401);
    expect((await post(`${base}/login`, { email: 'norole@example.com', password: PASSWORD })).status).toBe(403);
    expect((await post(`${base}/login`, { email: 'not-an-email', password: PASSWORD })).status).toBe(400);
    expect((await post(`${base}/login`, { email: 'rep@example.com' })).status).toBe(400);
    expect((await post(`${base}/login`, { email: 'rep@example.com', password: PASSWORD, role: 'admin' })).status).toBe(400);
  });

  it('login is rate limited per IP', async () => {
    const base = await start({ auth: createAuthService(new FakeGateway(), roleRepo) });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await post(`${base}/login`, { email: 'rep@example.com', password: 'nope' })).status);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('without Supabase there is no login, and me says so', async () => {
    const base = await start({ auth: null });
    expect(await (await me(base)).json()).toEqual({ enabled: false, user: null });
    expect((await post(`${base}/login`, { email: 'rep@example.com', password: PASSWORD })).status).toBe(503);
  });
});
