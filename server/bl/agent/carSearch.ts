/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import aliasesData from '../../data/car-aliases.json';
import catalogData from '../../data/catalog.json';
import { canSelectCarGroup } from '../engine/rules.ts';
import { Car, EligibilityGroup } from '../engine/types.ts';

const carsCatalog = catalogData as Car[];
const aliases = aliasesData as Record<string, string[]>;

/** Score from which a name counts as found (exact or contained), below it only suggestions */
const FOUND_SCORE = 0.9;
const MAX_SUGGESTIONS = 5;

// Lowercase, no quotes/geresh/hyphens, single spaces: "ג'י" = "גי", "RAV-4" = "rav 4"
const norm = (s: string) => s.toLowerCase().replace(/["'׳״`\-]/g, '').replace(/\s+/g, ' ').trim();
const compact = (s: string) => norm(s).replace(/ /g, '');

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** 1 = exact name, 0.9 = one contains the other, below = spelling similarity */
function scoreCar(car: Car, query: string): number {
  return nameScore(query, [car.model, car.make, car.make.split(' ')[0], ...(aliases[car.id] ?? [])]);
}

/** Best score of a query against several names of one item (also used for occupations) */
export function nameScore(query: string, names: string[]): number {
  const q = compact(query);
  if (!q) return 0;
  let best = 0;
  for (const name of names) {
    const n = compact(name);
    if (!n) continue;
    if (n === q) return 1;
    if (q.length >= 2 && (n.includes(q) || q.includes(n))) best = Math.max(best, FOUND_SCORE);
    else best = Math.max(best, 1 - levenshtein(q, n) / Math.max(q.length, n.length));
  }
  return best;
}

export interface CarSearchResult {
  /** Cars that match the query (one = found, several = ask which one) */
  matches: Car[];
  /** Closest cars when nothing matched, for "did you mean ...?" */
  suggestions: Car[];
}

/**
 * Fuzzy Hebrew/English car search (SPEC 7 find_car). An exact catalog ID or name wins alone,
 * so "קורולה קרוס" returns COROLLA CROSS only, not COROLLA too.
 */
export function searchCars(query: string, employeeGroup?: EligibilityGroup): CarSearchResult {
  const q = query.trim();
  const byId = carsCatalog.filter((c) => c.id.toLowerCase() === q.toLowerCase());
  if (byId.length > 0) return { matches: byId, suggestions: [] };

  const scored = carsCatalog
    .map((car) => ({ car, score: scoreCar(car, q) }))
    .sort((a, b) => b.score - a.score);

  const exact = scored.filter((s) => s.score === 1);
  if (exact.length > 0) return { matches: exact.map((s) => s.car), suggestions: [] };

  const contained = scored.filter((s) => s.score >= FOUND_SCORE);
  if (contained.length > 0) return { matches: contained.map((s) => s.car), suggestions: [] };

  // Nothing matched: closest cars the employee may choose (own group or lower, no family cars)
  const selectable = scored.filter(
    (s) => s.car.group !== 'משפחתי' && (!employeeGroup || canSelectCarGroup(employeeGroup, s.car.group))
  );
  return { matches: [], suggestions: selectable.slice(0, MAX_SUGGESTIONS).map((s) => s.car) };
}

/** Line N of a numbered list ("1. **MG4** ..." / "2) KONA EV ...") in a bot message */
export function numberedLine(text: string | undefined, n: number): string | undefined {
  if (!text) return undefined;
  const re = new RegExp(`^\\s*${n}\\s*[.)]\\s+(.+)$`, 'm');
  return text.match(re)?.[1];
}

/** The car named on a list line: by catalog ID if shown, else by the longest model name on it */
export function carOnLine(line: string): Car | undefined {
  const upper = line.toUpperCase();
  const byId = carsCatalog.find((c) => new RegExp(`\\b${c.id}\\b`).test(upper));
  if (byId) return byId;
  return carsCatalog
    .filter((c) => upper.includes(c.model.toUpperCase()))
    .sort((a, b) => b.model.length - a.model.length)[0];
}
