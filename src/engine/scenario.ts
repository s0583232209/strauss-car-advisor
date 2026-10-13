/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import catalogData from '../data/catalog.json';
import occupationsData from '../data/occupations.json';
import { buildDeltaSteps, buildPlainHebrewSummary } from './explain.ts';
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

/** Find occupation info for an employee */
export function findOccupation(occupationName: string): Occupation | undefined {
  const clean = occupationName.trim();
  return occupationsList.find(
    (o) => o.occupation === clean || clean.includes(o.occupation) || o.occupation.includes(clean)
  );
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
  const occ = findOccupation(profile.occupation) || {
    occupation: profile.occupation,
    group: profile.group,
    carMandatory: false,
    canWaive: true,
    maintenance: profile.currentMaintenance || 1500,
  };

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
    altCarLabel = `ויתור על רכב ואחזקת רכב (${occ.maintenance.toLocaleString()} ₪)`;
    if (occ.carMandatory || !occ.canWaive) {
      eligible = false;
      eligibilityReason_he = `עיסוקך (${occ.occupation}) מוגדר כבעל רכב חובה תפעולי ואינו מאפשר ויתור על הרכב. באפשרותך לבחור רכב אחר, לעבור לרכב חשמלי או לבחור במסלול משפחתי.`;
    } else {
      eligibilityReason_he = 'העיסוק שלך מאפשר ויתור על רכב חברה כנגד דמי אחזקת רכב לפי הנהלים.';
    }
    altState.benefitValue = 0;
    altState.maintenance = occ.maintenance;
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
  const { steps, sumSteps } =
    request.type === 'keep'
      ? { steps: [], sumSteps: 0 }
      : buildDeltaSteps(todayState, altState);

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
