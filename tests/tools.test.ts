import { describe, expect, it } from 'vitest';
import { carOnLine, numberedLine, searchCars } from '../server/bl/agent/carSearch.ts';
import { AGENT_TOOLS_DEFINITIONS, executeTool, toolStatus } from '../server/bl/agent/tools.ts';
import type { AgentContext } from '../server/bl/agent/types.ts';
import type { EmployeeProfile } from '../server/bl/engine/types.ts';

function ctx(profile: Partial<EmployeeProfile>, userTexts: string[] = []): AgentContext {
  return {
    profile: profile as EmployeeProfile,
    lastComparison: null,
    repParticipationMode: false,
    userTexts,
    onProfileUpdate: () => {},
    onComparisonRun: () => {},
    onEscalate: async () => 'TICK',
  };
}

describe('find_car', () => {
  it('a list position like "1" does not match car IDs by substring', async () => {
    const { result } = await executeTool('find_car', { query: '1' }, ctx({}));
    expect(result.found).toBe(false);
  });

  it('an exact ID returns only that car', async () => {
    const { result } = await executeTool('find_car', { query: 'CAR-06' }, ctx({}));
    expect(result.cars.map((c: { id: string }) => c.id)).toEqual(['CAR-06']);
  });

  it('a model name still matches', async () => {
    const { result } = await executeTool('find_car', { query: 'mg4' }, ctx({}));
    expect(result.cars.map((c: { id: string }) => c.id)).toEqual(['CAR-06']);
  });
});

describe('asking for missing fields', () => {
  it('get_missing_fields asks at most 2 fields at once', async () => {
    const { result } = await executeTool('get_missing_fields', { scenarioType: 'go_electric' }, ctx({}));
    expect(result.askNow.map((m: { field: string }) => m.field)).toEqual(['group', 'base']);
    expect(result.instruction).toContain('אל תפנה לנציג');
  });

  it('update_profile reports what is still missing', async () => {
    const c = ctx({ group: 'ב', base: 14200, hasCar: true, currentCarName: 'KONA EV' }, ['0']);
    const { result } = await executeTool('update_profile', { commissions: 0, childrenUpTo23: 0 }, c);
    expect(result.stillMissing.askNow.map((m: { field: string }) => m.field)).toEqual(['bonus', 'pensionPct']);
  });

  it('update_profile on a complete profile has nothing still missing', async () => {
    const full: Partial<EmployeeProfile> = {
      group: 'ב', base: 14200, hasCar: true, currentCarName: 'KONA EV', currentParticipation: 250,
      currentBenefit: 2960, childrenUpTo23: 0, commissions: 0, bonus: 0, pensionPct: 6, studyFundPct: 2.5,
    };
    const { result } = await executeTool('update_profile', { creditPoints: 2.25 }, ctx(full, ['2.25 נקודות']));
    expect(result.stillMissing).toEqual({});
    expect(result.nextStep_he).toContain('run_comparison');
  });

  it('update_profile with fields still missing does not push to run_comparison', async () => {
    const c = ctx({ group: 'ב', base: 14200, hasCar: true, currentCarName: 'KONA EV' }, ['0']);
    const { result } = await executeTool('update_profile', { commissions: 0, childrenUpTo23: 0 }, c);
    expect(result.nextStep_he).toBeUndefined();
  });

  it('run_comparison on missing fields tells the bot to ask the employee, not a rep', async () => {
    const { result } = await executeTool('run_comparison', { scenarioType: 'go_electric', targetCarId: 'CAR-06' }, ctx({ group: 'ב', base: 14200 }));
    expect(result.status).toBe('missing_fields');
    expect(result.askNow.length).toBeGreaterThan(0);
    expect(result.instruction).toContain('אל תפנה לנציג');
  });
});

describe('searchCars (fuzzy Hebrew/English)', () => {
  const ids = (cars: { id: string }[]) => cars.map((c) => c.id);

  it('finds a car by its Hebrew name', () => {
    expect(ids(searchCars('אטו').matches)).toEqual(['CAR-10']);
    expect(ids(searchCars('קונה').matches)).toEqual(['CAR-08']);
  });

  it('an exact name wins over a contained one (COROLLA CROSS, not COROLLA)', () => {
    expect(ids(searchCars('קורולה קרוס').matches)).toEqual(['CAR-09']);
    expect(ids(searchCars('COROLLA CROSS').matches)).toEqual(['CAR-09']);
  });

  it('a make returns all its cars so the bot asks which one', () => {
    expect(ids(searchCars('קיה').matches).sort()).toEqual(['CAR-01', 'CAR-05', 'CAR-11', 'CAR-16', 'CAR-19']);
  });

  it('a name not in the catalog returns suggestions the employee may choose, never a guess', () => {
    const r = searchCars('אאודי', 'ב');
    expect(r.matches).toEqual([]);
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(r.suggestions.length).toBeLessThanOrEqual(5);
    // Own group or lower, never family cars
    expect(r.suggestions.every((c) => c.group === 'א' || c.group === 'ב')).toBe(true);
  });
});

describe('choosing from a numbered list', () => {
  const botList = 'אלו האפשרויות:\n1. **MG4** (חשמלי) - מזהה כ-CAR-06\n2. **KONA EV** (חשמלי) - מזהה כ-CAR-08';

  it('reads line N and the car on it', () => {
    expect(numberedLine(botList, 2)).toContain('KONA EV');
    expect(carOnLine(numberedLine(botList, 1)!)?.id).toBe('CAR-06');
    expect(numberedLine(botList, 3)).toBeUndefined();
  });

  it('find_car "1" picks line 1 of the previous bot message (MG4, not EV3)', async () => {
    const c = { ...ctx({ group: 'ב' }), lastBotText: botList };
    const { result } = await executeTool('find_car', { query: '1' }, c);
    expect(result.cars.map((x: { id: string }) => x.id)).toEqual(['CAR-06']);
  });
});

describe('no new question while the previous one is unanswered', () => {
  it('asks only the unanswered field again, without adding the next one', async () => {
    // The bot asked group + base; the employee answered only base
    const c = { ...ctx({}, ['14200']), pendingFields: ['group', 'base'] };
    const { result } = await executeTool('update_profile', { base: 14200 }, c);
    expect(result.stillMissing.askNow.map((m: { field: string }) => m.field)).toEqual(['group']);
    expect(c.askedFields).toEqual(['group']);
  });

  it('moves on to the next 2 fields once the pending ones are answered', async () => {
    const c = { ...ctx({ group: 'ב' }, ['14200']), pendingFields: ['group', 'base'] };
    const { result } = await executeTool('update_profile', { base: 14200 }, c);
    expect(result.stillMissing.askNow.map((m: { field: string }) => m.field)).toEqual(['hasCar', 'childrenUpTo23']);
  });
});

describe('the benefit value (שווי שימוש) is never asked from the employee', () => {
  const base: Partial<EmployeeProfile> = {
    group: 'ב', base: 14200, hasCar: true, currentParticipation: 250, childrenUpTo23: 0,
    commissions: 0, bonus: 0, pensionPct: 6, studyFundPct: 2.5, creditPoints: 2.25,
  };

  it('a current car named in Hebrew gets its benefit from the catalog', async () => {
    const c = ctx(base);
    const { result } = await executeTool('update_profile', { currentCarName: 'קונה' }, c);
    expect(c.profile.currentCarId).toBe('CAR-08');
    expect(c.profile.currentBenefit).toBeCloseTo(2960, 2);
    expect(result.stillMissing).toEqual({});
  });

  it('a car not in the catalog sends the benefit to a rep, not to the employee', async () => {
    const c = ctx(base);
    const { result } = await executeTool('update_profile', { currentCarName: 'פיג׳ו 3008' }, c);
    expect(result.stillMissing.askNow).toEqual([]);
    expect(result.stillMissing.forRep.map((m: { field: string }) => m.field)).toEqual(['currentBenefit']);
    expect(result.stillMissing.instruction).toContain('escalate_to_rep');
    expect(c.askedFields).toEqual([]);
  });

  it('employee fields are asked first; the benefit never appears in askNow', async () => {
    const c = ctx({ group: 'ב', base: 14200, hasCar: true, currentCarName: 'פיג׳ו 3008' });
    const { result } = await executeTool('get_missing_fields', { scenarioType: 'go_electric' }, c);
    expect(result.askNow.map((m: { field: string }) => m.field)).not.toContain('currentBenefit');
  });

  it('a name that fits several cars is not saved; the bot asks which one', async () => {
    const c = ctx(base);
    const { result } = await executeTool('update_profile', { currentCarName: 'קיה' }, c);
    expect(c.profile.currentCarName).toBeUndefined();
    expect(result.currentCarChoices.length).toBeGreaterThan(1);
  });
});

describe('tool status shown to the employee', () => {
  it('every tool has its own Hebrew status line', () => {
    for (const t of AGENT_TOOLS_DEFINITIONS) expect(toolStatus(t.name)).not.toBe(toolStatus('no_such_tool'));
  });
});
