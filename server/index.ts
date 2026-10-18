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
import { createApp } from './api/app.ts';
import { configureLlm } from './bl/agent/llm.ts';
import { createGemini } from './bl/llm/gemini.ts';
import { createAdminService } from './bl/services/adminService.ts';
import { createAuthService } from './bl/services/authService.ts';
import { createSessionService } from './bl/services/sessionService.ts';
import { createTicketService } from './bl/services/ticketService.ts';
import { ConfigError, loadConfig } from './config.ts';
import { createAuthGateway, createRepository } from './dal/index.ts';

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

  // Data Access Layer
  const repo = createRepository({
    supabaseUrl: config.supabaseUrl,
    supabaseServiceKey: config.supabaseServiceKey,
    dataDir: config.dataDir,
  });
  const authGateway = createAuthGateway(config);
  if (!authGateway) console.warn('[config] No Supabase: login is off and every screen is open (development only)');

  // Business Logic Layer
  const gemini = createGemini(config.gemini);
  configureLlm({ transport: gemini.generate, fallback: config.fallback });
  const admin = createAdminService(repo);
  await admin.init();
  const sessions = createSessionService(repo);
  const tickets = createTicketService(repo);
  const auth = authGateway ? createAuthService(authGateway, repo) : null;

  // API Layer
  const app = createApp({
    config,
    sessions,
    tickets,
    admin,
    auth,
    extractPayslip: gemini.extractPayslip,
    healthDetails: () => ({ ...gemini.status(), storage: repo.kind }),
  });

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
    console.log(`Server listening on http://${config.host}:${config.port} (storage: ${repo.kind})`);
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
