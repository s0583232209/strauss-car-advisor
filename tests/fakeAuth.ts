/**
 * Test helpers: an in-memory stand-in for Supabase Auth and the app_users roles, and a login
 * through the real /api/auth/login route. Not a test file itself.
 */

import type { UserRole } from '../shared/types.ts';
import type { AuthAttempt, AuthGateway, CreateUserAttempt } from '../server/dal/types.ts';

export const PASSWORD = 'correct horse battery';

export class FakeGateway implements AuthGateway {
  users = new Map([
    ['employee1@example.com', 'u-employee'],
    ['employee2@example.com', 'u-employee2'],
    ['rep@example.com', 'u-rep'],
    ['admin@example.com', 'u-admin'],
    ['norole@example.com', 'u-norole'],
  ]);
  access = new Map<string, string>(); // access token → user id
  refreshTokens = new Map<string, string>(); // refresh token → user id
  getUserCalls = 0;
  signedOut: string[] = [];
  rateLimited = false;
  /** Passwords of users made with createUser; the seeded users all use PASSWORD */
  passwords = new Map<string, string>();
  /** createUser answers weak_password for this password */
  weakPassword = 'password123';
  deleted: string[] = [];
  private n = 0;

  private emailOf(userId: string): string {
    return [...this.users].find(([, id]) => id === userId)![0];
  }

  private issue(userId: string): AuthAttempt {
    const n = ++this.n;
    this.access.set(`at-${n}`, userId);
    this.refreshTokens.set(`rt-${n}`, userId);
    return { ok: true, tokens: { accessToken: `at-${n}`, refreshToken: `rt-${n}`, expiresIn: 3600, user: { id: userId, email: this.emailOf(userId) } } };
  }

  async signInWithPassword(email: string, password: string): Promise<AuthAttempt> {
    if (this.rateLimited) return { ok: false, reason: 'rate_limited' };
    const id = this.users.get(email);
    return id && password === (this.passwords.get(email) ?? PASSWORD) ? this.issue(id) : { ok: false, reason: 'invalid' };
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
    return id ? { id, email: this.emailOf(id) } : null;
  }

  async signOut(accessToken: string) {
    this.signedOut.push(accessToken);
    this.access.delete(accessToken);
  }

  async createUser(email: string, password: string): Promise<CreateUserAttempt> {
    if (this.users.has(email)) return { ok: false, reason: 'exists' };
    if (password === this.weakPassword) return { ok: false, reason: 'weak_password' };
    const id = `u-new-${++this.n}`;
    this.users.set(email, id);
    this.passwords.set(email, password);
    return { ok: true, user: { id, email } };
  }

  async deleteUser(userId: string) {
    this.deleted.push(userId);
    for (const [email, id] of this.users) if (id === userId) this.users.delete(email);
  }
}

const roles: Record<string, UserRole> = { 'u-employee': 'employee', 'u-employee2': 'employee', 'u-rep': 'rep', 'u-admin': 'admin' };
/** app_users: norole@example.com has no row; setUserRole adds rows for users made in a test */
export const roleRepo = {
  getUserRole: async (id: string) => roles[id] ?? null,
  setUserRole: async (id: string, role: UserRole) => {
    roles[id] = role;
  },
};

/** Logs in through the API and returns the "name=value" cookies for the next requests */
export async function loginCookie(apiBase: string, email: string): Promise<string> {
  const res = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (res.status !== 200) throw new Error(`login ${email} failed (${res.status})`);
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}
