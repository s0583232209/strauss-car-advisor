/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Employee conversation use cases: create/reset a session, sample employees, profile edits,
 * one agent turn per message, manual rep questions and delivery of rep answers.
 * Moved here from the React view: the client only calls the API.
 */

import { randomInt, randomUUID } from 'node:crypto';
import { getEmployees } from '../engine/referenceData.ts';
import { runAgentTurn } from '../agent/loop.ts';
import { buildOpeningMessage } from '../agent/profileStatus.ts';
import { getMissingFields } from '../agent/tools.ts';
import { getRules } from '../engine/rules.ts';
import { buildScenario } from '../engine/scenario.ts';
import type {
  ChatMessage,
  ComparisonResult,
  EmployeeProfile,
  Rules,
  SampleEmployee,
  SessionState,
  SupportTicket,
} from '../engine/types.ts';
import type { Repository, SessionRecord } from '../../dal/index.ts';
import { applyRepAnswer, findUndeliveredAnswers } from './repAnswer.ts';

// Start of the system message shown when a sample employee is loaded (dry runs only)
const SAMPLE_LOADED_PREFIX = 'נטענו בהצלחה נתוני הדוגמה של';

// Empty profile: every field is undefined until the agent collects it (get_missing_fields)
const emptyProfile = () => ({}) as EmployeeProfile;

export class NotFoundError extends Error {
  readonly status = 404;
}

export interface TurnEvents {
  onStatus?: (text: string) => void;
  onThrottled?: (on: boolean, text?: string) => void;
}

/** Recompute a comparison only when the profile is complete for its scenario */
function recomputeIfComplete(p: EmployeeProfile, prev: ComparisonResult): ComparisonResult | null {
  return getMissingFields(p, prev.scenarioType).length > 0
    ? null
    : buildScenario(p, { type: prev.scenarioType, targetCarId: prev.targetCar?.id });
}

const toState = (s: SessionRecord): SessionState => ({
  id: s.id,
  profile: s.profile,
  messages: s.messages,
  lastComparison: s.lastComparison,
});

export function sampleEmployees(): SampleEmployee[] {
  return getEmployees().map((e) => ({ id: e.id!, name: e.name!, occupation: e.occupation!, group: e.group }));
}

/** Reference data for the client screens (GET /api/meta): sample employees and the rules the engine uses now */
export function referenceMeta(): { sampleEmployees: SampleEmployee[]; rules: Rules } {
  return { sampleEmployees: sampleEmployees(), rules: getRules() };
}

export function createSessionService(repo: Repository, now: () => number = Date.now) {
  const msgId = (prefix: string) => `${prefix}-${randomUUID()}`;
  const message = (role: ChatMessage['role'], content: string, prefix: string, comparison?: ComparisonResult): ChatMessage => ({
    id: msgId(prefix),
    role,
    content,
    ...(comparison ? { comparison } : {}),
    timestamp: now(),
  });

  // One operation at a time per session (a message and a rep-answer delivery must not interleave)
  const locks = new Map<string, Promise<unknown>>();
  function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const prev = locks.get(id) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    const tail = next.catch(() => undefined);
    locks.set(id, tail);
    tail.then(() => locks.get(id) === tail && locks.delete(id));
    return next;
  }

  async function load(id: string): Promise<SessionRecord> {
    const s = await repo.getSession(id);
    if (!s) throw new NotFoundError('session not found');
    return s;
  }

  async function saveState(s: SessionRecord): Promise<void> {
    s.updatedAt = now();
    const { messages: _messages, ...state } = s;
    await repo.saveSessionState(state);
  }

  async function append(s: SessionRecord, ...msgs: ChatMessage[]): Promise<void> {
    s.messages.push(...msgs);
    await repo.appendMessages(s.id, msgs);
  }

  /** Ticket ids are shown to people ("TICK-482913"): short, random, never reused */
  async function newTicketId(): Promise<string> {
    for (;;) {
      const id = `TICK-${randomInt(100000, 1000000)}`;
      if (!(await repo.getTicket(id))) return id;
    }
  }

  async function startConversation(s: SessionRecord): Promise<void> {
    s.profile = emptyProfile();
    s.lastComparison = null;
    s.pendingFields = undefined;
    s.messages = [message('assistant', buildOpeningMessage(emptyProfile()), 'msg')];
    await saveState(s);
    await repo.replaceMessages(s.id, s.messages);
  }

  /** One agent turn. internal = a system note for the agent only (e.g. a rep answer), not shown in the chat */
  async function agentTurn(
    s: SessionRecord,
    text: string,
    opts: { repParticipationMode?: boolean; internal?: boolean },
    events: TurnEvents = {}
  ): Promise<void> {
    if (!opts.internal) await append(s, message('user', text, 'usr'));
    const history = [...s.messages];
    // Comparison computed during this turn (attached to the assistant message)
    let turnComparison: ComparisonResult | undefined;

    try {
      const result = await runAgentTurn(
        text,
        history,
        {
          // Copy: tools mutate the turn profile in place (tools.ts update_profile)
          profile: { ...s.profile },
          lastComparison: s.lastComparison,
          repParticipationMode: Boolean(opts.repParticipationMode),
          pendingFields: s.pendingFields,
          onProfileUpdate: (updates) => {
            s.profile = { ...s.profile, ...updates };
            // If a comparison exists, recompute it with the updated profile
            const recomputed = s.lastComparison ? recomputeIfComplete(s.profile, s.lastComparison) : null;
            if (recomputed) s.lastComparison = recomputed;
          },
          onComparisonRun: (comp) => {
            turnComparison = comp;
            s.lastComparison = comp;
          },
          onEscalate: async (question, summary) => {
            const ticket: SupportTicket = {
              id: await newTicketId(),
              sessionId: s.id,
              question,
              summary,
              status: 'open',
              profile: s.profile,
              lastComparison: s.lastComparison || undefined,
              transcript: history,
              createdAt: now(),
            };
            await repo.saveTicket(ticket);
            return ticket.id;
          },
        },
        events.onThrottled,
        events.onStatus
      );
      s.pendingFields = result.pendingFields;
      await saveState(s);
      await append(s, message('assistant', result.text, 'ast', turnComparison));
    } catch (err: any) {
      // Details stay in the server log (status only, never salary data); the employee gets a plain message
      console.error(`agent turn failed for a session: ${err?.name ?? 'Error'} ${err?.status ?? ''}`.trim());
      await saveState(s);
      await append(s, message('system', 'שגיאה בעיבוד הבקשה. אנא נסו שנית בעוד רגע.', 'err'));
    }
  }

  return {
    /** userId = the logged-in owner; undefined only without login (development) */
    async create(userId?: string): Promise<SessionState> {
      const s: SessionRecord = {
        id: randomUUID(),
        ...(userId ? { userId } : {}),
        profile: emptyProfile(),
        lastComparison: null,
        messages: [],
        createdAt: now(),
        updatedAt: now(),
      };
      await repo.saveSessionState(s);
      await startConversation(s);
      return toState(s);
    },

    async get(id: string): Promise<SessionState> {
      return toState(await load(id));
    },

    /**
     * Someone else's conversation looks like a missing one (404), so ids cannot be probed.
     * userId undefined = no login (development): every conversation is open, as before.
     */
    async assertOwner(id: string, userId: string | undefined): Promise<void> {
      const s = await load(id);
      if (userId !== undefined && s.userId !== userId) throw new NotFoundError('session not found');
    },

    /** The user's latest conversation, to continue it on another device */
    async latestFor(userId: string): Promise<SessionState> {
      const id = await repo.findLatestSessionId(userId);
      if (!id) throw new NotFoundError('session not found');
      return toState(await load(id));
    },

    /** New conversation: an empty profile, no data carried over */
    reset(id: string): Promise<SessionState> {
      return withLock(id, async () => {
        const s = await load(id);
        await startConversation(s);
        return toState(s);
      });
    },

    loadSample(id: string, employeeId: string): Promise<SessionState> {
      return withLock(id, async () => {
        const target = getEmployees().find((e) => e.id === employeeId);
        if (!target) throw new NotFoundError('sample employee not found');
        const s = await load(id);
        s.profile = structuredClone(target);
        // Initial baseline comparison
        s.lastComparison = buildScenario(target, { type: 'keep' });
        s.pendingFields = undefined;
        await saveState(s);
        await append(
          s,
          message(
            'system',
            `${SAMPLE_LOADED_PREFIX} ${target.name} (${target.occupation}, קבוצה ${target.group}, שכר בסיס ${target.base?.toLocaleString()} ₪).`,
            'sys'
          )
        );
        return toState(s);
      });
    },

    /** Manual card edit or confirmed payslip fields (already validated by the API layer) */
    updateProfile(id: string, updates: Partial<EmployeeProfile>, source: 'manual' | 'payslip'): Promise<SessionState> {
      return withLock(id, async () => {
        const s = await load(id);
        s.profile = { ...s.profile, ...updates };
        const recomputed = s.lastComparison ? recomputeIfComplete(s.profile, s.lastComparison) : null;
        if (recomputed) s.lastComparison = recomputed;
        await saveState(s);
        if (source === 'payslip') {
          await append(s, message('system', 'נתוני תלוש השכר מוזגו בהצלחה לתוך הפרופיל. המחשבון עודכן.', 'sys'));
        }
        return toState(s);
      });
    },

    sendMessage(
      id: string,
      text: string,
      opts: { repParticipationMode?: boolean },
      events?: TurnEvents
    ): Promise<SessionState> {
      return withLock(id, async () => {
        const s = await load(id);
        await agentTurn(s, text, opts, events);
        return toState(s);
      });
    },

    /** "Ask a rep" button on the comparison card */
    askRep(id: string): Promise<SessionState> {
      return withLock(id, async () => {
        const s = await load(id);
        const comp = s.lastComparison;
        if (!comp) throw Object.assign(new Error('no comparison to ask about'), { status: 409 });
        const ticket: SupportTicket = {
          id: await newTicketId(),
          sessionId: s.id,
          question: `שאלה לגבי השוואת שכר בין ${comp.todayCarLabel} ל-${comp.altCarLabel}`,
          summary: 'העובד ביקש בירור ידני לגבי השוואת השכר המוצגת.',
          status: 'open',
          profile: s.profile,
          lastComparison: comp,
          transcript: s.messages,
          createdAt: now(),
        };
        await repo.saveTicket(ticket);
        await append(
          s,
          message('system', `הפנייה נשלחה לנציג שכר (מספר פנייה: ${ticket.id}). נציג יבדוק את הנתונים וישיב בהקדם.`, 'tick')
        );
        return toState(s);
      });
    },

    /**
     * Delivers rep answers not shown in this chat yet: the rep message, the recomputed comparison,
     * and an agent turn so the bot continues. Called by the employee screen's polling.
     */
    sync(id: string, opts: { repParticipationMode?: boolean } = {}): Promise<SessionState> {
      return withLock(id, async () => {
        const s = await load(id);
        for (const ticket of findUndeliveredAnswers(await repo.listTicketsForSession(id), id)) {
          const delivery = applyRepAnswer(ticket, s.profile, s.lastComparison, now());
          // Mark as delivered first, so a retry never shows it twice
          await repo.saveTicket(delivery.ticket);
          await append(s, { ...message('rep', delivery.repMessageText, 'rep', delivery.comparison), id: `rep-ans-${ticket.id}` });
          if (delivery.comparison) {
            s.lastComparison = delivery.comparison;
            await saveState(s);
          }
          if (delivery.agentNote) await agentTurn(s, delivery.agentNote, { ...opts, internal: true });
        }
        return toState(s);
      });
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;
