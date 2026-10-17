/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Admin use cases: rules, reference data, the Tax Authority file and the calibration suite */

import catalogData from '../../data/catalog.json';
import employeesData from '../../data/employees.json';
import occupationsData from '../../data/occupations.json';
import { lookupBenefitValue, makeLookupKey } from '../engine/benefit.ts';
import { getRules, resetRules, setRules } from '../engine/rules.ts';
import type { AdminOverview, Car, EmployeeProfile, Occupation, Rules, VehicleLookupResult } from '../engine/types.ts';
import type { Repository } from '../../dal/index.ts';
import { runCalibrationSuite } from './calibration.ts';
import { parseTaxAuthorityCsv } from './taxCsv.ts';

export class InvalidRulesError extends Error {
  readonly status = 400;
}

/** The parts of Rules the engine reads directly; anything else is checked by the calibration suite */
function assertRulesShape(r: any): asserts r is Rules {
  const ok =
    r &&
    typeof r === 'object' &&
    r.budgets && typeof r.budgets === 'object' &&
    Array.isArray(r.groupOrder) &&
    r.netMethod && Array.isArray(r.netMethod.brackets) &&
    typeof r.netMethod.creditPointValue === 'number' &&
    r.netMethod.nationalInsurance && r.netMethod.health && r.netMethod.pensionCredit;
  if (!ok) throw new InvalidRulesError('קובץ הכללים חסר שדות חובה (budgets, groupOrder, netMethod)');
}

export function createAdminService(repo: Repository) {
  return {
    /** Applies the saved rules override at startup (the engine reads rules from memory) */
    async init(): Promise<void> {
      const saved = await repo.getRules();
      if (saved) setRules(saved);
    },

    async overview(): Promise<AdminOverview> {
      return {
        rules: getRules(),
        catalog: catalogData as Car[],
        occupations: occupationsData as Occupation[],
        employees: employeesData as EmployeeProfile[],
        taxRecordCount: await repo.countTaxRecords(),
        storage: repo.kind,
      };
    },

    async saveRules(rules: unknown): Promise<Rules> {
      assertRulesShape(rules);
      setRules(rules);
      await repo.saveRules(getRules());
      return getRules();
    },

    async resetRules(): Promise<Rules> {
      resetRules();
      await repo.saveRules(null);
      return getRules();
    },

    runCalibration: runCalibrationSuite,

    async importTaxCsv(buffer: Uint8Array): Promise<number> {
      const records = parseTaxAuthorityCsv(buffer);
      await repo.saveTaxRecords(records);
      return records.length;
    },

    clearTaxRecords: () => repo.clearTaxRecords(),

    /** Uploaded Tax Authority file first, then the seed and the catalog */
    async lookup(regYear: string, vehicleType: string, productCode: string, modelCode: string): Promise<VehicleLookupResult | null> {
      const key = makeLookupKey(regYear, vehicleType, productCode, modelCode);
      return (await repo.getTaxRecord(key)) ?? lookupBenefitValue(regYear, productCode, modelCode, vehicleType);
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
