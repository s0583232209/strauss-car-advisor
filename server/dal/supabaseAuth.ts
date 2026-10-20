/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Supabase Auth (GoTrue REST), called only from the server. The browser never gets a Supabase key:
 * it logs in through /api/auth and holds the tokens only as httpOnly cookies.
 * Request and response bodies hold credentials and are never logged.
 */

import type { AuthAttempt, AuthGateway, CreateUserAttempt } from './types.ts';

interface GoTrueSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email?: string };
}

export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly url: string, private readonly apiKey: string) {}

  private fetch(pathAndQuery: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`${this.url}/auth/v1/${pathAndQuery}`, {
      ...init,
      headers: { apikey: this.apiKey, 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    });
  }

  private async token(grantType: 'password' | 'refresh_token', body: unknown): Promise<AuthAttempt> {
    const res = await this.fetch(`token?grant_type=${grantType}`, { method: 'POST', body: JSON.stringify(body) });
    // 400/401: wrong credentials or a used/expired refresh token
    if (res.status === 400 || res.status === 401) return { ok: false, reason: 'invalid' };
    if (res.status === 429) return { ok: false, reason: 'rate_limited' };
    if (!res.ok) throw new Error(`Supabase Auth ${grantType} failed (${res.status})`);
    const s = (await res.json()) as GoTrueSession;
    return {
      ok: true,
      tokens: {
        accessToken: s.access_token,
        refreshToken: s.refresh_token,
        expiresIn: s.expires_in,
        user: { id: s.user.id, email: s.user.email ?? '' },
      },
    };
  }

  signInWithPassword(email: string, password: string): Promise<AuthAttempt> {
    return this.token('password', { email, password });
  }

  refresh(refreshToken: string): Promise<AuthAttempt> {
    return this.token('refresh_token', { refresh_token: refreshToken });
  }

  async getUser(accessToken: string): Promise<{ id: string; email: string } | null> {
    const res = await this.fetch('user', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) throw new Error(`Supabase Auth user failed (${res.status})`);
    const u = (await res.json()) as { id: string; email?: string };
    return { id: u.id, email: u.email ?? '' };
  }

  async signOut(accessToken: string): Promise<void> {
    // Already-expired tokens answer 401: the cookies are cleared either way
    await this.fetch('logout?scope=local', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => undefined);
  }

  // The admin endpoints accept only the service role key as the bearer token
  private admin(pathAndQuery: string, init: RequestInit): Promise<Response> {
    return this.fetch(`admin/${pathAndQuery}`, { ...init, headers: { Authorization: `Bearer ${this.apiKey}` } });
  }

  async createUser(email: string, password: string): Promise<CreateUserAttempt> {
    const res = await this.admin('users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) });
    if (res.ok) {
      const u = (await res.json()) as { id: string; email?: string };
      return { ok: true, user: { id: u.id, email: u.email ?? email } };
    }
    if (res.status === 400 || res.status === 409 || res.status === 422) {
      // Only the error code is read; the message is not logged
      const body = (await res.json().catch(() => ({}))) as { error_code?: string; code?: string; msg?: string };
      const code = body.error_code ?? body.code ?? '';
      if (code === 'email_exists' || code === 'user_already_exists' || /already been registered/i.test(body.msg ?? '')) {
        return { ok: false, reason: 'exists' };
      }
      if (code === 'weak_password') return { ok: false, reason: 'weak_password' };
      return { ok: false, reason: 'invalid' };
    }
    throw new Error(`Supabase Auth create user failed (${res.status})`);
  }

  async deleteUser(userId: string): Promise<void> {
    const res = await this.admin(`users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`Supabase Auth delete user failed (${res.status})`);
  }
}
