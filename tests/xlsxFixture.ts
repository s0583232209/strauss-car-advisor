/**
 * Test helper: a small .xlsx built in memory with shared strings, like the files Excel writes.
 * Not a test file itself.
 */

import { deflateRawSync } from 'node:zlib';
import type { Car } from '../shared/types.ts';

/** A .xlsx with shared strings, built in memory (what Excel writes when the admin saves) */
export function makeXlsx(sheets: Record<string, Array<Array<string | number>>>): Buffer {
  const strings: string[] = [];
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const col = (i: number) => String.fromCharCode(65 + i);
  const sheetXml = (rows: Array<Array<string | number>>) => `<worksheet><sheetData>${rows
    .map((r, ri) => `<row r="${ri + 1}">${r
      .map((v, ci) => typeof v === 'number'
        ? `<c r="${col(ci)}${ri + 1}"><v>${v}</v></c>`
        : `<c r="${col(ci)}${ri + 1}" t="s"><v>${strings.push(v) - 1}</v></c>`)
      .join('')}</row>`)
    .join('')}</sheetData></worksheet>`;
  const names = Object.keys(sheets);
  const files: Record<string, string> = {
    'xl/workbook.xml': `<workbook><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships>${names.map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
  };
  names.forEach((n, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(sheets[n]);
  });
  // After the sheets: they fill the shared strings
  files['xl/sharedStrings.xml'] = `<sst>${strings.map((s) => `<si><t>${esc(s)}</t></si>`).join('')}</sst>`;
  // Minimal ZIP: local headers, central directory, end record (CRC is not checked by the reader)
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBuf = Buffer.from(name);
    const data = deflateRawSync(Buffer.from(text));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

/** The catalog sheet of the original workbook: header and one row per car */
export const CATALOG_HEADER = ['מזהה', 'קבוצה', 'תוצר', 'קוד תוצר', 'דגם (כינוי מסחרי)', 'קוד דגם', 'תאור דגם', 'שנת רישום', 'הנעה', 'מחיר מחירון', 'שווי שימוש חודשי', 'עלות חודשית לחברה (דמה)', 'השתתפות עובד ברירת מחדל (דמה)'];
export const carRow = (c: Car) => [c.id, c.group, c.make, c.productCode, c.model, c.modelCode, c.description, String(c.year), c.fuel, String(c.listPrice), String(c.benefit), String(c.companyCost), String(c.participation)];
