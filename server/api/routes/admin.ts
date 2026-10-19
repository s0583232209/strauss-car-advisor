/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Admin API (role admin, checked in app.ts): rules, reference data, Tax Authority file, calibration */

import express, { Router } from 'express';
import type { AdminService } from '../../bl/services/adminService.ts';
import { asyncHandler, HttpError, rateLimit } from '../middleware.ts';
import { lookupQuery, rulesBody } from '../validate.ts';

// The full Tax Authority file is tens of megabytes
const TAX_FILE_LIMIT = '80mb';

export function adminRouter(admin: AdminService): Router {
  const router = Router();

  router.get('/overview', asyncHandler(async (_req, res) => {
    res.json(await admin.overview());
  }));

  router.put('/rules', express.json({ limit: '200kb' }), asyncHandler(async (req, res) => {
    res.json(await admin.saveRules(rulesBody(req.body)));
  }));

  router.post('/rules/reset', asyncHandler(async (_req, res) => {
    res.json(await admin.resetRules());
  }));

  router.post('/calibration', asyncHandler(async (_req, res) => {
    res.json(await admin.runCalibration());
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
