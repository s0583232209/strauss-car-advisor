/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Employee conversation API. A session id is a random UUID held by the employee's browser:
 * knowing it is what gives access to that conversation.
 */

import { Router } from 'express';
import type { ChatStreamEvent } from '../../../shared/types.ts';
import type { SessionService } from '../../bl/services/sessionService.ts';
import { asyncHandler, rateLimit } from '../middleware.ts';
import { messageBody, profileUpdateBody, sampleBody, sessionId, syncBody } from '../validate.ts';

export function sessionsRouter(sessions: SessionService): Router {
  const router = Router();
  // Each message may cost several model calls: keep abuse cheap
  const messageLimit = rateLimit({ name: 'messages', windowMs: 60_000, max: 30 });
  const createLimit = rateLimit({ name: 'session-create', windowMs: 60_000, max: 20 });

  router.post('/', createLimit, asyncHandler(async (_req, res) => {
    res.status(201).json(await sessions.create());
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    res.json(await sessions.get(sessionId(req.params.id)));
  }));

  router.post('/:id/reset', asyncHandler(async (req, res) => {
    res.json(await sessions.reset(sessionId(req.params.id)));
  }));

  router.post('/:id/sample', asyncHandler(async (req, res) => {
    const { employeeId } = sampleBody(req.body);
    res.json(await sessions.loadSample(sessionId(req.params.id), employeeId));
  }));

  router.patch('/:id/profile', asyncHandler(async (req, res) => {
    const { updates, source } = profileUpdateBody(req.body);
    res.json(await sessions.updateProfile(sessionId(req.params.id), updates, source));
  }));

  router.post('/:id/tickets', asyncHandler(async (req, res) => {
    res.status(201).json(await sessions.askRep(sessionId(req.params.id)));
  }));

  // Polled by the employee screen: delivers rep answers that arrived since the last call
  router.post('/:id/sync', asyncHandler(async (req, res) => {
    res.json(await sessions.sync(sessionId(req.params.id), syncBody(req.body)));
  }));

  /**
   * One agent turn. The reply is NDJSON: status lines while the agent works, then the session.
   * Validation errors are normal JSON errors (sent before the stream starts).
   */
  router.post('/:id/messages', messageLimit, asyncHandler(async (req, res) => {
    const id = sessionId(req.params.id);
    const { text, repParticipationMode } = messageBody(req.body);
    await sessions.get(id); // 404 before the stream starts

    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no'); // proxies (nginx, Cloud Run) must not buffer the stream
    res.flushHeaders();
    const send = (event: ChatStreamEvent) => {
      if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
    };

    // The agent reports "not throttled" after every model call: forward changes only
    let throttled = false;
    try {
      const session = await sessions.sendMessage(id, text, { repParticipationMode }, {
        onStatus: (status) => send({ type: 'status', text: status }),
        onThrottled: (on, message) => {
          if (on === throttled) return;
          throttled = on;
          send({ type: 'throttled', on, text: message });
        },
      });
      send({ type: 'result', session });
    } catch (err: any) {
      console.error(`[api] message turn failed: ${err?.name ?? 'Error'} (${err?.status ?? 500})`);
      send({ type: 'error', message: 'שגיאה בעיבוד הבקשה. אנא נסו שנית.' });
    }
    res.end();
  }));

  return router;
}
