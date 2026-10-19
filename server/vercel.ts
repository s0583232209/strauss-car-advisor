/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Vercel function entry: every /api/* request lands here. The app is built once per instance and
 * reused. Vercel serves the client (dist/) itself, so this entry has no static files and no listen().
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApiApp } from './bootstrap.ts';
import { ConfigError, loadConfig } from './config.ts';

let appPromise: ReturnType<typeof buildApiApp> | null = null;

function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const { config, warnings } = loadConfig();
      for (const w of warnings) console.warn(`[config] ${w}`);
      return buildApiApp(config);
    })();
    // A failed start is retried on the next request instead of being cached
    appPromise.catch(() => { appPromise = null; });
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const { app } = await getApp();
    app(req as any, res as any);
  } catch (err: any) {
    console.error(err instanceof ConfigError ? err.message : `Server failed to start: ${err?.message ?? err}`);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'השרת אינו מוגדר כראוי' }));
  }
}
