/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Car pros and cons: the model writes a draft for one catalog car, the admin approves it (as is or
 * edited), and employees see only approved text. The model is told not to state numbers; any item
 * with a digit is dropped from its draft.
 */

import type { AdminHighlightsRow, Car, CarHighlights, CarHighlightsRecord } from '../../../shared/types.ts';
import type { Repository } from '../../dal/index.ts';
import { getCatalog } from '../engine/referenceData.ts';

export const MAX_HIGHLIGHTS = 3;
export const MAX_HIGHLIGHT_LENGTH = 120;

/** Asks the model for { pros, cons } of one car; throws when no model answers */
export type HighlightsDrafter = (car: Car) => Promise<unknown>;

/** A failure with a message for the admin (also for 5xx, which the error handler would hide) */
export class HighlightsError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** The car a text was written for; a different car under the same id makes the text stale */
export const carLabelOf = (car: Car): string => `${car.make} ${car.model} ${car.year}`;

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const t = item.replace(/\s+/g, ' ').replace(/^[-•*·]\s*/, '').trim();
    if (!t || /\d/.test(t) || t.length > MAX_HIGHLIGHT_LENGTH || out.includes(t)) continue;
    out.push(t);
    if (out.length === MAX_HIGHLIGHTS) break;
  }
  return out;
}

/** Model output → at most 3 short pros and 3 cons, without items that state numbers */
export function cleanDraft(raw: unknown): CarHighlights {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { pros: cleanList(r.pros), cons: cleanList(r.cons) };
}

export function createHighlightsService(repo: Repository, drafter: HighlightsDrafter | null, now: () => number = Date.now) {
  function findCar(carId: string): Car {
    const car = getCatalog().find((c) => c.id === carId);
    if (!car) throw new HighlightsError(404, 'הרכב לא נמצא בקטלוג');
    return car;
  }

  async function put(record: CarHighlightsRecord): Promise<CarHighlightsRecord> {
    const all = await repo.getCarHighlights();
    await repo.saveCarHighlights([...all.filter((r) => r.carId !== record.carId), record]);
    return record;
  }

  return {
    /** Every catalog car with its saved text (if any), for the admin screen */
    async list(): Promise<AdminHighlightsRow[]> {
      const saved = new Map((await repo.getCarHighlights()).map((r) => [r.carId, r]));
      return getCatalog().map((car) => {
        const record = saved.get(car.id) ?? null;
        const carLabel = carLabelOf(car);
        return { carId: car.id, carLabel, group: car.group, record, stale: Boolean(record && record.carLabel !== carLabel) };
      });
    },

    /** A new model draft for one car; replaces what was saved for it (also an approved text) */
    async draft(carId: string): Promise<CarHighlightsRecord> {
      const car = findCar(carId);
      if (!drafter) throw new HighlightsError(503, 'יצירת טיוטה דורשת מפתח Gemini, שאינו מוגדר בשרת');
      let raw: unknown;
      try {
        raw = await drafter(car);
      } catch (err: any) {
        console.warn(`[highlights] draft for ${carId} failed: ${err?.name ?? 'Error'} (${err?.status ?? '-'})`);
        throw new HighlightsError(503, 'המודל לא זמין כרגע. נסו שוב בעוד דקה');
      }
      const draft = cleanDraft(raw);
      if (!draft.pros.length || !draft.cons.length) {
        throw new HighlightsError(502, 'המודל החזיר טיוטה לא תקינה. נסו שוב');
      }
      return put({ carId, carLabel: carLabelOf(car), status: 'draft', ...draft, updatedAt: now() });
    },

    /** The admin's approved text (the draft as is, or edited) */
    async approve(carId: string, highlights: CarHighlights): Promise<CarHighlightsRecord> {
      const car = findCar(carId);
      return put({ carId, carLabel: carLabelOf(car), status: 'approved', pros: highlights.pros, cons: highlights.cons, updatedAt: now() });
    },

    async remove(carId: string): Promise<void> {
      const all = await repo.getCarHighlights();
      await repo.saveCarHighlights(all.filter((r) => r.carId !== carId));
    },

    /** What employees see: approved, not stale, cars in the active catalog only */
    async approved(): Promise<Record<string, CarHighlights>> {
      const saved = new Map((await repo.getCarHighlights()).map((r) => [r.carId, r]));
      const out: Record<string, CarHighlights> = {};
      for (const car of getCatalog()) {
        const r = saved.get(car.id);
        if (r?.status === 'approved' && r.carLabel === carLabelOf(car)) out[car.id] = { pros: r.pros, cons: r.cons };
      }
      return out;
    },
  };
}

export type HighlightsService = ReturnType<typeof createHighlightsService>;
