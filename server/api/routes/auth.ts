/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Login API. Passwords go to the identity provider and are never stored or logged here.
 * Without Supabase (development with the file store) there is no login: GET /me says so.
 */

import { Router } from 'express';
import type { AuthStatus } from '../../../shared/types.ts';
import type { AuthService } from '../../bl/services/authService.ts';
import { ACCESS_COOKIE, clearAuthCookies, readCookie, resolveUser, setAuthCookies } from '../authCookies.ts';
import { asyncHandler, rateLimit } from '../middleware.ts';
import { loginBody } from '../validate.ts';

export function authRouter(auth: AuthService | null, secureCookies: boolean): Router {
  const router = Router();
  // Password guessing: a few attempts per IP; Supabase Auth adds its own limits
  const loginLimit = rateLimit({ name: 'login', windowMs: 15 * 60_000, max: 10 });

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get('/me', asyncHandler(async (req, res) => {
    const status: AuthStatus = auth
      ? { enabled: true, user: await resolveUser(req, res, auth, secureCookies) }
      : { enabled: false, user: null };
    res.json(status);
  }));

  router.post('/login', loginLimit, asyncHandler(async (req, res) => {
    if (!auth) {
      // A known state, not a failure: answered here (the error handler hides every 5xx message)
      res.status(503).json({ error: 'הכניסה אינה מוגדרת בשרת' });
      return;
    }
    const { email, password } = loginBody(req.body);
    const { tokens, user } = await auth.login(email, password);
    setAuthCookies(res, tokens, secureCookies);
    res.json(user);
  }));

  router.post('/logout', asyncHandler(async (req, res) => {
    const access = readCookie(req, ACCESS_COOKIE);
    if (auth && access) await auth.logout(access);
    clearAuthCookies(res, secureCookies);
    res.status(204).end();
  }));

  return router;
}
