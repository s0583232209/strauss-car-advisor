/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Console trace of every agent decision (dev builds only).
 * Salary data is never logged: any number >= 100 is shown as "#" (CLAUDE.md golden rule).
 */

import { EmployeeProfile } from '../engine/types.ts';
import { getProfileFieldStatus } from './profileStatus.ts';
import { getMissingFields } from './tools.ts';

const ENABLED = (import.meta as any).env?.PROD !== true;
/** "[agent 14:03:27.512]": wall-clock time on every line */
function tag(): string {
  const d = new Date();
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `[agent ${d.toLocaleTimeString('en-GB')}.${ms}]`;
}

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

// Timing of the current turn (one employee question)
let turnStartedAt = 0;
let lastMarkAt = 0; // end of the previous logged step: a model call starts or a tool starts from here
let modelMs = 0;
let toolMs = 0;
let modelCalls = 0;
let turnQuestion = '';
const turnModels = new Set<string>();
const turnTools: string[] = [];
/** Every question in this page session, for the summary table at the end of each turn */
const turnHistory: Array<{ question: string; seconds: string; modelCalls: number; model: string; tools: string; end: string }> = [];

/** ms since the previous step, and move the mark to now */
function lap(): number {
  const now = Date.now();
  const ms = now - lastMarkAt;
  lastMarkAt = now;
  return ms;
}

/** Mask money-sized numbers in free text ("14200", "18,500" -> "#") */
function maskText(text: string): string {
  return text.replace(/\d[\d,]*(\.\d+)?/g, (m) => (Number(m.replace(/,/g, '')) >= 100 ? '#' : m));
}

/** Deep copy with money-sized numbers masked */
function mask(value: unknown): unknown {
  if (typeof value === 'number') return Math.abs(value) >= 100 ? '#' : value;
  if (typeof value === 'string') return maskText(value);
  if (Array.isArray(value)) return value.map(mask);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mask(v)]));
  }
  return value;
}

const labels = (items: Array<{ label_he: string }>) => items.map((i) => i.label_he).join(', ') || '(none)';

/** Card status as the model sees it, plus what the engine still needs */
function logCard(title: string, profile: EmployeeProfile): void {
  console.groupCollapsed(`${tag()} ${title}`);
  console.table(
    getProfileFieldStatus(profile).map((f) => ({
      field: f.field,
      label: f.label_he,
      onCard: f.known ? '✓' : '✗',
      value: f.known ? mask(f.value) : '',
    }))
  );
  console.log('Still missing for run_comparison (getMissingFields):', labels(getMissingFields(profile)));
  console.groupEnd();
}

export const agentLog = {
  turnStart(userMessage: string, profile: EmployeeProfile, repParticipationMode: boolean): void {
    if (!ENABLED) return;
    turnStartedAt = lastMarkAt = Date.now();
    modelMs = toolMs = modelCalls = 0;
    turnQuestion = maskText(userMessage);
    console.group(`${tag()} NEW TURN — employee wrote: "${maskText(userMessage)}"`);
    console.log(`Rep-verification demo mode: ${repParticipationMode ? 'ON (any car change escalates to a rep)' : 'off'}`);
    logCard('Card at turn start', profile);
  },

  round(n: number, max: number, elapsedMs: number): void {
    if (!ENABLED) return;
    lastMarkAt = Date.now();
    console.log(`${tag()} ── round ${n}/${max}, ${elapsedMs}ms elapsed — asking the model`);
  },

  modelReply(model: string | undefined, calls: Array<{ name: string; args: any }> | undefined, text: string): void {
    if (!ENABLED) return;
    const ms = lap();
    modelMs += ms;
    modelCalls++;
    turnModels.add(model ?? '?');
    if (calls && calls.length > 0) {
      console.log(`${tag()} model ${model ?? '?'} took ${ms}ms, decided to call ${calls.length} tool(s):`);
      for (const c of calls) console.log(`   → ${c.name}`, mask(c.args ?? {}));
    } else {
      console.log(`${tag()} model ${model ?? '?'} took ${ms}ms, answered with text:`, maskText(text));
    }
  },

  repeatSkipped(name: string): void {
    if (!ENABLED) return;
    console.warn(`${tag()} ${name}: same tool + same args already ran this turn → NOT executed (loop guard)`);
  },

  /** Explains the outcome of one tool call in plain words */
  toolResult(name: string, args: any, result: any, profileAfter: EmployeeProfile): void {
    if (!ENABLED) return;
    const ms = lap();
    toolMs += ms;
    turnTools.push(name);
    console.groupCollapsed(`${tag()} tool ${name} (${ms}ms) → ${summarize(name, result)}`);
    switch (name) {
      case 'update_profile':
        console.log('Model understood (args):', mask(args));
        console.log('Saved to card:', mask(result.updated));
        if (result.rejected) console.warn('REJECTED, nothing saved (negative / not a number):', mask(result.rejected));
        if (result.notSaved) {
          console.warn(
            'NOT saved — the employee never wrote these numbers, the model guessed them:',
            mask(result.notSaved)
          );
        }
        if (result.alreadyInCard?.length) console.log('Already on card with same value (ignored):', result.alreadyInCard);
        logCard('Card after update', profileAfter);
        break;
      case 'get_missing_fields':
        console.log('Missing:', labels(result.missing ?? []));
        console.log('Next question should be about:', result.next?.label_he ?? '(nothing — profile complete)');
        console.log('Already on card:', (result.alreadyInCard ?? []).map((f: any) => f.field).join(', ') || '(none)');
        break;
      case 'run_comparison':
        console.log('Requested scenario:', mask(args));
        if (result.status === 'missing_fields') {
          console.warn('Engine REFUSED to calculate — missing:', labels(result.missing ?? []));
        } else if (result.status === 'pending_rep') {
          console.warn(
            `ESCALATED automatically by run_comparison: rep-verification demo mode is ON, so participation for the new car must be confirmed by a rep (ticket ${result.ticketId}).`
          );
        } else {
          console.log('Eligible:', result.eligible, '| reason:', result.eligibilityReason ?? '-');
          console.log('Today car → alternative car:', result.todayCar, '→', result.altCar);
        }
        break;
      case 'escalate_to_rep':
        console.warn('The MODEL chose to escalate to a rep (not forced by code).');
        console.warn('Model question to rep:', maskText(String(args?.question ?? '')));
        console.warn('Model summary (its reason):', maskText(String(args?.summary ?? '')));
        console.warn('Fields actually missing at that moment:', labels(getMissingFields(profileAfter)));
        break;
      case 'find_car':
        console.log('Query:', args?.query, '| matches:', (result.cars ?? []).map((c: any) => `${c.id} ${c.model}`).join(', ') || 'none');
        break;
      case 'list_options':
        console.log('Group:', result.employeeGroup, '| eligible cars:', (result.options ?? []).map((c: any) => c.model).join(', '));
        break;
      default:
        console.log('Result:', mask(result));
    }
    console.groupEnd();
  },

  /** The employee's answer was read in code (quickAnswer.ts): no model call needed to pick update_profile */
  quickAnswer(fields: string[]): void {
    if (!ENABLED) return;
    console.log(`${tag()} ⚡ simple answer read in code → update_profile [${fields.join(', ')}] without a model call`);
  },

  pseudoToolText(): void {
    if (!ENABLED) return;
    console.warn(`${tag()} model wrote a tool call as plain text → asking it again`);
  },

  guardrailFailed(invented: number[]): void {
    if (!ENABLED) return;
    console.warn(
      `${tag()} number guard BLOCKED the answer: ${invented.length} number(s) not found in employee messages / tool results / card:`,
      mask(invented),
      '→ asking the model to rephrase'
    );
  },

  turnEnd(reason: string, text: string): void {
    if (!ENABLED) return;
    const totalMs = Date.now() - turnStartedAt;
    console.log(`${tag()} END OF TURN (${maskText(reason)}). Reply to employee:`, maskText(text));
    console.log(
      `${tag()} ⏱ question took ${secs(totalMs)}: ${modelCalls} model call(s) ${secs(modelMs)}, tools ${secs(toolMs)}, other ${secs(Math.max(0, totalMs - modelMs - toolMs))}`
    );
    console.groupEnd();
    turnHistory.push({
      question: turnQuestion.length > 40 ? `${turnQuestion.slice(0, 40)}…` : turnQuestion,
      seconds: (totalMs / 1000).toFixed(1),
      modelCalls,
      model: [...turnModels].join(', '),
      tools: turnTools.join(', ') || '-',
      end: maskText(reason),
    });
    turnModels.clear();
    turnTools.length = 0;
    console.log(`${tag()} ⏱ time per question so far:`);
    console.table(turnHistory);
  },
};

/** One-line headline for a tool result */
function summarize(name: string, r: any): string {
  if (r?.skipped) return 'skipped (repeat)';
  switch (name) {
    case 'update_profile':
      if (r.rejected) return 'rejected';
      return `saved [${Object.keys(r.updated ?? {}).join(', ') || 'nothing'}]${r.notSaved ? `, NOT saved [${r.notSaved.map((n: any) => n.field).join(', ')}]` : ''}`;
    case 'get_missing_fields':
      return r.isComplete ? 'complete' : `missing ${r.missing.length}: ${labels(r.missing)}`;
    case 'run_comparison':
      return String(r.status);
    case 'escalate_to_rep':
      return `ticket ${r.ticketId}`;
    default:
      return 'done';
  }
}
