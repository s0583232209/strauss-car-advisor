import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import catalogData from '../src/data/catalog.json';
import employees from '../src/data/employees.json';
import { roundStepsToTotal } from '../src/engine/explain.ts';
import { buildScenario } from '../src/engine/scenario.ts';
import type { Car, DeltaStep, EmployeeProfile, ScenarioType } from '../src/engine/types.ts';

const catalog = catalogData as Car[];
const sumRounded = (steps: DeltaStep[]) => steps.reduce((acc, s) => acc + (s.deltaNetRounded as number), 0);
// Money is compared to 2 decimals, never with exact equality
const expectMoney = (actual: number[], expected: number[]) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((a, i) => expect(a).toBeCloseTo(expected[i], 2));
};
const step = (key: DeltaStep['key'], deltaNet: number): DeltaStep => ({ key, label_he: key, deltaNet, explanation_he: '' });

describe('roundStepsToTotal', () => {
  it('rounds each step and gives the leftover to the largest step', () => {
    // 0.4 + 0.4 + 660.4 = 661.2; shown difference 662 (e.g. round(11692.6) - round(11031.4))
    const out = roundStepsToTotal([step('benefit', 0.4), step('participation', 0.4), step('evGrossUp', 660.4)], 662);
    expectMoney(out.map((s) => s.deltaNetRounded as number), [0, 0, 662]);
    expectMoney(out.map((s) => s.deltaNet), [0.4, 0.4, 660.4]); // exact values unchanged
  });

  it('uses the absolute value to pick the largest step', () => {
    const out = roundStepsToTotal([step('benefit', 100.5), step('participation', -500.5)], -401);
    expectMoney(out.map((s) => s.deltaNetRounded as number), [101, -502]);
  });

  it('returns no steps for no change, and refuses a difference with no steps', () => {
    expect(roundStepsToTotal([], 0)).toEqual([]);
    expect(() => roundStepsToTotal([], 1)).toThrow();
  });

  it('1,000 random inputs: rounded steps always add up to the shown difference', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 60000, noNaN: true }),
        fc.array(fc.double({ min: -20000, max: 20000, noNaN: true }), { minLength: 1, maxLength: 5 }),
        (todayNet, deltas) => {
          const altNet = todayNet + deltas.reduce((a, b) => a + b, 0);
          const shown = Math.round(altNet) - Math.round(todayNet) + 0; // + 0: -0 and 0 are the same shekel
          const out = roundStepsToTotal(deltas.map((d) => step('benefit', d)), shown);
          expect(sumRounded(out)).toBeCloseTo(shown, 2);
          for (const s of out) expect(Number.isInteger(s.deltaNetRounded)).toBe(true);
          // Only one step may differ from its own rounding
          const adjusted = out.filter((s) => s.deltaNetRounded !== Math.round(s.deltaNet) + 0);
          expect(adjusted.length).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 1000 }
    );
  });
});

describe('buildScenario: the card steps add up to the shown difference', () => {
  // The six SPEC 8.1 scenarios (employee, scenario, expected difference copied from SPEC 8.1)
  const SPEC_CASES: Array<[string, ScenarioType, string | undefined, number]> = [
    ['E-001', 'go_electric', 'CAR-10', 661],
    ['E-002', 'family_track', 'CAR-19', -3522],
    ['E-003', 'go_electric', 'CAR-06', -1938],
    ['E-004', 'go_electric', 'CAR-11', 1207],
    ['E-005', 'waive_car', undefined, 3562],
    ['E-006', 'go_electric', 'CAR-14', 721],
  ];

  it.each(SPEC_CASES)('%s %s', (id, type, carId, expectedDiff) => {
    const emp = (employees as EmployeeProfile[]).find((e) => e.id === id)!;
    const targetCar = carId ? catalog.find((c) => c.id === carId) : undefined;
    const r = buildScenario(emp, { type, targetCarId: carId, targetCar });
    expect(r.diffNet).toBeCloseTo(expectedDiff, 2);
    expect(sumRounded(r.steps)).toBeCloseTo(r.diffNet, 2);
  });

  it('1,000 random employees and scenarios', () => {
    const groups = ['א', 'ב', 'ג', 'ד'] as const;
    const types: ScenarioType[] = ['change_car', 'go_electric', 'family_track', 'waive_car', 'keep'];
    const money = (max: number) => fc.integer({ min: 0, max });
    const profile = fc.record({
      group: fc.constantFrom(...groups),
      base: money(80000),
      commissions: money(15000),
      bonus: money(15000),
      pensionPct: fc.integer({ min: 0, max: 40 }).map((n) => n / 2), // 0-20 in halves
      studyFundPct: fc.integer({ min: 0, max: 20 }).map((n) => n / 2), // 0-10
      creditPoints: fc.integer({ min: 0, max: 60 }).map((n) => n / 4), // 0-15 in quarters
      childrenUpTo23: fc.integer({ min: 0, max: 15 }),
      hasCar: fc.boolean(),
      currentBenefit: money(9000),
      currentParticipation: money(1500),
      currentMaintenance: money(3000),
    });

    fc.assert(
      fc.property(profile, fc.constantFrom(...types), fc.constantFrom(...catalog), (p, type, car) => {
        const emp = { ...p, occupation: 'מנהל/ת מוצר', currentCarName: 'רכב' } as EmployeeProfile;
        const r = buildScenario(emp, { type, targetCarId: car.id, targetCar: car });
        expect(sumRounded(r.steps)).toBeCloseTo(r.diffNet, 2);
        expect(r.diffNet).toBeCloseTo(Math.round(r.altBreakdown.net) - Math.round(r.todayBreakdown.net), 2);
      }),
      { numRuns: 1000 }
    );
  });
});
