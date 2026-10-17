import { describe, expect, it } from 'vitest';
import { decodeTaxCsv, findColumn, parseTaxAuthorityCsv } from '../server/bl/services/taxCsv.ts';

// The 19 headers of the real Tax Authority file, in its order (SPEC section 3)
const HEADERS = [
  'שנת מס', 'שנת רישום', 'קוד סוג רכב', 'קוד תוצר', 'תוצר', 'קוד דגם', 'תאור דגם', 'סוג דלק', 'כינוי מסחרי',
  'לא-0.כן-1 אוטומט', '1-חשמלי.2-היברידי.3-פלג-אין', 'ציון ירוק', 'דרגת זיהום', 'נפח מנוע', 'משקל',
  'תאריך תחולה', 'מחיר מחירון', 'מחיר מתואם', 'שווי שימוש',
];
// ATTO 3 and TANG share product/model codes; only the vehicle type differs (SPEC section 3)
const ROWS = [
  '2025,2025,1,01014,BYD,00003,ATTO 3 COMFORT,חשמל,ATTO 3,1,3,15,1,0,1750,01/01/2025,177500,177500,3130',
  '2025,2025,2,01014,BYD,00003,TANG,חשמל,TANG,1,3,15,1,0,2560,01/01/2025,327990,327990,6950',
];

/** windows-1255 bytes: Hebrew letters U+05D0–U+05EA are 0xE0–0xFA */
const cp1255 = (s: string) =>
  Uint8Array.from([...s].map((ch) => (ch >= 'א' && ch <= 'ת' ? 0xe0 + ch.charCodeAt(0) - 0x5d0 : ch.charCodeAt(0))));

const file = [HEADERS.join(','), ...ROWS].join('\r\n');

describe('findColumn', () => {
  it('goes by term priority, exact header first, so "תוצר" does not pick "קוד תוצר"', () => {
    expect(HEADERS[findColumn(HEADERS, ['כינוי מסחרי', 'תאור דגם', 'תוצר'])]).toBe('כינוי מסחרי');
    expect(HEADERS[findColumn(HEADERS, ['תוצר'])]).toBe('תוצר');
  });

  it('skips taken key columns', () => {
    // Without "תוצר" (the make), the only partial match is the taken "קוד תוצר" key column
    const headers = HEADERS.filter((h) => h !== 'תוצר');
    const product = headers.indexOf('קוד תוצר');
    expect(findColumn(headers, ['תוצר'], [product])).toBe(-1);
    expect(findColumn(headers, ['תוצר'])).toBe(product);
  });

  it('the drive code column, not the fuel text "סוג דלק"', () => {
    expect(HEADERS[findColumn(HEADERS, ['1-חשמלי', 'פלג-אין'])]).toBe('1-חשמלי.2-היברידי.3-פלג-אין');
  });
});

describe('decodeTaxCsv', () => {
  it('reads the official windows-1255 file and a UTF-8 copy (with BOM) alike', () => {
    expect(decodeTaxCsv(cp1255('שווי שימוש'))).toBe('שווי שימוש');
    expect(decodeTaxCsv(new TextEncoder().encode('﻿שווי שימוש'))).toBe('שווי שימוש');
  });
});

describe('parseTaxAuthorityCsv on the real header layout', () => {
  for (const [label, bytes] of [['windows-1255', cp1255(file)], ['UTF-8', new TextEncoder().encode(file)]] as const) {
    it(`${label}: name, drive code, price and benefit come from the right columns`, () => {
      const records = parseTaxAuthorityCsv(bytes);
      expect(records).toHaveLength(2);
      expect(records[0]).toMatchObject({
        key: '2025|1|01014|00003',
        commercialName: 'ATTO 3',
        driveCode: 3,
        listPrice: 177500,
        benefitValue: 3130,
      });
      expect(records[1]).toMatchObject({ key: '2025|2|01014|00003', commercialName: 'TANG', benefitValue: 6950 });
    });
  }
});
