/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Input normalization for employee-stated values (pure, no I/O).
 * Turns "6 אחוז", "שש אחוז", "0.06", "18 אלף וחצי" into numbers before update_profile saves them.
 * Never guesses: an unclear or out-of-range value is returned as not ok, with a Hebrew question to ask.
 */

export type PercentField = 'pensionPct' | 'studyFundPct';
export type CountField = 'creditPoints' | 'childrenUpTo23';
export type MoneyField =
  | 'base'
  | 'commissions'
  | 'bonus'
  | 'currentParticipation'
  | 'currentBenefit'
  | 'currentMaintenance';
export type NumericField = PercentField | CountField | MoneyField;

export type NormalizeResult =
  | { ok: true; value: number }
  | { ok: false; ambiguous: true; suggested: number; question_he: string }
  | { ok: false; ambiguous?: false; reason: 'out_of_range' | 'unreadable' | 'negative'; question_he: string };

/** Valid ranges (inclusive). Outside: not saved, the bot asks again. */
export const FIELD_RANGES: Record<PercentField | CountField, [number, number]> = {
  pensionPct: [0, 20],
  studyFundPct: [0, 10],
  creditPoints: [0, 15],
  childrenUpTo23: [0, 15],
};

const FIELD_LABELS_HE: Record<NumericField, string> = {
  pensionPct: 'הפרשה לפנסיה',
  studyFundPct: 'הפרשה לקרן השתלמות',
  creditPoints: 'נקודות זיכוי',
  childrenUpTo23: 'מספר ילדים עד גיל 23',
  base: 'שכר בסיס',
  commissions: 'עמלות',
  bonus: 'בונוס',
  currentParticipation: 'השתתפות ברכב',
  currentBenefit: 'שווי שימוש',
  currentMaintenance: 'דמי אחזקה',
};

const PERCENT_FIELDS = new Set<string>(['pensionPct', 'studyFundPct']);
const COUNT_FIELDS = new Set<string>(['creditPoints', 'childrenUpTo23']);

// Hebrew number words 0-10 (masculine and feminine, construct forms)
const UNITS: Record<string, number> = {
  אפס: 0,
  אחד: 1, אחת: 1,
  שניים: 2, שתיים: 2, שני: 2, שתי: 2, שנים: 2, שתים: 2,
  שלושה: 3, שלוש: 3, שלשה: 3, שלש: 3,
  ארבעה: 4, ארבע: 4,
  חמישה: 5, חמש: 5, חמשה: 5,
  שישה: 6, שש: 6, ששה: 6,
  שבעה: 7, שבע: 7,
  שמונה: 8,
  תשעה: 9, תשע: 9,
  עשרה: 10, עשר: 10,
};
const TEEN_SUFFIX = new Set(['עשר', 'עשרה']); // "שש עשרה" = 16
const TENS: Record<string, number> = { עשרים: 20 };
const HALF = new Set(['וחצי', 'חצי']);
const THOUSAND = new Set(['אלף', 'אלפים', 'k', 'K']);

/** Looks up a Hebrew number word, allowing one prefix letter (ו/ב/ל/ה/ש/מ: "ושש", "בשש"). */
function wordValue(word: string, table: Record<string, number>): number | undefined {
  if (word in table) return table[word];
  const stripped = word.replace(/^[והבלשמ]/, '');
  return stripped !== word && stripped in table ? table[stripped] : undefined;
}

/** A number found in free text, with whether it was written as a percent or as money. */
export interface FoundNumber {
  value: number;
  percent: boolean;
  negative: boolean;
}

/**
 * Finds every number in free text: digits ("18,500", "6.5%", "0.06"), "18 אלף", "18.5K",
 * Hebrew words up to 20 ("שש", "שש עשרה", "עשרים") and "וחצי" ("שתיים וחצי", "18 אלף וחצי").
 */
export function extractNumbers(text: string): FoundNumber[] {
  const found: FoundNumber[] = [];
  // Split digits from letters and signs so "6%", "18K", "ב-661" become separate tokens
  // ("ב-661" is a Hebrew prefix, not a minus sign)
  const tokens = text
    .replace(/([א-ת])[-־](?=\d)/g, '$1 ')
    .replace(/(\d)([^\d.,\s])/g, '$1 $2')
    .replace(/([^\d.,\s-])(\d)/g, '$1 $2')
    .split(/[\s;:!?()"'״׳/]+|,(?!\d)|(?<!\d),/)
    .filter((t) => t !== '');

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    let value: number | undefined;
    let negative = false;

    const digits = tok.match(/^(-?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\.?$/);
    if (digits) {
      negative = digits[1] === '-';
      value = Number(digits[2].replace(/,/g, '') + (digits[3] ?? ''));
    } else {
      const unit = wordValue(tok, UNITS);
      const tens = wordValue(tok, TENS);
      if (unit !== undefined) {
        value = unit;
        // "שש עשרה" / "שלושה עשר" = 13-19
        if (unit > 0 && unit < 10 && TEEN_SUFFIX.has(tokens[i + 1] ?? '')) {
          value = unit + 10;
          i++;
        }
      } else if (tens !== undefined) {
        value = tens;
      }
    }
    if (value === undefined || !Number.isFinite(value)) continue;

    // "וחצי" right after the number, then "אלף" (18 וחצי אלף), or "אלף" then "וחצי" (18 אלף וחצי)
    let next = tokens[i + 1] ?? '';
    if (HALF.has(next)) {
      value += 0.5;
      next = tokens[++i + 1] ?? '';
    }
    if (THOUSAND.has(next)) {
      value *= 1000;
      next = tokens[++i + 1] ?? '';
      if (HALF.has(next)) {
        value += 500;
        next = tokens[++i + 1] ?? '';
      }
    }
    const percent = next === '%' || /^(ו?אחוז|אחוזים)$/.test(next);
    found.push({ value: Math.round(value * 1e6) / 1e6, percent, negative });
  }
  return found;
}

function firstNumber(raw: unknown): FoundNumber | undefined {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? { value: Math.abs(raw), percent: false, negative: raw < 0 } : undefined;
  }
  if (typeof raw !== 'string') return undefined;
  return extractNumbers(raw)[0];
}

function unreadable(field: NumericField): NormalizeResult {
  return { ok: false, reason: 'unreadable', question_he: `לא הצלחתי להבין את ה${FIELD_LABELS_HE[field]}. אפשר לכתוב מספר?` };
}
function negative(field: NumericField): NormalizeResult {
  return { ok: false, reason: 'negative', question_he: `ה${FIELD_LABELS_HE[field]} לא יכול להיות שלילי. מה הערך הנכון?` };
}
function outOfRange(field: PercentField | CountField, value: number): NormalizeResult {
  const [min, max] = FIELD_RANGES[field];
  const unit = PERCENT_FIELDS.has(field) ? '%' : '';
  return {
    ok: false,
    reason: 'out_of_range',
    question_he: `${value}${unit} נראה לא סביר עבור ${FIELD_LABELS_HE[field]} (טווח תקין ${min}–${max}${unit}). מה הערך הנכון?`,
  };
}
const inRange = (field: PercentField | CountField, v: number) => v >= FIELD_RANGES[field][0] && v <= FIELD_RANGES[field][1];

/**
 * Percent as a number (6 means 6%). "6", "6%", "6 אחוז", "6 לפנסיה", "שש אחוז", "6.5" → 6 / 6.5.
 * A value strictly between 0 and 1 is read as a fraction (0.06 → 6) only when x100 is in the
 * field's range; otherwise it is ambiguous and the bot asks "התכוונת ל-X%?".
 */
export function parsePercent(raw: unknown, field: PercentField): NormalizeResult {
  const n = firstNumber(raw);
  if (!n) return unreadable(field);
  if (n.negative) return negative(field);
  let value = n.value;
  if (value > 0 && value < 1) {
    const asPercent = Math.round(value * 100 * 1e6) / 1e6;
    if (!inRange(field, asPercent)) {
      return { ok: false, ambiguous: true, suggested: value, question_he: `התכוונת ל-${value}%?` };
    }
    value = asPercent;
  }
  if (!inRange(field, value)) return outOfRange(field, value);
  return { ok: true, value };
}

/** Money in shekels: "18,500", "18500", "18.5 אלף", "18 אלף וחצי" → 18500. */
export function parseMoney(raw: unknown, field: MoneyField = 'base'): NormalizeResult {
  const n = firstNumber(raw);
  if (!n) return unreadable(field);
  if (n.negative) return negative(field);
  return { ok: true, value: Math.round(n.value * 100) / 100 };
}

/** Credit points (halves allowed) and number of children (whole number), with range checks. */
export function parseCount(raw: unknown, field: CountField): NormalizeResult {
  const n = firstNumber(raw);
  if (!n) return unreadable(field);
  if (n.negative) return negative(field);
  if (field === 'childrenUpTo23' && !Number.isInteger(n.value)) return outOfRange(field, n.value);
  if (!inRange(field, n.value)) return outOfRange(field, n.value);
  return { ok: true, value: n.value };
}

/** Dispatches a profile field to the matching parser. */
export function normalizeField(field: NumericField, raw: unknown): NormalizeResult {
  if (PERCENT_FIELDS.has(field)) return parsePercent(raw, field as PercentField);
  if (COUNT_FIELDS.has(field)) return parseCount(raw, field as CountField);
  return parseMoney(raw, field as MoneyField);
}

/** Short Hebrew confirmation of a saved value, e.g. "פנסיה 6%" or "שכר בסיס 18,500 ₪". */
export function describeValue(field: NumericField, value: number): string {
  if (PERCENT_FIELDS.has(field)) return `${FIELD_LABELS_HE[field]} ${value}%`;
  if (COUNT_FIELDS.has(field)) return `${FIELD_LABELS_HE[field]} ${value}`;
  return `${FIELD_LABELS_HE[field]} ${value.toLocaleString('en-US')} ₪`;
}

// ---------------------------------------------------------------------------
// Eligibility group: saved only when the employee wrote it (like numbers)
// ---------------------------------------------------------------------------

const GROUP_LETTERS = ['א', 'ב', 'ג', 'ד'] as const;
const FAMILY_GROUP = 'משפחתי';
// Quote marks around a letter: "ב'", "ב׳", "'ב'"
const stripQuotes = (s: string) => s.replace(/^["'׳״`]+|["'׳״`]+$/g, '');

/** "ב", "ב'", "ב׳", "קבוצה ב", "משפחתי" → the group; anything else (e.g. "B", "שנייה") → undefined */
export function normalizeGroup(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = stripQuotes(raw.trim().replace(/^קבוצ(ה|ת)\s+/, '').trim());
  if ((GROUP_LETTERS as readonly string[]).includes(t)) return t;
  return t.startsWith(FAMILY_GROUP) ? FAMILY_GROUP : undefined;
}

/**
 * True when the employee wrote this group: the letter as a word of its own ("קבוצה ב", "אני בקבוצה ג",
 * "ב'") or "משפחתי". A Hebrew prefix is not a group ("בקבוצה" is not ב) and neither is "ב-15 אלף":
 * hyphens do not split words.
 */
export function groupStated(texts: string[], group: string): boolean {
  if (group === FAMILY_GROUP) return texts.some((t) => t.includes(FAMILY_GROUP));
  return texts.some((t) =>
    t
      .split(/[\s,.:;!?()/]+/)
      .map(stripQuotes)
      .some((word) => word === group)
  );
}
