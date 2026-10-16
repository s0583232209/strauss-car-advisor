/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Reads a simple answer to the bot's last question in code, so the model is not needed to pick
 * update_profile ("פנסיה 6, קרן השתלמות 2.5", "אין עמלות ואין בונוס", "קבוצה ב", "כן").
 * Conservative: any word it does not know, a value it cannot tie to exactly one field,
 * or a value normalize.ts rejects returns null, and the model handles the message as before.
 */

import { extractNumbers, normalizeField, NumericField } from './normalize.ts';

type QuickField = NumericField | 'group' | 'hasCar';
export type QuickAnswer = Partial<Record<QuickField, number | string | boolean>>;

/** Words that name a field. 'רכב' is weak: it yields to any other field named in the same part. */
const KEYWORDS: Record<string, QuickField> = {
  קבוצה: 'group', קבוצת: 'group', זכאות: 'group',
  שכר: 'base', בסיס: 'base', ברוטו: 'base', משכורת: 'base',
  רכב: 'hasCar',
  ילד: 'childrenUpTo23', ילדים: 'childrenUpTo23', ילדות: 'childrenUpTo23',
  עמלה: 'commissions', עמלות: 'commissions',
  בונוס: 'bonus', בונוסים: 'bonus',
  פנסיה: 'pensionPct',
  השתלמות: 'studyFundPct', קרן: 'studyFundPct',
  נקודות: 'creditPoints', נקודה: 'creditPoints', זיכוי: 'creditPoints',
  השתתפות: 'currentParticipation',
  אחזקה: 'currentMaintenance', אחזקת: 'currentMaintenance',
};
const WEAK_KEYWORD: QuickField = 'hasCar';
const NO_WORDS = new Set(['אין', 'לא']);
const YES_WORDS = new Set(['כן']);
// Parts of a number that extractNumbers reads ("18 אלף וחצי", "6 אחוז")
const NUMBER_PARTS = new Set(['אלף', 'אלפים', 'k', 'חצי', 'וחצי', 'אחוז', 'אחוזים', '%']);
const FILLER = new Set(['יש', 'לי', 'חברה', 'של', 'זה', 'הוא', 'היא', 'גם', 'בחודש', 'חודשי', 'חודשית', '₪', 'שח', 'שקל', 'שקלים', 'במס']);
const GROUP_LETTERS = new Set(['א', 'ב', 'ג', 'ד']);
const HEBREW_PREFIXES = 'והבלמש';
// "אין" may mean 0 only where the question itself says "0 אם אין"
const ZERO_BY_NO = new Set<QuickField>(['commissions', 'bonus', 'childrenUpTo23', 'studyFundPct', 'currentParticipation']);
const NUMERIC = new Set<QuickField>([
  'base', 'commissions', 'bonus', 'pensionPct', 'studyFundPct', 'creditPoints', 'childrenUpTo23',
  'currentParticipation', 'currentMaintenance',
]);

type Token =
  | { kind: 'number'; text: string }
  | { kind: 'numberPart'; text: string }
  | { kind: 'keyword'; field: QuickField }
  | { kind: 'no' }
  | { kind: 'yes' }
  | { kind: 'letter'; letter: string }
  | { kind: 'filler' };

function classifyWord(w: string): Token | undefined {
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$|^\d+(\.\d+)?$/.test(w)) return { kind: 'number', text: w };
  if (NUMBER_PARTS.has(w)) return { kind: 'numberPart', text: w };
  if (KEYWORDS[w]) return { kind: 'keyword', field: KEYWORDS[w] };
  if (NO_WORDS.has(w)) return { kind: 'no' };
  if (YES_WORDS.has(w)) return { kind: 'yes' };
  if (GROUP_LETTERS.has(w)) return { kind: 'letter', letter: w };
  if (FILLER.has(w)) return { kind: 'filler' };
  return undefined;
}

/** A word, or the same word after up to two Hebrew prefixes ("לפנסיה", "ואין", "והבונוס") */
function classify(word: string): { token: Token; startsWithAnd: boolean } | undefined {
  const direct = classifyWord(word);
  if (direct) return { token: direct, startsWithAnd: false };
  for (let cut = 1; cut <= 2 && cut < word.length - 1; cut++) {
    if (![...word.slice(0, cut)].every((c) => HEBREW_PREFIXES.includes(c))) break;
    const token = classifyWord(word.slice(cut));
    // A group letter is never read after a prefix ("בב" is not "ב")
    if (token && token.kind !== 'letter') return { token, startsWithAnd: word[0] === 'ו' };
  }
  return undefined;
}

/** Splits the message into parts ("פנסיה 6, קרן 2.5" / "אין עמלות ואין בונוס"); null on an unknown word */
function toParts(message: string): Token[][] | null {
  const text = message
    .trim()
    .replace(/[׳']/g, '') // "ב'" → "ב"
    .replace(/([א-ת])[-־](?=\d)/g, '$1 ') // "ו-2.5" → "ו 2.5"
    .replace(/(\d)(%|₪)/g, '$1 $2')
    .replace(/[.!?]+$/, '');
  const parts: Token[][] = [[]];
  for (const chunk of text.split(/[\n;]|,(?!\d{3})/)) {
    if (parts[parts.length - 1].length > 0) parts.push([]);
    for (const word of chunk.split(/\s+/).filter(Boolean)) {
      if (word === 'ו') {
        if (parts[parts.length - 1].length > 0) parts.push([]);
        continue;
      }
      const c = classify(word);
      if (!c) return null;
      // "ואין בונוס" starts a new part; "וחצי" stays part of the number
      if (c.startsWithAnd && c.token.kind !== 'numberPart' && parts[parts.length - 1].length > 0) parts.push([]);
      parts[parts.length - 1].push(c.token);
    }
  }
  return parts.filter((p) => p.length > 0);
}

/** The field a part names, undefined if none, null if it names two different fields */
function namedField(part: Token[]): QuickField | undefined | null {
  const named = new Set(part.flatMap((t) => (t.kind === 'keyword' ? [t.field] : [])));
  if (named.size > 1) named.delete(WEAK_KEYWORD);
  if (named.size > 1) return null;
  return [...named][0];
}

/** The value of one part for one field; undefined when it does not fit */
function partValue(part: Token[], field: QuickField): number | string | boolean | undefined {
  const numbers = part.filter((t): t is Extract<Token, { kind: 'number' | 'numberPart' }> => t.kind === 'number' || t.kind === 'numberPart');
  const hasNumber = part.some((t) => t.kind === 'number');
  const letters = part.filter((t): t is Extract<Token, { kind: 'letter' }> => t.kind === 'letter');
  const no = part.some((t) => t.kind === 'no');
  const yes = part.some((t) => t.kind === 'yes');

  if (field === 'group') {
    return letters.length === 1 && !hasNumber && !no && !yes ? letters[0].letter : undefined;
  }
  if (letters.length > 0) return undefined;
  if (field === 'hasCar') {
    if (hasNumber || (no && yes)) return undefined;
    if (no) return false;
    // "כן" / "יש לי רכב חברה"
    return yes || part.some((t) => t.kind === 'keyword') ? true : undefined;
  }
  if (!NUMERIC.has(field)) return undefined;
  if (!hasNumber) return no && !yes && ZERO_BY_NO.has(field) ? 0 : undefined;
  if (yes) return undefined;
  const text = numbers.map((t) => t.text).join(' ');
  const found = extractNumbers(text);
  if (found.length !== 1) return undefined;
  // A percent sign belongs only to percent fields ("בונוס 10%" is not shekels)
  if (found[0].percent && field !== 'pensionPct' && field !== 'studyFundPct') return undefined;
  const r = normalizeField(field as NumericField, text);
  return r.ok ? r.value : undefined;
}

/** What kind of value a part holds when it names no field */
function unnamedKind(part: Token[]): 'letter' | 'boolean' | 'number' | undefined {
  if (part.some((t) => t.kind === 'letter')) return 'letter';
  if (part.some((t) => t.kind === 'number')) return 'number';
  if (part.some((t) => t.kind === 'yes' || t.kind === 'no')) return 'boolean';
  return undefined;
}

/**
 * Fields and values read from a simple answer, or null when the model should read the message.
 * pendingFields: what the bot asked in its previous message (unnamed values can only go there).
 */
export function parseQuickAnswer(message: string, pendingFields: string[] = []): QuickAnswer | null {
  if (message.length > 120) return null;
  const parts = toParts(message);
  if (!parts || parts.length === 0) return null;

  const answer: QuickAnswer = {};
  const set = (field: QuickField, part: Token[]): boolean => {
    if (field in answer) return false; // the same field twice: unclear
    const value = partValue(part, field);
    if (value === undefined) return false;
    answer[field] = value;
    return true;
  };

  // 1. Parts that name their field ("2 ילדים", "אין בונוס", "קבוצה ב")
  const unnamed: Token[][] = [];
  for (const part of parts) {
    const field = namedField(part);
    if (field === null) return null;
    if (field === undefined) unnamed.push(part);
    else if (!set(field, part)) return null;
  }

  // 2. Unnamed parts: only into a pending field that is the single one of that kind still open
  const open = pendingFields.filter((f): f is QuickField => !(f in answer));
  for (const part of unnamed) {
    const kind = unnamedKind(part);
    const fits = open.filter((f) =>
      kind === 'letter' ? f === 'group' : kind === 'boolean' ? f === 'hasCar' || (open.length === 1 && ZERO_BY_NO.has(f)) : NUMERIC.has(f)
    );
    // Several pending fields could take this value: never guess which one was meant
    if (!kind || fits.length !== 1 || unnamed.filter((p) => unnamedKind(p) === kind).length > 1) return null;
    if (!set(fits[0], part)) return null;
  }

  return Object.keys(answer).length > 0 ? answer : null;
}
