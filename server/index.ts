/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server entry point: configuration → data access → business logic → API, then the client
 * (Vite middleware in development, the built dist/ in production).
 */

import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { buildApiApp } from './bootstrap.ts';
import { ConfigError, loadConfig } from './config.ts';

dotenv.config({ quiet: true });

async function main() {
  let loaded;
  try {
    loaded = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
  const { config, warnings } = loaded;
  for (const w of warnings) console.warn(`[config] ${w}`);

  const { app, storage } = await buildApiApp(config);

  // Client (presentation)
  if (!config.isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(config.staticDir, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(config.staticDir, 'index.html'));
    });
  }

  const server = app.listen(config.port, config.host, () => {
    console.log(`Server listening on http://${config.host}:${config.port} (storage: ${storage})`);
  });

  // Cloud platforms stop containers with SIGTERM: finish open requests first
  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(`Server failed to start: ${err?.message ?? err}`);
  process.exit(1);
});
