/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VehicleLookupResult } from '../engine/types.ts';

const DB_NAME = 'YoetzTaxDb';
const DB_VERSION = 1;
const STORE_NAME = 'tax_records';

export interface CompactTaxRecord {
  key: string; // "regYear|vehicleType|productCode|modelCode"
  regYear: string;
  vehicleType: string;
  productCode: string;
  modelCode: string;
  commercialName: string;
  benefitValue: number;
  driveCode: number;
  listPrice: number;
  sourceRow: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Store batch of compact tax records into IndexedDB */
export async function saveTaxRecordsToIndexedDb(records: CompactTaxRecord[]): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Bulk put
    for (const record of records) {
      store.put(record);
    }

    tx.oncomplete = () => resolve(records.length);
    tx.onerror = () => reject(tx.error);
  });
}

/** Lookup record by exact 4-tuple key: (שנת רישום, קוד סוג רכב, קוד תוצר, קוד דגם) */
export async function lookupIndexedDbTaxRecord(key: string): Promise<VehicleLookupResult | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        const item = req.result as CompactTaxRecord | undefined;
        if (!item) {
          resolve(null);
          return;
        }
        resolve({
          value: item.benefitValue,
          sourceRow: item.sourceRow,
          commercialName: item.commercialName,
          driveCode: item.driveCode,
          listPrice: item.listPrice,
        });
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/** Get total count of indexed tax records */
export async function getIndexedDbRecordCount(): Promise<number> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

/** Clear all records in tax IndexedDB */
export async function clearTaxDb(): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore
  }
}
