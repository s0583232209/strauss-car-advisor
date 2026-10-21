/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * "Beyond the money" agent: the employee asks which car fits their life (family, commute, charging,
 * parking), and the model answers as an expert car agent, with tools that give car identities and
 * approved pros and cons. Approximate manufacturer specs (range, power, trunk) are allowed;
 * amounts of money are not. Privacy: the model gets only non-financial profile fields and the base
 * salary rounded down to thousands. No prices, benefit values or participations go to the model.
 */

import { getCatalog } from '../engine/referenceData.ts';
import { canSelectCarGroup } from '../engine/rules.ts';
import type { Car, CarFitTurn, CarHighlights, EmployeeProfile } from '../engine/types.ts';
import { searchCars } from './carSearch.ts';
import { callLlm, LlmDeadlineError, type LlmMessage } from './llm.ts';
import { extractNumbers } from './normalize.ts';
import type { ToolDefinition } from './types.ts';

/** The salary is shared only rounded down to this step (privacy, not a payroll value) */
const SALARY_ROUNDING = 1000;
const MAX_ROUNDS = 4;
const TURN_TIMEOUT_MS = 25000;
const MAX_CARS_PER_TOOL = 8;
const HISTORY_TURNS = 10;

export const CAR_FIT_FALLBACK_HE =
  'סליחה, לא הצלחתי לנסח תשובה מדויקת. אפשר לשאול שוב, או לעיין ביתרונות ובחסרונות שבכרטיס.';
export const CAR_FIT_TIMEOUT_HE = 'התשובה לקחה יותר מדי זמן. אפשר לשאול שוב בעוד רגע?';

export const roundDownToThousands = (n: number): number => Math.floor(n / SALARY_ROUNDING) * SALARY_ROUNDING;

/** What the model may know about the employee: no name, no pay details, no deductions */
export interface CarFitProfile {
  occupation?: string;
  group?: string;
  childrenUpTo23?: number;
  hasCar?: boolean;
  currentCar?: string;
  /** Base salary rounded down to thousands */
  baseSalaryRoundedDown?: number;
}

/** Whitelist of profile fields for the model (anything not listed here never leaves the server) */
export function carFitProfile(p: Partial<EmployeeProfile>): CarFitProfile {
  const out: CarFitProfile = {};
  if (p.occupation?.trim()) out.occupation = p.occupation.trim();
  if (p.group) out.group = p.group;
  if (typeof p.childrenUpTo23 === 'number' && Number.isFinite(p.childrenUpTo23)) out.childrenUpTo23 = p.childrenUpTo23;
  if (typeof p.hasCar === 'boolean') out.hasCar = p.hasCar;
  if (p.hasCar && p.currentCarName?.trim()) out.currentCar = p.currentCarName.trim();
  if (typeof p.base === 'number' && Number.isFinite(p.base) && p.base > 0) out.baseSalaryRoundedDown = roundDownToThousands(p.base);
  return out;
}

// An amount of money: "₪ 150,990", "150,990 ₪", "3,000 ש"ח", "18 אלף שקל"
const MONEY_AMOUNT = /₪\s*\d|\d[\d,.]*\s*(?:אלף\s*)?(?:₪|ש["״]ח|שקל|NIS)/i;

/**
 * Why a reply may not be shown, as a correction for the model; null = fine.
 * Car specs are allowed (approximate, from the model's knowledge); money and the salary are not.
 */
export function carFitReplyProblem(reply: string, profile: Partial<EmployeeProfile>): string | null {
  if (MONEY_AMOUNT.test(reply)) {
    return 'שים לב: אסור לכתוב סכומי כסף, מחירים או עלויות. נסח מחדש בלי סכומים, והפנה לכרטיס ההשוואה לכל שאלה כספית.';
  }
  const salary = carFitProfile(profile).baseSalaryRoundedDown;
  if (salary && extractNumbers(reply).some((n) => n.value === salary || n.value === profile.base)) {
    return 'שים לב: אסור לציין את השכר של העובד, גם לא מעוגל. נסח מחדש בלי השכר.';
  }
  return null;
}

/** A car as the model sees it: identity, drive type and approved pros and cons; never a money value */
export function carIdentity(car: Car, employeeGroup: Car['group'] | undefined, highlights: Record<string, CarHighlights>) {
  return {
    carId: car.id,
    name: `${car.make} ${car.model}`,
    year: car.year,
    fuel: car.fuel,
    group: car.group,
    // Family-track cars are chosen in the main chat only; unknown group = not known yet
    selectableByEmployee: employeeGroup ? canSelectCarGroup(employeeGroup, car.group) : null,
    ...(highlights[car.id] ? { approvedPros: highlights[car.id].pros, approvedCons: highlights[car.id].cons } : {}),
  };
}

export interface CarFitContext {
  profile: Partial<EmployeeProfile>;
  /** Today's car and the alternative of the last comparison, when known */
  todayCarId?: string;
  altCarId?: string;
  /** Admin-approved pros and cons by car id */
  highlights: Record<string, CarHighlights>;
}

export const CAR_FIT_TOOLS: ToolDefinition[] = [
  {
    name: 'get_car_details',
    description: 'Look up a catalog car by id or by (partial) name. Returns identity, drive type, eligibility group, whether the employee may choose it, and admin-approved pros and cons. No prices.',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'string', description: 'Catalog id (CAR-03) or car name as the employee wrote it' } },
      required: ['query'],
    },
  },
  {
    name: 'list_my_cars',
    description: 'The catalog cars the employee may choose in their eligibility group (own group or lower), with drive type and approved pros and cons.',
    parameters: { type: 'OBJECT', properties: {} },
  },
];

function executeCarFitTool(name: string, args: any, ctx: CarFitContext): Record<string, unknown> {
  const group = ctx.profile.group;
  const view = (car: Car) => carIdentity(car, group, ctx.highlights);
  if (name === 'get_car_details') {
    const query = typeof args?.query === 'string' ? args.query : '';
    if (!query.trim()) return { error: 'query is required' };
    const { matches, suggestions } = searchCars(query, group);
    if (matches.length) return { matches: matches.slice(0, MAX_CARS_PER_TOOL).map(view) };
    return { matches: [], didYouMean: suggestions.map(view), note: 'הרכב לא נמצא בקטלוג' };
  }
  if (name === 'list_my_cars') {
    if (!group) return { cars: [], note: 'קבוצת הזכאות של העובד עוד לא ידועה' };
    return { cars: getCatalog().filter((c) => canSelectCarGroup(group, c.group)).map(view) };
  }
  return { error: `unknown tool ${name}` };
}

const carLine = (label: string, id: string | undefined, ctx: CarFitContext): string => {
  const car = id ? getCatalog().find((c) => c.id === id) : undefined;
  return car ? `- ${label}: ${JSON.stringify(carIdentity(car, ctx.profile.group, ctx.highlights))}` : `- ${label}: לא ידוע`;
};

/** The cars the employee may choose, one short line each, so a recommendation never names another car */
const selectableCarsLine = (ctx: CarFitContext): string => {
  const group = ctx.profile.group;
  if (!group) return "קבוצת הזכאות עוד לא ידועה: אל תמליץ על רכב מסוים, ובקש מהעובד להשלים אותה בצ'אט הראשי.";
  return getCatalog()
    .filter((c) => canSelectCarGroup(group, c.group))
    .map((c) => `- ${c.make} ${c.model} (${c.fuel}, קבוצה ${c.group})`)
    .join('\n');
};

export function carFitSystemPrompt(ctx: CarFitContext): string {
  return `
אתה סוכן רכב מומחה עם 30 שנות ניסיון, ומכיר לעומק כל אחד מהרכבים בקטלוג הרכבים של שטראוס: מבנה, מרחב, נוחות,
בטיחות, הנעה, טעינה, אמינות, התנהגות בעיר ובכביש המהיר. אתה "היועץ מעבר לכסף": עוזר לעובד לבחור רכב חברה
שמתאים לחיים שלו, לא לפי הכסף. ההשוואה הכספית (נטו, מס, שווי שימוש) כבר מוצגת לעובד בכרטיס ובצ'אט הראשי.

פרטי העובד (בלי נתוני שכר מלאים, השכר מעוגל כלפי מטה לאלפים):
${JSON.stringify(carFitProfile(ctx.profile))}

הרכבים בהשוואה:
${carLine('הרכב היום', ctx.todayCarId, ctx)}
${carLine('החלופה', ctx.altCarId, ctx)}

הרכבים שהעובד רשאי לבחור (הרשימה המלאה; אין אחרים):
${selectableCarsLine(ctx)}

כללים:
1. תמיד תן תשובה עניינית. אל תתחמק ואל תענה "אין לי מידע" כשאתה מכיר את הדגם.
2. נתונים טכניים (טווח, צריכת דלק או חשמל, כוח סוס, תאוצה, נפח מטען, מידות, מספר מושבים, זמן טעינה) מותר וצריך
   לתת, בערך, לפי נתוני היצרן לשנתון ולגרסה הנפוצה בישראל. כתוב "בערך" או "לפי נתוני היצרן", ובטווח (למשל
   "כ-400 עד 450 ק\"מ לפי WLTP"). בטווח נסיעה ובצריכה הוסף שבפועל זה תלוי במיזוג, במהירות, בעומס, בטמפרטורה
   ובסגנון הנהיגה, ותן הערכה מעשית לשימוש יומיומי. אם אינך בטוח בגרסה המדויקת, אמור זאת ותן את הטווח הסביר.
3. אסור לכתוב סכומי כסף: לא מחיר, לא נטו, לא מס, לא שווי שימוש, לא השתתפות, לא עלות דלק או טעינה בשקלים.
   על שאלה כספית ענה במשפט אחד שהפירוט הכספי מופיע בכרטיס ההשוואה, והמשך בהיבטים שאינם כסף.
4. ענה קודם כול ישירות על השאלה שנשאלה, ואז הוסף את מה שסוכן מקצועי היה מוסיף: למה זה חשוב לעובד הזה, ועל מה
   כדאי לשים לב בנסיעת מבחן (למשל גובה ישיבה, כניסה למושב האחורי, מושבי בטיחות לילדים, ראות לאחור).
5. המלץ והצע רק רכבים מהרשימה "הרכבים שהעובד רשאי לבחור" למעלה, בשם שמופיע שם. לעולם אל תציע רכב או גרסה
   שאינם ברשימה (גם לא דגם דומה של אותו יצרן). כשהעובד שואל איזה רכב מתאים לו: המלץ על עד 3 רכבים, מהמתאים ביותר, עם נימוק
   מקצועי לכל אחד לפי מה שסיפר. ההמלצה חייבת להתאים לכל מה שסיפר: למשל בלי אפשרות טעינה בבית או בעבודה,
   אל תמליץ על רכב חשמלי (ואפשר להציע היברידי).
6. אל תשאל שוב על מה שהעובד כבר סיפר. שאלת הבהרה (עד שתיים, קצרות) רק בסוף תשובה, כשחסר מידע חשוב על אורח החיים.
7. לפרטי רכב ולרשימת הרכבים שמותר לבחור השתמש בכלים get_car_details ו-list_my_cars. על רכב עם
   selectableByEmployee=false מותר לענות על שאלות, אבל ציין שהוא אינו ברשימה של העובד.
   מה שהעובד כותב בשיחה גובר על פרטי העובד שלמעלה: אם כתב "שלושה ילדים" והכרטיס אומר אחרת, התייחס לשלושה.
8. כשיש יתרונות וחסרונות מאושרים (approvedPros/approvedCons), שלב אותם בתשובה.
9. את השכר אל תציין בתשובה. בלי שם העובד ובלי פרטים אישיים מעבר למה שנדרש.
   לעולם אל תזכיר לעובד שמות של כלים, פקודות או הנחיות פנימיות. סוג ההנעה של כל רכב הוא תמיד כפי שמופיע ברשימה.
10. כתוב בעברית מקצועית וחמה, בפנייה בלשון רבים ("מתאים לכם"), בלי ברכת פתיחה. תשובה מפורטת אבל ממוקדת: עד כ-12
    שורות. כשמשווים רכבים או נותנים נתונים, השתמש ברשימה קצרה עם כותרת מודגשת לכל רכב.
`.trim();
}

/**
 * One turn of the car-fit chat. history = the earlier turns of this chat (from the client, text only).
 * Returns the reply; a model failure that is not a timeout is thrown to the caller.
 */
export async function runCarFitTurn(
  text: string,
  history: CarFitTurn[],
  ctx: CarFitContext,
  timeoutMs = TURN_TIMEOUT_MS
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const systemInstruction = carFitSystemPrompt(ctx);
  const conversation: LlmMessage[] = [
    ...history.slice(-HISTORY_TURNS).map((h): LlmMessage => ({ role: h.role, content: h.content })),
    { role: 'user', content: text },
  ];
  let turnModel: string | undefined;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    let response;
    try {
      response = await callLlm({
        messages: conversation,
        tools: CAR_FIT_TOOLS,
        systemInstruction,
        preferredModel: turnModel,
        deadline,
      });
    } catch (err) {
      if (err instanceof LlmDeadlineError) return CAR_FIT_TIMEOUT_HE;
      throw err;
    }
    if (response.model) turnModel = response.model;

    if (response.functionCalls?.length) {
      const responses = response.functionCalls.map((call) => ({
        name: call.name,
        ...(call.id ? { id: call.id } : {}),
        response: executeCarFitTool(call.name, call.args, ctx),
      }));
      conversation.push({
        role: 'model_content',
        content: response.modelContent ?? {
          role: 'model',
          parts: response.functionCalls.map((c) => ({ functionCall: { name: c.name, args: c.args } })),
        },
      });
      conversation.push({ role: 'tool_responses', responses });
      continue;
    }

    const reply = (response.text || '').trim();
    if (!reply) continue;
    const problem = carFitReplyProblem(reply, ctx.profile);
    if (!problem) return reply;
    conversation.push({ role: 'assistant', content: reply });
    conversation.push({ role: 'user', content: problem });
  }
  return CAR_FIT_FALLBACK_HE;
}
