/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The admin's data workbook (same layout as data/raw/catalog.xlsx) to reference data: sheets
 * 'קטלוג רכבים', 'עיסוקים' and 'עובדים לדוגמה'. Columns are found by their header, so their order
 * may change. Every row is checked; a sheet with an error is not applied, and the message names
 * the Excel row. The ID-number column of the employees sheet is never read.
 */

import type { Car, EligibilityGroup, EmployeeProfile, Occupation } from '../engine/types.ts';
import type { ReferenceData, ReferenceKind } from '../engine/referenceData.ts';
import { readXlsx } from './xlsx.ts';

export const SHEET_NAMES: Record<ReferenceKind, string> = {
  catalog: 'קטלוג רכבים',
  occupations: 'עיסוקים',
  employees: 'עובדים לדוגמה',
};

const CAR_GROUPS: readonly EligibilityGroup[] = ['א', 'ב', 'ג', 'ד', 'משפחתי'];
const EMPLOYEE_GROUPS: readonly EligibilityGroup[] = ['א', 'ב', 'ג', 'ד'];
// Drive codes as in the Tax Authority file: 0 gasoline · 1 hybrid · 2 plug-in · 3 electric
const DRIVE_CODES: Record<string, number> = { בנזין: 0, היברידי: 1, 'פלאג-אין': 2, חשמלי: 3 };
const NO_CAR_NAME = 'ללא רכב (ויתור)';
// IDs that buildScenario uses as defaults (scenario.ts): a catalog without them would break a comparison
const REQUIRED_CARS: Record<string, string> = {
  'CAR-19': 'ברירת המחדל במסלול המשפחתי',
  'CAR-10': 'ברירת המחדל לרכב חשמלי',
};

export interface SheetResult<K extends ReferenceKind> {
  kind: K;
  sheet: string;
  rows: ReferenceData[K];
  /** Problems that stop this sheet from being applied */
  errors: string[];
  /** Worth a look, but the sheet can be applied */
  warnings: string[];
}

export type ParsedWorkbook = { [K in ReferenceKind]?: SheetResult<K> };

/** "שווי שימוש חודשי (דמה)" → "שווי שימוש חודשי" */
const normHeader = (h: string) => h.replace(/\([^)]*\)/g, '').replace(/[״"]/g, '"').replace(/\s+/g, ' ').trim();

/** Column per field: exact header first, then a header that starts with the name */
function columns<F extends string>(header: string[], fields: Record<F, string>, errors: string[]): Record<F, number> | null {
  const heads = header.map(normHeader);
  const out = {} as Record<F, number>;
  const missing: string[] = [];
  for (const [field, name] of Object.entries(fields) as Array<[F, string]>) {
    let i = heads.indexOf(name);
    if (i < 0) i = heads.findIndex((h) => h.startsWith(name));
    if (i < 0) missing.push(name);
    out[field] = i;
  }
  if (missing.length) {
    errors.push(`חסרות עמודות: ${missing.join(', ')}`);
    return null;
  }
  return out;
}

/** Data rows with their Excel row number; empty rows are skipped */
const dataRows = (rows: string[][]) =>
  rows.slice(1).map((cells, i) => ({ cells, line: i + 2 })).filter((r) => r.cells.some((c) => c !== ''));

class RowReader {
  constructor(private readonly cells: string[], private readonly line: number, private readonly errors: string[]) {}

  private error(name: string, message: string) {
    this.errors.push(`שורה ${this.line}, ${name}: ${message}`);
  }

  text(col: number, name: string, required = true): string {
    const v = (this.cells[col] ?? '').trim();
    if (required && !v) this.error(name, 'חסר ערך');
    return v;
  }

  number(col: number, name: string, min: number, max: number): number {
    const raw = (this.cells[col] ?? '').replace(/[,₪%\s]/g, '');
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n)) {
      this.error(name, raw === '' ? 'חסר ערך' : `"${this.cells[col]}" אינו מספר`);
      return 0;
    }
    if (n < min || n > max) this.error(name, `${n} מחוץ לטווח (${min}–${max})`);
    return n;
  }

  /** Product and model codes keep their leading zeros (Excel may drop them) */
  code(col: number, name: string): string {
    const v = this.text(col, name);
    if (v && !/^\d{1,5}$/.test(v)) this.error(name, `"${v}" אינו קוד מספרי`);
    return v.padStart(5, '0');
  }

  yesNo(col: number, name: string): boolean {
    const v = this.text(col, name);
    if (v === 'כן') return true;
    if (v !== 'לא' && v) this.error(name, `"${v}": יש לכתוב כן או לא`);
    return false;
  }

  oneOf<T extends string>(col: number, name: string, allowed: readonly T[]): T {
    const v = this.text(col, name).replace(/['׳]/g, '');
    if (v && !allowed.includes(v as T)) this.error(name, `"${v}" אינו אחד מ: ${allowed.join(', ')}`);
    return v as T;
  }
}

function duplicates(keys: string[]): string[] {
  const seen = new Set<string>();
  return [...new Set(keys.filter((k) => seen.size === seen.add(k).size))];
}

export function parseCatalogSheet(rows: string[][]): SheetResult<'catalog'> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const col = columns(rows[0] ?? [], {
    id: 'מזהה', group: 'קבוצה', make: 'תוצר', productCode: 'קוד תוצר', model: 'דגם', modelCode: 'קוד דגם',
    description: 'תאור דגם', year: 'שנת רישום', fuel: 'הנעה', listPrice: 'מחיר מחירון', benefit: 'שווי שימוש',
    companyCost: 'עלות חודשית', participation: 'השתתפות',
  }, errors);
  const cars: Car[] = [];
  if (col) {
    for (const { cells, line } of dataRows(rows)) {
      const r = new RowReader(cells, line, errors);
      const fuel = r.oneOf(col.fuel, 'הנעה', Object.keys(DRIVE_CODES));
      cars.push({
        id: r.text(col.id, 'מזהה'),
        group: r.oneOf(col.group, 'קבוצה', CAR_GROUPS),
        make: r.text(col.make, 'תוצר'),
        model: r.text(col.model, 'דגם'),
        productCode: r.code(col.productCode, 'קוד תוצר'),
        modelCode: r.code(col.modelCode, 'קוד דגם'),
        description: r.text(col.description, 'תאור דגם', false),
        year: r.number(col.year, 'שנת רישום', 1990, 2100),
        fuel,
        driveCode: DRIVE_CODES[fuel] ?? 0,
        listPrice: r.number(col.listPrice, 'מחיר מחירון', 0, 10_000_000),
        benefit: r.number(col.benefit, 'שווי שימוש', 1, 100_000),
        companyCost: r.number(col.companyCost, 'עלות חודשית לחברה', 0, 100_000),
        participation: r.number(col.participation, 'השתתפות עובד', 0, 100_000),
      });
    }
    if (!cars.length) errors.push('הגיליון ריק');
    for (const id of duplicates(cars.map((c) => c.id))) errors.push(`המזהה ${id} מופיע יותר מפעם אחת`);
    for (const g of ['א', 'ב', 'ג', 'ד'] as const) {
      if (cars.length && !cars.some((c) => c.group === g)) warnings.push(`אין רכב בקבוצה ${g}: עובדי הקבוצה יוכלו לבחור רק מקבוצות נמוכות יותר`);
    }
    if (cars.length && !cars.some((c) => c.group === 'משפחתי')) warnings.push('אין רכב במסלול המשפחתי');
    for (const [id, role] of Object.entries(REQUIRED_CARS)) {
      if (cars.length && !cars.some((c) => c.id === id)) errors.push(`חסר הרכב ${id} (${role}); המחשבון נשען עליו`);
    }
  }
  return { kind: 'catalog', sheet: SHEET_NAMES.catalog, rows: cars, errors, warnings };
}

export function parseOccupationsSheet(rows: string[][]): SheetResult<'occupations'> {
  const errors: string[] = [];
  const col = columns(rows[0] ?? [], {
    occupation: 'עיסוק', group: 'קבוצת זכאות', carMandatory: 'רכב חובה', canWaive: 'מותר לוותר', maintenance: 'אחזקת רכב',
  }, errors);
  const list: Occupation[] = [];
  if (col) {
    for (const { cells, line } of dataRows(rows)) {
      const r = new RowReader(cells, line, errors);
      const occ: Occupation = {
        occupation: r.text(col.occupation, 'עיסוק'),
        group: r.oneOf(col.group, 'קבוצת זכאות', EMPLOYEE_GROUPS),
        carMandatory: r.yesNo(col.carMandatory, 'רכב חובה'),
        canWaive: r.yesNo(col.canWaive, 'מותר לוותר'),
        maintenance: r.number(col.maintenance, 'אחזקת רכב', 0, 100_000),
      };
      if (occ.carMandatory && occ.canWaive) errors.push(`שורה ${line}: עיסוק עם רכב חובה לא יכול להיות "מותר לוותר"`);
      if (occ.canWaive && occ.maintenance <= 0) errors.push(`שורה ${line}: מותר לוותר אבל אחזקת הרכב היא 0`);
      list.push(occ);
    }
    if (!list.length) errors.push('הגיליון ריק');
    for (const name of duplicates(list.map((o) => o.occupation))) errors.push(`העיסוק "${name}" מופיע יותר מפעם אחת`);
  }
  return { kind: 'occupations', sheet: SHEET_NAMES.occupations, rows: list, errors, warnings: [] };
}

/**
 * Sample employees. The current car is matched to the catalog by model name or ID; "אין (אחזקה 1500 ₪)"
 * means no car with that maintenance.
 */
export function parseEmployeesSheet(rows: string[][], catalog: Car[], occupations: Occupation[]): SheetResult<'employees'> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const col = columns(rows[0] ?? [], {
    id: 'מזהה', name: 'שם', occupation: 'עיסוק', group: 'קבוצה', base: 'שכר בסיס', commissions: 'עמלות', bonus: 'בונוס',
    pensionPct: 'פנסיה עובד', studyFundPct: 'קרן השתלמות', creditPoints: 'נקודות זיכוי', children: 'ילדים',
    car: 'רכב היום', participation: 'השתתפות היום',
  }, errors);
  const list: EmployeeProfile[] = [];
  if (col) {
    for (const { cells, line } of dataRows(rows)) {
      const r = new RowReader(cells, line, errors);
      const carText = r.text(col.car, 'רכב היום');
      const noCar = /^(אין|ללא)/.test(carText);
      const car = noCar
        ? undefined
        : catalog.find((c) => c.id.toLowerCase() === carText.toLowerCase() || c.model.toLowerCase() === carText.toLowerCase());
      if (carText && !noCar && !car) errors.push(`שורה ${line}, רכב היום: "${carText}" לא נמצא בקטלוג הרכבים`);
      const maintenance = noCar ? Number(carText.replace(/,/g, '').match(/\d+(\.\d+)?/)?.[0] ?? 0) : 0;
      const occupation = r.text(col.occupation, 'עיסוק');
      if (occupation && !occupations.some((o) => o.occupation === occupation)) {
        warnings.push(`שורה ${line}: העיסוק "${occupation}" אינו בטבלת העיסוקים`);
      }
      list.push({
        id: r.text(col.id, 'מזהה'),
        name: r.text(col.name, 'שם'),
        occupation,
        group: r.oneOf(col.group, 'קבוצה', EMPLOYEE_GROUPS),
        base: r.number(col.base, 'שכר בסיס', 0, 1_000_000),
        commissions: r.number(col.commissions, 'עמלות', 0, 1_000_000),
        bonus: r.number(col.bonus, 'בונוס', 0, 1_000_000),
        pensionPct: r.number(col.pensionPct, 'פנסיה עובד %', 0, 100),
        studyFundPct: r.number(col.studyFundPct, 'קרן השתלמות %', 0, 100),
        creditPoints: r.number(col.creditPoints, 'נקודות זיכוי', 0, 30),
        childrenUpTo23: r.number(col.children, 'ילדים עד 23', 0, 30),
        hasCar: Boolean(car),
        currentCarId: car?.id ?? null,
        currentCarName: car?.model ?? NO_CAR_NAME,
        currentParticipation: car ? r.number(col.participation, 'השתתפות היום', 0, 100_000) : 0,
        currentBenefit: car?.benefit ?? 0,
        currentMaintenance: maintenance,
      });
    }
    if (!list.length) errors.push('הגיליון ריק');
    for (const id of duplicates(list.map((e) => e.id!))) errors.push(`המזהה ${id} מופיע יותר מפעם אחת`);
  }
  return { kind: 'employees', sheet: SHEET_NAMES.employees, rows: list, errors, warnings };
}

/**
 * Every known sheet found in the workbook. Employees are matched against the catalog and occupations
 * from the same file when it has them, else against the active ones.
 */
export function parseDataWorkbook(data: Uint8Array, active: Pick<ReferenceData, 'catalog' | 'occupations'>): ParsedWorkbook {
  const sheets = readXlsx(data);
  const out: ParsedWorkbook = {};
  const catalogRows = sheets.get(SHEET_NAMES.catalog);
  const occupationRows = sheets.get(SHEET_NAMES.occupations);
  const employeeRows = sheets.get(SHEET_NAMES.employees);
  if (catalogRows) out.catalog = parseCatalogSheet(catalogRows);
  if (occupationRows) out.occupations = parseOccupationsSheet(occupationRows);
  if (employeeRows) {
    const catalog = out.catalog && !out.catalog.errors.length ? out.catalog.rows : active.catalog;
    const occupations = out.occupations && !out.occupations.errors.length ? out.occupations.rows : active.occupations;
    out.employees = parseEmployeesSheet(employeeRows, catalog, occupations);
  }
  return out;
}
