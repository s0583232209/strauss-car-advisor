import { describe, expect, it } from 'vitest';
import { calculateNationalInsuranceAndHealth } from '../server/bl/engine/tax.ts';

// SPEC 3.1: niHealth = 0.0427 × min(base, 7,522) + 0.1217 × (min(base, 50,695) − 7,522)
// (NI 1.04% + health 3.23% below the threshold, NI 7% + health 5.17% above it)
describe('calculateNationalInsuranceAndHealth (niHealth)', () => {
  it('at the threshold: 7,522 × 0.0427 = 321.1894', () => {
    expect(calculateNationalInsuranceAndHealth(7522)).toBeCloseTo(321.1894, 2);
  });

  it('above the threshold: 321.1894 + 2,478 × 0.1217 (301.5726) = 622.762', () => {
    expect(calculateNationalInsuranceAndHealth(10000)).toBeCloseTo(622.762, 2);
  });

  it('is 0 for no income', () => {
    expect(calculateNationalInsuranceAndHealth(0)).toBeCloseTo(0, 2);
  });
});
