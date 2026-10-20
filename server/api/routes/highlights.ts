/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Car pros and cons for the admin: a model draft per car, then the admin approves it */

import express, { NextFunction, Request, Response, Router } from 'express';
import { HighlightsError, type HighlightsService } from '../../bl/services/highlightsService.ts';
import { asyncHandler, rateLimit } from '../middleware.ts';
import { carIdParam, highlightsBody } from '../validate.ts';

/** Mounted at /admin/highlights (role admin, checked in app.ts) */
export function highlightsAdminRouter(highlights: HighlightsService): Router {
  const router = Router();
  router.use(express.json({ limit: '20kb' }));

  router.get('/', asyncHandler(async (_req, res) => {
    res.json(await highlights.list());
  }));

  // One model call per car; the screen drafts the cars one by one
  router.post(
    '/:carId/draft',
    rateLimit({ name: 'highlights-draft', windowMs: 60_000, max: 40 }),
    asyncHandler(async (req, res) => {
      res.json(await highlights.draft(carIdParam(req.params.carId)));
    })
  );

  router.put('/:carId', asyncHandler(async (req, res) => {
    res.json(await highlights.approve(carIdParam(req.params.carId), highlightsBody(req.body)));
  }));

  router.delete('/:carId', asyncHandler(async (req, res) => {
    await highlights.remove(carIdParam(req.params.carId));
    res.status(204).end();
  }));

  // Known failures are answered here: the API error handler hides every 5xx message
  router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof HighlightsError) res.status(err.status).json({ error: err.message });
    else next(err);
  });

  return router;
}
