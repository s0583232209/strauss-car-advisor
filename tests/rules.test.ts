import { describe, expect, it } from 'vitest';
import catalogData from '../src/data/catalog.json';
import employees from '../src/data/employees.json';
import { buildScenario } from '../src/engine/scenario.ts';
import type { Car, EmployeeProfile, ScenarioType } from '../src/engine/types.ts';

// Rule assertions (SPEC 8.2, 8.3). Money is compared with toBeCloseTo(x, 2).
const catalog = catalogData as Car[];
const emp = (id: string) => (employees as EmployeeProfile[]).find((e) => e.id === id)!;
const car = (model: string) => catalog.find((c) => c.model === model)!;
const run = (p: EmployeeProfile, type: ScenarioType, c?: Car) =>
  buildScenario(p, { type, targetCarId: c?.id, targetCar: c });

describe('family track', () => {
  it('Eli (group ד, 4 children) with SANTA FE: gap 5,600 − 5,200 = 400, employee share 200', () => {
    const eli = emp('E-006');
    expect(eli.group).toBe('ד');
    expect(eli.childrenUpTo23).toBe(4);
    const r = run(eli, 'family_track', car('SANTA FE'));
    expect(r.eligible).toBe(true);
    expect(r.companyCost).toBeCloseTo(5600, 2);
    expect(r.budget).toBeCloseTo(5200, 2);
    expect(r.employeeGap + r.employerGap).toBeCloseTo(400, 2);
    expect(r.employeeGap).toBeCloseTo(200, 2);
    expect(r.employerGap).toBeCloseTo(200, 2);
    expect(r.altState.familyGapShare).toBeCloseTo(200, 2);
  });

  it('Yossi (3 children) is not eligible', () => {
    const yossi = emp('E-004');
    expect(yossi.childrenUpTo23).toBe(3);
    expect(run(yossi, 'family_track', car('SANTA FE')).eligible).toBe(false);
  });
});

describe('waiver', () => {
  it('group ב process engineer: maintenance 1,500 is taxable, not pensionable; benefit and participation drop', () => {
    const niro = car('NIRO');
    expect(niro.participation).toBeCloseTo(250, 2);
    const shira: EmployeeProfile = {
      occupation: 'מהנדס/ת תהליך',
      group: 'ב',
      base: 15000,
      commissions: 0,
      bonus: 0,
      pensionPct: 6,
      studyFundPct: 2.5,
      creditPoints: 2.25,
      childrenUpTo23: 0,
      hasCar: true,
      currentCarId: niro.id,
      currentCarName: niro.model,
      currentBenefit: niro.benefit,
      currentParticipation: 250,
      currentMaintenance: 0,
    };
    const r = run(shira, 'waive_car');
    expect(r.eligible).toBe(true);

    // Maintenance 1,500 instead of the car: benefit and participation are gone
    expect(r.altState.maintenance).toBeCloseTo(1500, 2);
    expect(r.altState.benefitValue).toBeCloseTo(0, 2);
    expect(r.altState.participation).toBeCloseTo(0, 2);
    expect(r.altBreakdown.participation).toBeCloseTo(0, 2);

    // Taxable: enters cash and the tax/NI base
    expect(r.altBreakdown.cash).toBeCloseTo(15000 + 1500, 2);
    expect(r.altBreakdown.taxableBase).toBeCloseTo(15000 + 1500, 2);
    expect(r.todayBreakdown.taxableBase).toBeCloseTo(15000 + niro.benefit, 2);

    // Not pensionable: pension and study fund stay on the 15,000 base
    expect(r.altBreakdown.pensionable).toBeCloseTo(15000, 2);
    expect(r.altBreakdown.pension).toBeCloseTo(900, 2);
    expect(r.altBreakdown.studyFund).toBeCloseTo(375, 2);
    expect(r.altBreakdown.pension).toBeCloseTo(r.todayBreakdown.pension, 2);

    // Steps add up to the difference (exact and as shown on the card)
    expect(r.sumSteps).toBeCloseTo(r.exactDiff, 2);
    const shown = r.steps.reduce((acc, s) => acc + (s.deltaNetRounded as number), 0);
    expect(shown).toBeCloseTo(r.diffNet, 2);
  });

  it.each([
    ['E-002', 'David'],
    ['E-004', 'Yossi'],
  ])('%s (%s) has a mandatory car and cannot waive', (id) => {
    const r = run(emp(id), 'waive_car');
    expect(r.eligible).toBe(false);
  });
});

describe('EV refund', () => {
  it.each<ScenarioType>(['change_car', 'go_electric'])('SPORTAGE HEV (plug-in) gets no EV refund (%s)', (type) => {
    const sportage = car('SPORTAGE HEV');
    expect(sportage.driveCode).toBe(2); // plug-in, not electric (3)
    const r = run(emp('E-006'), type, sportage);
    expect(r.altState.evGrossUp).toBeCloseTo(0, 2);
    expect(r.altBreakdown.evGrossUp).toBeCloseTo(0, 2);
    expect(r.steps.some((s) => s.key === 'evGrossUp')).toBe(false);
  });
});
