/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Payroll rep API (Bearer REP_ACCESS_TOKEN). Only the open-ticket count is public. */

import { Router } from 'express';
import type { TicketService } from '../../bl/services/ticketService.ts';
import { asyncHandler, requireToken } from '../middleware.ts';
import { ticketAnswerBody, ticketId } from '../validate.ts';

export function ticketsRouter(tickets: TicketService, repAccessToken: string | undefined): Router {
  const router = Router();

  // Header badge: a number only, no ticket content
  router.get('/summary', asyncHandler(async (_req, res) => {
    res.json({ open: await tickets.openCount() });
  }));

  router.use(requireToken(repAccessToken));

  router.get('/', asyncHandler(async (_req, res) => {
    res.json(await tickets.list());
  }));

  router.post('/:id/answer', asyncHandler(async (req, res) => {
    res.json(await tickets.answer(ticketId(req.params.id), ticketAnswerBody(req.body)));
  }));

  return router;
}
