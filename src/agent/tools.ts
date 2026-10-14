/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import catalogData from '../data/catalog.json';
import occupationsData from '../data/occupations.json';
import { canSelectCarGroup } from '../engine/rules.ts';
import { buildScenario, findCarByIdOrName, findOccupation } from '../engine/scenario.ts';
import { Car, ComparisonResult, EmployeeProfile, Occupation, ScenarioType } from '../engine/types.ts';
import { describeValue, extractNumbers, normalizeField, NumericField } from './normalize.ts';
import { AgentContext, MissingFieldInfo, ToolDefinition } from './types.ts';

const carsCatalog = catalogData as Car[];
const occupationsList = occupationsData as Occupation[];

// "Missing" means not provided: 0 is a valid value (e.g. no commissions, no study fund)
const isUnset = (v: unknown) => v === undefined || v === null || (typeof v === 'number' && !Number.isFinite(v));
const isBlank = (v: unknown) => isUnset(v) || String(v).trim() === '';

/** Numbers the employee actually wrote: digits (18,500 / 2.25 / 6%), "18 אלף וחצי", Hebrew words up to 20. */
export function statedNumbers(texts: string[]): Set<number> {
  const found = new Set<number>();
  for (const text of texts) for (const n of extractNumbers(text)) found.add(n.value);
  return found;
}

const NUMERIC_PROFILE_FIELDS = [
  'base',
  'commissions',
  'bonus',
  'pensionPct',
  'studyFundPct',
  'creditPoints',
  'childrenUpTo23',
  'currentParticipation',
  'currentBenefit',
  'currentMaintenance',
] as const;

const GROUP_MISSING: MissingFieldInfo = {
  field: 'group',
  label_he: 'קבוצת זכאות (א–ד)',
  whyNeeded_he: 'לקביעת תקציב הרכב והרכבים המותרים',
};

/** Required fields per SPEC section 7. Pure; also used by the UI before calling the engine. */
export function getMissingFields(
  prof: Partial<EmployeeProfile>,
  scenarioType: ScenarioType | 'general' = 'general'
): MissingFieldInfo[] {
  // Order = the order the agent asks: group, base, car today, children, then the rest
  const missing: MissingFieldInfo[] = [];

  if (isBlank(prof.group)) missing.push(GROUP_MISSING);
  if (isUnset(prof.base)) {
    missing.push({ field: 'base', label_he: 'שכר בסיס חודשי', whyNeeded_he: 'לקביעת מדרגות המס וחישוב שכר הנטו' });
  }
  if (prof.hasCar === undefined || prof.hasCar === null) {
    missing.push({ field: 'hasCar', label_he: 'האם יש כיום רכב חברה או ויתור (אחזקה)', whyNeeded_he: 'לקביעת מצב היום שאליו משווים' });
  }
  // Always asked (product decision 2026-10-13, SPEC 7), not only for the family track
  if (isUnset(prof.childrenUpTo23)) {
    missing.push({ field: 'childrenUpTo23', label_he: 'מספר ילדים עד גיל 23 (0 אם אין)', whyNeeded_he: 'לבדיקת זכאות למסלול ברוכת ילדים' });
  }
  // Occupation only matters for a waiver (may waive? maintenance amount); group is asked directly
  if (scenarioType === 'waive_car' && isBlank(prof.occupation)) {
    missing.push({ field: 'occupation', label_he: 'עיסוק / תפקיד', whyNeeded_he: 'לבדיקה אם מותר לוותר על הרכב ומהו סכום האחזקה' });
  }
  if (isUnset(prof.commissions)) {
    missing.push({ field: 'commissions', label_he: 'עמלות חודשיות (0 אם אין)', whyNeeded_he: 'חלק מההכנסה החייבת במס' });
  }
  if (isUnset(prof.bonus)) {
    missing.push({ field: 'bonus', label_he: 'בונוס חודשי (0 אם אין)', whyNeeded_he: 'חלק מההכנסה החייבת במס' });
  }
  if (isUnset(prof.pensionPct)) {
    missing.push({ field: 'pensionPct', label_he: 'אחוז הפרשת עובד לפנסיה', whyNeeded_he: 'משפיע על הנטו ועל זיכוי הפנסיה במס' });
  }
  if (isUnset(prof.studyFundPct)) {
    missing.push({ field: 'studyFundPct', label_he: 'אחוז הפרשה לקרן השתלמות (0 אם אין)', whyNeeded_he: 'ניכוי מהשכר שמשפיע על הנטו' });
  }
  if (isUnset(prof.creditPoints)) {
    missing.push({ field: 'creditPoints', label_he: 'נקודות זיכוי במס', whyNeeded_he: 'לחישוב המס לתשלום' });
  }

  if (prof.hasCar === true) {
    const carNameMissing = isBlank(prof.currentCarName) || prof.currentCarName === 'רכב חברה נוכחי';
    if (carNameMissing) {
      missing.push({ field: 'currentCarName', label_he: 'דגם רכב נוכחי', whyNeeded_he: 'לשליפת שווי השימוש הנוכחי לצורך השוואה מדויקת' });
    }
    if (isUnset(prof.currentParticipation)) {
      missing.push({ field: 'currentParticipation', label_he: 'השתתפות עובד ברכב הנוכחי (0 אם אין)', whyNeeded_he: 'מנוכה מהנטו במצב היום' });
    }
    if (!carNameMissing && isUnset(prof.currentBenefit)) {
      missing.push({ field: 'currentBenefit', label_he: 'שווי שימוש של הרכב הנוכחי', whyNeeded_he: 'הרכב לא נמצא בקטלוג; יש להעביר שאלה לנציג' });
    }
  } else if (prof.hasCar === false && isUnset(prof.currentMaintenance)) {
    missing.push({ field: 'currentMaintenance', label_he: 'דמי אחזקת רכב נוכחיים', whyNeeded_he: 'חלק מהשכר במצב היום (ויתור על רכב)' });
  }

  return missing;
}

export const AGENT_TOOLS_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'update_profile',
    description: 'Save ONLY values the employee stated explicitly in this conversation. Never assume, estimate or fill in typical values; if a value was not stated, ask the employee instead. Numbers that do not appear in the employee messages are rejected.',
    parameters: {
      type: 'OBJECT',
      properties: {
        base: { type: 'number', description: 'Monthly base salary (שכר בסיס חודשי)' },
        group: { type: 'string', description: 'Car eligibility group (קבוצת זכאות: א, ב, ג, ד)' },
        occupation: { type: 'string', description: 'Job title / occupation (עיסוק/תפקיד). Needed only for a car waiver; does not set the eligibility group' },
        commissions: { type: 'number', description: 'Monthly commissions / sales incentives (עמלות)' },
        bonus: { type: 'number', description: 'Monthly bonus component (בונוס)' },
        pensionPct: { type: 'number', description: 'Employee pension deduction % (אחוז הפרשת עובד לפנסיה)' },
        studyFundPct: { type: 'number', description: 'Employee study fund deduction % (אחוז הפרשה לקרן השתלמות)' },
        creditPoints: { type: 'number', description: 'Tax credit points (נקודות זיכוי במס)' },
        childrenUpTo23: { type: 'number', description: 'Number of children up to age 23 (מספר ילדים עד גיל 23)' },
        hasCar: { type: 'boolean', description: 'Whether the employee currently has a company car (האם יש כיום רכב חברה)' },
        currentCarName: { type: 'string', description: 'Name/model of current company car (דגם הרכב הנוכחי)' },
        currentParticipation: { type: 'number', description: 'Current employee participation in car (השתתפות עובד ברכב הנוכחי)' },
        currentBenefit: { type: 'number', description: 'Current vehicle benefit value for tax (שווי שימוש נוכחי)' },
        currentMaintenance: { type: 'number', description: 'Current car maintenance allowance if waived (דמי אחזקת רכב נוכחיים)' },
      },
    },
  },
  {
    name: 'get_missing_fields',
    description: 'Returns the required fields still missing from the profile, in the order to ask them. Call it before every run_comparison and ask the employee about the first missing field.',
    parameters: {
      type: 'OBJECT',
      properties: {
        scenarioType: {
          type: 'string',
          enum: ['change_car', 'go_electric', 'family_track', 'waive_car', 'general'],
          description: 'The requested scenario type',
        },
      },
      required: ['scenarioType'],
    },
  },
  {
    name: 'find_car',
    description: 'Search for a company car in the catalog by Hebrew or English name/keywords.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'string', description: 'Car model search query (e.g. "אטו", "קורולה", "טסלה", "קרניבל")' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_options',
    description: 'List eligible cars from catalog that the employee is entitled to choose (own group or lower).',
    parameters: {
      type: 'OBJECT',
      properties: {
        type: {
          type: 'string',
          enum: ['all', 'electric', 'hybrid', 'gasoline'],
          description: 'Filter category: electric, hybrid, gasoline, or all',
        },
      },
    },
  },
  {
    name: 'run_comparison',
    description: 'Execute the official calculation engine to compare today state with an alternative scenario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        scenarioType: {
          type: 'string',
          enum: ['change_car', 'go_electric', 'family_track', 'waive_car'],
          description: 'The type of change scenario',
        },
        targetCarId: { type: 'string', description: 'Catalog car ID (e.g. CAR-10) for car changes' },
        overrideParticipation: { type: 'number', description: 'Custom participation amount if confirmed by rep' },
      },
      required: ['scenarioType'],
    },
  },
  {
    name: 'escalate_to_rep',
    description: 'Opens a formal ticket to a human payroll representative when data is missing or exception requested.',
    parameters: {
      type: 'OBJECT',
      properties: {
        question: { type: 'string', description: 'The specific question for the human representative' },
        summary: { type: 'string', description: 'Brief summary of the employee situation and missing info' },
      },
      required: ['question', 'summary'],
    },
  },
];

/** Execute local tool by name */
export async function executeTool(
  name: string,
  args: any,
  context: AgentContext
): Promise<{ result: any; outputTextForGuardrail: string }> {
  switch (name) {
    case 'update_profile': {
      const rawArgs = args;
      // Normalize every number first ("6%", "שש אחוז", "0.06", "18 אלף וחצי"); see normalize.ts
      const normalized: Partial<Record<NumericField, number>> = {};
      const rejected: { field: string; value: unknown }[] = [];
      const needsConfirmation: { field: string; value: unknown; question_he: string }[] = [];
      for (const f of NUMERIC_PROFILE_FIELDS) {
        if (args[f] === undefined) continue;
        const r = normalizeField(f, args[f]);
        if (r.ok) normalized[f] = r.value;
        else if (!r.ambiguous && r.reason !== 'out_of_range') rejected.push({ field: f, value: args[f] });
        // Ambiguous or out of range: not saved, the bot asks the employee again
        else needsConfirmation.push({ field: f, value: args[f], question_he: r.question_he });
      }
      // Reject the whole call if any number is negative or not a number (no partial update)
      if (rejected.length > 0) {
        const res = {
          success: false,
          rejected,
          message: `ערכים לא חוקיים (שליליים או לא מספריים): ${rejected.map((r) => r.field).join(', ')}. הפרופיל לא עודכן; יש לבקש מהעובד ערך תקין.`,
        };
        return { result: res, outputTextForGuardrail: JSON.stringify(res) };
      }

      // Numbers must come from the employee, never from the model ("0" = none is always allowed).
      // Unstated values are dropped and reported, so the agent asks for them instead.
      const notSaved: { field: string; value: unknown }[] = [];
      args = { ...args };
      for (const f of NUMERIC_PROFILE_FIELDS) {
        if (args[f] === undefined) continue;
        if (normalized[f] === undefined) delete args[f];
        else args[f] = normalized[f];
      }
      if (context.userTexts) {
        const stated = statedNumbers(context.userTexts);
        for (const f of NUMERIC_PROFILE_FIELDS) {
          const value = normalized[f];
          if (value === undefined || value === 0 || stated.has(value)) continue;
          // The employee may have written the raw form the model passed on ("0.06" → 6%)
          const raw = typeof rawArgs[f] === 'number' ? rawArgs[f] : extractNumbers(String(rawArgs[f]))[0]?.value;
          if (raw !== undefined && stated.has(raw)) continue;
          notSaved.push({ field: f, value: rawArgs[f] });
          delete args[f];
        }
      }

      const updates: Partial<EmployeeProfile> = {};
      if (args.base !== undefined) updates.base = Number(args.base);
      if (args.group !== undefined) updates.group = args.group;
      if (args.commissions !== undefined) updates.commissions = Number(args.commissions);
      if (args.bonus !== undefined) updates.bonus = Number(args.bonus);
      if (args.pensionPct !== undefined) updates.pensionPct = Number(args.pensionPct);
      if (args.studyFundPct !== undefined) updates.studyFundPct = Number(args.studyFundPct);
      if (args.creditPoints !== undefined) updates.creditPoints = Number(args.creditPoints);
      if (args.childrenUpTo23 !== undefined) updates.childrenUpTo23 = Number(args.childrenUpTo23);
      if (args.hasCar !== undefined) updates.hasCar = Boolean(args.hasCar);
      if (args.currentCarName !== undefined) {
        updates.currentCarName = args.currentCarName;
        // Auto fill benefit if matches catalog
        const match = findCarByIdOrName(args.currentCarName);
        if (match) {
          updates.currentCarId = match.id;
          if (updates.currentBenefit === undefined && (isUnset(context.profile.currentBenefit) || context.profile.currentBenefit === 0)) {
            updates.currentBenefit = match.benefit;
          }
          if (updates.currentParticipation === undefined && context.profile.currentParticipation === 0) {
            updates.currentParticipation = match.participation;
          }
        }
      }
      if (args.currentParticipation !== undefined) updates.currentParticipation = Number(args.currentParticipation);
      if (args.currentBenefit !== undefined) updates.currentBenefit = Number(args.currentBenefit);
      if (args.currentMaintenance !== undefined) updates.currentMaintenance = Number(args.currentMaintenance);

      if (args.occupation !== undefined) {
        updates.occupation = args.occupation;
        const occ = findOccupation(args.occupation);
        if (occ) {
          if (!updates.hasCar && occ.canWaive && updates.currentMaintenance === undefined) {
            updates.currentMaintenance = occ.maintenance;
          }
        }
      }

      // Mutate the turn's profile in place so later tools in the same turn see the new values
      Object.assign(context.profile, updates);
      context.onProfileUpdate(updates);
      const understood = NUMERIC_PROFILE_FIELDS.filter((f) => typeof updates[f] === 'number').map((f) =>
        describeValue(f, updates[f] as number)
      );
      const res = {
        success: notSaved.length === 0 && needsConfirmation.length === 0,
        updated: updates,
        // The bot confirms this briefly so the employee can correct it
        ...(understood.length > 0 && { understood_he: `הבנתי: ${understood.join(', ')}` }),
        ...(notSaved.length > 0 && {
          notSaved,
          message: `לא נשמר: ${notSaved.map((n) => n.field).join(', ')}. העובד לא כתב את הערכים האלה. אל תניח ערכים: שאל את העובד ישירות ובקש מספר מדויק.`,
        }),
        ...(needsConfirmation.length > 0 && {
          needsConfirmation,
          askAgain_he: needsConfirmation.map((n) => n.question_he).join(' '),
        }),
      };
      return { result: res, outputTextForGuardrail: JSON.stringify(updates) };
    }

    case 'get_missing_fields': {
      const scType = (args.scenarioType || 'general') as ScenarioType;
      const missing = getMissingFields(context.profile, scType);
      const res = {
        scenarioType: scType,
        missing,
        isComplete: missing.length === 0,
        ...(missing.length > 0 && {
          next: missing[0],
          instruction: `שאל את העובד על: ${missing[0].label_he}. אל תניח ערך ואל תחשב לפני שכל השדות מולאו.`,
        }),
      };
      return { result: res, outputTextForGuardrail: JSON.stringify(res) };
    }

    case 'find_car': {
      const q = String(args.query || '').trim().toLowerCase();
      const matches = carsCatalog.filter((c) => {
        const text = `${c.make} ${c.model} ${c.id} ${c.fuel}`.toLowerCase();
        return text.includes(q) || q.includes(c.model.toLowerCase());
      });

      if (matches.length === 0) {
        return {
          result: { found: false, message: `לא נמצא רכב בקטלוג התואם ל-"${args.query}". אפשר לבקש רשימת רכבים זמינים.` },
          outputTextForGuardrail: '0',
        };
      }

      const res = {
        found: true,
        count: matches.length,
        cars: matches.map((c) => ({
          id: c.id,
          model: c.model,
          make: c.make,
          group: c.group,
          fuel: c.fuel,
          isElectric: c.driveCode === 3,
          benefit: c.benefit,
          companyCost: c.companyCost,
          participation: c.participation,
        })),
      };

      const outText = matches.map((m) => `${m.model} ${m.benefit} ${m.participation} ${m.companyCost}`).join(' ');
      return { result: res, outputTextForGuardrail: outText };
    }

    case 'list_options': {
      const empGroup = context.profile.group;
      if (isBlank(empGroup)) {
        const res = { error: 'missing_group', message: 'חסרה קבוצת זכאות', missing: [GROUP_MISSING] };
        return { result: res, outputTextForGuardrail: '' };
      }
      const filterType = args.type || 'all';

      const eligibleCars = carsCatalog.filter((c) => {
        // Never show family cars outside family track
        if (c.group === 'משפחתי') return false;
        // Group check
        if (!canSelectCarGroup(empGroup, c.group)) return false;
        // Fuel filter
        if (filterType === 'electric') return c.driveCode === 3;
        if (filterType === 'hybrid') return c.driveCode === 1;
        if (filterType === 'gasoline') return c.driveCode === 0;
        return true;
      });

      const res = {
        employeeGroup: empGroup,
        totalEligible: eligibleCars.length,
        options: eligibleCars.map((c) => ({
          id: c.id,
          model: c.model,
          group: c.group,
          fuel: c.fuel,
          benefit: c.benefit,
          participation: c.participation,
        })),
      };

      const outText = eligibleCars.map((c) => `${c.model} ${c.benefit} ${c.participation}`).join(' ');
      return { result: res, outputTextForGuardrail: outText };
    }

    case 'run_comparison': {
      const scType = args.scenarioType as ScenarioType;
      const targetCarId = args.targetCarId;
      const overridePart = args.overrideParticipation !== undefined ? Number(args.overrideParticipation) : undefined;

      // Never run the engine on an incomplete profile
      const missing = getMissingFields(context.profile, scType);
      if (missing.length > 0) {
        const res = {
          status: 'missing_fields',
          missing,
          message: `לא ניתן לחשב: חסרים נתונים (${missing.map((m) => m.label_he).join(', ')}). יש לשאול עליהם קודם.`,
        };
        return { result: res, outputTextForGuardrail: '' };
      }

      // Demo mode check: "השתתפות ברכב החדש לפי אימות נציג"
      if (context.repParticipationMode && scType !== 'waive_car' && overridePart === undefined) {
        const car = targetCarId ? carsCatalog.find((c) => c.id === targetCarId) : undefined;
        const carName = car?.model || 'רכב חדש';
        const ticketId = await context.onEscalate(
          `אימות השתתפות עצמית עבור עובד/ת: ${context.profile.name || 'עובד'} בבחירת ${carName}`,
          `נדרש אימות נציג לגבי גובה ההשתתפות החודשית בעת מעבר ל-${carName}.`
        );

        // Calculate baseline today state
        const baseline: ComparisonResult = {
          ...buildScenario(context.profile, { type: 'keep' }),
          requestedScenarioType: scType,
          requestedCarId: targetCarId,
        };
        context.onComparisonRun(baseline);

        const res = {
          status: 'pending_rep',
          ticketId,
          message: `חסר לי גובה ההשתתפות שלך ברכב החדש (${carName}). שלחתי שאלה לנציג שכר (פנייה ${ticketId}). בינתיים אני מציג את מצבך הנוכחי: שכר נטו ${Math.round(baseline.todayBreakdown.net).toLocaleString()} ₪.`,
          todayNet: Math.round(baseline.todayBreakdown.net),
          todayCar: baseline.todayCarLabel,
        };

        return {
          result: res,
          outputTextForGuardrail: `${Math.round(baseline.todayBreakdown.net)} ${ticketId}`,
        };
      }

      // Standard direct calculation
      const comparison = buildScenario(context.profile, {
        type: scType,
        targetCarId,
        overrideParticipation: overridePart,
      });

      context.onComparisonRun(comparison);

      const res = {
        status: 'calculated',
        eligible: comparison.eligible,
        eligibilityReason: comparison.eligibilityReason_he,
        todayNet: Math.round(comparison.todayBreakdown.net),
        altNet: Math.round(comparison.altBreakdown.net),
        diffNet: comparison.diffNet,
        diffDirection: comparison.diffNet >= 0 ? '+' : '−',
        todayTax: Math.round(comparison.todayBreakdown.tax),
        altTax: Math.round(comparison.altBreakdown.tax),
        todayNIHealth: Math.round(comparison.todayBreakdown.niHealth),
        altNIHealth: Math.round(comparison.altBreakdown.niHealth),
        evGrossUp: Math.round(comparison.altState.evGrossUp),
        familyGapShare: Math.round(comparison.altState.familyGapShare),
        steps: comparison.steps.map((s) => ({
          label: s.label_he,
          deltaNet: s.deltaNetRounded ?? Math.round(s.deltaNet),
          explanation: s.explanation_he,
        })),
        summary: comparison.summary_he,
        todayCar: comparison.todayCarLabel,
        altCar: comparison.altCarLabel,
      };

      const numbersGathered = [
        res.todayNet,
        res.altNet,
        Math.abs(res.diffNet),
        res.todayTax,
        res.altTax,
        res.todayNIHealth,
        res.altNIHealth,
        res.evGrossUp,
        res.familyGapShare,
        ...comparison.steps.map((s) => Math.abs(s.deltaNetRounded ?? Math.round(s.deltaNet))),
      ].join(' ');

      return { result: res, outputTextForGuardrail: numbersGathered };
    }

    case 'escalate_to_rep': {
      const q = String(args.question || 'פנייה לנציג');
      const s = String(args.summary || 'פרטי פנייה');
      const ticketId = await context.onEscalate(q, s);
      const res = { success: true, ticketId, message: `פנייה נפתחה לנציג: ${ticketId}` };
      return { result: res, outputTextForGuardrail: ticketId };
    }

    default:
      return { result: { error: `כלי לא מוכר: ${name}` }, outputTextForGuardrail: '' };
  }
}
