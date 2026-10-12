/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompactTaxRecord, saveTaxRecordsToIndexedDb } from './db.ts';

export interface ParseProgress {
  totalRows: number;
  processedRows: number;
  percentage: number;
  status: 'decoding' | 'parsing' | 'saving' | 'done' | 'error';
  errorMessage?: string;
}

/**
 * Parses raw ArrayBuffer of Tax Authority CSV (windows-1255 or UTF-8)
 * and streams batches directly into IndexedDB.
 */
export async function parseTaxAuthorityCsv(
  buffer: ArrayBuffer,
  onProgress?: (p: ParseProgress) => void
): Promise<number> {
  onProgress?.({
    totalRows: 0,
    processedRows: 0,
    percentage: 5,
    status: 'decoding',
  });

  // 1. Decode bytes using windows-1255 with UTF-8 fallback
  let text = '';
  try {
    const decoder = new TextDecoder('windows-1255');
    text = decoder.decode(buffer);
  } catch {
    const decoder = new TextDecoder('utf-8');
    text = decoder.decode(buffer);
  }

  // 2. Split lines
  const lines = text.split(/\r?\n/);
  const totalRows = lines.length;
  if (totalRows < 2) {
    throw new Error('קובץ ה-CSV ריק או אינו תקין');
  }

  // 3. Parse headers
  const headerLine = lines[0];
  const headers = headerLine.split(',').map((h) => h.replace(/^["']|["']$/g, '').trim());

  // Find column indices
  const findCol = (terms: string[]) =>
    headers.findIndex((h) => terms.some((t) => h.includes(t)));

  const idxRegYear = findCol(['שנת רישום']);
  const idxVehicleType = findCol(['קוד סוג רכב']);
  const idxProduct = findCol(['קוד תוצר']);
  const idxModel = findCol(['קוד דגם']);
  const idxName = findCol(['כינוי מסחרי', 'תוצר', 'תאור דגם']);
  const idxBenefit = findCol(['שווי שימוש']);
  const idxPrice = findCol(['מחיר מחירון', 'מחיר מתואם']);
  const idxDrive = findCol(['1-חשמלי', 'היברידי', 'סוג דלק']);

  if (idxRegYear === -1 || idxProduct === -1 || idxModel === -1 || idxBenefit === -1) {
    throw new Error('לא נמצאו עמודות מפתח נדרשות (שנת רישום, קוד תוצר, קוד דגם, שווי שימוש)');
  }

  onProgress?.({
    totalRows,
    processedRows: 0,
    percentage: 15,
    status: 'parsing',
  });

  const BATCH_SIZE = 5000;
  let batch: CompactTaxRecord[] = [];
  let totalSaved = 0;

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
    const commercialName = idxName >= 0 ? cols[idxName] : '';
    const benefitValue = parseFloat(cols[idxBenefit]) || 0;
    const listPrice = idxPrice >= 0 ? parseFloat(cols[idxPrice]) || 0 : 0;
    const driveCode = idxDrive >= 0 ? parseInt(cols[idxDrive], 10) || 0 : 0;

    const key = `${regYear}|${vehicleType}|${productCode}|${modelCode}`;

    batch.push({
      key,
      regYear,
      vehicleType,
      productCode,
      modelCode,
      commercialName,
      benefitValue,
      driveCode,
      listPrice,
      sourceRow: i + 1,
    });

    if (batch.length >= BATCH_SIZE) {
      await saveTaxRecordsToIndexedDb(batch);
      totalSaved += batch.length;
      batch = [];
      const pct = Math.min(95, Math.round(15 + (i / totalRows) * 80));
      onProgress?.({
        totalRows,
        processedRows: totalSaved,
        percentage: pct,
        status: 'saving',
      });
    }
  }

  if (batch.length > 0) {
    await saveTaxRecordsToIndexedDb(batch);
    totalSaved += batch.length;
  }

  onProgress?.({
    totalRows,
    processedRows: totalSaved,
    percentage: 100,
    status: 'done',
  });

  return totalSaved;
}
