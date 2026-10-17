/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TaxRecord } from '../../dal/index.ts';

/**
 * Parses the Tax Authority benefit-value CSV (windows-1255 or UTF-8) into records keyed by
 * "regYear|vehicleType|productCode|modelCode". Pure: saving is the DAL's job.
 */
/** The official file is windows-1255; a re-saved copy may be UTF-8 (with or without BOM) */
export function decodeTaxCsv(buffer: ArrayBuffer | Uint8Array): string {
  try {
    // fatal: windows-1255 Hebrew bytes are not valid UTF-8, so the official file falls through
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1255').decode(buffer);
  }
}

/**
 * Column index for the first term that matches, in the order of the terms (not of the headers):
 * an exact header beats a header that only contains the term, and taken columns are skipped.
 * Example: name terms ['כינוי מסחרי', 'תאור דגם', 'תוצר'] must not pick "קוד תוצר".
 */
export function findColumn(headers: string[], terms: string[], taken: number[] = []): number {
  const free = (i: number) => i >= 0 && !taken.includes(i);
  for (const term of terms) {
    const exact = headers.findIndex((h, i) => free(i) && h === term);
    if (exact >= 0) return exact;
    const partial = headers.findIndex((h, i) => free(i) && h.includes(term));
    if (partial >= 0) return partial;
  }
  return -1;
}

export function parseTaxAuthorityCsv(buffer: ArrayBuffer | Uint8Array): TaxRecord[] {
  // 1. Decode bytes (windows-1255, or UTF-8 when the file is valid UTF-8)
  const text = decodeTaxCsv(buffer);

  // 2. Split lines
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('קובץ ה-CSV ריק או אינו תקין');
  }

  // 3. Parse headers
  const headers = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim());

  // Key columns first, so the descriptive columns below can never take one of them
  const idxRegYear = findColumn(headers, ['שנת רישום']);
  const idxVehicleType = findColumn(headers, ['קוד סוג רכב']);
  const idxProduct = findColumn(headers, ['קוד תוצר']);
  const idxModel = findColumn(headers, ['קוד דגם']);
  const idxBenefit = findColumn(headers, ['שווי שימוש']);
  const keys = [idxRegYear, idxVehicleType, idxProduct, idxModel, idxBenefit];
  const idxName = findColumn(headers, ['כינוי מסחרי', 'תאור דגם', 'תוצר'], keys);
  const idxPrice = findColumn(headers, ['מחיר מחירון', 'מחיר מתואם'], keys);
  // The drive column is "1-חשמלי.2-היברידי.3-פלג-אין", but its values are coded like the catalog:
  // 0 gasoline, 1 hybrid, 2 plug-in, 3 electric (SPEC section 3). "סוג דלק" is the fuel text, not the code.
  const idxDrive = findColumn(headers, ['1-חשמלי', 'פלג-אין'], keys);

  if (idxRegYear === -1 || idxProduct === -1 || idxModel === -1 || idxBenefit === -1) {
    throw new Error('לא נמצאו עמודות מפתח נדרשות (שנת רישום, קוד תוצר, קוד דגם, שווי שימוש)');
  }

  const records: TaxRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parse with comma split
    const cols = line.split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
    if (cols.length < 5) continue;

    const regYear = cols[idxRegYear] || '2025';
    const vehicleType = idxVehicleType >= 0 && cols[idxVehicleType] ? cols[idxVehicleType] : '1';
    const productCode = (cols[idxProduct] || '').padStart(5, '0');
    const modelCode = (cols[idxModel] || '').padStart(5, '0');

    records.push({
      key: `${regYear}|${vehicleType}|${productCode}|${modelCode}`,
      regYear,
      vehicleType,
      productCode,
      modelCode,
      commercialName: idxName >= 0 ? cols[idxName] : '',
      benefitValue: parseFloat(cols[idxBenefit]) || 0,
      listPrice: idxPrice >= 0 ? parseFloat(cols[idxPrice]) || 0 : 0,
      driveCode: idxDrive >= 0 ? parseInt(cols[idxDrive], 10) || 0 : 0,
      sourceRow: i + 1,
    });
  }
  return records;
}
