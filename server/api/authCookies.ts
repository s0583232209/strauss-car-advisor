/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Auth tokens travel only as httpOnly cookies: page scripts cannot read them, and SameSite=Strict
 * keeps other sites from sending them. The refresh token is sent only to /api/auth.
 */

import type { Request, Response } from 'express';
import type { AuthUser } from '../../shared/types.ts';
import type { AuthService } from '../bl/services/authService.ts';
import type { AuthTokens } from '../dal/index.ts';

export const ACCESS_COOKIE = 'yoetz_at';
export const REFRESH_COOKIE = 'yoetz_rt';
const ACCESS_PATH = '/api';
const REFRESH_PATH = '/api/auth';
const REFRESH_MAX_AGE_S = 7 * 24 * 60 * 60;

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      const value = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(value) || undefined;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function cookie(name: string, value: string, path: string, maxAgeS: number, secure: boolean): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAgeS}`,
    'HttpOnly',
    'SameSite=Strict',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export function setAuthCookies(res: Response, tokens: AuthTokens, secure: boolean): void {
  res.append('Set-Cookie', cookie(ACCESS_COOKIE, tokens.accessToken, ACCESS_PATH, Math.max(1, Math.floor(tokens.expiresIn)), secure));
  res.append('Set-Cookie', cookie(REFRESH_COOKIE, tokens.refreshToken, REFRESH_PATH, REFRESH_MAX_AGE_S, secure));
}

export function clearAuthCookies(res: Response, secure: boolean): void {
  res.append('Set-Cookie', cookie(ACCESS_COOKIE, '', ACCESS_PATH, 0, secure));
  res.append('Set-Cookie', cookie(REFRESH_COOKIE, '', REFRESH_PATH, 0, secure));
}

/**
 * The logged-in user from the access cookie. When it has expired and the request can see the
 * refresh cookie (only under /api/auth), the tokens are renewed and new cookies are set.
 */
export async function resolveUser(req: Request, res: Response, auth: AuthService, secure: boolean): Promise<AuthUser | null> {
  const access = readCookie(req, ACCESS_COOKIE);
  if (access) {
    const user = await auth.verify(access);
    if (user) return user;
  }
  const refresh = readCookie(req, REFRESH_COOKIE);
  if (!refresh) return null;
  const renewed = await auth.refresh(refresh);
  if (!renewed) {
    clearAuthCookies(res, secure);
    return null;
  }
  setAuthCookies(res, renewed.tokens, secure);
  return renewed.user;
}
