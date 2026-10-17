/**
 * Check for the agent tools in server/bl/agent/tools.ts, without a model.
 * Run: npx tsx tests/tools.check.ts
 *
 * Each tool is called through executeTool() with a fake AgentContext.
 * Required fields follow SPEC section 7; "missing" means undefined (0 is valid).
 * Expected nets for Noa (E-001, ATTO 3) are copied from SPEC 8.1.
 * Exit code 1 if any check fails.
 */
import { executeTool } from '../server/bl/agent/tools.ts';
import type { AgentContext } from '../server/bl/agent/types.ts';
import type { Car, ComparisonResult, EmployeeProfile } from '../server/bl/engine/types.ts';
import catalogData from '../server/data/catalog.json';
import employees from '../server/data/employees.json';

const catalog = catalogData as Car[];

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
}

interface Spy {
  ctx: AgentContext;
  updates: Partial<EmployeeProfile>[];
  comparisons: ComparisonResult[];
  escalations: { question: string; summary: string }[];
}

function makeContext(profile: Partial<EmployeeProfile>, repParticipationMode = false): Spy {
  const spy: Spy = { ctx: undefined as unknown as AgentContext, updates: [], comparisons: [], escalations: [] };
  spy.ctx = {
    profile: { ...profile } as EmployeeProfile,
    lastComparison: null,
    repParticipationMode,
    onProfileUpdate: (u) => spy.updates.push(u),
    onComparisonRun: (c) => spy.comparisons.push(c),
    onEscalate: async (question, summary) => {
      spy.escalations.push({ question, summary });
      return 'TICK-TEST';
    },
  };
  return spy;
}

const noa = (employees as EmployeeProfile[]).find((e) => e.id === 'E-001')!;
const rachel = (employees as EmployeeProfile[]).find((e) => e.id === 'E-003')!;
const fieldsOf = (r: any): string[] => (r.missing ?? []).map((m: any) => m.field);

async function main() {
  // ---------- update_profile ----------
  {
    const s = makeContext({});
    const { result } = await executeTool('update_profile', { base: 18500, commissions: 0, studyFundPct: 0 }, s.ctx);
    check('update_profile: accepts valid values', result.success === true);
    check('update_profile: 0 is stored, not dropped', s.ctx.profile.commissions === 0 && s.ctx.profile.studyFundPct === 0);
    check('update_profile: mutates turn profile and notifies', s.ctx.profile.base === 18500 && s.updates.length === 1);
  }
  {
    const s = makeContext({ base: 18500 });
    const { result } = await executeTool('update_profile', { base: -100 }, s.ctx);
    check('update_profile: rejects negative base', result.success === false && result.rejected?.[0]?.field === 'base');
    check('update_profile: negative leaves profile unchanged', s.ctx.profile.base === 18500 && s.updates.length === 0);
  }
  {
    const s = makeContext({});
    const { result } = await executeTool('update_profile', { base: 20000, currentParticipation: -300 }, s.ctx);
    check(
      'update_profile: one negative rejects the whole call',
      result.success === false && s.ctx.profile.base === undefined && s.updates.length === 0
    );
  }
  {
    const s = makeContext({});
    const { result } = await executeTool('update_profile', { pensionPct: 'abc' }, s.ctx);
    check('update_profile: rejects non-numeric value', result.success === false);
  }
  {
    const s = makeContext({});
    await executeTool('update_profile', { hasCar: true, currentCarName: 'ATTO 3' }, s.ctx);
    check(
      'update_profile: catalog car fills benefit on an empty profile',
      s.ctx.profile.currentCarId === 'CAR-10' && s.ctx.profile.currentBenefit === 3130,
      `id=${s.ctx.profile.currentCarId} benefit=${s.ctx.profile.currentBenefit}`
    );
    check('update_profile: participation is not guessed', s.ctx.profile.currentParticipation === undefined);
  }

  // update_profile with the conversation: numbers must come from the employee
  {
    const s = makeContext({});
    s.ctx.userTexts = ['אני בקבוצה ג, השכר שלי 18,500 ₪', 'יש לי שלושה ילדים, אין עמלות'];
    const { result } = await executeTool(
      'update_profile',
      { group: 'ג', base: 18500, childrenUpTo23: 3, commissions: 0, pensionPct: 6, creditPoints: 2.25 },
      s.ctx
    );
    check(
      'update_profile: saves stated numbers (18,500, "שלושה", 0 for none)',
      s.ctx.profile.base === 18500 && s.ctx.profile.childrenUpTo23 === 3 && s.ctx.profile.commissions === 0
    );
    check(
      'update_profile: drops numbers the employee never wrote (6%, 2.25)',
      result.success === false &&
        s.ctx.profile.pensionPct === undefined &&
        s.ctx.profile.creditPoints === undefined &&
        result.notSaved.map((n: any) => n.field).join(',') === 'pensionPct,creditPoints'
    );
  }
  {
    const s = makeContext({});
    s.ctx.userTexts = ['מרוויחה 18 אלף, פנסיה 6.5%'];
    await executeTool('update_profile', { base: 18000, pensionPct: 6.5 }, s.ctx);
    check('update_profile: "18 אלף" and "6.5%" count as stated', s.ctx.profile.base === 18000 && s.ctx.profile.pensionPct === 6.5);
  }

  // ---------- get_missing_fields ----------
  {
    const s = makeContext({});
    const { result } = await executeTool('get_missing_fields', { scenarioType: 'general' }, s.ctx);
    // Order: group, base, car today, children (always asked, decision 2026-10-13), then the rest.
    // No occupation: it is asked only for waive_car (SPEC 7, changed 2026-10-14)
    const expected = ['group', 'base', 'hasCar', 'childrenUpTo23', 'commissions', 'bonus', 'pensionPct', 'studyFundPct', 'creditPoints'];
    const got = fieldsOf(result);
    check(
      'get_missing_fields: empty profile lists all fields in asking order',
      got.join(',') === expected.join(',') && result.isComplete === false,
      got.join(',')
    );
    check('get_missing_fields: next = first field to ask', result.next?.field === 'group');
  }
  {
    const { childrenUpTo23, ...noKids } = noa;
    const s = makeContext(noKids);
    const { result } = await executeTool('get_missing_fields', { scenarioType: 'go_electric' }, s.ctx);
    check('get_missing_fields: children asked outside family track too', fieldsOf(result).join(',') === 'childrenUpTo23');
  }
  {
    // Occupation is required only for a waiver (SPEC 7)
    const { occupation, ...noOcc } = noa;
    const electric = await executeTool('get_missing_fields', { scenarioType: 'go_electric' }, makeContext(noOcc).ctx);
    check('get_missing_fields: go_electric does not ask occupation', !fieldsOf(electric.result).includes('occupation'), fieldsOf(electric.result).join(','));
    const change = await executeTool('get_missing_fields', { scenarioType: 'change_car' }, makeContext(noOcc).ctx);
    check('get_missing_fields: change_car does not ask occupation', !fieldsOf(change.result).includes('occupation'), fieldsOf(change.result).join(','));
    const waive = await executeTool('get_missing_fields', { scenarioType: 'waive_car' }, makeContext(noOcc).ctx);
    check('get_missing_fields: waive_car asks occupation', fieldsOf(waive.result).includes('occupation'), fieldsOf(waive.result).join(','));
    const s = makeContext(noOcc);
    await executeTool('run_comparison', { scenarioType: 'go_electric', targetCarId: 'CAR-10' }, s.ctx);
    check('run_comparison: go_electric works without occupation', s.comparisons.length === 1);
  }
  {
    // Group is asked directly, never derived from occupation
    const s = makeContext({});
    await executeTool('update_profile', { occupation: 'מנהל/ת מוצר' }, s.ctx);
    check('update_profile: occupation does not set group', s.ctx.profile.group === undefined);
  }
  {
    const s = makeContext({ ...noa, childrenUpTo23: 0 });
    const { result } = await executeTool('get_missing_fields', { scenarioType: 'family_track' }, s.ctx);
    check('get_missing_fields: 0 children is a value, not missing', result.isComplete === true, fieldsOf(result).join(','));
  }
  {
    const s = makeContext(noa);
    const { result } = await executeTool('get_missing_fields', { scenarioType: 'go_electric' }, s.ctx);
    check('get_missing_fields: full sample profile (0 commissions/bonus) is complete', result.isComplete === true, fieldsOf(result).join(','));
  }
  {
    const { currentParticipation, ...noPart } = noa;
    const s = makeContext(noPart);
    const { result } = await executeTool('get_missing_fields', { scenarioType: 'change_car' }, s.ctx);
    check('get_missing_fields: car without participation is missing', fieldsOf(result).join(',') === 'currentParticipation');
  }
  {
    const s = makeContext({ ...noa, currentCarName: 'UNKNOWN CAR', currentBenefit: undefined });
    const { result } = await executeTool('get_missing_fields', { scenarioType: 'change_car' }, s.ctx);
    check('get_missing_fields: car without benefit value is missing', fieldsOf(result).includes('currentBenefit'));
  }
  {
    const s = makeContext(rachel);
    const { result } = await executeTool('get_missing_fields', { scenarioType: 'go_electric' }, s.ctx);
    check('get_missing_fields: waiver profile is complete', result.isComplete === true, fieldsOf(result).join(','));
  }
  {
    const s = makeContext({ ...rachel, currentMaintenance: undefined });
    const { result } = await executeTool('get_missing_fields', { scenarioType: 'go_electric' }, s.ctx);
    check('get_missing_fields: waiver without maintenance is missing', fieldsOf(result).join(',') === 'currentMaintenance');
  }

  // ---------- find_car ----------
  {
    const s = makeContext({});
    const { result } = await executeTool('find_car', { query: 'atto' }, s.ctx);
    check('find_car: finds ATTO 3', result.found === true && result.cars.some((c: any) => c.id === 'CAR-10'));
    const none = await executeTool('find_car', { query: 'zzzz' }, s.ctx);
    check('find_car: unknown query returns found=false', none.result.found === false);
  }

  // ---------- list_options ----------
  {
    const s = makeContext({});
    const { result } = await executeTool('list_options', { type: 'all' }, s.ctx);
    check(
      'list_options: no group returns "חסרה קבוצת זכאות", no cars',
      result.message === 'חסרה קבוצת זכאות' && result.options === undefined && fieldsOf(result).includes('group')
    );
  }
  {
    const s = makeContext({ group: 'ב' });
    const { result } = await executeTool('list_options', { type: 'all' }, s.ctx);
    const groups = new Set(result.options.map((o: any) => o.group));
    check(
      'list_options: group ב sees only א/ב, never family cars',
      result.totalEligible > 0 && [...groups].every((g) => g === 'א' || g === 'ב'),
      [...groups].join(',')
    );
    const ev = await executeTool('list_options', { type: 'electric' }, s.ctx);
    check(
      'list_options: electric filter returns only EVs',
      ev.result.options.length > 0 && ev.result.options.every((o: any) => catalog.find((c) => c.id === o.id)?.driveCode === 3),
      ev.result.options.map((o: any) => o.id).join(',')
    );
  }

  // ---------- run_comparison ----------
  {
    const s = makeContext({});
    const { result } = await executeTool('run_comparison', { scenarioType: 'go_electric', targetCarId: 'CAR-10' }, s.ctx);
    check(
      'run_comparison: refuses an empty profile and lists fields',
      result.status === 'missing_fields' && fieldsOf(result).includes('base') && s.comparisons.length === 0
    );
  }
  {
    const s = makeContext({}, true);
    const { result } = await executeTool('run_comparison', { scenarioType: 'go_electric', targetCarId: 'CAR-10' }, s.ctx);
    check(
      'run_comparison: rep mode also refuses first, no ticket',
      result.status === 'missing_fields' && s.escalations.length === 0 && s.comparisons.length === 0
    );
  }
  {
    const { childrenUpTo23, ...noKids } = noa;
    const s = makeContext(noKids);
    const { result } = await executeTool('run_comparison', { scenarioType: 'family_track', targetCarId: 'CAR-19' }, s.ctx);
    check('run_comparison: family track without children refuses', fieldsOf(result).join(',') === 'childrenUpTo23');
  }
  {
    const s = makeContext(noa);
    const { result } = await executeTool('run_comparison', { scenarioType: 'go_electric', targetCarId: 'CAR-10' }, s.ctx);
    check(
      'run_comparison: Noa → ATTO 3 matches SPEC 8.1 (11,032 → 11,693)',
      result.status === 'calculated' && result.todayNet === 11032 && result.altNet === 11693 && s.comparisons.length === 1,
      `${result.todayNet} → ${result.altNet}`
    );
  }

  // ---------- escalate_to_rep ----------
  {
    const s = makeContext({});
    const { result } = await executeTool('escalate_to_rep', { question: 'q', summary: 's' }, s.ctx);
    check('escalate_to_rep: opens a ticket', result.success === true && result.ticketId === 'TICK-TEST' && s.escalations.length === 1);
  }

  // ---------- unknown tool ----------
  {
    const s = makeContext({});
    const { result } = await executeTool('no_such_tool', {}, s.ctx);
    check('unknown tool returns an error', typeof result.error === 'string');
  }

  console.log(`\nTOTAL ${passed}/${passed + failed}`);
  if (failed > 0) process.exit(1);
}

main();
