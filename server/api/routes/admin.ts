/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Admin API (role admin, checked in app.ts): rules, reference data, Tax Authority file, users */

import express, { Router } from 'express';
import type { AdminService } from '../../bl/services/adminService.ts';
import type { AuthService } from '../../bl/services/authService.ts';
import { asyncHandler, HttpError, rateLimit } from '../middleware.ts';
import { createUserBody, dataTableParam, lookupQuery, rulesBody } from '../validate.ts';

// The full Tax Authority file is tens of megabytes
const TAX_FILE_LIMIT = '80mb';
// The data workbook is a few tables of tens of rows
const DATA_FILE_LIMIT = '5mb';
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function adminRouter(admin: AdminService, auth: AuthService | null): Router {
  const router = Router();

  // The body holds a password: never logged, never stored here (Supabase Auth keeps only its hash)
  router.post(
    '/users',
    rateLimit({ name: 'create-user', windowMs: 60_000, max: 20 }),
    express.json({ limit: '10kb' }),
    asyncHandler(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      if (!auth) {
        // A known state, not a failure: answered here (the error handler hides every 5xx message)
        res.status(503).json({ error: 'הוספת משתמשים דורשת חיבור ל-Supabase, שאינו מוגדר בשרת' });
        return;
      }
      const { email, password, role } = createUserBody(req.body);
      res.status(201).json(await auth.createUser(email, password, role));
    })
  );

  router.get('/overview', asyncHandler(async (_req, res) => {
    res.json(await admin.overview());
  }));

  // Rules file: check and compare first, then save the same rules with PUT
  router.post('/rules/preview', express.json({ limit: '200kb' }), asyncHandler(async (req, res) => {
    res.json(admin.previewRules(rulesBody(req.body)));
  }));

  router.put('/rules', express.json({ limit: '200kb' }), asyncHandler(async (req, res) => {
    res.json(await admin.saveRules(rulesBody(req.body)));
  }));

  // Data workbook (.xlsx): preview compares it with the active data, apply replaces the tables in it
  const workbook = [
    rateLimit({ name: 'data-upload', windowMs: 60_000, max: 20 }),
    express.raw({ type: [XLSX_TYPE, 'application/octet-stream'], limit: DATA_FILE_LIMIT }),
  ];
  const fileOf = (body: unknown): Uint8Array => {
    if (!Buffer.isBuffer(body) || body.length === 0) throw new HttpError(400, 'יש לשלוח קובץ Excel (xlsx)');
    return new Uint8Array(body);
  };

  router.post('/data/preview', ...workbook, asyncHandler(async (req, res) => {
    res.json(admin.previewDataFile(fileOf(req.body)));
  }));

  router.post('/data/apply', ...workbook, asyncHandler(async (req, res) => {
    res.json(await admin.applyDataFile(fileOf(req.body)));
  }));

  router.delete('/data/:table', asyncHandler(async (req, res) => {
    await admin.resetDataTable(dataTableParam(req.params.table));
    res.status(204).end();
  }));

  router.post('/rules/reset', asyncHandler(async (_req, res) => {
    res.json(await admin.resetRules());
  }));

  router.post(
    '/tax-records',
    rateLimit({ name: 'tax-upload', windowMs: 60_000, max: 5 }),
    express.raw({ type: ['text/csv', 'application/octet-stream'], limit: TAX_FILE_LIMIT }),
    asyncHandler(async (req, res) => {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        throw new HttpError(400, 'יש לשלוח קובץ CSV (Content-Type: text/csv)');
      }
      try {
        res.json({ count: await admin.importTaxCsv(new Uint8Array(req.body)) });
      } catch (err: any) {
        // Parser errors are Hebrew messages about the file's columns
        if (err instanceof Error && !(err as any).status && /CSV|עמודות/.test(err.message)) throw new HttpError(400, err.message);
        throw err;
      }
    })
  );

  router.delete('/tax-records', asyncHandler(async (_req, res) => {
    await admin.clearTaxRecords();
    res.status(204).end();
  }));

  router.get('/tax-records/lookup', asyncHandler(async (req, res) => {
    const q = lookupQuery(req.query as Record<string, unknown>);
    res.json({ result: await admin.lookup(q.year, q.type, q.product, q.model) });
  }));

  return router;
}
