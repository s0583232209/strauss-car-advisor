/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Builds the API app: configuration → data access → business logic → API. Shared by the
 * long-running server (index.ts) and the Vercel function (vercel.ts).
 */

import type express from 'express';
import { createApp } from './api/app.ts';
import { configureLlm } from './bl/agent/llm.ts';
import { createGemini } from './bl/llm/gemini.ts';
import { createAdminService } from './bl/services/adminService.ts';
import { createAuthService } from './bl/services/authService.ts';
import { createSessionService } from './bl/services/sessionService.ts';
import { createTicketService } from './bl/services/ticketService.ts';
import type { ServerConfig } from './config.ts';
import { createAuthGateway, createRepository } from './dal/index.ts';

export async function buildApiApp(config: ServerConfig): Promise<{ app: express.Express; storage: string }> {
  // Data Access Layer
  const repo = createRepository({
    supabaseUrl: config.supabaseUrl,
    supabaseServiceKey: config.supabaseServiceKey,
    dataDir: config.dataDir,
  });
  const authGateway = createAuthGateway(config);

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
  return { app, storage: repo.kind };
}
