/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EmployeeProfile } from '../engine/types.ts';

/** Placeholder car name used when the employee has a car but the model is unknown */
const UNKNOWN_CAR_NAME = 'רכב חברה נוכחי';

export interface ProfileFieldStatus {
  field: keyof EmployeeProfile;
  label_he: string;
  known: boolean;
  /** Display value when known (plain digits, no thousands separators) */
  value?: string;
}

/**
 * Single source of truth for "is this field already on the employee card?".
 * The agent must check this before asking the employee for any field.
 */
export function getProfileFieldStatus(profile: EmployeeProfile): ProfileFieldStatus[] {
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const str = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

  const fields: ProfileFieldStatus[] = [
    { field: 'base', label_he: 'שכר בסיס חודשי', known: num(profile.base) && profile.base > 0, value: String(profile.base) },
    { field: 'group', label_he: 'קבוצת זכאות', known: str(profile.group), value: profile.group },
    { field: 'occupation', label_he: 'עיסוק/תפקיד', known: str(profile.occupation), value: profile.occupation },
    { field: 'hasCar', label_he: 'רכב חברה כיום', known: typeof profile.hasCar === 'boolean', value: profile.hasCar ? 'כן' : 'לא' },
    { field: 'commissions', label_he: 'עמלות', known: num(profile.commissions), value: String(profile.commissions) },
    { field: 'bonus', label_he: 'בונוס', known: num(profile.bonus), value: String(profile.bonus) },
    { field: 'pensionPct', label_he: 'אחוז הפרשה לפנסיה', known: num(profile.pensionPct), value: String(profile.pensionPct) },
    { field: 'studyFundPct', label_he: 'אחוז הפרשה לקרן השתלמות', known: num(profile.studyFundPct), value: String(profile.studyFundPct) },
    { field: 'creditPoints', label_he: 'נקודות זיכוי', known: num(profile.creditPoints), value: String(profile.creditPoints) },
    { field: 'childrenUpTo23', label_he: 'מספר ילדים עד גיל 23', known: num(profile.childrenUpTo23), value: String(profile.childrenUpTo23) },
  ];

  if (profile.hasCar) {
    fields.push(
      {
        field: 'currentCarName',
        label_he: 'דגם רכב נוכחי',
        known: str(profile.currentCarName) && profile.currentCarName !== UNKNOWN_CAR_NAME,
        value: profile.currentCarName,
      },
      { field: 'currentBenefit', label_he: 'שווי שימוש נוכחי', known: num(profile.currentBenefit) && profile.currentBenefit > 0, value: String(profile.currentBenefit) },
      { field: 'currentParticipation', label_he: 'השתתפות עובד ברכב הנוכחי', known: num(profile.currentParticipation), value: String(profile.currentParticipation) },
    );
  } else {
    fields.push({ field: 'currentMaintenance', label_he: 'דמי אחזקת רכב', known: num(profile.currentMaintenance), value: String(profile.currentMaintenance) });
  }

  return fields.map((f) => (f.known ? f : { ...f, value: undefined }));
}

/** Hebrew card snapshot injected into the system instruction on every LLM call */
export function describeProfileCard(profile: EmployeeProfile): string {
  const lines = getProfileFieldStatus(profile).map((f) =>
    f.known ? `- ${f.label_he} (${f.field}): ✓ קיים בכרטיס = ${f.value}` : `- ${f.label_he} (${f.field}): ✗ חסר`
  );
  return `כרטיס העובד הנוכחי (מתעדכן אוטומטית אחרי כל update_profile):\n${lines.join('\n')}`;
}

/** Greeting that asks only for card fields that are actually missing */
export function buildOpeningMessage(profile: EmployeeProfile): string {
  const intro =
    'היי, אני יועץ הרכב. אפשר לשאול אותי מה יקרה לנטו אם תעברו לרכב חשמלי, תחליפו רכב, תוותרו על הרכב או תבחרו במסלול ברוכת ילדים.';
  const status = getProfileFieldStatus(profile);
  const baseKnown = status.find((f) => f.field === 'base')?.known;
  const groupKnown = status.find((f) => f.field === 'group')?.known;

  if (baseKnown && groupKnown) return `${intro} פרטי השכר וקבוצת הזכאות כבר מופיעים בכרטיס שלך, אז אפשר לשאול ישר.`;
  if (baseKnown) return `${intro} שכר הבסיס כבר בכרטיס. באיזו קבוצת זכאות (א–ד) אתם?`;
  if (groupKnown) return `${intro} קבוצת הזכאות כבר בכרטיס. מה שכר הבסיס החודשי שלכם?`;
  return `${intro} נתחיל מהשכר: באיזו קבוצת זכאות (א–ד) אתם ומה שכר הבסיס החודשי?`;
}
