/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Active reference data: car catalog, occupations and sample employees. Starts from the files in
 * server/data; the admin can replace each table with an uploaded file (saved by the admin service and
 * applied again at startup), like the rules in rules.ts.
 */

import catalogData from '../../data/catalog.json';
import employeesData from '../../data/employees.json';
import occupationsData from '../../data/occupations.json';
import type { Car, EmployeeProfile, Occupation } from './types.ts';

export type ReferenceKind = 'catalog' | 'occupations' | 'employees';

export interface ReferenceData {
  catalog: Car[];
  occupations: Occupation[];
  employees: EmployeeProfile[];
}

export const REFERENCE_KINDS: readonly ReferenceKind[] = ['catalog', 'occupations', 'employees'];

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const defaults: ReferenceData = {
  catalog: catalogData as Car[],
  occupations: occupationsData as Occupation[],
  employees: employeesData as EmployeeProfile[],
};

const active: ReferenceData = clone(defaults);
// Bumped on every change, so derived indexes (occupation names) know when to rebuild
let version = 0;

export const getCatalog = (): Car[] => active.catalog;
export const getOccupations = (): Occupation[] => active.occupations;
export const getEmployees = (): EmployeeProfile[] => active.employees;
export const referenceVersion = (): number => version;

/** The built-in table from server/data */
export function defaultReferenceData<K extends ReferenceKind>(kind: K): ReferenceData[K] {
  return clone(defaults[kind]);
}

export function setReferenceData<K extends ReferenceKind>(kind: K, rows: ReferenceData[K]): void {
  active[kind] = clone(rows);
  version++;
}

export function resetReferenceData(kind: ReferenceKind): void {
  setReferenceData(kind, defaults[kind]);
}
