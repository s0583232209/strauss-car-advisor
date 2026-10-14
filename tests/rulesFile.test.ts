import { afterEach, describe, expect, it } from 'vitest';
import catalogData from '../src/data/catalog.json';
import employees from '../src/data/employees.json';
import rulesFile from '../src/data/strauss-rules.json';
import { calculateEVGrossUp, calculateNetBreakdown } from '../src/engine/net.ts';
import { getRules, resetRules, setRules } from '../src/engine/rules.ts';
import { buildScenario } from '../src/engine/scenario.ts';
import { calculatePensionCredit } from '../src/engine/tax.ts';
import type { Car, EmployeeProfile, Rules } from '../src/engine/types.ts';

// Fields added in strauss-rules.json (SPEC 4.1): rounding, pensionCredit.maxContributionRate, familyTrack.cars.
// Money is compared with toBeCloseTo(x, 2).
const catalog = catalogData as Car[];
const emp = (id: string) => (employees as EmployeeProfile[]).find((e) => e.id === id)!;
const car = (model: string) => catalog.find((c) => c.model === model)!;
const withRules = (patch: (r: Rules) => void) => {
  const r = JSON.parse(JSON.stringify(getRules())) as Rules;
  patch(r);
  setRules(r);
};

afterEach(() => resetRules());

describe('rules file', () => {
  it('declares no rounding during the calculation, shekel rounding on display', () => {
    expect(rulesFile.netMethod.rounding.during).toBe('none');
    expect(rulesFile.netMethod.rounding.display).toBe('shekel');
  });

  it('family track lists CARNIVAL and SANTA FE, both in the family group of the catalog', () => {
    expect(rulesFile.familyTrack.cars).toEqual(['CAR-19', 'CAR-20']);
    for (const id of rulesFile.familyTrack.cars) {
      expect(catalog.find((c) => c.id === id)?.group).toBe('משפחתי');
    }
  });
});

describe('calculateEVGrossUp with rounding.during = none', () => {
  // Noa: COROLLA CROSS → ATTO 3 (SPEC 8.1, displayed gross-up 440)
  const noaAlt = () => {
    const r = buildScenario(emp('E-001'), { type: 'go_electric', targetCarId: car('ATTO 3').id, targetCar: car('ATTO 3') });
    return { ...r.altState, evGrossUp: 0 };
  };

  it('yields exactly +250 net (unrounded gross-up 439.91, displayed 440)', () => {
    const s = noaAlt();
    const g = calculateEVGrossUp(s, 250);
    const delta = calculateNetBreakdown({ ...s, evGrossUp: g }).net - calculateNetBreakdown(s).net;
    expect(delta).toBeCloseTo(250, 2);
    expect(g).toBeCloseTo(439.91, 1);
    expect(Math.round(g)).toBe(440);
  });

  it("rounding.during = 'shekel' keeps the old whole-shekel gross-up (440)", () => {
    withRules((r) => {
      r.netMethod.rounding.during = 'shekel';
    });
    expect(calculateEVGrossUp(noaAlt(), 250)).toBeCloseTo(440, 2);
  });
});

describe('calculatePensionCredit reads maxContributionRate', () => {
  it('default 0.35 × 0.07 × 9,500 = 232.75 max', () => {
    expect(calculatePensionCredit(10000)).toBeCloseTo(232.75, 2);
  });

  it('maxContributionRate 0.05 → 0.35 × 0.05 × 9,500 = 166.25 max', () => {
    withRules((r) => {
      r.netMethod.pensionCredit.maxContributionRate = 0.05;
    });
    expect(calculatePensionCredit(10000)).toBeCloseTo(166.25, 2);
  });
});

describe('buildScenario family track uses familyTrack.cars', () => {
  it('without a car id it defaults to the first listed car (CARNIVAL, cost 6,000)', () => {
    const r = buildScenario(emp('E-002'), { type: 'family_track' });
    expect(r.altState.familyGapShare).toBeCloseTo((6000 - 3700) * 0.5, 2);
    expect(r.companyCost).toBeCloseTo(6000, 2);
  });

  it('a car outside the list is not eligible for the family track', () => {
    const r = buildScenario(emp('E-002'), { type: 'family_track', targetCarId: car('NIRO').id });
    expect(r.eligible).toBe(false);
  });

  it('the default follows the rules file order', () => {
    withRules((r) => {
      r.familyTrack.cars = ['CAR-20'];
    });
    const r = buildScenario(emp('E-002'), { type: 'family_track' });
    expect(r.companyCost).toBeCloseTo(5600, 2);
  });
});
