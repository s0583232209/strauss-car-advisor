/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { buildScenario } from '../engine/scenario.ts';
import { ComparisonResult, EmployeeProfile } from '../engine/types.ts';
import { SupportTicket } from './types.ts';

export interface RepAnswerDelivery {
  /** Ticket with answer.deliveredAt set; save it through the StorageAdapter. */
  ticket: SupportTicket;
  /** Text shown once in the chat as the rep message. */
  repMessageText: string;
  /** Recomputed comparison, or undefined when there is nothing to recompute. */
  comparison?: ComparisonResult;
  /** Internal message for runAgentTurn so the bot continues; undefined when not recomputed. */
  agentNote?: string;
}

/** Answered tickets of this session that were not delivered to the chat yet (by ticket.id). */
export function findUndeliveredAnswers(
  tickets: SupportTicket[],
  sessionId: string
): SupportTicket[] {
  return tickets.filter(
    (t) =>
      t.sessionId === sessionId &&
      t.status === 'answered' &&
      t.answer !== undefined &&
      t.answer.deliveredAt === undefined
  );
}

/**
 * Applies a rep answer to the conversation. Pure: no storage, no clock.
 * The rep value is the participation for the NEW car: it is passed only as
 * overrideParticipation and the profile (today's participation) is not changed.
 * The scenario and car come from requestedScenarioType / requestedCarId (K.2),
 * taken from the ticket snapshot first, then from the current comparison.
 */
export function applyRepAnswer(
  ticket: SupportTicket,
  profile: EmployeeProfile,
  currentComparison: ComparisonResult | null,
  now: number
): RepAnswerDelivery {
  const answer = ticket.answer!;
  const effective = answer.effectiveFrom ? ` (בתוקף מ-${answer.effectiveFrom})` : '';
  const repMessageText = `תשובת נציג: ${answer.text}${effective}`;
  const delivered: SupportTicket = { ...ticket, answer: { ...answer, deliveredAt: now } };

  const source = ticket.lastComparison ?? currentComparison ?? undefined;
  const scenarioType = source?.requestedScenarioType ?? source?.scenarioType;
  const carId = source?.requestedCarId ?? source?.targetCar?.id;

  // Nothing to recompute: no value, or no new car / alternative was requested
  if (answer.value === undefined || !scenarioType || scenarioType === 'keep') {
    return { ticket: delivered, repMessageText };
  }

  const comparison = buildScenario(profile, {
    type: scenarioType,
    targetCarId: carId,
    overrideParticipation: answer.value,
  });

  const carLabel = comparison.targetCar?.model ?? carId ?? '';
  const agentNote =
    `[הודעה פנימית מהמערכת] נציג השכר ענה על הפנייה ${ticket.id}: השתתפות עצמית של ${answer.value} ₪ ` +
    `ברכב ${carLabel}${effective}. מנוע השכר חישב מחדש את ההשוואה: נטו היום ${Math.round(comparison.todayBreakdown.net)} ₪, ` +
    `נטו בחלופה ${Math.round(comparison.altBreakdown.net)} ₪, הפרש ${comparison.diffNet} ₪. ` +
    `המשך את השיחה מאותה נקודה בלי לחשב מספרים בעצמך.`;

  return { ticket: delivered, repMessageText, comparison, agentNote };
}
