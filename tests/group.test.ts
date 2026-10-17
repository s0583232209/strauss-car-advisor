import { describe, expect, it } from 'vitest';
import { groupStated, normalizeGroup } from '../server/bl/agent/normalize.ts';
import { executeTool } from '../server/bl/agent/tools.ts';
import type { AgentContext } from '../server/bl/agent/types.ts';
import type { EmployeeProfile } from '../shared/types.ts';

function ctx(userTexts: string[]): AgentContext {
  return {
    profile: {} as EmployeeProfile,
    lastComparison: null,
    repParticipationMode: false,
    userTexts,
    onProfileUpdate: () => {},
    onComparisonRun: () => {},
    onEscalate: async () => 'TICK',
  };
}

describe('normalizeGroup', () => {
  it('reads a letter in the forms the model passes on', () => {
    expect(normalizeGroup('ב')).toBe('ב');
    expect(normalizeGroup("ב'")).toBe('ב');
    expect(normalizeGroup('ג׳')).toBe('ג');
    expect(normalizeGroup('קבוצה ד')).toBe('ד');
    expect(normalizeGroup('משפחתי')).toBe('משפחתי');
  });

  it('never guesses a letter from something else', () => {
    expect(normalizeGroup('B')).toBeUndefined();
    expect(normalizeGroup('שנייה')).toBeUndefined();
    expect(normalizeGroup('ה')).toBeUndefined();
    expect(normalizeGroup(2)).toBeUndefined();
  });
});

describe('groupStated', () => {
  it('finds the letter as a word of its own', () => {
    expect(groupStated(['קבוצה ב, שכר בסיס 14200'], 'ב')).toBe(true);
    expect(groupStated(['אני בקבוצה ג, השכר שלי 18,500 ₪'], 'ג')).toBe(true);
    expect(groupStated(["אני ב'"], 'ב')).toBe(true);
    expect(groupStated(['ד'], 'ד')).toBe(true);
  });

  it('a Hebrew prefix or "ב-15 אלף" is not a group', () => {
    expect(groupStated(['אני בקבוצה הכי גבוהה'], 'ב')).toBe(false);
    expect(groupStated(['השכר שלי ב-15 אלף'], 'ב')).toBe(false);
    expect(groupStated(['אני רוצה לעבור לרכב חשמלי'], 'א')).toBe(false);
  });

  it('a garbled message states no group', () => {
    expect(groupStated(['����, ��� 14200'], 'א')).toBe(false);
  });

  it('the family group by name', () => {
    expect(groupStated(['אני במסלול משפחתי'], 'משפחתי')).toBe(true);
  });
});

describe('update_profile saves only a group the employee wrote', () => {
  it('a group the employee did not write is not saved, and the bot is told to ask', async () => {
    const c = ctx(['����, ��� ���� 14200']);
    const { result } = await executeTool('update_profile', { group: 'א', base: 14200 }, c);
    expect(c.profile.group).toBeUndefined();
    expect(c.profile.base).toBe(14200);
    expect(result.success).toBe(false);
    expect(result.notSaved.map((n: { field: string }) => n.field)).toContain('group');
  });

  it('a written group is saved in its plain form', async () => {
    const c = ctx(["אני בקבוצה ב'"]);
    await executeTool('update_profile', { group: "ב'" }, c);
    expect(c.profile.group).toBe('ב');
  });

  it('an unknown group value is never saved', async () => {
    const c = ctx(['group B']);
    const { result } = await executeTool('update_profile', { group: 'B' }, c);
    expect(c.profile.group).toBeUndefined();
    expect(result.notSaved.map((n: { field: string }) => n.field)).toContain('group');
  });
});
