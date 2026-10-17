/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Payslip reading: the file goes to Gemini from the server; only the known fields come back */

import express, { Router } from 'express';
import { asyncHandler, rateLimit } from '../middleware.ts';
import { payslipBody, payslipResult } from '../validate.ts';

export function payslipRouter(extract: (fileData: string, mimeType: string) => Promise<unknown>): Router {
  const router = Router();

  router.post(
    '/extract',
    rateLimit({ name: 'payslip', windowMs: 10 * 60_000, max: 10 }),
    // Own body limit (base64 of a file up to ~10 MB); mounted before the global 100kb JSON parser
    express.json({ limit: '15mb' }),
    asyncHandler(async (req, res) => {
      const { fileData, mimeType } = payslipBody(req.body);
      res.json(payslipResult(await extract(fileData, mimeType)));
    })
  );

  return router;
}
