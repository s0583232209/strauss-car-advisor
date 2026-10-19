/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Cross-cutting API concerns: security headers, CORS, rate limits, errors (login: authCookies.ts) */

import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Wraps an async route so a rejected promise reaches the error handler */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/** Also used by scripts/vercel-build.mjs for the static client, which Vercel serves without Express */
export function securityHeaderValues(isProduction: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
  if (isProduction) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    // Vite's dev server needs inline scripts, so the CSP is production only
    headers['Content-Security-Policy'] = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
  }
  return headers;
}

export function securityHeaders(isProduction: boolean): RequestHandler {
  const headers = Object.entries(securityHeaderValues(isProduction));
  return (_req, res, next) => {
    for (const [name, value] of headers) res.setHeader(name, value);
    next();
  };
}

/**
 * The app's own origin is always allowed; other origins only when listed in ALLOWED_ORIGINS.
 * A cross-origin request from anywhere else is refused before it reaches a route.
 */
export function cors(allowedOrigins: string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) return next();
    let sameOrigin = false;
    try {
      sameOrigin = new URL(origin).host === req.headers.host;
    } catch {
      // Malformed Origin header: treat as foreign
    }
    if (!sameOrigin && !allowed.has(origin)) {
      res.status(403).json({ error: 'מקור הבקשה אינו מורשה' });
      return;
    }
    if (!sameOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}

/** Fixed-window rate limit per client IP (in memory, per server instance) */
export function rateLimit(options: { windowMs: number; max: number; name: string }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  // Forget old windows so the map does not grow forever
  setInterval(() => {
    const now = Date.now();
    for (const [key, h] of hits) if (h.resetAt <= now) hits.delete(key);
  }, options.windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    let h = hits.get(key);
    if (!h || h.resetAt <= now) {
      h = { count: 0, resetAt: now + options.windowMs };
      hits.set(key, h);
    }
    h.count++;
    if (h.count > options.max) {
      res.setHeader('Retry-After', String(Math.ceil((h.resetAt - now) / 1000)));
      res.status(429).json({ error: 'יותר מדי בקשות. נסו שוב בעוד רגע.' });
      return;
    }
    next();
  };
}

/** Error with a status the client may see (validation, not found, conflict) */
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/**
 * Client errors (4xx) keep their message; server errors get a plain message and are logged
 * by name and status only (never request bodies: they may hold salary data).
 */
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  const status = Number(err?.status ?? err?.statusCode) || 500;
  if (res.headersSent) {
    res.end();
    return;
  }
  if (status >= 400 && status < 500) {
    // body-parser errors carry their own type; their message is technical
    const message = err?.type ? (status === 413 ? 'הקובץ או הבקשה גדולים מדי' : 'בקשה לא תקינה') : err?.message;
    res.status(status).json({ error: message || 'בקשה לא תקינה' });
    return;
  }
  console.error(`[api] ${req.method} ${req.path} failed: ${err?.name ?? 'Error'} (${status})`);
  res.status(500).json({ error: 'שגיאת שרת. אנא נסו שנית.' });
}
