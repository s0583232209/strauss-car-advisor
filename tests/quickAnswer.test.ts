import { describe, expect, it } from 'vitest';
import { parseQuickAnswer } from '../server/bl/agent/quickAnswer.ts';

describe('parseQuickAnswer: simple answers are read in code', () => {
  it('named values in several parts', () => {
    expect(parseQuickAnswer('פנסיה 6 אחוז, קרן השתלמות 2.5 אחוז, 2.25 נקודות זיכוי', ['pensionPct', 'studyFundPct'])).toEqual({
      pensionPct: 6,
      studyFundPct: 2.5,
      creditPoints: 2.25,
    });
  });

  it('"אין X ואין Y" saves 0 for both', () => {
    expect(parseQuickAnswer('אין עמלות ואין בונוס', ['commissions', 'bonus'])).toEqual({ commissions: 0, bonus: 0 });
  });

  it('group letter and base salary', () => {
    expect(parseQuickAnswer('קבוצה ב, שכר בסיס 14200', ['group', 'base'])).toEqual({ group: 'ב', base: 14200 });
  });

  it('unnamed letter and unnamed number go to the only field of their kind', () => {
    expect(parseQuickAnswer("ב', 18,500", ['group', 'base'])).toEqual({ group: 'ב', base: 18500 });
  });

  it('a bare number answers the single question asked', () => {
    expect(parseQuickAnswer('18 אלף', ['base'])).toEqual({ base: 18000 });
    expect(parseQuickAnswer('6%', ['pensionPct'])).toEqual({ pensionPct: 6 });
  });

  it('yes/no goes to hasCar, with a named number beside it', () => {
    expect(parseQuickAnswer('כן, 2 ילדים', ['hasCar', 'childrenUpTo23'])).toEqual({ hasCar: true, childrenUpTo23: 2 });
    expect(parseQuickAnswer('אין לי רכב', ['hasCar', 'childrenUpTo23'])).toEqual({ hasCar: false });
  });

  it('"אין" alone answers a single "0 if none" question', () => {
    expect(parseQuickAnswer('אין', ['commissions'])).toEqual({ commissions: 0 });
  });

  it('"השתתפות ברכב" is participation, not hasCar', () => {
    expect(parseQuickAnswer('השתתפות ברכב 250', ['currentParticipation'])).toEqual({ currentParticipation: 250 });
  });
});

describe('parseQuickAnswer: anything unclear goes to the model (null)', () => {
  it('unknown words (car name, scenario, question)', () => {
    expect(parseQuickAnswer('יש לי רכב חברה, קונה חשמלית, 2 ילדים', ['hasCar', 'childrenUpTo23'])).toBeNull();
    expect(parseQuickAnswer('אני רוצה לעבור לרכב חשמלי', [])).toBeNull();
    expect(parseQuickAnswer('כמה זה יעלה לי?', ['base'])).toBeNull();
  });

  it('a bare number when two numeric questions are open', () => {
    expect(parseQuickAnswer('6', ['pensionPct', 'studyFundPct'])).toBeNull();
    expect(parseQuickAnswer('6 ו-2.5', ['pensionPct', 'studyFundPct'])).toBeNull();
  });

  it('"אין" alone when two "0 if none" questions are open', () => {
    expect(parseQuickAnswer('אין', ['commissions', 'bonus'])).toBeNull();
  });

  it('a value the normalizer rejects or asks about', () => {
    expect(parseQuickAnswer('פנסיה 60', ['pensionPct'])).toBeNull();
    expect(parseQuickAnswer('קרן השתלמות 0.5', ['studyFundPct'])).toBeNull();
  });

  it('a percent on a money field, or "אין" on a field without a 0 default', () => {
    expect(parseQuickAnswer('בונוס 10%', ['bonus'])).toBeNull();
    expect(parseQuickAnswer('אין', ['base'])).toBeNull();
  });

  it('the same field twice, or two fields in one part', () => {
    expect(parseQuickAnswer('בונוס 500, בונוס 600', ['bonus'])).toBeNull();
    expect(parseQuickAnswer('עמלות בונוס 500', ['bonus', 'commissions'])).toBeNull();
  });

  it('number words and a numbered list choice are left to the model', () => {
    expect(parseQuickAnswer('שש אחוז', ['pensionPct'])).toBeNull();
    expect(parseQuickAnswer('יש לי', ['hasCar', 'childrenUpTo23'])).toBeNull();
  });
});
