/**
 * Check for src/store/repAnswer.ts (TODO C.4): applying a rep answer in the employee chat.
 * Run: npx tsx tests/repAnswer.check.ts
 *
 * Scenario: Noa (E-001) asks about ATTO 3 (CAR-10, go_electric). While the rep
 * verifies, the chat shows the 'keep' baseline with requestedScenarioType /
 * requestedCarId (K.2). The rep answers 350, effective from 1/1.
 * Today's net must stay 11,032 (SPEC 8.1): the 350 is the NEW car's participation.
 * Exit code 1 if any check fails.
 */
import { buildScenario } from '../src/engine/scenario.ts';
import type { ComparisonResult, EmployeeProfile } from '../src/engine/types.ts';
import { applyRepAnswer, findUndeliveredAnswers } from '../src/store/repAnswer.ts';
import type { SupportTicket } from '../src/store/types.ts';
import employees from '../src/data/employees.json';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
}

const noa = (employees as EmployeeProfile[]).find((e) => e.id === 'E-001')!;
const profile: EmployeeProfile = { ...noa };

const baseline: ComparisonResult = {
  ...buildScenario(profile, { type: 'keep' }),
  requestedScenarioType: 'go_electric',
  requestedCarId: 'CAR-10',
};

const ticket: SupportTicket = {
  id: 'TICK-0001',
  sessionId: 'session-noa',
  question: 'מה ההשתתפות העצמית ב-ATTO 3?',
  summary: 'נועה שואלת על ATTO 3',
  status: 'answered',
  profile,
  lastComparison: baseline,
  transcript: [],
  createdAt: 1,
  answeredAt: 2,
  answer: { text: 'ההשתתפות ב-ATTO 3 היא 350 ₪', value: 350, effectiveFrom: '1/1' },
};
const otherSession: SupportTicket = { ...ticket, id: 'TICK-0002', sessionId: 'other' };
const openTicket: SupportTicket = { ...ticket, id: 'TICK-0003', status: 'open', answer: undefined };

// 1. Pending answers are found by ticket id / deliveredAt, not by message text
const pending = findUndeliveredAnswers([ticket, otherSession, openTicket], 'session-noa');
check('finds exactly the answered ticket of this session', pending.length === 1 && pending[0].id === 'TICK-0001');

const now = 1_700_000_000_000;
const res = applyRepAnswer(ticket, profile, null, now);

check('marks answer.deliveredAt', res.ticket.answer?.deliveredAt === now);
check('delivered ticket is not pending again', findUndeliveredAnswers([res.ticket], 'session-noa').length === 0);
check('input ticket is not mutated', ticket.answer?.deliveredAt === undefined);

// 2. Today's participation is untouched
check('profile.currentParticipation stays 300', profile.currentParticipation === 300, `got ${profile.currentParticipation}`);

// 3. Recomputed for the requested car and scenario
const c = res.comparison;
check('comparison recomputed', c !== undefined);
check('scenario is go_electric', c?.scenarioType === 'go_electric', `got ${c?.scenarioType}`);
check('target car is ATTO 3 (CAR-10)', c?.targetCar?.id === 'CAR-10', `got ${c?.targetCar?.id}`);
check('new car participation is 350', c?.altState.participation === 350, `got ${c?.altState.participation}`);
check('today participation is 300', c?.todayState.participation === 300, `got ${c?.todayState.participation}`);
check('today net stays 11,032', Math.round(c?.todayBreakdown.net ?? NaN) === 11032, `got ${c?.todayBreakdown.net}`);

check(
  'rep message text',
  res.repMessageText === 'תשובת נציג: ההשתתפות ב-ATTO 3 היא 350 ₪ (בתוקף מ-1/1)',
  res.repMessageText
);

// 4. Internal note for the agent carries the engine numbers (no thousands commas, see guard.ts)
const note = res.agentNote ?? '';
check('agent note exists', note.length > 0);
check('agent note has today net from the engine', note.includes('11032'), note);
check('agent note has the diff from the engine', c !== undefined && note.includes(`${c.diffNet}`), note);

// Falls back to the current comparison when the ticket has no snapshot (Supabase listTickets)
const noSnapshot = applyRepAnswer({ ...ticket, lastComparison: undefined }, profile, baseline, now);
check('uses current comparison when ticket has no snapshot', noSnapshot.comparison?.targetCar?.id === 'CAR-10');

// No new car requested -> show the answer only, no recompute and no agent turn
const keepOnly = applyRepAnswer(
  { ...ticket, lastComparison: buildScenario(profile, { type: 'keep' }) },
  profile,
  null,
  now
);
check('keep: no recompute', keepOnly.comparison === undefined && keepOnly.agentNote === undefined);

console.log(`\nTOTAL ${passed}/${passed + failed}`);
if (failed > 0) process.exit(1);
