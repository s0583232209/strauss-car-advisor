/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Input validation for every API body and parameter (unknown fields are rejected) */

import type { EmployeeProfile } from '../../shared/types.ts';
import { PAYSLIP_FIELDS } from '../bl/agent/extract.ts';
import { HttpError } from './middleware.ts';

const fail = (message: string): never => {
  throw new HttpError(400, message);
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function object(v: unknown, allowed: readonly string[], what: string): Record<string, unknown> {
  if (!isObject(v)) return fail(`${what}: נדרש אובייקט JSON`);
  const extra = Object.keys(v).filter((k) => !allowed.includes(k));
  if (extra.length) fail(`${what}: שדות לא מוכרים (${extra.join(', ')})`);
  return v;
}

function text(v: unknown, field: string, max: number, required = true): string | undefined {
  if (v === undefined || v === null || v === '') return required ? fail(`${field}: שדה חובה`) : undefined;
  if (typeof v !== 'string') return fail(`${field}: נדרש טקסט`);
  const t = v.trim();
  if (required && !t) fail(`${field}: שדה חובה`);
  if (t.length > max) fail(`${field}: ארוך מדי (עד ${max} תווים)`);
  return t;
}

function number(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fail(`${field}: נדרש מספר`);
  if (v < min || v > max) fail(`${field}: מחוץ לטווח (${min}–${max})`);
  return v;
}

function bool(v: unknown, field: string): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') return fail(`${field}: נדרש true/false`);
  return v;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function sessionId(v: unknown): string {
  if (typeof v !== 'string' || !UUID.test(v)) fail('מזהה שיחה לא תקין');
  return v as string;
}

export function ticketId(v: unknown): string {
  if (typeof v !== 'string' || !/^TICK-\d{4,8}$/.test(v)) fail('מזהה פנייה לא תקין');
  return v as string;
}

export function messageBody(body: unknown): { text: string; repParticipationMode: boolean } {
  const b = object(body, ['text', 'repParticipationMode'], 'הודעה');
  return { text: text(b.text, 'text', 2000)!, repParticipationMode: Boolean(bool(b.repParticipationMode, 'repParticipationMode')) };
}

export function syncBody(body: unknown): { repParticipationMode: boolean } {
  const b = object(body ?? {}, ['repParticipationMode'], 'סנכרון');
  return { repParticipationMode: Boolean(bool(b.repParticipationMode, 'repParticipationMode')) };
}

export function sampleBody(body: unknown): { employeeId: string } {
  const b = object(body, ['employeeId'], 'עובד לדוגמה');
  const id = text(b.employeeId, 'employeeId', 40)!;
  if (!/^[A-Z0-9-]+$/.test(id)) fail('employeeId: מזהה לא תקין');
  return { employeeId: id };
}

// Money in shekels and counts: generous upper bounds, the engine and the guard do the rest
const MONEY_MAX = 10_000_000;
const NUMERIC_PROFILE: Record<string, [number, number]> = {
  base: [0, MONEY_MAX],
  commissions: [0, MONEY_MAX],
  bonus: [0, MONEY_MAX],
  pensionPct: [0, 20],
  studyFundPct: [0, 10],
  creditPoints: [0, 15],
  childrenUpTo23: [0, 15],
  currentParticipation: [0, MONEY_MAX],
  currentBenefit: [0, MONEY_MAX],
  currentMaintenance: [0, MONEY_MAX],
};
const TEXT_PROFILE = ['occupation', 'currentCarName'] as const;
const GROUPS = ['א', 'ב', 'ג', 'ד', 'משפחתי'];

/** Card edits and confirmed payslip fields; a number set to null clears it (the field is missing again) */
export function profileUpdateBody(body: unknown): { updates: Partial<EmployeeProfile>; source: 'manual' | 'payslip' } {
  const b = object(body, ['updates', 'source'], 'עדכון פרופיל');
  const source = b.source ?? 'manual';
  if (source !== 'manual' && source !== 'payslip') fail('source: ערך לא תקין');
  const allowed = [...Object.keys(NUMERIC_PROFILE), ...TEXT_PROFILE, 'group', 'hasCar'];
  const u = object(b.updates, allowed, 'updates');
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(u)) {
    if (key in NUMERIC_PROFILE) {
      updates[key] = value === null ? undefined : number(value, key, ...NUMERIC_PROFILE[key]);
    } else if ((TEXT_PROFILE as readonly string[]).includes(key)) {
      updates[key] = text(value, key, 120, false);
    } else if (key === 'group') {
      if (!GROUPS.includes(value as string)) fail('group: קבוצה לא תקינה');
      updates.group = value;
    } else if (key === 'hasCar') {
      updates.hasCar = bool(value, 'hasCar');
    }
  }
  return { updates: updates as Partial<EmployeeProfile>, source: source as 'manual' | 'payslip' };
}

export function ticketAnswerBody(body: unknown): { status: 'answered' | 'closed'; text?: string; value?: number; effectiveFrom?: string } {
  const b = object(body, ['status', 'text', 'value', 'effectiveFrom'], 'תשובת נציג');
  if (b.status !== 'answered' && b.status !== 'closed') fail('status: ערך לא תקין');
  return {
    status: b.status as 'answered' | 'closed',
    text: text(b.text, 'text', 2000, false),
    value: b.value === undefined || b.value === null ? undefined : number(b.value, 'value', 0, MONEY_MAX),
    effectiveFrom: text(b.effectiveFrom, 'effectiveFrom', 40, false),
  };
}

const PAYSLIP_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']);
// About 10 MB of file once decoded
const PAYSLIP_MAX_BASE64 = 14_000_000;

export function payslipBody(body: unknown): { fileData: string; mimeType: string } {
  const b = object(body, ['fileData', 'mimeType'], 'תלוש');
  const mimeType = text(b.mimeType, 'mimeType', 60)!;
  if (!PAYSLIP_MIME.has(mimeType)) fail('סוג קובץ לא נתמך (JPG, PNG, WEBP, HEIC או PDF)');
  if (typeof b.fileData !== 'string' || !b.fileData) fail('fileData: חסר קובץ');
  const fileData = b.fileData as string;
  if (fileData.length > PAYSLIP_MAX_BASE64) fail('הקובץ גדול מדי (עד 10MB)');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(fileData)) fail('fileData: קידוד לא תקין');
  return { fileData, mimeType };
}

/** Keeps only the known payslip fields, each as { value, confidence, sourceQuote } */
export function payslipResult(raw: unknown): Record<string, { value: string | number | null; confidence: string; sourceQuote: string }> {
  const src = isObject(raw) ? raw : {};
  const out: Record<string, { value: string | number | null; confidence: string; sourceQuote: string }> = {};
  for (const key of PAYSLIP_FIELDS) {
    const f = isObject(src[key]) ? (src[key] as Record<string, unknown>) : {};
    const value = typeof f.value === 'number' || typeof f.value === 'string' ? f.value : null;
    const confidence = f.confidence === 'high' || f.confidence === 'medium' ? f.confidence : 'low';
    out[key] = { value, confidence, sourceQuote: typeof f.sourceQuote === 'string' ? f.sourceQuote.slice(0, 300) : '' };
  }
  return out;
}

export function rulesBody(body: unknown): unknown {
  const b = object(body, ['rules'], 'כללים');
  if (!isObject(b.rules)) fail('rules: נדרש אובייקט');
  return b.rules;
}

export function lookupQuery(q: Record<string, unknown>): { year: string; type: string; product: string; model: string } {
  const digits = (v: unknown, field: string, max: number) => {
    if (typeof v !== 'string' || !new RegExp(`^\\d{1,${max}}$`).test(v)) fail(`${field}: נדרש מספר`);
    return v as string;
  };
  return {
    year: digits(q.year, 'year', 4),
    type: digits(q.type ?? '1', 'type', 2),
    product: digits(q.product, 'product', 5),
    model: digits(q.model, 'model', 5),
  };
}
