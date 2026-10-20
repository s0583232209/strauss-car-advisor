import { describe, expect, it } from 'vitest';
import rulesData from '../server/data/strauss-rules.json';
import { getRules } from '../server/bl/engine/rules.ts';
import { referenceMeta } from '../server/bl/services/sessionService.ts';

describe('reference data for the client (GET /api/meta)', () => {
  it('sends the rules the engine uses, so the card shows their amounts (EV refund, tax year, NI)', () => {
    const meta = referenceMeta();
    expect(meta.rules).toEqual(getRules());
    expect(meta.rules.electric.netBonus).toBeCloseTo(rulesData.electric.netBonus, 2);
    expect(meta.rules.netMethod.taxYear).toBe(rulesData.netMethod.taxYear);
    expect(meta.rules.netMethod.nationalInsurance.threshold).toBeCloseTo(rulesData.netMethod.nationalInsurance.threshold, 2);
    expect(meta.sampleEmployees.length).toBeGreaterThan(0);
  });
});
