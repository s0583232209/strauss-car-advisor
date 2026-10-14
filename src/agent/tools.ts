/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import catalogData from '../data/catalog.json';
import occupationsData from '../data/occupations.json';
import { canSelectCarGroup } from '../engine/rules.ts';
import { buildScenario, findCarByIdOrName, findOccupation } from '../engine/scenario.ts';
import { Car, ComparisonResult, EmployeeProfile, Occupation, ScenarioType } from '../engine/types.ts';
import { getProfileFieldStatus } from './profileStatus.ts';
import { AgentContext, MissingFieldInfo, ToolDefinition } from './types.ts';

const carsCatalog = catalogData as Car[];
const occupationsList = occupationsData as Occupation[];

export const AGENT_TOOLS_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'update_profile',
    description: 'Update employee salary, role, car, or deduction fields. Only call with values the employee just stated that differ from the card; do not re-send fields already on the card.',
    parameters: {
      type: 'OBJECT',
      properties: {
        base: { type: 'number', description: 'Monthly base salary (שכר בסיס חודשי)' },
        group: { type: 'string', description: 'Car eligibility group (קבוצת זכאות: א, ב, ג, ד)' },
        occupation: { type: 'string', description: 'Job title / occupation (עיסוק/תפקיד)' },
        commissions: { type: 'number', description: 'Monthly commissions / sales incentives (עמלות)' },
        bonus: { type: 'number', description: 'Monthly bonus component (בונוס)' },
        pensionPct: { type: 'number', description: 'Employee pension deduction % (אחוז הפרשת עובד לפנסיה, בד"כ 6%)' },
        studyFundPct: { type: 'number', description: 'Employee study fund deduction % (אחוז הפרשה לקרן השתלמות, בד"כ 2.5%)' },
        creditPoints: { type: 'number', description: 'Tax credit points (נקודות זיכוי במס, למשל 2.25 או 2.75)' },
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
    description: 'Checks which required fields are still missing for a given scenario, and lists fields already on the employee card (alreadyInCard). Never ask the employee for a field in alreadyInCard.',
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
          if (updates.currentBenefit === undefined && context.profile.currentBenefit === 0) {
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
          if (!updates.group && !context.profile.group) updates.group = occ.group;
          if (!updates.hasCar && occ.canWaive && updates.currentMaintenance === undefined) {
            updates.currentMaintenance = occ.maintenance;
          }
        }
      }

      // Values identical to the card are not updates: report them as already known
      const alreadyInCard: string[] = [];
      for (const key of Object.keys(updates) as Array<keyof EmployeeProfile>) {
        if (updates[key] === context.profile[key]) {
          alreadyInCard.push(key);
          delete updates[key];
        }
      }

      if (Object.keys(updates).length > 0) {
        context.onProfileUpdate(updates);
        // Keep this turn's view of the card current (React state updates are async)
        context.profile = { ...context.profile, ...updates };
      }
      const res = {
        success: true,
        updated: updates,
        alreadyInCard,
        ...(alreadyInCard.length > 0 ? { note: 'שדות alreadyInCard כבר קיימים בכרטיס עם אותו ערך: אין לשאול או לעדכן אותם שוב.' } : {}),
      };
      return { result: res, outputTextForGuardrail: JSON.stringify(updates) };
    }

    case 'get_missing_fields': {
      const scType = (args.scenarioType || 'general') as ScenarioType;
      const prof = context.profile;
      const missing: MissingFieldInfo[] = [];

      if (!prof.base || prof.base <= 0) {
        missing.push({ field: 'base', label_he: 'שכר בסיס חודשי', whyNeeded_he: 'לקביעת מדרגות המס וחישוב שכר הנטו' });
      }
      if (!prof.group) {
        missing.push({ field: 'group', label_he: 'קבוצת זכאות (א–ד)', whyNeeded_he: 'לקביעת תקציב הרכב והרכבים המותרים' });
      }
      if (prof.hasCar && (!prof.currentCarName || prof.currentCarName === 'רכב חברה נוכחי')) {
        missing.push({ field: 'currentCarName', label_he: 'דגם רכב נוכחי', whyNeeded_he: 'לשליפת שווי השימוש הנוכחי לצורך השוואה מדויקת' });
      }
      if (scType === 'family_track' && prof.childrenUpTo23 === undefined) {
        missing.push({ field: 'childrenUpTo23', label_he: 'מספר ילדים עד גיל 23', whyNeeded_he: 'לבדיקת זכאות למסלול ברוכת ילדים (סף מינימלי: 4 ילדים)' });
      }

      // Fields already on the card: the model must not ask for these
      const alreadyInCard = getProfileFieldStatus(prof)
        .filter((f) => f.known)
        .map((f) => ({ field: f.field, label_he: f.label_he, value: f.value }));

      const res = { scenarioType: scType, missing, isComplete: missing.length === 0, alreadyInCard };
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
      const empGroup = context.profile.group || 'ג';
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

      // Demo mode check: "השתתפות ברכב החדש לפי אימות נציג"
      if (context.repParticipationMode && scType !== 'waive_car' && overridePart === undefined) {
        const car = targetCarId ? carsCatalog.find((c) => c.id === targetCarId) : undefined;
        const carName = car?.model || 'רכב חדש';
        const ticketId = await context.onEscalate(
          `אימות השתתפות עצמית עבור עובד/ת: ${context.profile.name || 'עובד'} בבחירת ${carName}`,
          `נדרש אימות נציג לגבי גובה ההשתתפות החודשית בעת מעבר ל-${carName}.`
        );

        // Calculate baseline today state
        const baseline = buildScenario(context.profile, { type: 'keep' as any });
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
          deltaNet: Math.round(s.deltaNet),
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
        ...comparison.steps.map((s) => Math.round(Math.abs(s.deltaNet))),
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
