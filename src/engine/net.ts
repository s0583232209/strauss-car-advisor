/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getRules } from './rules.ts';
import { calculateIncomeTax, calculateNationalInsuranceAndHealth } from './tax.ts';
import { NetBreakdown, TaxCalculationInputs } from './types.ts';

/**
 * Computes full monthly net salary breakdown for an employee in a given state.
 * Decimals/agorot used internally; display rounding happens at presentation level.
 */
export function calculateNetBreakdown(state: TaxCalculationInputs): NetBreakdown {
  const pensionable = state.base + state.commissions + state.bonus;
  const pension = (state.pensionPct / 100) * pensionable;
  const studyFund = (state.studyFundPct / 100) * pensionable;

  const cash = pensionable + state.maintenance + state.evGrossUp;
  const taxableBase = cash + state.benefitValue;

  const { bracketTax, pensionCredit, tax } = calculateIncomeTax(
    taxableBase,
    pension,
    state.creditPoints
  );

  const niHealth = calculateNationalInsuranceAndHealth(taxableBase);

  const net =
    cash -
    tax -
    niHealth -
    pension -
    studyFund -
    state.participation -
    state.familyGapShare;

  return {
    pensionable,
    pension,
    studyFund,
    cash,
    taxableBase,
    bracketTax,
    pensionCredit,
    tax,
    niHealth,
    participation: state.participation,
    familyGapShare: state.familyGapShare,
    evGrossUp: state.evGrossUp,
    net,
  };
}

/**
 * Calculates EV refund gross-up amount to achieve target net (default +250 ₪ net).
 * Uses bisection on evGrossUp to find the exact gross amount (|Δnet − target| < 0.005).
 * rules.netMethod.rounding.during = 'none': returned unrounded, so the net bonus is exactly 250
 * (Noa 439.91, Yossi 439.91, Rachel 473.22, Eli 473.22; displayed 440 / 473).
 * 'shekel': rounded to whole shekels when that stays within 1 ₪ of the target.
 */
export function calculateEVGrossUp(
  stateWithoutEV: TaxCalculationInputs,
  targetNetBonus = 250
): number {
  const rules = getRules();
  if (rules.electric.method === 'gross_250') {
    return targetNetBonus;
  }

  const baseNet = calculateNetBreakdown({ ...stateWithoutEV, evGrossUp: 0 }).net;

  let low = 0;
  let high = 1500;
  let bestGross = 0;

  // Bisection with tolerance 0.005
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    const testNet = calculateNetBreakdown({ ...stateWithoutEV, evGrossUp: mid }).net;
    const delta = testNet - baseNet;

    if (Math.abs(delta - targetNetBonus) < 0.005) {
      bestGross = mid;
      break;
    }

    if (delta < targetNetBonus) {
      low = mid;
    } else {
      high = mid;
    }
    bestGross = mid;
  }

  if (rules.netMethod.rounding.during === 'none') {
    return bestGross;
  }

  // Round to nearest integer for realistic Israeli payslip gross-up
  const roundedGross = Math.round(bestGross);
  const roundedNetDelta =
    calculateNetBreakdown({ ...stateWithoutEV, evGrossUp: roundedGross }).net - baseNet;

  // If rounded integer is within 1 shekel of 250, use the clean integer amount
  if (Math.abs(roundedNetDelta - targetNetBonus) <= 1.0) {
    return roundedGross;
  }

  return bestGross;
}
