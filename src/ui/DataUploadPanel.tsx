/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AlertTriangle, CheckCircle2, FileUp, RotateCcw, XCircle } from 'lucide-react';
import React, { useRef, useState } from 'react';
import type { DataFilePreview, DataTablePreview, FieldChange, RulesPreview } from '../../shared/types.ts';
import { api, ApiError } from '../api/client.ts';

const TABLE_NAMES: Record<DataTablePreview['kind'], string> = {
  catalog: 'קטלוג רכבים',
  occupations: 'עיסוקים',
  employees: 'עובדים לדוגמה',
};

interface DataUploadPanelProps {
  /** workbook: the Excel data file (cars, occupations, employees); rules: the rules file */
  kind: 'workbook' | 'rules';
  /** Where the data shown now comes from */
  source: 'default' | 'uploaded';
  /** Called after an apply or a reset, to reload the data */
  onChanged: () => void;
  /** Reset to the built-in data */
  onReset: () => Promise<void>;
}

type Preview = { kind: 'workbook'; data: DataFilePreview } | { kind: 'rules'; data: RulesPreview; rules: unknown };

/**
 * Upload, check and apply. The admin never edits data in the browser: they choose a file, see what
 * it would change (and any errors, by Excel row), and only then apply it.
 */
export const DataUploadPanel: React.FC<DataUploadPanelProps> = ({ kind, source, onChanged, onReset }) => {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const fail = (err: unknown) => {
    if (err instanceof ApiError && err.status === 401) return; // back to the login screen
    setError(err instanceof Error ? err.message : 'הפעולה נכשלה');
  };

  const clear = () => {
    setFile(null);
    setPreview(null);
    if (input.current) input.current.value = '';
  };

  const choose = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setDone(null);
    setPreview(null);
    setFile(f);
    setBusy(true);
    try {
      if (kind === 'workbook') {
        setPreview({ kind, data: await api.admin.previewDataFile(f) });
      } else {
        let rules: unknown;
        try {
          rules = JSON.parse(await f.text());
        } catch {
          throw new Error('הקובץ אינו קובץ כללים תקין (JSON). ודאו שבחרתם את הקובץ שקיבלתם, בלי לשנות אותו.');
        }
        setPreview({ kind, data: await api.admin.previewRules(rules), rules });
      }
    } catch (err) {
      clear();
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!preview || !file) return;
    setBusy(true);
    setError(null);
    try {
      if (preview.kind === 'workbook') await api.admin.applyDataFile(file);
      else await api.admin.saveRules(preview.rules);
      setDone(`הקובץ ${file.name} הוחל. החישובים משתמשים מעכשיו בנתונים החדשים.`);
      clear();
      onChanged();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm('לחזור לנתוני ברירת המחדל? הקובץ שהועלה יוסר.')) return;
    setBusy(true);
    setError(null);
    try {
      await onReset();
      setDone('הנתונים הוחזרו לברירת המחדל.');
      clear();
      onChanged();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const canApply = preview ? (preview.kind === 'workbook' ? preview.data.canApply : preview.data.errors.length === 0) : false;
  const nothingChanges =
    preview?.kind === 'rules'
      ? preview.data.changes.length === 0
      : preview?.kind === 'workbook' &&
        preview.data.tables.every((t) => !t.diff.added.length && !t.diff.removed.length && !t.diff.changed.length);

  return (
    <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-ink">
            {kind === 'workbook' ? 'עדכון מקובץ Excel' : 'עדכון מקובץ כללים'}
          </p>
          <p className="text-xs text-slate-600">
            {kind === 'workbook'
              ? 'העלו קובץ באותו מבנה של קובץ הנתונים (גיליונות: קטלוג רכבים, עיסוקים, עובדים לדוגמה). אפשר קובץ עם גיליון אחד בלבד.'
              : 'העלו את קובץ הכללים (strauss-rules.json) שקיבלתם, בלי לערוך אותו.'}
          </p>
          <p className="text-[11px] text-slate-500">
            מקור הנתונים כרגע: {source === 'uploaded' ? <b className="text-brand-dark">קובץ שהועלה</b> : 'ברירת המחדל של המערכת'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {source === 'uploaded' && (
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-line hover:bg-slate-50 disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              חזרה לברירת המחדל
            </button>
          )}
          <label
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-brand hover:bg-brand-dark cursor-pointer ${busy ? 'opacity-40 pointer-events-none' : ''}`}
          >
            <FileUp className="w-4 h-4" />
            בחירת קובץ
            <input
              ref={input}
              type="file"
              accept={kind === 'workbook' ? '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : '.json,application/json'}
              className="hidden"
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </label>
        </div>
      </div>

      {busy && <p className="text-xs text-slate-500">בודקים את הקובץ...</p>}
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-danger font-medium">
          <XCircle className="w-4 h-4 shrink-0" />
          {error}
        </p>
      )}
      {done && (
        <p className="flex items-center gap-1.5 text-xs text-success font-bold">
          <CheckCircle2 className="w-4 h-4" />
          {done}
        </p>
      )}

      {preview && file && (
        <div className="bg-white rounded-xl border border-line p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-ink">
              תצוגה מקדימה: <span className="font-mono text-xs text-slate-600" dir="ltr">{file.name}</span>
            </p>
            <span className="text-[11px] text-slate-500">שום דבר עוד לא השתנה</span>
          </div>

          {preview.kind === 'workbook' ? (
            preview.data.tables.length === 0 ? (
              <Problems
                title="לא נמצא בקובץ אף גיליון מוכר"
                items={['שמות הגיליונות צריכים להיות: קטלוג רכבים, עיסוקים, עובדים לדוגמה']}
                tone="error"
              />
            ) : (
              preview.data.tables.map((t) => <TablePreview key={t.kind} table={t} />)
            )
          ) : (
            <RulesPreviewView preview={preview.data} />
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={apply}
              disabled={!canApply || busy}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-brand hover:bg-brand-dark disabled:opacity-40"
            >
              {nothingChanges ? 'החלה (אין שינויים)' : 'החלת הקובץ'}
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200"
            >
              ביטול
            </button>
            {!canApply && <span className="text-xs text-danger font-medium">יש לתקן את השגיאות בקובץ ולהעלות אותו שוב</span>}
          </div>
        </div>
      )}
    </div>
  );
};

const Problems: React.FC<{ title: string; items: string[]; tone: 'error' | 'warning' }> = ({ title, items, tone }) => (
  <div className={`rounded-lg p-3 text-xs space-y-1 ${tone === 'error' ? 'bg-danger/5 text-danger' : 'bg-warning/10 text-warning'}`}>
    <p className="flex items-center gap-1.5 font-bold">
      {tone === 'error' ? <XCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {title}
    </p>
    <ul className="list-disc pr-5 space-y-0.5">
      {items.slice(0, 30).map((m, i) => (
        <li key={i}>{m}</li>
      ))}
      {items.length > 30 && <li>ועוד {items.length - 30}...</li>}
    </ul>
  </div>
);

const Changes: React.FC<{ changes: FieldChange[] }> = ({ changes }) => (
  <ul className="space-y-0.5">
    {changes.map((c, i) => (
      <li key={i} className="text-slate-700">
        {c.field}: <bdi className="line-through text-slate-400 font-mono">{c.before}</bdi> ←{' '}
        <bdi className="font-mono font-bold text-ink">{c.after}</bdi>
      </li>
    ))}
  </ul>
);

const TablePreview: React.FC<{ table: DataTablePreview }> = ({ table }) => {
  const { diff } = table;
  return (
    <div className="space-y-2 text-xs">
      <p className="font-bold text-slate-800">
        {TABLE_NAMES[table.kind]}: {table.count} שורות (היום {table.previousCount})
        {table.errors.length === 0 && (
          <span className="font-normal text-slate-500">
            {' '}
            · {diff.added.length} חדשות · {diff.changed.length} שהשתנו · {diff.removed.length} שיוסרו · {diff.unchanged} ללא שינוי
          </span>
        )}
      </p>
      {table.errors.length > 0 && <Problems title={`שגיאות בגיליון "${table.sheet}"`} items={table.errors} tone="error" />}
      {table.warnings.length > 0 && <Problems title="לתשומת לב" items={table.warnings} tone="warning" />}
      {table.errors.length === 0 && (
        <div className="space-y-2">
          {diff.added.length > 0 && (
            <p className="text-success">
              <b>נוספות:</b> {diff.added.join(' · ')}
            </p>
          )}
          {diff.removed.length > 0 && (
            <p className="text-danger">
              <b>יוסרו:</b> {diff.removed.join(' · ')}
            </p>
          )}
          {diff.changed.map((row) => (
            <div key={row.row} className="rounded-lg border border-slate-100 p-2">
              <p className="font-bold text-slate-800 mb-1">{row.row}</p>
              <Changes changes={row.changes} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const RulesPreviewView: React.FC<{ preview: RulesPreview }> = ({ preview }) =>
  preview.errors.length > 0 ? (
    <Problems title="הקובץ אינו קובץ כללים תקין" items={preview.errors} tone="error" />
  ) : (
    <div className="text-xs space-y-2">
      <p className="text-slate-600">
        גרסה: <bdi className="font-mono">{preview.previousVersion}</bdi> ← <bdi className="font-mono font-bold">{preview.version}</bdi>
      </p>
      {preview.changes.length === 0 ? (
        <p className="text-slate-500">הקובץ זהה לכללים הפעילים.</p>
      ) : (
        <Changes changes={preview.changes} />
      )}
    </div>
  );
