/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import catalogData from '../data/catalog.json';
import employeesData from '../data/employees.json';
import { lookupBenefitValue, makeLookupKey } from '../engine/benefit.ts';
import { buildScenario, findCarByIdOrName, findOccupation } from '../engine/scenario.ts';
import { Car, EmployeeProfile, ScenarioRequest } from '../engine/types.ts';

export interface TestCaseResult {
  name: string;
  category: 'benchmark' | 'rules' | 'lookup' | 'group_b';
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

export interface CalibrationSummary {
  passed: number;
  failed: number;
  total: number;
  results: TestCaseResult[];
}

export async function runCalibrationSuite(): Promise<CalibrationSummary> {
  const results: TestCaseResult[] = [];
  const employees = employeesData as EmployeeProfile[];
  const catalog = catalogData as Car[];

  // Helper assertion
  function assertTolerance(
    testName: string,
    category: TestCaseResult['category'],
    actualVal: number,
    expectedVal: number,
    tolerance = 1,
    details = ''
  ) {
    const diff = Math.abs(actualVal - expectedVal);
    const passed = diff <= tolerance;
    results.push({
      name: testName,
      category,
      passed,
      expected: expectedVal.toLocaleString(),
      actual: actualVal.toLocaleString(),
      details: passed ? details : `${details} (פער: ${diff.toFixed(2)})`,
    });
  }

  function assertCondition(
    testName: string,
    category: TestCaseResult['category'],
    condition: boolean,
    expectedDesc: string,
    actualDesc: string,
    details = ''
  ) {
    results.push({
      name: testName,
      category,
      passed: condition,
      expected: expectedDesc,
      actual: actualDesc,
      details,
    });
  }

  // ==========================================
  // 8.1 BENCHMARK EMPLOYEES (Exact ±1 ₪)
  // ==========================================

  // 1. Noa (נועה): COROLLA CROSS -> ATTO 3
  const noa = employees.find((e) => e.id === 'E-001')!;
  const noaReq: ScenarioRequest = { type: 'go_electric', targetCarId: 'CAR-10' };
  const noaRes = buildScenario(noa, noaReq);

  assertTolerance('נועה: נטו היום', 'benchmark', Math.round(noaRes.todayBreakdown.net), 11032);
  assertTolerance('נועה: נטו חלופה (ATTO 3)', 'benchmark', Math.round(noaRes.altBreakdown.net), 11693);
  assertTolerance('נועה: הפרש נטו (+661)', 'benchmark', noaRes.diffNet, 661);
  assertTolerance('נועה: מס היום (3,443)', 'benchmark', Math.round(noaRes.todayBreakdown.tax), 3443);
  assertTolerance('נועה: מס חלופה (3,283)', 'benchmark', Math.round(noaRes.altBreakdown.tax), 3283);
  assertTolerance('נועה: ביטוח לאומי+בריאות היום (2,153)', 'benchmark', Math.round(noaRes.todayBreakdown.niHealth), 2153);
  assertTolerance('נועה: ביטוח לאומי+בריאות חלופה (2,092)', 'benchmark', Math.round(noaRes.altBreakdown.niHealth), 2092);
  assertTolerance('נועה: גילום החזר חשמל (440)', 'benchmark', Math.round(noaRes.altState.evGrossUp), 440);

  // 2. David (דוד): NIRO -> CARNIVAL (Family track)
  const david = employees.find((e) => e.id === 'E-002')!;
  const davidReq: ScenarioRequest = { type: 'family_track', targetCarId: 'CAR-19' };
  const davidRes = buildScenario(david, davidReq);

  assertTolerance('דוד: נטו היום', 'benchmark', Math.round(davidRes.todayBreakdown.net), 8600);
  assertTolerance('דוד: נטו חלופה (קרניבל)', 'benchmark', Math.round(davidRes.altBreakdown.net), 5078);
  assertTolerance('דוד: הפרש נטו (-3,522)', 'benchmark', davidRes.diffNet, -3522);
  assertTolerance('דוד: מס היום (1,369)', 'benchmark', Math.round(davidRes.todayBreakdown.tax), 1369);
  assertTolerance('דוד: מס חלופה (2,861)', 'benchmark', Math.round(davidRes.altBreakdown.tax), 2861);
  assertTolerance('דוד: ביטוח לאומי+בריאות היום (1,250)', 'benchmark', Math.round(davidRes.todayBreakdown.niHealth), 1250);
  assertTolerance('דוד: ביטוח לאומי+בריאות חלופה (1,879)', 'benchmark', Math.round(davidRes.altBreakdown.niHealth), 1879);
  assertTolerance('דוד: חלק עובד בפער (1,150)', 'benchmark', Math.round(davidRes.employeeGap), 1150);

  // 3. Rachel (רחל): Waiver 1,500 -> MG4
  const rachel = employees.find((e) => e.id === 'E-003')!;
  const rachelReq: ScenarioRequest = { type: 'go_electric', targetCarId: 'CAR-06' };
  const rachelRes = buildScenario(rachel, rachelReq);

  assertTolerance('רחל: נטו היום (ויתור 1,500)', 'benchmark', Math.round(rachelRes.todayBreakdown.net), 15047);
  assertTolerance('רחל: נטו חלופה (MG4)', 'benchmark', Math.round(rachelRes.altBreakdown.net), 13109);
  assertTolerance('רחל: הפרש נטו (-1,938)', 'benchmark', rachelRes.diffNet, -1938);
  assertTolerance('רחל: מס היום (3,419)', 'benchmark', Math.round(rachelRes.todayBreakdown.tax), 3419);
  assertTolerance('רחל: מס חלופה (3,910)', 'benchmark', Math.round(rachelRes.altBreakdown.tax), 3910);
  assertTolerance('רחל: ביטוח לאומי+בריאות היום (2,144)', 'benchmark', Math.round(rachelRes.todayBreakdown.niHealth), 2144);
  assertTolerance('רחל: ביטוח לאומי+בריאות חלופה (2,315)', 'benchmark', Math.round(rachelRes.altBreakdown.niHealth), 2315);
  assertTolerance('רחל: גילום החזר חשמל (473)', 'benchmark', Math.round(rachelRes.altState.evGrossUp), 473);

  // 4. Yossi (יוסי): TUCSON -> EV3
  const yossi = employees.find((e) => e.id === 'E-004')!;
  const yossiReq: ScenarioRequest = { type: 'go_electric', targetCarId: 'CAR-11' };
  const yossiRes = buildScenario(yossi, yossiReq);

  assertTolerance('יוסי: נטו היום', 'benchmark', Math.round(yossiRes.todayBreakdown.net), 10693);
  assertTolerance('יוסי: נטו חלופה (EV3)', 'benchmark', Math.round(yossiRes.altBreakdown.net), 11900);
  assertTolerance('יוסי: הפרש נטו (+1,207)', 'benchmark', yossiRes.diffNet, 1207);
  assertTolerance('יוסי: מס היום (3,991)', 'benchmark', Math.round(yossiRes.todayBreakdown.tax), 3991);
  assertTolerance('יוסי: מס חלופה (3,497)', 'benchmark', Math.round(yossiRes.altBreakdown.tax), 3497);
  assertTolerance('יוסי: ביטוח לאומי+בריאות היום (2,301)', 'benchmark', Math.round(yossiRes.todayBreakdown.niHealth), 2301);
  assertTolerance('יוסי: ביטוח לאומי+בריאות חלופה (2,128)', 'benchmark', Math.round(yossiRes.altBreakdown.niHealth), 2128);
  assertTolerance('יוסי: גילום החזר חשמל (440)', 'benchmark', Math.round(yossiRes.altState.evGrossUp), 440);

  // 5. Michal (מיכל): MAZDA 3 -> Waiver 2,000
  const michal = employees.find((e) => e.id === 'E-005')!;
  const michalReq: ScenarioRequest = { type: 'waive_car' };
  const michalRes = buildScenario(michal, michalReq);

  assertTolerance('מיכל: נטו היום', 'benchmark', Math.round(michalRes.todayBreakdown.net), 14244);
  assertTolerance('מיכל: נטו חלופה (ויתור 2,000)', 'benchmark', Math.round(michalRes.altBreakdown.net), 17806);
  assertTolerance('מיכל: הפרש נטו (+3,562)', 'benchmark', michalRes.diffNet, 3562);
  assertTolerance('מיכל: מס היום (6,593)', 'benchmark', Math.round(michalRes.todayBreakdown.tax), 6593);
  assertTolerance('מיכל: מס חלופה (5,694)', 'benchmark', Math.round(michalRes.altBreakdown.tax), 5694);
  assertTolerance('מיכל: ביטוח לאומי+בריאות היום (3,248)', 'benchmark', Math.round(michalRes.todayBreakdown.niHealth), 3248);
  assertTolerance('מיכל: ביטוח לאומי+בריאות חלופה (2,935)', 'benchmark', Math.round(michalRes.altBreakdown.niHealth), 2935);

  // 6. Eli (אלי): OCTAVIA -> MODEL 3
  const eli = employees.find((e) => e.id === 'E-006')!;
  const eliReq: ScenarioRequest = { type: 'go_electric', targetCarId: 'CAR-14' };
  const eliRes = buildScenario(eli, eliReq);

  assertTolerance('אלי: נטו היום', 'benchmark', Math.round(eliRes.todayBreakdown.net), 17073);
  assertTolerance('אלי: נטו חלופה (MODEL 3)', 'benchmark', Math.round(eliRes.altBreakdown.net), 17794);
  assertTolerance('אלי: הפרש נטו (+721)', 'benchmark', eliRes.diffNet, 721);
  assertTolerance('אלי: מס היום (9,367)', 'benchmark', Math.round(eliRes.todayBreakdown.tax), 9367);
  assertTolerance('אלי: מס חלופה (9,183)', 'benchmark', Math.round(eliRes.altBreakdown.tax), 9183);
  assertTolerance('אלי: ביטוח לאומי+בריאות היום (4,170)', 'benchmark', Math.round(eliRes.todayBreakdown.niHealth), 4170);
  assertTolerance('אלי: ביטוח לאומי+בריאות חלופה (4,106)', 'benchmark', Math.round(eliRes.altBreakdown.niHealth), 4106);
  assertTolerance('אלי: גילום החזר חשמל (473)', 'benchmark', Math.round(eliRes.altState.evGrossUp), 473);

  // ==========================================
  // 8.2 RULE ASSERTIONS
  // ==========================================

  // Step breakdown telescoping sum check
  const allScenarios = [noaRes, davidRes, rachelRes, yossiRes, michalRes, eliRes];
  for (const sc of allScenarios) {
    const isSumExact = Math.abs(sc.sumSteps - sc.exactDiff) < 0.001;
    assertCondition(
      `סכום צעדי הדלתא שווה בדיוק להפרש (${sc.todayCarLabel})`,
      'rules',
      isSumExact,
      `סכום צעדים = הפרש מדויק (${sc.exactDiff.toFixed(2)})`,
      `סכום = ${sc.sumSteps.toFixed(2)}`
    );
  }

  // Hybrid and Plug-in get NO refund
  const hybridTestCar = catalog.find((c) => c.driveCode === 1)!;
  const plugInTestCar = catalog.find((c) => c.driveCode === 2)!;
  const hybridRes = buildScenario(noa, { type: 'change_car', targetCar: hybridTestCar });
  const plugInRes = buildScenario(eli, { type: 'change_car', targetCar: plugInTestCar });
  assertCondition(
    'רכב היברידי אינו מקבל החזר חשמל',
    'rules',
    hybridRes.altState.evGrossUp === 0,
    'evGrossUp = 0',
    `evGrossUp = ${hybridRes.altState.evGrossUp}`
  );
  assertCondition(
    'רכב פלאג-אין אינו מקבל החזר חשמל',
    'rules',
    plugInRes.altState.evGrossUp === 0,
    'evGrossUp = 0',
    `evGrossUp = ${plugInRes.altState.evGrossUp}`
  );

  // Mandatory car role cannot waive
  const salesRepOcc = findOccupation('נציג/ת מכירות שטח');
  assertCondition(
    'נציג שטח: רכב חובה, אינו רשאי לוותר',
    'rules',
    salesRepOcc?.carMandatory === true && salesRepOcc?.canWaive === false,
    'carMandatory=true, canWaive=false',
    `carMandatory=${salesRepOcc?.carMandatory}, canWaive=${salesRepOcc?.canWaive}`
  );
  const davidWaiveRes = buildScenario(david, { type: 'waive_car' });
  assertCondition(
    'ניסיון ויתור על רכב ע"י דוד (נציג מכירות) נחסם',
    'rules',
    !davidWaiveRes.eligible,
    'eligible = false',
    `eligible = ${davidWaiveRes.eligible}`
  );

  // Family track eligibility check (min 4 kids)
  const noaFamilyRes = buildScenario(noa, { type: 'family_track' });
  assertCondition(
    'נועה (2 ילדים) נחסמת במסלול ברוכת ילדים',
    'rules',
    !noaFamilyRes.eligible,
    'eligible = false',
    `eligible = ${noaFamilyRes.eligible}`
  );
  assertCondition(
    'דוד (5 ילדים) זכאי למסלול ברוכת ילדים',
    'rules',
    davidRes.eligible,
    'eligible = true',
    `eligible = ${davidRes.eligible}`
  );

  // Group restriction check: group א cannot choose group ג
  const groupAEmp: EmployeeProfile = {
    ...noa,
    group: 'א',
    occupation: 'טכנאי/ת שירות',
  };
  const highCar = catalog.find((c) => c.group === 'ג')!;
  const illegalChoiceRes = buildScenario(groupAEmp, { type: 'change_car', targetCar: highCar });
  assertCondition(
    'עובד מקבוצה א אינו יכול לבחור רכב מקבוצה ג',
    'rules',
    !illegalChoiceRes.eligible,
    'eligible = false',
    `eligible = ${illegalChoiceRes.eligible}`
  );

  // Family cars cannot be chosen as regular company cars
  const carnivalCar = catalog.find((c) => c.id === 'CAR-19')!;
  const regularCarnivalChoice = buildScenario(noa, { type: 'change_car', targetCar: carnivalCar });
  assertCondition(
    'רכב משפחתי (קרניבל) אינו ניתן לבחירה במסלול רגיל',
    'rules',
    !regularCarnivalChoice.eligible,
    'eligible = false',
    `eligible = ${regularCarnivalChoice.eligible}`
  );

  // Family gap example: budget 3,500, cost 6,000 -> gap 2,500 -> 1,250 / 1,250
  const groupAFamily = { ...groupAEmp, childrenUpTo23: 4 };
  const groupAFamilyRes = buildScenario(groupAFamily, { type: 'family_track', targetCarId: 'CAR-19' });
  assertTolerance(
    'דוגמת פער משפחתי (תקציב 3,500, עלות 6,000): חלק עובד 1,250',
    'rules',
    groupAFamilyRes.employeeGap,
    1250,
    0
  );

  // ==========================================
  // LOOKUP SPECIFICS (ATTO 3 vs TANG, Seed)
  // ==========================================
  const atto3Lookup = await lookupBenefitValue('2025', '01014', '00003', '1');
  const tangLookup = await lookupBenefitValue('2025', '01014', '00003', '2');

  assertCondition(
    'חיפוש עם סוג רכב 1 מחזיר ATTO 3 עם שווי 3,130',
    'lookup',
    atto3Lookup?.value === 3130 && atto3Lookup?.commercialName === 'ATTO 3',
    'value = 3,130 (ATTO 3)',
    `value = ${atto3Lookup?.value} (${atto3Lookup?.commercialName})`
  );

  assertCondition(
    'חיפוש עם סוג רכב 2 מחזיר TANG עם שווי 6,950',
    'lookup',
    tangLookup?.value === 6950 && tangLookup?.commercialName === 'TANG',
    'value = 6,950 (TANG)',
    `value = ${tangLookup?.value} (${tangLookup?.commercialName})`
  );

  // All 20 catalog cars have matching benefit in tax seed
  let allCatalogMatch = true;
  for (const car of catalog) {
    const seedVal = await lookupBenefitValue(car.year, car.productCode, car.modelCode, '1');
    if (!seedVal || seedVal.value !== car.benefit) {
      allCatalogMatch = false;
      break;
    }
  }
  assertCondition(
    'כל 20 רכבי הקטלוג תואמים ב-100% לשווי השימוש בבסיס הנתונים',
    'lookup',
    allCatalogMatch,
    'תואם מלא (20/20)',
    allCatalogMatch ? 'תואם מלא' : 'אי התאמה'
  );

  // ==========================================
  // 8.3 GENERIC GROUP-B WAIVER
  // ==========================================
  const shira = employees.find((e) => e.id === 'E-GEN-B')!;
  const shiraRes = buildScenario(shira, { type: 'waive_car' });

  assertCondition(
    'ויתור מהנדסת תהליך קבוצה ב: זכאית לויתור',
    'group_b',
    shiraRes.eligible,
    'eligible = true',
    `eligible = ${shiraRes.eligible}`
  );
  assertTolerance(
    'ויתור מהנדסת תהליך קבוצה ב: דמי אחזקה 1,500',
    'group_b',
    shiraRes.altState.maintenance,
    1500,
    0
  );
  assertTolerance(
    'ויתור מהנדסת תהליך קבוצה ב: שווי שימוש מתאפס',
    'group_b',
    shiraRes.altState.benefitValue,
    0,
    0
  );
  assertTolerance(
    'ויתור מהנדסת תהליך קבוצה ב: השתתפות עצמית מתאפסת',
    'group_b',
    shiraRes.altState.participation,
    0,
    0
  );
  assertCondition(
    'ויתור קבוצה ב: סכום צעדי הדלתא שווה בדיוק להפרש הנטו',
    'group_b',
    Math.abs(shiraRes.sumSteps - shiraRes.exactDiff) < 0.001,
    'סכום צעדים = הפרש מדויק',
    `צעדים = ${shiraRes.sumSteps.toFixed(2)}, הפרש = ${shiraRes.exactDiff.toFixed(2)}`
  );

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    passed,
    failed,
    total: results.length,
    results,
  };
}
