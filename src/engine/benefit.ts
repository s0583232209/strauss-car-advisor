/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import catalogData from '../data/catalog.json';
import taxSeedData from '../data/tax-seed.json';
import { VehicleLookupResult } from './types.ts';

// In-memory cache for fast lookups
const seedLookupMap = new Map<string, VehicleLookupResult>();

// Populate lookup map from verified seed
for (const item of taxSeedData) {
  const key = makeLookupKey(
    String(item.regYear).trim(),
    String(item.vehicleType).trim(),
    String(item.productCode).trim().padStart(5, '0'),
    String(item.modelCode).trim().padStart(5, '0')
  );
  seedLookupMap.set(key, {
    value: item.benefitValue,
    sourceRow: item.sourceRow,
    commercialName: item.commercialName,
    driveCode: item.driveCode,
    listPrice: item.listPrice,
  });
}

/** Formats the official 4-tuple key: (שנת רישום, קוד סוג רכב, קוד תוצר, קוד דגם) */
export function makeLookupKey(
  regYear: string | number,
  vehicleType: string | number,
  productCode: string,
  modelCode: string
): string {
  const y = String(regYear).trim();
  const t = String(vehicleType).trim();
  const p = String(productCode).trim().padStart(5, '0');
  const m = String(modelCode).trim().padStart(5, '0');
  return `${y}|${t}|${p}|${m}`;
}

/**
 * Looks up vehicle benefit in tax database / seed data.
 * Priority: custom in-memory/IndexedDB index -> catalog seed.
 * Defaults vehicleType to '1' (private car) unless specified.
 */
export async function lookupBenefitValue(
  regYear: string | number,
  productCode: string,
  modelCode: string,
  vehicleType: string | number = '1',
  customDbLookup?: (key: string) => Promise<VehicleLookupResult | null>
): Promise<VehicleLookupResult | null> {
  const key = makeLookupKey(regYear, vehicleType, productCode, modelCode);

  // 1. Try uploaded custom database if available
  if (customDbLookup) {
    try {
      const customRes = await customDbLookup(key);
      if (customRes) return customRes;
    } catch {
      // Fallback to seed
    }
  }

  // 2. Try official seed data
  if (seedLookupMap.has(key)) {
    return seedLookupMap.get(key)!;
  }

  // 3. Fallback to catalog seed
  const catItem = catalogData.find(
    (c) =>
      String(c.year) === String(regYear).trim() &&
      c.productCode.padStart(5, '0') === String(productCode).trim().padStart(5, '0') &&
      c.modelCode.padStart(5, '0') === String(modelCode).trim().padStart(5, '0')
  );

  if (catItem) {
    return {
      value: catItem.benefit,
      sourceRow: 0,
      commercialName: catItem.model,
      driveCode: catItem.driveCode,
      listPrice: catItem.listPrice,
    };
  }

  return null;
}
