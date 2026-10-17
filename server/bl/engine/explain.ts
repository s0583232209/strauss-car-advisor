/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { calculateNetBreakdown } from './net.ts';
import { DeltaStep, TaxCalculationInputs } from './types.ts';

/**
 * Builds the sequential step-by-step delta explanation.
 * The total difference is the EXACT telescoping sum of sequential steps:
 * 1. benefit change
 * 2. maintenance change
 * 3. participation change
 * 4. family-track gap share
 * 5. EV refund gross-up
 */
export function buildDeltaSteps(
  todayState: TaxCalculationInputs,
  altState: TaxCalculationInputs
): { steps: DeltaStep[]; sumSteps: number; exactDiff: number } {
  const steps: DeltaStep[] = [];

  // state 0: today
  const s0 = { ...todayState };
  const net0 = calculateNetBreakdown(s0).net;

  // step 1: benefit change
  const s1 = { ...s0, benefitValue: altState.benefitValue };
  const net1 = calculateNetBreakdown(s1).net;
  const d1 = net1 - net0;
  if (Math.abs(todayState.benefitValue - altState.benefitValue) > 0.001 || Math.abs(d1) > 0.01) {
    steps.push({
      key: 'benefit',
      label_he: 'שינוי שווי שימוש',
      deltaNet: d1,
      explanation_he: `שווי שימוש ${Math.round(todayState.benefitValue).toLocaleString()} ₪ ← ${Math.round(altState.benefitValue).toLocaleString()} ₪ (משפיע על מס הכנסה, ביטוח לאומי ומס בריאות)`,
    });
  }

  // step 2: maintenance change
  const s2 = { ...s1, maintenance: altState.maintenance };
  const net2 = calculateNetBreakdown(s2).net;
  const d2 = net2 - net1;
  if (Math.abs(todayState.maintenance - altState.maintenance) > 0.001 || Math.abs(d2) > 0.01) {
    steps.push({
      key: 'maintenance',
      label_he: 'שינוי דמי אחזקה',
      deltaNet: d2,
      explanation_he: `דמי אחזקה ${Math.round(todayState.maintenance).toLocaleString()} ₪ ← ${Math.round(altState.maintenance).toLocaleString()} ₪ (תוספת לברוטו החייב במס, ללא הפרשות פנסיוניות)`,
    });
  }

  // step 3: participation change
  const s3 = { ...s2, participation: altState.participation };
  const net3 = calculateNetBreakdown(s3).net;
  const d3 = net3 - net2;
  if (Math.abs(todayState.participation - altState.participation) > 0.001 || Math.abs(d3) > 0.01) {
    steps.push({
      key: 'participation',
      label_he: 'שינוי השתתפות עובד',
      deltaNet: d3,
      explanation_he: `השתתפות עצמית ${Math.round(todayState.participation).toLocaleString()} ₪ ← ${Math.round(altState.participation).toLocaleString()} ₪ (ניכוי ישיר משכר הנטו)`,
    });
  }

  // step 4: family gap share
  const s4 = { ...s3, familyGapShare: altState.familyGapShare };
  const net4 = calculateNetBreakdown(s4).net;
  const d4 = net4 - net3;
  if (Math.abs(todayState.familyGapShare - altState.familyGapShare) > 0.001 || Math.abs(d4) > 0.01) {
    steps.push({
      key: 'familyGap',
      label_he: 'השתתפות בפער תקציב משפחתי',
      deltaNet: d4,
      explanation_he: `חלק העובד (50%) בפער שמעל תקציב הקבוצה עבור רכב 7-8 מקומות (${Math.round(altState.familyGapShare).toLocaleString()} ₪)`,
    });
  }

  // step 5: EV refund gross-up
  const s5 = { ...s4, evGrossUp: altState.evGrossUp };
  const net5 = calculateNetBreakdown(s5).net;
  const d5 = net5 - net4;
  if (Math.abs(todayState.evGrossUp - altState.evGrossUp) > 0.001 || Math.abs(d5) > 0.01) {
    steps.push({
      key: 'evGrossUp',
      label_he: 'החזר טעינה חשמלית',
      deltaNet: d5,
      explanation_he: `תוספת נטו של +250 ₪ בגין החזר טעינה חשמלית (מגולם בשכר הברוטו ב-${Math.round(altState.evGrossUp).toLocaleString()} ₪)`,
    });
  }

  const exactDiff = net5 - net0;
  const sumSteps = steps.reduce((acc, step) => acc + step.deltaNet, 0);

  return { steps, sumSteps, exactDiff };
}

/**
 * Rounds every step to whole shekels so the displayed steps add up exactly to the displayed
 * difference (diffNet = round(alt) - round(today)). The leftover from rounding goes to the step
 * with the largest absolute value (the first one on a tie). Returns new steps; deltaNet stays exact.
 */
export function roundStepsToTotal(steps: DeltaStep[], totalRounded: number): DeltaStep[] {
  if (steps.length === 0) {
    if (totalRounded !== 0) {
      throw new Error(`roundStepsToTotal: no steps but the displayed difference is ${totalRounded}`);
    }
    return [];
  }
  const rounded = steps.map((s) => ({ ...s, deltaNetRounded: Math.round(s.deltaNet) }));
  const leftover = totalRounded - rounded.reduce((acc, s) => acc + s.deltaNetRounded, 0);
  if (leftover !== 0) {
    let largest = 0;
    for (let i = 1; i < steps.length; i++) {
      if (Math.abs(steps[i].deltaNet) > Math.abs(steps[largest].deltaNet)) largest = i;
    }
    rounded[largest].deltaNetRounded += leftover;
  }
  // Math.round(-0.4) is -0: show it as 0
  for (const s of rounded) s.deltaNetRounded = s.deltaNetRounded + 0;
  return rounded;
}

/** Formats a two-line plain-Hebrew summary of the comparison */
export function buildPlainHebrewSummary(
  todayState: TaxCalculationInputs,
  altState: TaxCalculationInputs,
  todayLabel: string,
  altLabel: string
): [string, string] {
  const parts: string[] = [];

  if (Math.abs(todayState.benefitValue - altState.benefitValue) > 0) {
    parts.push(
      `שווי שימוש ${Math.round(todayState.benefitValue).toLocaleString()} ← ${Math.round(altState.benefitValue).toLocaleString()} ₪`
    );
  }

  if (altState.evGrossUp > 0) {
    parts.push(`+250 ₪ נטו החזר חשמל (מגולם)`);
  }

  if (Math.abs(todayState.participation - altState.participation) > 0) {
    parts.push(
      `השתתפות ${Math.round(todayState.participation).toLocaleString()} ← ${Math.round(altState.participation).toLocaleString()} ₪`
    );
  }

  if (altState.familyGapShare > 0) {
    parts.push(`השתתפות בפער רכב משפחתי ${Math.round(altState.familyGapShare).toLocaleString()} ₪`);
  }

  if (altState.maintenance > 0 || todayState.maintenance > 0) {
    parts.push(
      `אחזקת רכב ${Math.round(todayState.maintenance).toLocaleString()} ← ${Math.round(altState.maintenance).toLocaleString()} ₪`
    );
  }

  const line1 = `${todayLabel} ← ${altLabel}`;
  const line2 = parts.join(' · ') || 'ללא שינוי ברכיבי הרכב';

  return [line1, line2];
}
