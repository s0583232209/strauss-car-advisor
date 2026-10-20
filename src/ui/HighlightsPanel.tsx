/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Admin: pros and cons per catalog car. The AI writes a draft in one click, the admin approves it in
 * one click (and may edit a line first). Employees see approved text only.
 */

import { CheckCircle2, Loader2, RefreshCw, Sparkles, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type { AdminHighlightsRow, CarHighlights } from '../../shared/types.ts';
import { api, ApiError } from '../api/client.ts';

const SLOTS = 3;

/** Always 3 inputs per side; empty lines are dropped when saving */
const padded = (items: string[]): string[] => [...items, ...Array(SLOTS).fill('')].slice(0, SLOTS);
const filled = (h: CarHighlights): CarHighlights => ({
  pros: h.pros.map((t) => t.trim()).filter(Boolean),
  cons: h.cons.map((t) => t.trim()).filter(Boolean),
});

type Status = 'none' | 'draft' | 'approved' | 'stale';
const statusOf = (row: AdminHighlightsRow): Status => (!row.record ? 'none' : row.stale ? 'stale' : row.record.status);
const STATUS_BADGE: Record<Status, { label: string; className: string }> = {
  none: { label: 'אין עדיין', className: 'bg-slate-100 text-slate-600' },
  draft: { label: 'טיוטה, ממתין לאישור', className: 'bg-warning/15 text-warning' },
  approved: { label: 'מאושר, מוצג לעובדים', className: 'bg-success/15 text-success' },
  stale: { label: 'נכתב לרכב אחר, צרו מחדש', className: 'bg-danger/10 text-danger' },
};

export const HighlightsPanel: React.FC<{ onError: (err: unknown) => void }> = ({ onError }) => {
  const [rows, setRows] = useState<AdminHighlightsRow[] | null>(null);
  // Lines the admin changed and has not saved yet, by car id
  const [edits, setEdits] = useState<Record<string, CarHighlights>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [bulk, setBulk] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      setRows(await api.admin.highlights.list());
    } catch (err) {
      onError(err);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const replaceRow = (carId: string, record: AdminHighlightsRow['record']) => {
    setRows((prev) => prev?.map((r) => (r.carId === carId ? { ...r, record, stale: false } : r)) ?? prev);
    setEdits(({ [carId]: _, ...rest }) => rest);
  };

  /** Runs one car's call; returns false (and shows the message) when it fails */
  const run = async (carId: string, call: () => Promise<void>): Promise<boolean> => {
    setBusy((b) => ({ ...b, [carId]: true }));
    try {
      await call();
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status !== 401) setMessage(`${carId}: ${err.message}`);
      else onError(err);
      return false;
    } finally {
      setBusy((b) => ({ ...b, [carId]: false }));
    }
  };

  const draft = (carId: string) => run(carId, async () => replaceRow(carId, await api.admin.highlights.draft(carId)));
  const approve = (carId: string, h: CarHighlights) =>
    run(carId, async () => replaceRow(carId, await api.admin.highlights.approve(carId, filled(h))));
  const remove = (carId: string) =>
    run(carId, async () => {
      await api.admin.highlights.remove(carId);
      replaceRow(carId, null);
    });

  /** One car after the other: each draft is a model call of a few seconds */
  const draftAllMissing = async () => {
    const todo = (rows ?? []).filter((r) => ['none', 'stale'].includes(statusOf(r)));
    setMessage(null);
    let ok = 0;
    for (const [i, row] of todo.entries()) {
      setBulk(`יוצר טיוטות… ${i + 1}/${todo.length}`);
      if (await draft(row.carId)) ok++;
    }
    setBulk(null);
    if (todo.length) setMessage(`נוצרו ${ok} טיוטות מתוך ${todo.length}. עברו עליהן ואשרו.`);
  };

  const approveAllDrafts = async () => {
    const todo = (rows ?? []).filter((r) => statusOf(r) === 'draft');
    setMessage(null);
    for (const [i, row] of todo.entries()) {
      setBulk(`מאשר… ${i + 1}/${todo.length}`);
      await approve(row.carId, edits[row.carId] ?? row.record!);
    }
    setBulk(null);
  };

  if (!rows) return <div className="text-sm text-slate-500">טוען…</div>;

  const counts = rows.reduce<Record<Status, number>>(
    (acc, r) => ({ ...acc, [statusOf(r)]: acc[statusOf(r)] + 1 }),
    { none: 0, draft: 0, approved: 0, stale: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div className="text-xs text-slate-600 space-y-1">
          <div>
            <span className="font-semibold text-success">{counts.approved} מאושרים</span> ·{' '}
            <span className="font-semibold text-warning">{counts.draft} טיוטות</span> ·{' '}
            <span className="font-semibold">{counts.none + counts.stale} חסרים</span>
          </div>
          <div>הטיוטה נכתבת על ידי AI, בלי מספרים. העובדים רואים רק מה שאושר.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(bulk) || counts.none + counts.stale === 0}
            onClick={draftAllMissing}
            className="lift px-3.5 py-2 rounded-full text-xs font-semibold bg-brand text-white hover:bg-brand-dark disabled:opacity-40 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>צור טיוטות לכל החסרים</span>
          </button>
          <button
            type="button"
            disabled={Boolean(bulk) || counts.draft === 0}
            onClick={approveAllDrafts}
            className="px-3.5 py-2 rounded-full text-xs font-semibold bg-success text-white hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>אשר את כל הטיוטות</span>
          </button>
        </div>
      </div>

      {(bulk || message) && (
        <div className="text-xs px-3 py-2 rounded-lg bg-brand/5 border border-brand/20 text-brand-dark flex items-center gap-2">
          {bulk && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>{bulk ?? message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {rows.map((row) => {
          const status = statusOf(row);
          const badge = STATUS_BADGE[status];
          const saved: CarHighlights = row.record && !row.stale ? row.record : { pros: [], cons: [] };
          const current = edits[row.carId] ?? saved;
          const dirty = Boolean(edits[row.carId]);
          const ready = filled(current).pros.length > 0 && filled(current).cons.length > 0;
          const working = busy[row.carId] || Boolean(bulk);
          const setLine = (side: keyof CarHighlights, i: number, value: string) => {
            const next = { pros: padded(current.pros), cons: padded(current.cons) };
            next[side][i] = value;
            setEdits((e) => ({ ...e, [row.carId]: next }));
          };

          return (
            <div key={row.carId} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-ink">{row.carLabel}</div>
                  <div className="text-[11px] text-slate-500">
                    {row.carId} · קבוצה {row.group}
                  </div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${badge.className}`}>
                  {badge.label}
                </span>
              </div>

              {(status !== 'none' && status !== 'stale') || dirty ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['pros', 'cons'] as const).map((side) => (
                    <div key={side} className="space-y-1.5">
                      <div
                        className={`text-[11px] font-semibold flex items-center gap-1 ${
                          side === 'pros' ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {side === 'pros' ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                        <span>{side === 'pros' ? 'יתרונות' : 'חסרונות'}</span>
                      </div>
                      {padded(current[side]).map((line, i) => (
                        <input
                          key={i}
                          value={line}
                          maxLength={120}
                          disabled={working}
                          onChange={(e) => setLine(side, i, e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand/20"
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={working}
                  onClick={() => {
                    setMessage(null);
                    draft(row.carId);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-800 hover:bg-slate-200 disabled:opacity-40 flex items-center gap-1.5"
                >
                  {busy[row.carId] ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : status === 'none' ? (
                    <Sparkles className="w-3.5 h-3.5" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>{status === 'none' ? 'צור טיוטה' : 'צור מחדש'}</span>
                </button>
                {(status === 'draft' || dirty) && (
                  <button
                    type="button"
                    disabled={working || !ready}
                    title={ready ? undefined : 'נדרש לפחות יתרון אחד וחיסרון אחד'}
                    onClick={() => approve(row.carId, current)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-success text-white hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{dirty ? 'שמור ואשר' : 'אשר'}</span>
                  </button>
                )}
                {row.record && (
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => remove(row.carId)}
                    className="mr-auto p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5 disabled:opacity-40"
                    title="מחק"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
