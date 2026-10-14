import { describe, expect, it } from 'vitest';
import { extractNumbers, parseCount, parseMoney, parsePercent } from '../src/agent/normalize.ts';
import { executeTool } from '../src/agent/tools.ts';
import type { AgentContext } from '../src/agent/types.ts';
import type { EmployeeProfile } from '../src/engine/types.ts';

const ok = (value: number) => ({ ok: true, value });

describe('parsePercent', () => {
  it('reads the forms employees write', () => {
    expect(parsePercent('אני מפריש לפנסיה 6 אחוז', 'pensionPct')).toEqual(ok(6));
    expect(parsePercent('6 לפנסיה', 'pensionPct')).toEqual(ok(6));
    expect(parsePercent('6', 'pensionPct')).toEqual(ok(6));
    expect(parsePercent('6%', 'pensionPct')).toEqual(ok(6));
    expect(parsePercent('6.5%', 'pensionPct')).toEqual(ok(6.5));
    expect(parsePercent('6.5', 'pensionPct')).toEqual(ok(6.5));
    expect(parsePercent('שש אחוז', 'pensionPct')).toEqual(ok(6));
    expect(parsePercent(6, 'pensionPct')).toEqual(ok(6));
  });

  it('reads a fraction as percent when x100 fits the field range', () => {
    expect(parsePercent('0.06', 'pensionPct')).toEqual(ok(6));
    expect(parsePercent(0.025, 'studyFundPct')).toEqual(ok(2.5));
  });

  it('asks when a fraction x100 is outside the range', () => {
    const r = parsePercent('0.5', 'studyFundPct'); // 50% study fund is impossible; 0.5% is unusual
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ ambiguous: true, suggested: 0.5 });
  });

  it('rejects out-of-range values so the bot asks again', () => {
    expect(parsePercent('50', 'pensionPct')).toMatchObject({ ok: false, reason: 'out_of_range' });
    expect(parsePercent('11', 'studyFundPct')).toMatchObject({ ok: false, reason: 'out_of_range' });
    expect(parsePercent('-6', 'pensionPct')).toMatchObject({ ok: false, reason: 'negative' });
    expect(parsePercent('הרבה', 'pensionPct')).toMatchObject({ ok: false, reason: 'unreadable' });
  });
});

describe('parseMoney', () => {
  it('reads shekel amounts', () => {
    expect(parseMoney('18,500')).toEqual(ok(18500));
    expect(parseMoney('18500')).toEqual(ok(18500));
    expect(parseMoney('18.5 אלף')).toEqual(ok(18500));
    expect(parseMoney('18 אלף וחצי')).toEqual(ok(18500));
    expect(parseMoney('18 אלף')).toEqual(ok(18000));
    expect(parseMoney('18K')).toEqual(ok(18000));
  });
});

describe('parseCount', () => {
  it('reads Hebrew number words up to 20 and halves', () => {
    expect(parseCount('שתיים וחצי', 'creditPoints')).toEqual(ok(2.5));
    expect(parseCount('שבע', 'childrenUpTo23')).toEqual(ok(7));
    expect(parseCount('שלושה ילדים', 'childrenUpTo23')).toEqual(ok(3));
    expect(parseCount('אחת עשרה', 'creditPoints')).toEqual(ok(11));
  });

  it('applies the ranges', () => {
    expect(parseCount('16', 'childrenUpTo23')).toMatchObject({ ok: false, reason: 'out_of_range' });
    expect(parseCount('2.5', 'childrenUpTo23')).toMatchObject({ ok: false, reason: 'out_of_range' });
    expect(parseCount('20', 'creditPoints')).toMatchObject({ ok: false, reason: 'out_of_range' });
  });
});

describe('extractNumbers', () => {
  it('finds Hebrew words up to 20', () => {
    expect(extractNumbers('שש עשרה').map((n) => n.value)).toEqual([16]);
    expect(extractNumbers('עשרים').map((n) => n.value)).toEqual([20]);
    expect(extractNumbers('ב-661 ₪').map((n) => n.value)).toEqual([661]);
  });
});

describe('update_profile normalizes before saving', () => {
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

  it('"0.06" for pension is saved as 6 and confirmed', async () => {
    const c = ctx(['0.06 לפנסיה']);
    const { result } = await executeTool('update_profile', { pensionPct: 0.06 }, c);
    expect(c.profile.pensionPct).toBe(6);
    expect(result.understood_he).toContain('6%');
  });

  it('"50" for pension is not saved and the bot asks again', async () => {
    const c = ctx(['50 לפנסיה']);
    const { result } = await executeTool('update_profile', { pensionPct: 50 }, c);
    expect(c.profile.pensionPct).toBeUndefined();
    expect(result.success).toBe(false);
    expect(result.needsConfirmation[0].field).toBe('pensionPct');
    expect(result.askAgain_he).toBeTruthy();
  });

  it('"18 אלף וחצי" is saved as 18500', async () => {
    const c = ctx(['אני מרוויח 18 אלף וחצי']);
    await executeTool('update_profile', { base: 18500 }, c);
    expect(c.profile.base).toBe(18500);
  });

  it('"שש אחוז" is accepted as stated 6', async () => {
    const c = ctx(['שש אחוז לפנסיה']);
    await executeTool('update_profile', { pensionPct: 6 }, c);
    expect(c.profile.pensionPct).toBe(6);
  });
});
