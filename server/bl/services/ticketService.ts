/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Payroll rep use cases: the ticket queue and answering a ticket */

import type { SupportTicket } from '../engine/types.ts';
import type { Repository } from '../../dal/index.ts';
import { NotFoundError } from './sessionService.ts';

export interface TicketAnswerInput {
  status: 'answered' | 'closed';
  text?: string;
  value?: number;
  effectiveFrom?: string;
}

export function createTicketService(repo: Repository, now: () => number = Date.now) {
  return {
    list(): Promise<SupportTicket[]> {
      return repo.listTickets();
    },

    /** Open-ticket count for the header badge (no ticket content) */
    async openCount(): Promise<number> {
      return (await repo.listTickets()).filter((t) => t.status === 'open').length;
    },

    /** The employee chat picks the answer up on its next sync (sessionService.sync) */
    async answer(id: string, input: TicketAnswerInput): Promise<SupportTicket> {
      const ticket = await repo.getTicket(id);
      if (!ticket) throw new NotFoundError('ticket not found');
      const updated: SupportTicket = {
        ...ticket,
        status: input.status,
        answeredAt: now(),
        answer: {
          text: input.text?.trim() || 'פנייתך נבדקה ואושרה במערכת.',
          value: input.value,
          effectiveFrom: input.effectiveFrom?.trim() || undefined,
        },
      };
      await repo.saveTicket(updated);
      return updated;
    },
  };
}

export type TicketService = ReturnType<typeof createTicketService>;
