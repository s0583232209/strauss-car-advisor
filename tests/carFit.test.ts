/**
 * "Beyond the money" agent: only non-financial profile fields and the base salary rounded down to
 * thousands reach the model, tools never return money values, and invented numbers are re-asked.
 */

import { describe, expect, it, vi } from 'vitest';
import type { EmployeeProfile } from '../shared/types.ts';
import { carFitBody } from '../server/api/validate.ts';
import {
  CAR_FIT_FALLBACK_HE,
  carFitProfile,
  carFitSystemPrompt,
  roundDownToThousands,
  runCarFitTurn,
  type CarFitContext,
} from '../server/bl/agent/carFit.ts';
import { configureLlm, type LlmRequest } from '../server/bl/agent/llm.ts';
import { getCatalog } from '../server/bl/engine/referenceData.ts';
import { createCarFitService } from '../server/bl/services/carFitService.ts';

const profile: EmployeeProfile = {
  name: 'ישראל ישראלי',
  occupation: 'מנהל אזור',
  group: 'ב',
  base: 18750,
  commissions: 2350,
  bonus: 1170,
  pensionPct: 6,
  studyFundPct: 2.5,
  creditPoints: 2.75,
  childrenUpTo23: 3,
  hasCar: true,
  currentCarId: 'CAR-02',
  currentCarName: 'YARIS CROSS HSD',
  currentParticipation: 210,
  currentBenefit: 3350,
  currentMaintenance: 0,
};

const ctx = (over: Partial<CarFitContext> = {}): CarFitContext => ({
  profile,
  todayCarId: 'CAR-02',
  altCarId: 'CAR-03',
  highlights: { 'CAR-03': { pros: ['נסיעה שקטה'], cons: ['טעינה ארוכה'] } },
  ...over,
});

/** Every money value of the profile and of the compared cars, as written in JSON */
const moneyValues = () => {
  const cars = getCatalog().filter((c) => ['CAR-02', 'CAR-03'].includes(c.id));
  return [
    profile.base,
    profile.commissions,
    profile.bonus,
    profile.currentParticipation,
    profile.currentBenefit,
    ...cars.flatMap((c) => [c.listPrice, c.benefit, c.companyCost, c.participation]),
  ].map(String);
};

describe('roundDownToThousands', () => {
  it('rounds down, never up', () => {
    expect(roundDownToThousands(18750)).toBeCloseTo(18000, 2);
    expect(roundDownToThousands(18999.99)).toBeCloseTo(18000, 2);
    expect(roundDownToThousands(9000)).toBeCloseTo(9000, 2);
    expect(roundDownToThousands(999)).toBeCloseTo(0, 2);
  });
});

describe('carFitProfile', () => {
  it('keeps only non-financial fields and the rounded base salary', () => {
    expect(carFitProfile(profile)).toEqual({
      occupation: 'מנהל אזור',
      group: 'ב',
      childrenUpTo23: 3,
      hasCar: true,
      currentCar: 'YARIS CROSS HSD',
      baseSalaryRoundedDown: 18000,
    });
  });

  it('an empty profile gives nothing', () => {
    expect(carFitProfile({})).toEqual({});
  });
});

describe('carFitSystemPrompt', () => {
  it('has no name, no exact pay values and no car prices', () => {
    const prompt = carFitSystemPrompt(ctx());
    expect(prompt).toContain('18000');
    expect(prompt).toContain('BYD DOLPHIN');
    expect(prompt).not.toContain('ישראל ישראלי');
    for (const v of moneyValues()) expect(prompt).not.toContain(v);
  });

  it('lists exactly the cars the employee may choose (group ב: groups א and ב, no family cars)', () => {
    const prompt = carFitSystemPrompt(ctx());
    const list = prompt.split('הרכבים שהעובד רשאי לבחור')[1].split('כללים:')[0];
    for (const car of getCatalog()) {
      const line = `${car.make} ${car.model} (`;
      if (car.group === 'א' || car.group === 'ב') expect(list).toContain(line);
      else expect(list).not.toContain(line);
    }
  });
});

describe('runCarFitTurn', () => {
  it('runs a tool and sends back car identities without money values', async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce({ text: '', functionCalls: [{ name: 'list_my_cars', args: {} }] })
      .mockResolvedValueOnce({ text: 'לשלושה ילדים כדאי רכב מרווח עם תא מטען גדול.' });
    configureLlm({ transport });

    const reply = await runCarFitTurn('מה מתאים למשפחה עם שלושה ילדים?', [], ctx());
    expect(reply).toBe('לשלושה ילדים כדאי רכב מרווח עם תא מטען גדול.');

    const second: LlmRequest = transport.mock.calls[1][0];
    const toolTurn = second.messages.find((m) => m.role === 'tool_responses');
    const sent = JSON.stringify(toolTurn);
    expect(sent).toContain('BYD DOLPHIN');
    expect(sent).toContain('נסיעה שקטה');
    for (const v of moneyValues()) expect(sent).not.toContain(v);
    // Group ב may choose group א cars, never family-track cars
    expect(sent).not.toContain('"group":"משפחתי"');
  });

  it('a reply with an amount of money is asked again', async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce({ text: 'הדולפין עולה 150,990 ₪ ונוסע 427 ק"מ.' })
      .mockResolvedValueOnce({ text: 'הדולפין שקט ונוח בעיר.' });
    configureLlm({ transport });

    const reply = await runCarFitTurn('ספר לי על הדולפין', [], ctx());
    expect(reply).toBe('הדולפין שקט ונוח בעיר.');
    const retry: LlmRequest = transport.mock.calls[1][0];
    expect(JSON.stringify(retry.messages.at(-1))).toContain('אסור לכתוב סכומי כסף');
  });

  it('approximate manufacturer specs are answered as is', async () => {
    const text = 'לפי נתוני היצרן הטווח הוא בערך 400 עד 427 ק"מ (WLTP), כ-204 כוח סוס ותאוצה של כ-7 שניות. בפועל, עם מיזוג ובכביש מהיר, צפו לכ-330 עד 370 ק"מ.';
    configureLlm({ transport: vi.fn().mockResolvedValue({ text }) });
    expect(await runCarFitTurn('מה הטווח של הדולפין בקילומטרים?', [], ctx())).toBe(text);
  });

  it('the salary may not be quoted back, even rounded and without ₪', async () => {
    configureLlm({ transport: vi.fn().mockResolvedValue({ text: 'עם שכר של 18,000 ₪ מתאים לך רכב גדול.' }) });
    expect(await runCarFitTurn('איזה רכב מתאים לרמת השכר שלי?', [], ctx())).toBe(CAR_FIT_FALLBACK_HE);
    configureLlm({ transport: vi.fn().mockResolvedValue({ text: 'עם שכר של 18 אלף מתאים לכם רכב גדול.' }) });
    expect(await runCarFitTurn('לפי השכר שלי, מה מתאים?', [], ctx())).toBe(CAR_FIT_FALLBACK_HE);
  });

  it('earlier turns are sent as text, before the new question', async () => {
    const transport = vi.fn().mockResolvedValue({ text: 'אם יש עמדת טעינה בבית, חשמלי נוח מאוד.' });
    configureLlm({ transport });
    await runCarFitTurn('ואם יש לי עמדת טעינה?', [
      { role: 'user', content: 'אני נוסע הרבה בעבודה' },
      { role: 'assistant', content: 'יש לך אפשרות לטעון בבית?' },
    ], ctx());
    const req: LlmRequest = transport.mock.calls[0][0];
    expect(req.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  });
});

describe('carFitService', () => {
  it('takes the profile and the compared cars from the session', async () => {
    const transport = vi.fn().mockResolvedValue({ text: 'שני הרכבים נוחים בעיר.' });
    configureLlm({ transport });
    const sessions = {
      get: vi.fn().mockResolvedValue({
        id: 's1',
        profile,
        messages: [],
        lastComparison: { targetCar: getCatalog().find((c) => c.id === 'CAR-03') },
      }),
    };
    const service = createCarFitService(sessions as any);
    expect(await service.ask('s1', 'מה ההבדל בנוחות בין הרכבים?', [])).toBe('שני הרכבים נוחים בעיר.');
    const req: LlmRequest = transport.mock.calls[0][0];
    expect(req.systemInstruction).toContain('YARIS CROSS HSD');
    expect(req.systemInstruction).toContain('BYD DOLPHIN');
  });

  it('a model failure is a 503 with a Hebrew message', async () => {
    configureLlm({ transport: vi.fn().mockRejectedValue(Object.assign(new Error('bad'), { status: 400 })) });
    const sessions = { get: vi.fn().mockResolvedValue({ id: 's1', profile, messages: [], lastComparison: null }) };
    await expect(createCarFitService(sessions as any).ask('s1', 'שאלה שנכשלת', [])).rejects.toMatchObject({ status: 503 });
  }, 20000);
});

describe('carFitBody', () => {
  it('accepts text with user/assistant history', () => {
    expect(carFitBody({ text: ' שאלה ', history: [{ role: 'user', content: 'היי' }] })).toEqual({
      text: 'שאלה',
      history: [{ role: 'user', content: 'היי' }],
    });
  });

  it('refuses other roles, extra fields and long history', () => {
    expect(() => carFitBody({ text: 'x', history: [{ role: 'system', content: 'y' }] })).toThrow();
    expect(() => carFitBody({ text: 'x', profile: {} })).toThrow();
    expect(() => carFitBody({ text: 'x', history: Array(21).fill({ role: 'user', content: 'y' }) })).toThrow();
  });
});
