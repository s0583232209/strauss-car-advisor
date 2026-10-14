/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getRules } from './rules.ts';

/**
 * Computes progressive tax across Israeli income tax brackets (2025).
 * Uses decimals internally without intermediate rounding.
 */
export function calculateBracketTax(taxableBase: number): number {
  if (taxableBase <= 0) return 0;
  const rules = getRules();
  const brackets = rules.netMethod.brackets;

  let totalTax = 0;
  let prevCeiling = 0;

  for (const [ceiling, rate] of brackets) {
    if (taxableBase <= prevCeiling) break;
    const currentLimit = ceiling === null ? Infinity : ceiling;
    const taxableInBracket = Math.min(taxableBase, currentLimit) - prevCeiling;
    if (taxableInBracket > 0) {
      totalTax += taxableInBracket * rate;
    }
    if (ceiling === null || taxableBase <= currentLimit) {
      break;
    }
    prevCeiling = ceiling;
  }

  return totalTax;
}

/**
 * Computes the employee pension tax credit (זיכוי מס בגין הפקדה לפנסיה - סעיף 45א).
 * rate (35%) on the employee pension deposit, up to maxContributionRate (7%) of incomeCeiling (9,500 ₪)
 * -> max 232.75 ₪. All three values come from rules.netMethod.pensionCredit.
 */
export function calculatePensionCredit(pensionDeposit: number): number {
  if (pensionDeposit <= 0) return 0;
  const rules = getRules();
  const cfg = rules.netMethod.pensionCredit;
  const maxDeposit = cfg.maxContributionRate * cfg.incomeCeiling;
  const eligibleDeposit = Math.min(pensionDeposit, maxDeposit);
  return cfg.rate * eligibleDeposit;
}

/**
 * Computes total monthly income tax after deducting credit points and pension credit.
 */
export function calculateIncomeTax(
  taxableBase: number,
  pensionDeposit: number,
  creditPoints: number
): { bracketTax: number; pensionCredit: number; tax: number } {
  const rules = getRules();
  const bracketTax = calculateBracketTax(taxableBase);
  const pensionCredit = calculatePensionCredit(pensionDeposit);
  const creditPointDeduction = creditPoints * rules.netMethod.creditPointValue;

  const rawTax = bracketTax - creditPointDeduction - pensionCredit;
  const tax = Math.max(0, rawTax);

  return { bracketTax, pensionCredit, tax };
}

/**
 * Computes National Insurance (ביטוח לאומי) and Health Tax (מס בריאות).
 * Progressive rates up to threshold (7,522 ₪) and ceiling (50,695 ₪).
 */
export function calculateNationalInsuranceAndHealth(taxableBase: number): number {
  if (taxableBase <= 0) return 0;
  const rules = getRules();
  const ni = rules.netMethod.nationalInsurance;
  const health = rules.netMethod.health;

  const lowRate = ni.lowRate + health.lowRate; // 0.0427 (4.27%)
  const highRate = ni.highRate + health.highRate; // 0.1217 (12.17%)

  const threshold = ni.threshold;
  const ceiling = ni.ceiling;

  const lowPortion = Math.min(taxableBase, threshold);
  const highPortion = Math.max(0, Math.min(taxableBase, ceiling) - threshold);

  return (lowPortion * lowRate) + (highPortion * highRate);
}
