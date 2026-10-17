/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import catalogData from '../../data/catalog.json';
import occupationAliases from '../../data/occupation-aliases.json';
import occupationsData from '../../data/occupations.json';
import { buildDeltaSteps, buildPlainHebrewSummary, roundStepsToTotal } from './explain.ts';
import { calculateEVGrossUp, calculateNetBreakdown } from './net.ts';
import { canSelectCarGroup, getGroupBudget, getRules } from './rules.ts';
import {
  Car,
  ComparisonResult,
  EmployeeProfile,
  Occupation,
  ScenarioRequest,
  TaxCalculationInputs,
} from './types.ts';

const carsCatalog = catalogData as Car[];
const occupationsList = occupationsData as Occupation[];

/** Find car in catalog by ID or model name */
export function findCarByIdOrName(query: string): Car | undefined {
  const clean = query.trim().toLowerCase();
  return carsCatalog.find(
    (c) =>
      c.id.toLowerCase() === clean ||
      c.model.toLowerCase() === clean ||
      clean.includes(c.model.toLowerCase()) ||
      c.model.toLowerCase().includes(clean)
  );
}

// "נציג/ת" → "נציג", no quotes, lowercase, single spaces
const normOccupation = (s: string) =>
  s.replace(/\/(ית|ת|ה)(?=\s|$)/g, '').replace(/["'׳״]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Every word of the official occupation names ("נציג", "מכירות", "שטח", ...)
const occupationWords = new Set(occupationsList.flatMap((o) => normOccupation(o.occupation).split(' ')));

/** Feminine word forms to the listed form: "נציגה" → "נציג", "מנהלת" → "מנהל", "אנליסטית" → "אנליסט" */
function baseWord(w: string): string {
  if (occupationWords.has(w)) return w;
  for (const suffix of ['ית', 'ת', 'ה']) {
    if (w.endsWith(suffix) && occupationWords.has(w.slice(0, -suffix.length))) return w.slice(0, -suffix.length);
  }
  return w;
}
const occupationKey = (s: string) => normOccupation(s).split(' ').map(baseWord).join(' ');

// Names that identify one occupation: the official name and its aliases, longest first
const occupationNames = occupationsList
  .flatMap((o) => [o.occupation, ...((occupationAliases as Record<string, string[]>)[o.occupation] ?? [])].map((n) => ({ key: occupationKey(n), occ: o })))
  .sort((a, b) => b.key.length - a.key.length);

/**
 * Find occupation info for an employee. Matches the official name, its feminine form or a listed
 * alias, also inside a sentence ("אני נציגת מכירות שטח"). A partial name ("מנהל") matches nothing:
 * several occupations fit, and guessing could allow a waiver that is not allowed.
 */
export function findOccupation(occupationName: string | undefined): Occupation | undefined {
  const key = occupationKey(occupationName ?? '');
  if (!key) return undefined; // occupation is optional outside waive_car; '' must not match the first row
  const exact = occupationNames.find((n) => n.key === key);
  if (exact) return exact.occ;
  return occupationNames.find((n) => ` ${key} `.includes(` ${n.key} `))?.occ;
}

/**
 * Builds a complete comparison scenario between the employee's today state
 * and a requested alternative (change_car, go_electric, family_track, waive_car).
 */
export function buildScenario(
  profile: EmployeeProfile,
  request: ScenarioRequest
): ComparisonResult {
  const rules = getRules();
  // Unknown occupation: never assume a waiver is allowed or guess a maintenance amount
  const occ = findOccupation(profile.occupation);

  const budget = getGroupBudget(profile.group);

  // 1. Determine Today State
  const todayState: TaxCalculationInputs = {
    base: profile.base,
    commissions: profile.commissions,
    bonus: profile.bonus,
    pensionPct: profile.pensionPct,
    studyFundPct: profile.studyFundPct,
    creditPoints: profile.creditPoints,
    benefitValue: profile.hasCar ? profile.currentBenefit : 0,
    maintenance: profile.hasCar ? 0 : profile.currentMaintenance,
    participation: profile.hasCar ? profile.currentParticipation : 0,
    familyGapShare: 0,
    evGrossUp: 0,
  };

  const todayCarLabel = profile.hasCar
    ? profile.currentCarName || 'רכב חברה נוכחי'
    : `ללא רכב (דמי אחזקה ${profile.currentMaintenance.toLocaleString()} ₪)`;

  // 2. Build Alternative State based on scenario type
  let eligible = true;
  let eligibilityReason_he = '';
  let altCarLabel = '';
  let targetCar: Car | undefined = request.targetCar;
  let companyCost = 0;
  let employeeGap = 0;
  let employerGap = 0;
  let sourceNote = '';

  const altState: TaxCalculationInputs = {
    base: profile.base,
    commissions: profile.commissions,
    bonus: profile.bonus,
    pensionPct: profile.pensionPct,
    studyFundPct: profile.studyFundPct,
    creditPoints: profile.creditPoints,
    benefitValue: 0,
    maintenance: 0,
    participation: 0,
    familyGapShare: 0,
    evGrossUp: 0,
  };

  if (request.type === 'keep') {
    // No change: the alternative is exactly today's state.
    altCarLabel = todayCarLabel;
    altState.benefitValue = todayState.benefitValue;
    altState.maintenance = todayState.maintenance;
    altState.participation = todayState.participation;
    altState.familyGapShare = todayState.familyGapShare;
    altState.evGrossUp = 0;
  } else if (request.type === 'waive_car') {
    if (!occ) {
      altCarLabel = 'ויתור על רכב (העיסוק לא זוהה)';
      eligible = false;
      eligibilityReason_he = `העיסוק "${profile.occupation ?? ''}" לא זוהה ברשימת העיסוקים, ולכן אי אפשר לקבוע אם מותר לוותר על הרכב ומהו סכום האחזקה. יש לבחור עיסוק מהרשימה או לפנות לנציג שכר.`;
    } else if (occ.carMandatory || !occ.canWaive) {
      altCarLabel = `ויתור על רכב ואחזקת רכב (${occ.maintenance.toLocaleString()} ₪)`;
      eligible = false;
      eligibilityReason_he = `עיסוקך (${occ.occupation}) מוגדר כבעל רכב חובה תפעולי ואינו מאפשר ויתור על הרכב. באפשרותך לבחור רכב אחר, לעבור לרכב חשמלי או לבחור במסלול משפחתי.`;
    } else {
      altCarLabel = `ויתור על רכב ואחזקת רכב (${occ.maintenance.toLocaleString()} ₪)`;
      eligibilityReason_he = 'העיסוק שלך מאפשר ויתור על רכב חברה כנגד דמי אחזקת רכב לפי הנהלים.';
    }
    altState.benefitValue = 0;
    altState.maintenance = occ?.maintenance ?? 0;
    altState.participation = 0;
    altState.familyGapShare = 0;
    altState.evGrossUp = 0;
  } else if (request.type === 'family_track') {
    // Family track (ברוכת ילדים)
    const targetCarId = request.targetCarId || 'CAR-19'; // Default Carnival
    targetCar = carsCatalog.find((c) => c.id === targetCarId) || carsCatalog.find((c) => c.id === 'CAR-19')!;
    altCarLabel = `${targetCar.model} (${targetCar.fuel}) - מסלול ברוכת ילדים`;
    companyCost = targetCar.companyCost;

    const minKids = rules.familyTrack.minChildren;
    if (profile.childrenUpTo23 < minKids) {
      eligible = false;
      eligibilityReason_he = `מסלול ברוכת ילדים דורש לפחות ${minKids} ילדים עד גיל ${rules.familyTrack.childMaxAge} (הוזנו ${profile.childrenUpTo23} ילדים).`;
    } else {
      eligibilityReason_he = `זכאי/ת למסלול ברוכת ילדים (${profile.childrenUpTo23} ילדים עד גיל ${rules.familyTrack.childMaxAge}). החברה משתתפת ב-50% מהפער שמעל התקציב.`;
    }

    const gap = Math.max(0, companyCost - budget);
    employeeGap = gap * rules.familyTrack.gapSplitEmployee; // 50%
    employerGap = gap * (1 - rules.familyTrack.gapSplitEmployee); // 50%

    const participation =
      request.overrideParticipation !== undefined
        ? request.overrideParticipation
        : targetCar.participation;

    altState.benefitValue = targetCar.benefit;
    altState.maintenance = 0;
    altState.participation = participation;
    altState.familyGapShare = employeeGap;
    altState.evGrossUp = 0;
  } else {
    // change_car or go_electric
    if (!targetCar && request.targetCarId) {
      targetCar = carsCatalog.find((c) => c.id === request.targetCarId);
    }
    if (!targetCar) {
      // Default fallback if electric requested
      targetCar =
        request.type === 'go_electric'
          ? carsCatalog.find((c) => c.group === profile.group && c.driveCode === 3) ||
            carsCatalog.find((c) => c.id === 'CAR-10')!
          : carsCatalog.find((c) => c.group === profile.group)!;
    }

    companyCost = targetCar.companyCost;
    altCarLabel = `${targetCar.model} (${targetCar.fuel})`;

    // Check group eligibility (own group or lower)
    const canChoose = canSelectCarGroup(profile.group, targetCar.group);
    if (!canChoose) {
      eligible = false;
      eligibilityReason_he = `הרכב (${targetCar.model}) שייך לקבוצה ${targetCar.group}, בעוד קבוצת הזכאות שלך היא ${profile.group}. לפי הנהלים ניתן לבחור רכב מקבוצתך או נמוכה ממנה בלבד.`;
    } else {
      eligibilityReason_he = `הרכב מקבוצת הזכאות שלך (${profile.group}) או מקבוצה נמוכה ממנה.`;
    }

    if (companyCost < budget) {
      sourceNote = `עלות הרכב למעסיק (${companyCost.toLocaleString()} ₪) נמוכה מתקציב הקבוצה (${budget.toLocaleString()} ₪). לפי נוהל שטראוס, יתרת תקציב אינה נפדית במזומן.`;
    }

    const participation =
      request.overrideParticipation !== undefined
        ? request.overrideParticipation
        : targetCar.participation;

    altState.benefitValue = targetCar.benefit;
    altState.maintenance = 0;
    altState.participation = participation;
    altState.familyGapShare = 0;

    // EV refund gross-up: only driveCode 3 (electric) qualifies!
    if (targetCar.driveCode === 3) {
      const stateWithoutEV = { ...altState, evGrossUp: 0 };
      altState.evGrossUp = calculateEVGrossUp(stateWithoutEV, rules.electric.netBonus);
    } else {
      altState.evGrossUp = 0;
    }
  }

  // 3. Compute Net breakdowns
  const todayBreakdown = calculateNetBreakdown(todayState);
  const altBreakdown = calculateNetBreakdown(altState);

  // 4. Exact display difference = round(net_alt) - round(net_today)
  const diffNet = Math.round(altBreakdown.net) - Math.round(todayBreakdown.net);
  const exactDiff = altBreakdown.net - todayBreakdown.net;

  // 5. Delta Steps and Explanations
  const { steps: exactSteps, sumSteps } =
    request.type === 'keep'
      ? { steps: [], sumSteps: 0 }
      : buildDeltaSteps(todayState, altState);
  // Displayed (whole-shekel) steps add up exactly to the displayed difference
  const steps = roundStepsToTotal(exactSteps, diffNet);

  // SPEC 3.3: the delta steps must add up to the exact net difference.
  if (Math.abs(sumSteps - exactDiff) > 1e-6) {
    throw new Error(
      `buildScenario(${request.type}): sum of steps (${sumSteps}) != exactDiff (${exactDiff})`
    );
  }
  const summary_he = buildPlainHebrewSummary(todayState, altState, todayCarLabel, altCarLabel);

  return {
    scenarioType: request.type,
    requestedScenarioType: request.type,
    requestedCarId: request.targetCarId ?? targetCar?.id,
    eligible,
    eligibilityReason_he,
    todayState,
    todayBreakdown,
    altState,
    altBreakdown,
    diffNet,
    exactDiff,
    steps,
    sumSteps,
    summary_he,
    todayCarLabel,
    altCarLabel,
    targetCar,
    budget,
    companyCost,
    employeeGap,
    employerGap,
    sourceNote,
  };
}
