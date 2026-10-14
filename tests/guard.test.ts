import { describe, expect, it } from 'vitest';
import { verifyNumbersInResponse } from '../src/agent/guard.ts';

const tool = '{"todayNet":11032.4,"altNet":11692.82,"diff":660.42,"evGrossUp":440}';

describe('verifyNumbersInResponse', () => {
  it('passes a correct reply', () => {
    const r = verifyNumbersInResponse('היום הנטו 11,032 ₪, עם ה-ATTO 3 יהיה 11,693 ₪.', {
      toolOutputs: [tool],
      userTexts: ['אם אעבור ל-ATTO 3 כמה זה ישנה?'],
    });
    expect(r).toEqual({ passed: true, inventedNumbers: [] });
  });

  it('rejects an invented 20,000', () => {
    const r = verifyNumbersInResponse('הנטו שלך יהיה 20,000 ₪', { toolOutputs: [tool], userTexts: [] });
    expect(r.passed).toBe(false);
    expect(r.inventedNumbers).toEqual([20000]);
  });

  it('accepts 11,693 ₪ when the tool returned 11692.82', () => {
    const r = verifyNumbersInResponse('עם הרכב החדש: 11,693 ₪', { toolOutputs: ['{"altNet":11692.82}'], userTexts: [] });
    expect(r.passed).toBe(true);
  });

  it('ignores dates, years and list numbers', () => {
    const r = verifyNumbersInResponse('בתוקף מ-1/1\n1. נוהל 2026\n2. עדכון 31/12/2025', { toolOutputs: [], userTexts: [] });
    expect(r.passed).toBe(true);
  });

  it('accepts confirming a value the employee wrote', () => {
    const r = verifyNumbersInResponse('הבנתי: פנסיה 6%', {
      toolOutputs: [],
      userTexts: ['6 לפנסיה'],
      profile: { pensionPct: 6 },
    });
    expect(r.passed).toBe(true);
  });

  it('accepts current profile values even without a tool call this turn', () => {
    const r = verifyNumbersInResponse('שכר בסיס 18,500 ₪, 3 ילדים, קרן השתלמות 2.5%', {
      toolOutputs: [],
      userTexts: [],
      profile: { base: 18500, childrenUpTo23: 3, studyFundPct: 2.5 },
    });
    expect(r.passed).toBe(true);
  });

  it('rejects 661 ₪ when no tool returned 661', () => {
    const r = verifyNumbersInResponse('הנטו שלך יעלה ב-661 ₪', { toolOutputs: ['{"altNet":11692.82}'], userTexts: [] });
    expect(r.passed).toBe(false);
    expect(r.inventedNumbers).toEqual([661]);
  });

  it('checks small numbers only with ₪ or %', () => {
    expect(verifyNumbersInResponse('יש 3 אפשרויות', { toolOutputs: [], userTexts: [] }).passed).toBe(true);
    expect(verifyNumbersInResponse('תקבל 7%', { toolOutputs: [], userTexts: [] }).passed).toBe(false);
  });

  it('reads a thousands comma as one number', () => {
    // 12,345 must not pass because 12 and 345 appeared separately
    expect(verifyNumbersInResponse('ההפרש הוא 12,345 ₪', ['12 345']).passed).toBe(false);
  });
});
