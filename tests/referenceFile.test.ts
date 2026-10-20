/**
 * The admin's data workbook: the original catalog.xlsx must give exactly the data in server/data,
 * and bad rows must be reported by their Excel row number.
 */

import { readFileSync } from 'node:fs';
import { CATALOG_HEADER, carRow, makeXlsx } from './xlsxFixture.ts';
import { describe, expect, it } from 'vitest';
import catalogData from '../server/data/catalog.json';
import employeesData from '../server/data/employees.json';
import occupationsData from '../server/data/occupations.json';
import type { Car, EmployeeProfile, Occupation } from '../shared/types.ts';
import {
  parseCatalogSheet,
  parseDataWorkbook,
  parseEmployeesSheet,
  parseOccupationsSheet,
} from '../server/bl/services/referenceFile.ts';
import { readXlsx, XlsxError } from '../server/bl/services/xlsx.ts';

const catalog = catalogData as Car[];
const occupations = occupationsData as Occupation[];
const employees = employeesData as EmployeeProfile[];
const original = readFileSync(new URL('../data/raw/catalog.xlsx', import.meta.url));



describe('original catalog.xlsx', () => {
  const parsed = parseDataWorkbook(original, { catalog, occupations });

  it('the car catalog equals catalog.json', () => {
    expect(parsed.catalog?.errors).toEqual([]);
    expect(parsed.catalog?.rows).toEqual(catalog);
  });

  it('the occupations equal occupations.json', () => {
    expect(parsed.occupations?.errors).toEqual([]);
    expect(parsed.occupations?.rows).toEqual(occupations);
  });

  it('the sample employees equal employees.json (E-GEN-B was added in code, not in the file)', () => {
    expect(parsed.employees?.errors).toEqual([]);
    expect(parsed.employees?.rows).toEqual(employees.filter((e) => e.id !== 'E-GEN-B'));
  });

  it('the ID-number column is never read', () => {
    expect(JSON.stringify(parsed.employees?.rows)).not.toContain('312456783');
  });
});

describe('xlsx reader', () => {
  it('reads shared strings and numbers, and keeps Excel row numbers', () => {
    const sheets = readXlsx(makeXlsx({ גיליון: [['א', 'b & c'], [], [12.5, 'x']] }));
    expect(sheets.get('גיליון')).toEqual([['א', 'b & c'], [], ['12.5', 'x']]);
  });

  it('refuses a file that is not xlsx', () => {
    expect(() => readXlsx(Buffer.from('id,name\n1,a'))).toThrow(XlsxError);
  });
});

describe('sheet checks', () => {
  it('columns may come in any order; codes get their leading zeros back', () => {
    const order = [...CATALOG_HEADER].reverse();
    const rows = [order, ...catalog.map((c) => carRow({ ...c, productCode: String(Number(c.productCode)) }).reverse())];
    const result = parseCatalogSheet(rows);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual(catalog);
  });

  it('a bad row is reported with its Excel row number, and a missing column by name', () => {
    const rows = [CATALOG_HEADER, ...catalog.map(carRow)];
    rows[3][10] = 'הרבה'; // benefit of the 3rd car, Excel row 4
    rows[5][8] = 'דיזל';
    const result = parseCatalogSheet(rows);
    expect(result.errors).toContain('שורה 4, שווי שימוש: "הרבה" אינו מספר');
    expect(result.errors.some((e) => e.startsWith('שורה 6, הנעה'))).toBe(true);
    expect(parseCatalogSheet([CATALOG_HEADER.slice(0, 10)]).errors[0]).toMatch(/חסרות עמודות: שווי שימוש/);
  });

  it('duplicate IDs and a missing default car are errors', () => {
    const rows = [CATALOG_HEADER, ...catalog.filter((c) => c.id !== 'CAR-19').map(carRow), carRow(catalog[0])];
    const errors = parseCatalogSheet(rows).errors;
    expect(errors).toContain('המזהה CAR-01 מופיע יותר מפעם אחת');
    expect(errors.some((e) => e.includes('CAR-19'))).toBe(true);
  });

  it('occupations: yes/no values, and a mandatory car cannot be waived', () => {
    const header = ['עיסוק', 'קבוצת זכאות', 'רכב חובה', 'מותר לוותר', 'אחזקת רכב בוויתור (₪)'];
    const result = parseOccupationsSheet([header, ['נהג', 'א', 'כן', 'כן', '1200'], ['רכז', 'ב', 'אולי', 'לא', '0']]);
    expect(result.errors).toContain('שורה 2: עיסוק עם רכב חובה לא יכול להיות "מותר לוותר"');
    expect(result.errors.some((e) => e.startsWith('שורה 3, רכב חובה'))).toBe(true);
  });

  it('employees: an unknown current car is an error; "אין (אחזקה 1,500 ₪)" means no car', () => {
    const header = ['מזהה', 'שם', 'עיסוק', 'קבוצה', 'שכר בסיס', 'עמלות', 'בונוס', 'פנסיה עובד %', 'קרן השתלמות עובד %', 'נקודות זיכוי', 'ילדים עד 23', 'רכב היום', 'השתתפות היום'];
    const base = ['10000', '0', '0', '6', '2.5', '2.25', '0'];
    const result = parseEmployeesSheet(
      [header, ['E-1', 'א', 'מפתח/ת תוכנה', 'ב', ...base, 'אין (אחזקה 1,500 ₪)', '0'], ['E-2', 'ב', 'מפתח/ת תוכנה', 'ב', ...base, 'DELOREAN', '100']],
      catalog,
      occupations
    );
    expect(result.rows[0]).toMatchObject({ hasCar: false, currentCarId: null, currentMaintenance: 1500, currentBenefit: 0 });
    expect(result.errors).toEqual(['שורה 3, רכב היום: "DELOREAN" לא נמצא בקטלוג הרכבים']);
  });

  it('a saved workbook with only one sheet gives only that table', () => {
    const parsed = parseDataWorkbook(makeXlsx({ 'קטלוג רכבים': [CATALOG_HEADER, ...catalog.map(carRow)] }), { catalog, occupations });
    expect(Object.keys(parsed)).toEqual(['catalog']);
    expect(parsed.catalog?.rows).toEqual(catalog);
  });
});
