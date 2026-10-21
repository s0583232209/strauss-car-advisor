/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Employee conversation API (any logged-in user, checked in app.ts). Each conversation belongs to
 * the user who created it; anyone else gets 404 for it. Without login (development) the random
 * session id held by the browser is what gives access, as before.
 */

import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AuthUser, CarFitReply, ChatStreamEvent } from '../../../shared/types.ts';
import { CarFitError, type CarFitService } from '../../bl/services/carFitService.ts';
import type { SessionService } from '../../bl/services/sessionService.ts';
import { asyncHandler, rateLimit } from '../middleware.ts';
import { carFitBody, messageBody, profileUpdateBody, sampleBody, sessionId, syncBody } from '../validate.ts';

/** carFit absent = the "beyond the money" chat is off (older tests) */
export function sessionsRouter(sessions: SessionService, carFit?: CarFitService): Router {
  const router = Router();
  // Each message may cost several model calls: keep abuse cheap
  const messageLimit = rateLimit({ name: 'messages', windowMs: 60_000, max: 30 });
  const carFitLimit = rateLimit({ name: 'car-fit', windowMs: 60_000, max: 20 });
  const createLimit = rateLimit({ name: 'session-create', windowMs: 60_000, max: 20 });

  // Set by requireRole; undefined only when the server has no login
  const userId = (res: Response) => (res.locals.user as AuthUser | undefined)?.id;

  // Every /:id route below: the conversation must exist and belong to the logged-in user
  router.param('id', (req, res, next, raw) => {
    Promise.resolve()
      .then(() => sessions.assertOwner(sessionId(raw), userId(res)))
      .then(() => next(), next);
  });

  router.post('/', createLimit, asyncHandler(async (_req, res) => {
    res.status(201).json(await sessions.create(userId(res)));
  }));

  // The user's latest conversation, so another device continues it (404: none yet, or no login)
  router.get('/mine', asyncHandler(async (_req, res) => {
    const id = userId(res);
    if (!id) {
      res.status(404).json({ error: 'לא נמצאה שיחה' });
      return;
    }
    res.json(await sessions.latestFor(id));
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

  // "Beyond the money": which car fits the employee's life (no money, no full pay data to the model)
  if (carFit) {
    router.post('/:id/car-fit', carFitLimit, asyncHandler(async (req, res) => {
      const { text, history } = carFitBody(req.body);
      const body: CarFitReply = { reply: await carFit.ask(sessionId(req.params.id), text, history) };
      res.json(body);
    }));
  }

  // Known failures are answered here: the API error handler hides every 5xx message
  router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof CarFitError) res.status(err.status).json({ error: err.message });
    else next(err);
  });

  return router;
}
