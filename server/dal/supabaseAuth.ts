/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Supabase Auth (GoTrue REST), called only from the server. The browser never gets a Supabase key:
 * it logs in through /api/auth and holds the tokens only as httpOnly cookies.
 * Request and response bodies hold credentials and are never logged.
 */

import type { AuthAttempt, AuthGateway } from './types.ts';

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
}
