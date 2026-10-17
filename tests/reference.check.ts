/**
 * Independent reference check vs docs/SPEC.md section 8.1 (and a few 8.2 rules).
 * Run: npx tsx tests/reference.check.ts
 *
 * The 12 states (6 employees x today/alternative) are built HERE from the SPEC
 * tables (4.2, 4.4, 8.1), NOT by buildScenario, and fed to the app's existing
 * net function calculateNetBreakdown(). buildScenario() is then run separately
 * to see whether the scenario layer reproduces the same states.
 * Expected values are copied from SPEC 8.1 and must never be edited to pass.
 * Exit code 1 if any check fails.
 */
import { calculateEVGrossUp, calculateNetBreakdown } from '../server/bl/engine/net.ts';
import { buildScenario } from '../server/bl/engine/scenario.ts';
import type { EmployeeProfile, TaxCalculationInputs } from '../server/bl/engine/types.ts';
import employees from '../server/data/employees.json';

type Emp = Pick<TaxCalculationInputs, 'base' | 'commissions' | 'bonus' | 'pensionPct' | 'studyFundPct' | 'creditPoints'>;
type Car = { benefit: number; participation: number } | { maintenance: number };
interface Case {
  name: string;
  emp: Emp;
  today: Car;
  alt: Car & { familyGapShare?: number; electric?: boolean };
  expect: { netT: number; netA: number; diff: number; taxT: number; taxA: number; niT: number; niA: number; gross: number };
  scenario: { id: string; type: 'go_electric' | 'family_track' | 'waive_car'; targetCarId?: string };
}

// SPEC 4.4 (employees) + 4.2 (catalog benefit/participation) + 8.1 (expected)
const CASES: Case[] = [
  { name: 'נועה', emp: { base: 18500, commissions: 0, bonus: 0, pensionPct: 6, studyFundPct: 2.5, creditPoints: 2.75 },
    today: { benefit: 4070, participation: 300 }, alt: { benefit: 3130, participation: 300, electric: true },
    expect: { netT: 11032, netA: 11693, diff: 661, taxT: 3443, taxA: 3283, niT: 2153, niA: 2092, gross: 440 },
    scenario: { id: 'E-001', type: 'go_electric', targetCarId: 'CAR-10' } },
  { name: 'דוד', emp: { base: 9800, commissions: 2400, bonus: 0, pensionPct: 6, studyFundPct: 0, creditPoints: 2.25 },
    today: { benefit: 2950, participation: 250 }, alt: { benefit: 8120, participation: 500, familyGapShare: 1150 },
    expect: { netT: 8600, netA: 5078, diff: -3522, taxT: 1369, taxA: 2861, niT: 1250, niA: 1879, gross: 0 },
    scenario: { id: 'E-002', type: 'family_track', targetCarId: 'CAR-19' } },
  { name: 'רחל', emp: { base: 21000, commissions: 0, bonus: 0, pensionPct: 6.5, studyFundPct: 2.5, creditPoints: 2.75 },
    today: { maintenance: 1500 }, alt: { benefit: 2430, participation: 250, electric: true },
    expect: { netT: 15047, netA: 13109, diff: -1938, taxT: 3419, taxA: 3910, niT: 2144, niA: 2315, gross: 473 },
    scenario: { id: 'E-003', type: 'go_electric', targetCarId: 'CAR-06' } },
  { name: 'יוסי', emp: { base: 16000, commissions: 3000, bonus: 0, pensionPct: 6, studyFundPct: 2.5, creditPoints: 2.25 },
    today: { benefit: 4790, participation: 400 }, alt: { benefit: 2930, participation: 300, electric: true },
    expect: { netT: 10693, netA: 11900, diff: 1207, taxT: 3991, taxA: 3497, niT: 2301, niA: 2128, gross: 440 },
    scenario: { id: 'E-004', type: 'go_electric', targetCarId: 'CAR-11' } },
  { name: 'מיכל', emp: { base: 27000, commissions: 0, bonus: 0, pensionPct: 7, studyFundPct: 2.5, creditPoints: 2.75 },
    today: { benefit: 4570, participation: 350 }, alt: { maintenance: 2000 },
    expect: { netT: 14244, netA: 17806, diff: 3562, taxT: 6593, taxA: 5694, niT: 3248, niA: 2935, gross: 0 },
    scenario: { id: 'E-005', type: 'waive_car' } },
  { name: 'אלי', emp: { base: 32000, commissions: 0, bonus: 2000, pensionPct: 6, studyFundPct: 2.5, creditPoints: 2.25 },
    today: { benefit: 5150, participation: 500 }, alt: { benefit: 4150, participation: 500, electric: true },
    expect: { netT: 17073, netA: 17794, diff: 721, taxT: 9367, taxA: 9183, niT: 4170, niA: 4106, gross: 473 },
    scenario: { id: 'E-006', type: 'go_electric', targetCarId: 'CAR-14' } },
];

function state(emp: Emp, car: any): TaxCalculationInputs {
  return {
    ...emp,
    benefitValue: car.benefit ?? 0,
    participation: car.participation ?? 0,
    maintenance: car.maintenance ?? 0,
    familyGapShare: car.familyGapShare ?? 0,
    evGrossUp: 0,
  };
}

/** Independent exact gross-up: bisection to |Δnet − 250| < 0.005, no integer rounding. */
function exactGrossUp(s: TaxCalculationInputs, target = 250): number {
  const base = calculateNetBreakdown(s).net;
  let lo = 0, hi = 2000;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const d = calculateNetBreakdown({ ...s, evGrossUp: mid }).net - base;
    if (Math.abs(d - target) < 0.005) return mid;
    if (d < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

const TOL = 1;
let total = 0, failed = 0;
const table: string[] = [];
const row = (label: string, expected: number, actual: number, tol = TOL) => {
  total++;
  const gap = actual - expected;
  const pass = Math.abs(gap) <= tol;
  if (!pass) failed++;
  table.push(`${pass ? '✓' : '✗'} | ${label.padEnd(28)} | ${String(expected).padStart(7)} | ${String(Math.round(actual * 100) / 100).padStart(9)} | ${String(Math.round(gap * 100) / 100).padStart(7)}`);
};

console.log('=== A. 12 states via calculateNetBreakdown (states built from SPEC) ===');
console.log('  | מצב                          |   צפוי  |    בפועל  |   פער');
const stateResults: Record<string, { pass: boolean }> = {};
for (const c of CASES) {
  const sT = state(c.emp, c.today);
  const sA0 = state(c.emp, c.alt);
  const gApp = c.alt.electric ? calculateEVGrossUp(sA0, 250) : 0;
  const sA = { ...sA0, evGrossUp: gApp };
  const bT = calculateNetBreakdown(sT);
  const bA = calculateNetBreakdown(sA);
  const before = failed;
  row(`${c.name} היום: נטו`, c.expect.netT, bT.net);
  row(`${c.name} היום: מס`, c.expect.taxT, bT.tax);
  row(`${c.name} היום: ב״ל+בריאות`, c.expect.niT, bT.niHealth);
  stateResults[`${c.name} היום`] = { pass: failed === before };
  const before2 = failed;
  row(`${c.name} חלופה: נטו`, c.expect.netA, bA.net);
  row(`${c.name} חלופה: מס`, c.expect.taxA, bA.tax);
  row(`${c.name} חלופה: ב״ל+בריאות`, c.expect.niA, bA.niHealth);
  row(`${c.name} גילום (app)`, c.expect.gross, gApp);
  row(`${c.name} הפרש round-round`, c.expect.diff, Math.round(bA.net) - Math.round(bT.net), 0);
  stateResults[`${c.name} חלופה`] = { pass: failed === before2 };
  if (c.alt.electric) {
    const gx = exactGrossUp(sA0);
    const dApp = bA.net - calculateNetBreakdown(sA0).net;
    console.log(`  info ${c.name}: app gross-up=${gApp.toFixed(3)} gives Δnet=${dApp.toFixed(3)}; exact gross-up=${gx.toFixed(3)} (rounds to ${Math.round(gx)})`);
  }
}
console.log(table.join('\n'));
const green = Object.values(stateResults).filter((r) => r.pass).length;
console.log(`\nStates fully green (net+tax+NI within ±1): ${green}/12`);

console.log('\n=== B. Same 6 comparisons through buildScenario (sample employees from server/data) ===');
table.length = 0;
for (const c of CASES) {
  const emp = (employees as EmployeeProfile[]).find((e) => e.id === c.scenario.id)!;
  const r = buildScenario(emp, c.scenario);
  row(`${c.name} scenario: נטו היום`, c.expect.netT, r.todayBreakdown.net);
  row(`${c.name} scenario: נטו חלופה`, c.expect.netA, r.altBreakdown.net);
  row(`${c.name} scenario: הפרש`, c.expect.diff, r.diffNet, 0);
  row(`${c.name} scenario: Σצעדים−הפרש`, 0, r.sumSteps - r.exactDiff, 0.001);
}
console.log(table.join('\n'));

console.log('\n=== C. Rule / agent probes (SPEC 3.2, 7, 8.2) ===');
const probes: Array<[string, boolean, string]> = [];
// EV gross-up should give exactly +250 net (SPEC 3.2 tolerance 0.005)
{
  const s = state(CASES[0].emp, CASES[0].alt);
  const g = calculateEVGrossUp(s, 250);
  const d = calculateNetBreakdown({ ...s, evGrossUp: g }).net - calculateNetBreakdown(s).net;
  probes.push(['EV gross-up yields +250.00 net (±0.005)', Math.abs(d - 250) < 0.005, `Δnet=${d.toFixed(4)} with gross ${g}`]);
}
// Unknown occupation must not silently allow waiver
{
  const emp = { ...(employees as EmployeeProfile[])[0], occupation: 'אסטרונאוט/ית' };
  const r = buildScenario(emp, { type: 'waive_car' });
  probes.push(['Unknown occupation is not auto-eligible to waive (should escalate)', !r.eligible, `eligible=${r.eligible}, maintenance=${r.altState.maintenance}`]);
}
// keep scenario: alternative should equal today
{
  const eli = (employees as EmployeeProfile[]).find((e) => e.id === 'E-006')!;
  const r = buildScenario(eli, { type: 'keep' });
  probes.push(["'keep' scenario shows no change", r.diffNet === 0, `alt="${r.altCarLabel}", diff=${r.diffNet}`]);
}
const { findCarByIdOrName } = await import('../server/bl/engine/scenario.ts');
{
  const c = findCarByIdOrName('COROLLA CROSS');
  probes.push(["findCarByIdOrName('COROLLA CROSS') returns COROLLA CROSS", c?.model === 'COROLLA CROSS', `got ${c?.id} ${c?.model}`]);
}
const { executeTool } = await import('../server/bl/agent/tools.ts');
const ctx: any = {
  profile: (employees as EmployeeProfile[])[0], lastComparison: null, repParticipationMode: false,
  onProfileUpdate: () => {}, onComparisonRun: () => {}, onEscalate: async () => 'T-1',
};
for (const q of ['קורולה קרוס', 'אטו', 'טסלה', 'קרניבל']) {
  const { result } = await executeTool('find_car', { query: q }, ctx);
  probes.push([`find_car("${q}") finds a car (SPEC 7 fuzzy Hebrew)`, result.found === true, result.found ? result.cars.map((c: any) => c.model).join(',') : 'not found']);
}
// same-turn profile update must reach run_comparison
{
  const updates: any[] = [];
  const c2 = { ...ctx, onProfileUpdate: (u: any) => updates.push(u) };
  await executeTool('update_profile', { base: 30000 }, c2);
  const { result } = await executeTool('run_comparison', { scenarioType: 'go_electric', targetCarId: 'CAR-10' }, c2);
  probes.push(['run_comparison after update_profile(base=30000) in the same turn uses the new base', result.todayNet !== 11032, `todayNet=${result.todayNet}`]);
}
const { verifyNumbersInResponse } = await import('../server/bl/agent/guard.ts');
{
  const g1 = verifyNumbersInResponse('הנטו שלך יעלה ב-661 ₪ ויהיה 11,693 ₪', ['11693 661']);
  probes.push(['Guard accepts "11,693" when the tool returned 11693', g1.passed, `invented=${g1.inventedNumbers.join(',')}`]);
  const g2 = verifyNumbersInResponse('ההפרש הוא 12,345 ₪', ['12 345']);
  probes.push(['Guard rejects 12,345 when tool output only had 12 and 345', !g2.passed, `invented=${g2.inventedNumbers.join(',')}`]);
}
for (const [label, pass, detail] of probes) {
  total++;
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}  — ${detail}`);
}

console.log(`\nTOTAL: ${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
