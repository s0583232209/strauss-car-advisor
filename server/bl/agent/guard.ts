/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getRules } from '../engine/rules.ts';
import { extractNumbers } from './normalize.ts';

/** Where a number in the bot's reply may come from (SPEC 7 guardrails). */
export interface GuardSources {
  /** Tool outputs of the current turn only. */
  toolOutputs: string[];
  /** Messages written by people or the app (employee, rep, system), never the bot's own replies. */
  userTexts: string[];
  /** Current profile values (percentages, children...), so "הבנתי: פנסיה 6%" always passes. */
  profile?: object;
}

// Allowed policy values the bot may quote: EV refund (+250 ₪ net) and the child age limit (23)
function policyNumbers(): number[] {
  const rules = getRules() as any;
  return [rules.electric?.netBonus, rules.familyTrack?.childMaxAge].filter((n) => typeof n === 'number');
}

const MARKED_AFTER = /^\s*(₪|%|ש["״]ח|שקל|אחוז)/;
const MARKED_BEFORE = /₪\s*$/;

/** A number the guard has to verify: written with ₪ or %, or 10 and above. */
export function numbersToCheck(text: string): number[] {
  // Dates (1/1, 31/12/2026, 1.1.2026) and list markers at line start ("1. ", "2) ") are not claims
  const cleaned = text
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, ' ')
    .replace(/^(\s*)\d{1,2}[.)](?=\s)/gm, '$1');

  const out: number[] = [];
  for (const m of cleaned.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)) {
    const value = Number(m[0].replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;
    const start = m.index ?? 0;
    const marked =
      MARKED_AFTER.test(cleaned.slice(start + m[0].length, start + m[0].length + 6)) ||
      MARKED_BEFORE.test(cleaned.slice(Math.max(0, start - 3), start));
    if (!marked && Number.isInteger(value) && value >= 1990 && value <= 2100) continue; // a year
    if (!marked && value < 10) continue;
    out.push(value);
  }
  return out;
}

function allowedNumbers(sources: GuardSources): number[] {
  const allowed: number[] = [...policyNumbers()];
  // Tool outputs are JSON: take every number as written (sign dropped: "-661" allows 661)
  for (const t of sources.toolOutputs) {
    for (const m of t.matchAll(/\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)) allowed.push(Math.abs(Number(m[0])));
  }
  // People write "18,500", "18 אלף", "שש": use the same reader as update_profile
  for (const t of sources.userTexts) for (const n of extractNumbers(t)) allowed.push(n.value);
  for (const v of Object.values(sources.profile ?? {})) {
    if (typeof v === 'number' && Number.isFinite(v)) allowed.push(Math.abs(v));
  }
  return allowed.filter((n) => Number.isFinite(n));
}

/** True if `value` equals an allowed number or one of its rounded forms (11692.82 → 11,693 / 11692.8). */
function matches(value: number, allowed: number[]): boolean {
  return allowed.some(
    (a) =>
      a === value ||
      Math.round(a) === value ||
      Math.round(a * 10) / 10 === value ||
      Math.round(a * 100) / 100 === value
  );
}

/**
 * Guardrail check: the bot must not invent numbers. Only the bot's own text is checked.
 * Every number in it written with ₪ or %, or 10 and above, must come from this turn's tool
 * outputs, the conversation's user/rep/system messages, the current profile, or the policy values.
 * Legacy form: `allowedSources` as plain strings (treated as tool outputs).
 */
export function verifyNumbersInResponse(
  responseText: string,
  allowedSources: GuardSources | string[]
): { passed: boolean; inventedNumbers: number[] } {
  const sources: GuardSources = Array.isArray(allowedSources)
    ? { toolOutputs: allowedSources, userTexts: [] }
    : allowedSources;
  const allowed = allowedNumbers(sources);
  const invented = numbersToCheck(responseText).filter((n) => !matches(n, allowed));
  return { passed: invented.length === 0, inventedNumbers: invented };
}
