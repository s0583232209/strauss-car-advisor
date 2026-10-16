import { describe, expect, it } from 'vitest';
import employees from '../src/data/employees.json';
import { executeTool } from '../src/agent/tools.ts';
import type { AgentContext } from '../src/agent/types.ts';
import { buildScenario, findOccupation } from '../src/engine/scenario.ts';
import type { EmployeeProfile } from '../src/engine/types.ts';

const noa = (employees as EmployeeProfile[])[0];

describe('findOccupation', () => {
  it('finds the official name, the feminine form and common synonyms', () => {
    for (const q of ['נציג/ת מכירות שטח', 'נציג מכירות שטח', 'נציגת מכירות שטח', 'סוכן מכירות שטח', 'אני סוכנת שטח בשטראוס']) {
      expect(findOccupation(q)?.occupation, q).toBe('נציג/ת מכירות שטח');
    }
    expect(findOccupation('מנהלת מוצר')?.occupation).toBe('מנהל/ת מוצר');
    expect(findOccupation('טכנאית')?.occupation).toBe('טכנאי/ת שירות');
  });

  it('a partial or unknown name matches nothing (never a guess)', () => {
    for (const q of ['מנהל', 'מכירות', 'אסטרונאוט', '', undefined]) {
      expect(findOccupation(q), String(q)).toBeUndefined();
    }
  });
});

describe('waive_car eligibility (SPEC 4.3)', () => {
  it('a field sales rep may not waive the car, by any phrasing', () => {
    for (const occupation of ['נציג/ת מכירות שטח', 'סוכן מכירות שטח']) {
      const r = buildScenario({ ...noa, occupation }, { type: 'waive_car' });
      expect(r.eligible, occupation).toBe(false);
      expect(r.altState.maintenance).toBeCloseTo(0, 2);
    }
  });

  it('an unknown occupation is not eligible and gets no guessed maintenance', () => {
    const r = buildScenario({ ...noa, occupation: 'אסטרונאוט/ית' }, { type: 'waive_car' });
    expect(r.eligible).toBe(false);
    expect(r.eligibilityReason_he).toContain('לא זוהה');
    expect(r.altState.maintenance).toBeCloseTo(0, 2);
  });

  it('a listed occupation that may waive still gets its maintenance', () => {
    const r = buildScenario({ ...noa, occupation: 'מנהל/ת מוצר' }, { type: 'waive_car' });
    expect(r.eligible).toBe(true);
    expect(r.altState.maintenance).toBeCloseTo(2000, 2);
  });
});

describe('update_profile occupation', () => {
  const ctx = (): AgentContext => ({
    profile: {} as EmployeeProfile,
    lastComparison: null,
    repParticipationMode: false,
    onProfileUpdate: () => {},
    onComparisonRun: () => {},
    onEscalate: async () => 'TICK',
  });

  it('saves the official name of a recognized occupation', async () => {
    const c = ctx();
    await executeTool('update_profile', { occupation: 'סוכן מכירות שטח' }, c);
    expect(c.profile.occupation).toBe('נציג/ת מכירות שטח');
  });

  it('does not save an unknown occupation and offers choices', async () => {
    const c = ctx();
    const { result } = await executeTool('update_profile', { occupation: 'מנהל' }, c);
    expect(c.profile.occupation).toBeUndefined();
    expect(result.occupationChoices).toHaveLength(6);
    expect(result.occupationInstruction).toContain('escalate_to_rep');
  });

  it('waive_car keeps asking while the occupation is not on the list', async () => {
    const c = ctx();
    c.profile = { ...noa, occupation: 'אסטרונאוט/ית' };
    const { result } = await executeTool('run_comparison', { scenarioType: 'waive_car' }, c);
    expect(result.status).toBe('missing_fields');
    expect(result.missing.map((m: { field: string }) => m.field)).toContain('occupation');
  });
});
