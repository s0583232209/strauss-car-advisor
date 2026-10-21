/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * "Beyond the money" chat for one conversation: the profile and the compared cars come from the
 * stored session, never from the client. Read-only: nothing is saved.
 */

import type { CarFitTurn } from '../../../shared/types.ts';
import { runCarFitTurn } from '../agent/carFit.ts';
import type { HighlightsService } from './highlightsService.ts';
import type { SessionService } from './sessionService.ts';

/** A failure with a message for the employee (the API error handler hides 5xx messages) */
export class CarFitError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function createCarFitService(sessions: Pick<SessionService, 'get'>, highlights?: Pick<HighlightsService, 'approved'>) {
  return {
    async ask(sessionId: string, text: string, history: CarFitTurn[]): Promise<string> {
      const { profile, lastComparison } = await sessions.get(sessionId);
      const todayCarId = profile.hasCar ? profile.currentCarId ?? undefined : undefined;
      const altId = lastComparison?.targetCar?.id;
      const approved = highlights ? await highlights.approved() : {};
      try {
        return await runCarFitTurn(text, history, {
          profile,
          todayCarId,
          altCarId: altId && altId !== todayCarId ? altId : undefined,
          highlights: approved,
        });
      } catch (err: any) {
        console.warn(`[car-fit] turn failed: ${err?.name ?? 'Error'} (${err?.status ?? '-'})`);
        throw new CarFitError(503, 'היועץ לא זמין כרגע. נסו שוב בעוד דקה');
      }
    },
  };
}

export type CarFitService = ReturnType<typeof createCarFitService>;
