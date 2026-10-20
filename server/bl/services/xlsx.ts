/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Minimal .xlsx reader: the sheets of a workbook as rows of cell text. Enough for the admin's data
 * files (plain tables, inline or shared strings, numbers); formulas give their cached value and
 * formatting is ignored. No dependency: a ZIP directory walk and node:zlib.
 */

import { inflateRawSync } from 'node:zlib';

export class XlsxError extends Error {
  readonly status = 400;
}

// Limits against a crafted file (a "zip bomb" or a huge sheet)
const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 5_000;

const fail = (message: string): never => {
  throw new XlsxError(message);
};

/** File name → raw bytes for every entry of a ZIP archive */
function unzip(buf: Buffer): Map<string, () => Buffer> {
  // End of central directory: the last 0x06054b50 within the final 64 KB + 22 bytes
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) fail('הקובץ אינו קובץ Excel תקין (xlsx)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  const entries = new Map<string, () => Buffer>();
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) fail('הקובץ אינו קובץ Excel תקין (xlsx)');
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    entries.set(name, () => {
      if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== 0x04034b50) fail('הקובץ אינו קובץ Excel תקין (xlsx)');
      const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
      const data = buf.subarray(start, start + compressedSize);
      if (method === 0) return data;
      if (method !== 8) fail('הקובץ דחוס בשיטה שאינה נתמכת');
      try {
        return inflateRawSync(data, { maxOutputLength: MAX_ENTRY_BYTES });
      } catch {
        return fail('הקובץ פגום או גדול מדי');
      }
    });
  }
  return entries;
}

function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    const k = e.toLowerCase();
    if (k === 'amp') return '&';
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'quot') return '"';
    if (k === 'apos') return "'";
    return String.fromCodePoint(k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  });
}

/** All <t> texts inside a fragment, joined (rich text has several runs) */
const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join('');

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

/** "C12" → column index 2 */
function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    if (rows.length >= MAX_ROWS) fail(`הגיליון ארוך מדי (עד ${MAX_ROWS} שורות)`);
    const rowNum = Number(attr(rowMatch[1], 'r')) || rows.length + 1;
    const row: string[] = [];
    for (const c of (rowMatch[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const type = attr(c[1], 't');
      const body = c[2] ?? '';
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value: string;
      if (type === 'inlineStr') value = texts(body);
      else if (type === 's') value = shared[Number(v)] ?? '';
      else value = v === undefined ? '' : decodeXml(v);
      const ref = attr(c[1], 'r');
      row[ref ? columnIndex(ref) : row.length] = value;
    }
    // Keep the sheet's row numbers, so messages can point at the row the admin sees in Excel
    rows[rowNum - 1] = Array.from(row, (v) => (v ?? '').trim());
  }
  return Array.from(rows, (r) => r ?? []);
}

/** Sheet name → rows (row 0 is Excel row 1). Throws XlsxError with a Hebrew message for a bad file. */
export function readXlsx(data: Uint8Array): Map<string, string[][]> {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (buf.length < 22 || buf.readUInt32LE(0) !== 0x04034b50) fail('הקובץ אינו קובץ Excel (xlsx). שמרו אותו ב-Excel בפורמט .xlsx ונסו שוב.');
  const zip = unzip(buf);
  const read = (name: string) => zip.get(name)?.().toString('utf8');

  const workbook = read('xl/workbook.xml') ?? fail('הקובץ אינו קובץ Excel תקין (חסר workbook)');
  const rels = read('xl/_rels/workbook.xml.rels') ?? '';
  const targets = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], 'Id');
    const target = attr(m[0], 'Target');
    if (id && target) targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  }

  const sharedXml = read('xl/sharedStrings.xml');
  const shared = sharedXml ? [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1])) : [];

  const sheets = new Map<string, string[][]>();
  for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const name = decodeXml(attr(m[0], 'name') ?? '');
    const target = targets.get(attr(m[0], 'r:id') ?? '');
    const xml = target ? read(target) : undefined;
    if (name && xml) sheets.set(name.trim(), parseSheet(xml, shared));
  }
  return sheets;
}
