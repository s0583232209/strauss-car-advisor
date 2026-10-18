/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * API layer: the only entry point for the client. Routes validate input and call the business
 * services; they never touch storage or the model directly.
 */

import express, { Router } from 'express';
import type { ServerConfig } from '../config.ts';
import { getRules } from '../bl/engine/rules.ts';
import type { AdminService } from '../bl/services/adminService.ts';
import type { AuthService } from '../bl/services/authService.ts';
import { sampleEmployees, type SessionService } from '../bl/services/sessionService.ts';
import type { TicketService } from '../bl/services/ticketService.ts';
import { cors, errorHandler, rateLimit, securityHeaders } from './middleware.ts';
import { adminRouter } from './routes/admin.ts';
import { authRouter } from './routes/auth.ts';
import { payslipRouter } from './routes/payslip.ts';
import { sessionsRouter } from './routes/sessions.ts';
import { ticketsRouter } from './routes/tickets.ts';

export interface AppDeps {
  config: Pick<ServerConfig, 'isProduction' | 'trustProxy' | 'allowedOrigins' | 'repAccessToken' | 'adminAccessToken'>;
  sessions: SessionService;
  tickets: TicketService;
  admin: AdminService;
  /** Login (Supabase Auth); null = no login (development with the file store) */
  auth?: AuthService | null;
  extractPayslip: (fileData: string, mimeType: string) => Promise<unknown>;
  /** Extra details for /api/health outside production (model cooldowns, storage) */
  healthDetails?: () => Record<string, unknown>;
}

export function createApp(deps: AppDeps): express.Express {
  const { config } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(securityHeaders(config.isProduction));

  const api = Router();
  api.use(cors(config.allowedOrigins));
  api.use(rateLimit({ name: 'api', windowMs: 60_000, max: 600 }));

  // Routes with their own body parsers and limits come before the global JSON parser
  api.use('/payslip', payslipRouter(deps.extractPayslip));
  api.use('/admin', adminRouter(deps.admin, config.adminAccessToken));

  api.use(express.json({ limit: '100kb' }));
  api.use('/auth', authRouter(deps.auth ?? null, config.isProduction));
  api.use('/sessions', sessionsRouter(deps.sessions));
  api.use('/tickets', ticketsRouter(deps.tickets, config.repAccessToken));

  api.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      ...(config.isProduction ? {} : deps.healthDetails?.()),
    });
  });

  // Public reference data for the employee and guide screens (no personal data)
  api.get('/meta', (_req, res) => {
    res.json({ sampleEmployees: sampleEmployees(), rules: getRules() });
  });

  api.use((_req, res) => {
    res.status(404).json({ error: 'נתיב לא קיים' });
  });
  api.use(errorHandler);

  app.use('/api', api);
  return app;
}
