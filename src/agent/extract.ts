/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ExtractedField<T = any> {
  value: T | null;
  confidence: 'high' | 'medium' | 'low';
  sourceQuote: string;
}

export interface ExtractedPayslipData {
  occupation: ExtractedField<string>;
  base: ExtractedField<number>;
  commissions: ExtractedField<number>;
  bonus: ExtractedField<number>;
  pensionPct: ExtractedField<number>;
  studyFundPct: ExtractedField<number>;
  creditPoints: ExtractedField<number>;
  currentCar: ExtractedField<string>;
  carParticipation: ExtractedField<number>;
  maintenance: ExtractedField<number>;
  childrenUpTo23: ExtractedField<number>;
}

export const PAYSLIP_EXTRACTION_PROMPT = `
אתה מנתח תלושי שכר וחוזי העסקה רשמיים עבור מערכת שכר ישראלית.
עליך לחלץ מתוך התמונה/מסמך המצורף אך ורק את השדות הבאים, בדיוק רב:
- occupation: שם התפקיד או העיסוק
- base: שכר יסוד / שכר בסיס חודשי
- commissions: עמלות / פרמיות / שכר עידוד
- bonus: בונוס חודשי
- pensionPct: אחוז ניכוי עובד לתגמולים / פנסיה (בד"כ 6.0%)
- studyFundPct: אחוז ניכוי עובד לקרן השתלמות (בד"כ 2.5%)
- creditPoints: מספר נקודות זיכוי (למשל 2.25, 2.75)
- currentCar: רכב חברה קיים / דגם רכב אם מצוין
- carParticipation: ניכוי השתתפות עובד ברכב
- maintenance: דמי אחזקת רכב / שווי אחזקה
- childrenUpTo23: מספר ילדים עד גיל 23 אם מופיע

הנחיית ברזל:
אל תנחש לעולם! אם שדה אינו מופיע או אינו ברור, החזר null בערך value.
עבור כל שדה ספק:
- value: הערך (מספר או מחרוזת) או null
- confidence: "high" | "medium" | "low"
- sourceQuote: הציטוט המדויק מתוך התלוש/חוזה
החזר אך ורק מבנה JSON תקני.
`.trim();
