/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import defaultRulesData from '../data/strauss-rules.json';
import { EligibilityGroup, Rules } from './types.ts';

let activeRules: Rules = JSON.parse(JSON.stringify(defaultRulesData));

/** Get current active rules configuration */
export function getRules(): Rules {
  return activeRules;
}

/** Update active rules (used by Admin) */
export function setRules(newRules: Rules): void {
  activeRules = JSON.parse(JSON.stringify(newRules));
}

/** Reset rules to built-in default */
export function resetRules(): void {
  activeRules = JSON.parse(JSON.stringify(defaultRulesData));
}

/** Get monthly car budget for a given eligibility group */
export function getGroupBudget(group: string): number {
  return activeRules.budgets[group] || 0;
}

/**
 * Check if employee in group `employeeGroup` can select a car in `carGroup`.
 * Rule: own_group_or_lower (Family group cars are restricted to family track only).
 */
export function canSelectCarGroup(employeeGroup: EligibilityGroup, carGroup: EligibilityGroup): boolean {
  if (carGroup === 'משפחתי') {
    return false; // Only selectable via the dedicated family track
  }
  const order = activeRules.groupOrder;
  const empIdx = order.indexOf(employeeGroup);
  const carIdx = order.indexOf(carGroup);
  if (empIdx === -1 || carIdx === -1) return false;
  return carIdx <= empIdx;
}
