/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Admin use cases: rules, reference data and the Tax Authority file */

import type {
  DataFilePreview,
  DataTableKind,
  DataTablePreview,
  FieldChange,
  RulesPreview,
  TableDiff,
} from '../../../shared/types.ts';
import { lookupBenefitValue, makeLookupKey } from '../engine/benefit.ts';
import {
  getCatalog,
  getEmployees,
  getOccupations,
  REFERENCE_KINDS,
  ReferenceData,
  resetReferenceData,
  setReferenceData,
} from '../engine/referenceData.ts';
import { getRules, resetRules, setRules } from '../engine/rules.ts';
import type { AdminOverview, Rules, VehicleLookupResult } from '../engine/types.ts';
import type { Repository } from '../../dal/index.ts';
import { parseDataWorkbook, type ParsedWorkbook } from './referenceFile.ts';
import { parseTaxAuthorityCsv } from './taxCsv.ts';

export class InvalidRulesError extends Error {
  readonly status = 400;
}

/** An uploaded data file that cannot be applied (message for the admin) */
export class InvalidDataError extends Error {
  readonly status = 400;
}

/** The parts of Rules the engine reads directly */
function assertRulesShape(r: any): asserts r is Rules {
  const ok =
    r &&
    typeof r === 'object' &&
    r.budgets && typeof r.budgets === 'object' &&
    Array.isArray(r.groupOrder) &&
    r.netMethod && Array.isArray(r.netMethod.brackets) &&
    typeof r.netMethod.creditPointValue === 'number' &&
    r.netMethod.nationalInsurance && r.netMethod.health && r.netMethod.pensionCredit;
  if (!ok) throw new InvalidRulesError('קובץ הכללים חסר שדות חובה (budgets, groupOrder, netMethod)');
}

// How the preview names rows and fields, in the admin's words
const ROW_KEY: { [K in DataTableKind]: (row: ReferenceData[K][number]) => string } = {
  catalog: (c) => c.id,
  occupations: (o) => o.occupation,
  employees: (e) => e.id ?? '',
};
const ROW_NAME: { [K in DataTableKind]: (row: ReferenceData[K][number]) => string } = {
  catalog: (c) => `${c.id} · ${c.model}`,
  occupations: (o) => o.occupation,
  employees: (e) => `${e.id} · ${e.name ?? ''}`,
};
const FIELD_LABELS: Record<string, string> = {
  group: 'קבוצה', make: 'תוצר', model: 'דגם', productCode: 'קוד תוצר', modelCode: 'קוד דגם', description: 'תאור דגם',
  year: 'שנת רישום', fuel: 'הנעה', driveCode: 'קוד הנעה', listPrice: 'מחיר מחירון', benefit: 'שווי שימוש',
  companyCost: 'עלות חודשית לחברה', participation: 'השתתפות עובד',
  occupation: 'עיסוק', carMandatory: 'רכב חובה', canWaive: 'מותר לוותר', maintenance: 'אחזקת רכב',
  name: 'שם', base: 'שכר בסיס', commissions: 'עמלות', bonus: 'בונוס', pensionPct: 'פנסיה עובד %',
  studyFundPct: 'קרן השתלמות %', creditPoints: 'נקודות זיכוי', childrenUpTo23: 'ילדים עד 23', hasCar: 'יש רכב',
  currentCarId: 'רכב היום', currentCarName: 'שם הרכב היום', currentParticipation: 'השתתפות היום',
  currentBenefit: 'שווי שימוש היום', currentMaintenance: 'אחזקה היום',
};
const RULE_LABELS: Record<string, string> = {
  version: 'גרסה',
  budgets: 'תקציב קבוצה',
  groupOrder: 'סדר הקבוצות',
  chooseFrom: 'בחירת רכב',
  'electric.netBonus': 'החזר חשמל נטו',
  'electric.method': 'שיטת החזר החשמל',
  'familyTrack.minChildren': 'מסלול משפחתי: מינימום ילדים',
  'familyTrack.childMaxAge': 'מסלול משפחתי: גיל ילד מרבי',
  'familyTrack.carPrice': 'מסלול משפחתי: מחיר רכב',
  'familyTrack.gapSplitEmployee': 'מסלול משפחתי: חלק העובד בפער',
  'netMethod.taxYear': 'שנת מס',
  'netMethod.creditPointValue': 'ערך נקודת זיכוי',
  'netMethod.brackets': 'מדרגות מס',
  'netMethod.nationalInsurance': 'ביטוח לאומי',
  'netMethod.health': 'מס בריאות',
  'netMethod.pensionCredit': 'זיכוי פנסיה',
};

const show = (v: unknown): string =>
  v === undefined || v === null ? '—' : typeof v === 'boolean' ? (v ? 'כן' : 'לא') : typeof v === 'object' ? JSON.stringify(v) : String(v);

function diffTable<K extends DataTableKind>(kind: K, before: ReferenceData[K], after: ReferenceData[K]): TableDiff {
  const key = ROW_KEY[kind] as (r: unknown) => string;
  const name = ROW_NAME[kind] as (r: unknown) => string;
  const old = new Map((before as unknown[]).map((r) => [key(r), r as Record<string, unknown>]));
  const next = new Set((after as unknown[]).map(key));
  const diff: TableDiff = { added: [], removed: [], changed: [], unchanged: 0 };
  for (const row of after as unknown as Array<Record<string, unknown>>) {
    const prev = old.get(key(row));
    if (!prev) {
      diff.added.push(name(row));
      continue;
    }
    const changes: FieldChange[] = [];
    for (const field of new Set([...Object.keys(prev), ...Object.keys(row)])) {
      if (field === 'driveCode' || field === 'currentCarName') continue; // follow fuel / current car
      if (JSON.stringify(prev[field]) !== JSON.stringify(row[field])) {
        changes.push({ field: FIELD_LABELS[field] ?? field, before: show(prev[field]), after: show(row[field]) });
      }
    }
    if (changes.length) diff.changed.push({ row: name(row), changes });
    else diff.unchanged++;
  }
  for (const row of before as unknown[]) if (!next.has(key(row))) diff.removed.push(name(row));
  return diff;
}

/** Leaf values by path ("electric.netBonus"); arrays and "note" texts count as one value / are skipped */
function flatten(v: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, child] of Object.entries(v)) if (k !== 'note') flatten(child, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out[prefix] = v;
  }
  return out;
}

function ruleLabel(path: string): string {
  if (RULE_LABELS[path]) return RULE_LABELS[path];
  const parent = Object.keys(RULE_LABELS).filter((p) => path.startsWith(`${p}.`)).sort((a, b) => b.length - a.length)[0];
  return parent ? `${RULE_LABELS[parent]} ${path.slice(parent.length + 1)}` : path;
}

function activeTable<K extends DataTableKind>(kind: K): ReferenceData[K] {
  const active: ReferenceData = { catalog: getCatalog(), occupations: getOccupations(), employees: getEmployees() };
  return active[kind];
}

// Other server instances (serverless) pick up an admin change within this time
const SYNC_MS = 30_000;

export function createAdminService(repo: Repository, now: () => number = Date.now) {
  let syncedAt = 0;
  let syncing: Promise<void> | null = null;

  /** Applies the saved rules and uploaded tables (the engine reads them from memory) */
  async function loadFromStorage(): Promise<void> {
    const [rules, ...tables] = await Promise.all([repo.getRules(), ...REFERENCE_KINDS.map((k) => repo.getReferenceData(k))]);
    if (rules) setRules(rules);
    else resetRules();
    REFERENCE_KINDS.forEach((kind, i) => {
      const rows = tables[i];
      if (rows) setReferenceData(kind, rows as never);
      else resetReferenceData(kind);
    });
    syncedAt = now();
  }

  function parse(file: Uint8Array): ParsedWorkbook {
    return parseDataWorkbook(file, { catalog: getCatalog(), occupations: getOccupations() });
  }

  function previewOf(parsed: ParsedWorkbook): DataFilePreview {
    const tables: DataTablePreview[] = [];
    for (const kind of REFERENCE_KINDS) {
      const sheet = parsed[kind];
      if (!sheet) continue;
      const before = activeTable(kind);
      tables.push({
        kind,
        sheet: sheet.sheet,
        count: sheet.rows.length,
        previousCount: before.length,
        errors: sheet.errors,
        warnings: [...sheet.warnings],
        diff: diffTable(kind, before, sheet.rows as never),
      });
    }
    // A new catalog without a car that a sample employee has today (when employees are not replaced too)
    const newCatalog = parsed.catalog?.rows;
    const catalogTable = tables.find((t) => t.kind === 'catalog');
    if (newCatalog && catalogTable && !parsed.employees) {
      const missing = getEmployees().filter((e) => e.currentCarId && !newCatalog.some((c) => c.id === e.currentCarId));
      if (missing.length) {
        catalogTable.warnings.push(`לעובדי הדוגמה ${missing.map((e) => e.name).join(', ')} יש רכב שאינו בקטלוג החדש`);
      }
    }
    return { tables, canApply: tables.length > 0 && tables.every((t) => t.errors.length === 0) };
  }

  return {
    async init(): Promise<void> {
      await loadFromStorage();
    },

    /**
     * Reloads the saved data when it is older than SYNC_MS, so an upload on one instance reaches the
     * others. A storage error keeps the data already in memory.
     */
    async syncIfStale(): Promise<void> {
      if (now() - syncedAt < SYNC_MS) return;
      syncing ??= loadFromStorage()
        .catch((err) => console.error(`[admin] reloading settings failed: ${err?.name ?? 'Error'}`))
        .finally(() => {
          syncing = null;
        });
      await syncing;
    },

    async overview(): Promise<AdminOverview> {
      const [rules, ...tables] = await Promise.all([repo.getRules(), ...REFERENCE_KINDS.map((k) => repo.getReferenceData(k))]);
      const source = (v: unknown) => (v ? 'uploaded' : 'default') as 'uploaded' | 'default';
      return {
        rules: getRules(),
        catalog: getCatalog(),
        occupations: getOccupations(),
        employees: getEmployees(),
        taxRecordCount: await repo.countTaxRecords(),
        storage: repo.kind,
        sources: {
          rules: source(rules),
          catalog: source(tables[0]),
          occupations: source(tables[1]),
          employees: source(tables[2]),
        },
      };
    },

    /** Checks an uploaded rules file and lists what would change; saves nothing */
    previewRules(rules: unknown): RulesPreview {
      const current = getRules();
      try {
        assertRulesShape(rules);
      } catch (err) {
        return { version: '', previousVersion: current.version, changes: [], errors: [(err as Error).message] };
      }
      const before = flatten(current);
      const after = flatten(rules);
      const changes: FieldChange[] = [];
      // The version is shown on its own line
      for (const path of new Set([...Object.keys(before), ...Object.keys(after)].filter((p) => p !== 'version'))) {
        if (JSON.stringify(before[path]) !== JSON.stringify(after[path])) {
          changes.push({ field: ruleLabel(path), before: show(before[path]), after: show(after[path]) });
        }
      }
      return { version: String(rules.version ?? ''), previousVersion: current.version, changes, errors: [] };
    },

    async saveRules(rules: unknown): Promise<Rules> {
      assertRulesShape(rules);
      setRules(rules);
      await repo.saveRules(getRules());
      return getRules();
    },

    async resetRules(): Promise<Rules> {
      resetRules();
      await repo.saveRules(null);
      return getRules();
    },

    /** Checks the sheets of an uploaded data workbook and lists what would change; saves nothing */
    previewDataFile(file: Uint8Array): DataFilePreview {
      return previewOf(parse(file));
    },

    /** Replaces every table found in the workbook, all or nothing (the same file the preview showed) */
    async applyDataFile(file: Uint8Array): Promise<DataFilePreview> {
      const parsed = parse(file);
      const preview = previewOf(parsed);
      if (!preview.canApply) {
        throw new InvalidDataError(
          preview.tables.length ? 'בקובץ יש שגיאות: תקנו אותן ונסו שוב' : 'לא נמצא בקובץ אף גיליון מוכר (קטלוג רכבים, עיסוקים, עובדים לדוגמה)'
        );
      }
      for (const kind of REFERENCE_KINDS) {
        const sheet = parsed[kind];
        if (!sheet) continue;
        await repo.saveReferenceData(kind, sheet.rows);
        setReferenceData(kind, sheet.rows as never);
      }
      return preview;
    },

    async resetDataTable(kind: DataTableKind): Promise<void> {
      await repo.saveReferenceData(kind, null);
      resetReferenceData(kind);
    },

    async importTaxCsv(buffer: Uint8Array): Promise<number> {
      const records = parseTaxAuthorityCsv(buffer);
      await repo.saveTaxRecords(records);
      return records.length;
    },

    clearTaxRecords: () => repo.clearTaxRecords(),

    /** Uploaded Tax Authority file first, then the seed and the catalog */
    async lookup(regYear: string, vehicleType: string, productCode: string, modelCode: string): Promise<VehicleLookupResult | null> {
      const key = makeLookupKey(regYear, vehicleType, productCode, modelCode);
      return (await repo.getTaxRecord(key)) ?? lookupBenefitValue(regYear, productCode, modelCode, vehicleType);
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
