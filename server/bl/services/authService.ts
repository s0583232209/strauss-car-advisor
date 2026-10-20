/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Login, current user, refresh and logout. The identity provider checks passwords; the role comes
 * from our own app_users table, so a user without a row cannot use the app.
 * Verified access tokens are cached briefly so not every request costs a call to the provider.
 */

import { createHash } from 'node:crypto';
import type { AuthUser, UserRole } from '../../../shared/types.ts';
import type { AuthGateway, AuthTokens, Repository } from '../../dal/index.ts';

// The API layer gets the token shape from here, never from the DAL
export type { AuthTokens };

/** Error with a status and a message the employee may see */
export class AuthError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export interface AuthResult {
  tokens: AuthTokens;
  user: AuthUser;
}

export interface AuthService {
  login(email: string, password: string): Promise<AuthResult>;
  /** The user behind an access token; null when it is invalid, expired or has no role */
  verify(accessToken: string): Promise<AuthUser | null>;
  /** New tokens from a refresh token; null when it is invalid or used */
  refresh(refreshToken: string): Promise<AuthResult | null>;
  logout(accessToken: string): Promise<void>;
  /** Admin: a new user who can log in at once with this password and role */
  createUser(email: string, password: string, role: UserRole): Promise<AuthUser>;
}

const VERIFY_CACHE_MS = 60_000;
const VERIFY_CACHE_MAX = 5_000;

const tokenKey = (token: string) => createHash('sha256').update(token).digest('base64url');

export function createAuthService(
  gateway: AuthGateway,
  repo: Pick<Repository, 'getUserRole' | 'setUserRole'>,
  now: () => number = Date.now
): AuthService {
  const cache = new Map<string, { user: AuthUser; until: number }>();

  function remember(token: string, user: AuthUser) {
    if (cache.size >= VERIFY_CACHE_MAX) {
      const t = now();
      for (const [k, v] of cache) if (v.until <= t) cache.delete(k);
      // Still full: drop the oldest entries (Map keeps insertion order)
      for (const k of cache.keys()) {
        if (cache.size < VERIFY_CACHE_MAX) break;
        cache.delete(k);
      }
    }
    cache.set(tokenKey(token), { user, until: now() + VERIFY_CACHE_MS });
  }

  async function withRole(tokens: AuthTokens): Promise<AuthResult | null> {
    const role = await repo.getUserRole(tokens.user.id);
    if (!role) return null;
    const user: AuthUser = { id: tokens.user.id, email: tokens.user.email, role };
    remember(tokens.accessToken, user);
    return { tokens, user };
  }

  return {
    async login(email, password) {
      const attempt = await gateway.signInWithPassword(email, password);
      if (!attempt.ok) {
        if (attempt.reason === 'rate_limited') throw new AuthError(429, 'יותר מדי ניסיונות כניסה. נסו שוב בעוד כמה דקות.');
        throw new AuthError(401, 'אימייל או סיסמה שגויים');
      }
      const result = await withRole(attempt.tokens);
      if (!result) {
        await gateway.signOut(attempt.tokens.accessToken);
        throw new AuthError(403, 'למשתמש זה אין הרשאה למערכת. פנו למנהל המערכת.');
      }
      return result;
    },

    async verify(accessToken) {
      const hit = cache.get(tokenKey(accessToken));
      if (hit && hit.until > now()) return hit.user;
      const u = await gateway.getUser(accessToken);
      if (!u) return null;
      const role = await repo.getUserRole(u.id);
      if (!role) return null;
      const user: AuthUser = { id: u.id, email: u.email, role };
      remember(accessToken, user);
      return user;
    },

    async refresh(refreshToken) {
      const attempt = await gateway.refresh(refreshToken);
      return attempt.ok ? withRole(attempt.tokens) : null;
    },

    async logout(accessToken) {
      cache.delete(tokenKey(accessToken));
      await gateway.signOut(accessToken);
    },

    async createUser(email, password, role) {
      const created = await gateway.createUser(email, password);
      if (!created.ok) {
        if (created.reason === 'exists') throw new AuthError(409, 'כבר קיים משתמש עם האימייל הזה');
        if (created.reason === 'weak_password') throw new AuthError(400, 'הסיסמה חלשה מדי. בחרו סיסמה ארוכה ומגוונת יותר.');
        throw new AuthError(400, 'לא ניתן ליצור משתמש עם הפרטים האלה');
      }
      try {
        await repo.setUserRole(created.user.id, role);
      } catch (err) {
        // Without a role the user could never log in: undo, so the admin can simply try again
        await gateway.deleteUser(created.user.id).catch(() => undefined);
        throw err;
      }
      return { id: created.user.id, email: created.user.email, role };
    },
  };
}
