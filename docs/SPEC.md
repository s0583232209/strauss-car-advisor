# PROMPT FOR GOOGLE AI STUDIO (Build mode), v2 — "Yoetz HaRechev" (Strauss Car Advisor)

You are a senior full-stack engineer with deep experience in payroll/net-salary calculations and LLM agents. Build, in ONE pass, a complete, working, polished web app. No placeholders, no TODOs, no mock logic where real logic is specified. If something is ambiguous, choose the most reasonable option, record it in a visible "Assumptions" panel (Admin screen) and continue.

## 0. Environment and constraints

- React + TypeScript + Vite + Tailwind (or plain CSS). The calculation engine is a pure TypeScript module (`/engine`) with no React and no LLM dependency. The LLM NEVER computes or invents a number.
- Gemini via `@google/genai` (key from `process.env.GEMINI_API_KEY`, never hard-coded, never logged). Use the latest Flash model available (default `gemini-2.5-flash`). Function calling for the agent, multimodal input for payslip extraction.
- Free-tier safety: the free Gemini key has low per-minute and per-day limits. Implement (a) exponential backoff with jitter on HTTP 429/503 (max 4 tries), (b) at most 6 model calls per user turn, (c) an in-memory cache for identical requests, (d) an optional fallback provider (OpenAI-compatible endpoint, configurable via `VITE_FALLBACK_BASE_URL`, `VITE_FALLBACK_KEY`, `VITE_FALLBACK_MODEL`, e.g. OpenRouter or Groq) used automatically after repeated 429s. Show a friendly Hebrew banner when throttled.
- Persistence through a `StorageAdapter` interface with two implementations: `LocalStorageAdapter` (default; wrap every access in try/catch, in-memory fallback) and `SupabaseAdapter` (used when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exist; includes Realtime subscription on tickets and messages). Provide the SQL (in a `/supabase/schema.sql` file and shown in Admin): tables `sessions(id, profile jsonb, updated_at)`, `messages(id, session_id, role, content, created_at)`, `tickets(id, session_id, question, summary, status, answer jsonb, created_at, answered_at)`. State MUST survive a page refresh (conversation, profile, tickets, last comparison).
- Large data: the tax-authority CSV (about 78k rows) is parsed in a Web Worker and stored in IndexedDB as a compact index, not in localStorage.
- All data and rules come from files in `/data`, never hard-coded in logic. Admin can upload replacements (rules JSON, catalog, occupations, employees, tax-authority CSV). A pilot swaps data, not code.
- UI language Hebrew, RTL (`dir="rtl"`, `lang="he"`), Heebo font with fallback. Money as `1,234 ₪`, explicit signs (`+661 ₪`, `−3,522 ₪`). Code and comments in English.
- Privacy: all demo data is fictional. Show a banner on the upload control: "השתמשו רק בטפסי דוגמה מותאמים (פרטים שונו). בגרסה החינמית של ג׳מיני הקלט עשוי לשמש לאימון." Mask ID numbers; never put salary data in console logs.

## 1. Product

An employee entitled to a company car asks in free Hebrew, for example "מה יקרה לנטו שלי אם אעבור לרכב חשמלי?", or about another car, giving up the car, or the large-family track. The bot answers within about a minute with a clear, explained and correct comparison of monthly NET pay: today vs. the alternative. It starts from salary, pay components and deductions (typing; payslip/contract upload is optional), asks ONLY for what is missing, and sends a question to a human representative when needed. After the rep answers, the conversation continues from the same point. Principle: "I am missing X, I asked the rep" is always better than a nice but wrong number. Never guess and never invent entitlements. Same data + same rules = same result, always.

## 2. Screens (hash routes)

1. `#/` Employee: chat + collected-profile panel + comparison card.
2. `#/rep` Representative screen.
3. `#/admin` Data, rules, assumptions, calibration tests. `#/guide` static Hebrew guidance page generated from the app's real config (conversation script, rules table, data sources "what exists / what is on the way", what is submitted).
   Top bar: role switcher [עובד | נציג | נתונים ובדיקות | מדריך] and a badge with the open-ticket count.

### 2.1 Employee

- Chat with typing indicator, quick-reply buttons for closed questions, Enter to send, error states with retry, mobile-friendly (360px), "שיחה חדשה" button.
- Profile panel ("פרופיל שנאסף"): every field editable in place ("תיקון נתונים"); missing fields highlighted; changing a field recomputes the last comparison.
- Demo helper: dropdown "טען עובד לדוגמה" (6 sample employees) plus six chips with the six sample questions (section 7), plus a chip "עובדת בקבוצה ב׳ שמוותרת על הרכב" that loads a generic Group-B waiver profile (see 8.3).
- Paperclip upload (section 6).
- Toggle "השתתפות ברכב החדש": `לפי ברירת מחדל בקטלוג` (default) | `אימות נציג` (demo mode: when ON, the bot says it is missing the employee's participation in the new car, opens a ticket, shows today's state meanwhile, and recomputes after the rep answers).

### 2.2 Representative

- Tickets list (פתוחה / נענתה / נסגרה) with filters; details: question, bot summary, employee profile, last comparison, transcript.
- Reply form: free text + optional structured fields `value` (number) and `effectiveFrom` (e.g. "1/1"), buttons "שלח תשובה" / "סגור פנייה".
- On reply, the employee chat (same browser through `storage` event + 2s polling, or Supabase Realtime across devices) shows "תשובת נציג: …" and the agent continues from the same point, re-running the comparison if the answer changes an input (example: rep answers "השתתפות 350 ₪, בתוקף מ-1/1").

### 2.3 Admin

Tabs: Rules (view + upload), Catalog, Occupations, Sample employees, Tax tables (read from rules JSON; editable override, reset), Vehicle benefit DB (CSV upload, row count, lookup tester), Assumptions, Calibration tests (section 8).
Tax-authority CSV specifics (verified on the real file, 77,988 rows, 19 columns): encoding is **windows-1255** (decode with `TextDecoder('windows-1255')`), headers and values contain padding spaces (trim everything), header names include: `שנת מס`, `שנת רישום`, `קוד סוג רכב`, `קוד תוצר`, `תוצר`, `קוד דגם`, `תאור דגם`, `סוג דלק`, `כינוי מסחרי`, `1-חשמלי.2-היברידי.3-פלג-אין` (drive field), `מחיר מחירון`, `מחיר מתואם`, `שווי שימוש`. Codes keep leading zeros (strings). The official lookup key is **(שנת רישום, קוד סוג רכב, קוד תוצר, קוד דגם)** — it is unique in the file. The catalog has no vehicle-type column: use type `1` (private car). Warning: some product/model codes appear twice with different vehicle-type codes (e.g. BYD 01014/00003/2025: type 1 = ATTO 3 = 3,130; type 2 = TANG = 6,950), so omitting the type code returns a wrong value. Lookup returns `{value, sourceRow, commercialName}` or `null`; `null` means escalate to a rep, never guess. Priority: uploaded CSV → catalog seed value (already verified identical to the CSV for all 20 cars). Drive field is actually coded 0 gasoline · 1 hybrid · 2 plug-in · 3 electric (the header text is misleading) — show a note in Admin.

## 3. Calculation engine (pure TS), exact specification

Monthly (not cumulative), 2025 tables, all numbers read from `rules.netMethod` (section 4.1). Use decimals/agorot internally; display whole shekels. **Displayed difference = round(net_alt) − round(net_today)** (this yields −1,938 and +721 as in the reference).

### 3.1 Formulas

Inputs: `base, commissions, bonus, pensionPct, studyFundPct, creditPoints, benefitValue (שווי שימוש), maintenance (אחזקה), participation, familyGapShare, evGrossUp`.

```
pensionable   = base + commissions + bonus
pension       = pensionPct * pensionable       // deducted from net
studyFund     = studyFundPct * pensionable     // net deduction, no tax effect
cash          = base + commissions + bonus + maintenance + evGrossUp
taxableBase   = cash + benefitValue            // benefit enters tax AND NI/health base, is not paid in cash
bracketTax    = progressive tax on taxableBase using rules.netMethod.brackets (last bracket has null ceiling)
pensionCredit = pensionCredit.rate(0.35) * min(pension, 0.07 * pensionCredit.incomeCeiling(9500))   // = max 232.75 ₪
tax           = max(0, bracketTax - creditPoints*creditPointValue(242) - pensionCredit)
niHealth      = (NI.lowRate+health.lowRate)*min(taxableBase, threshold 7522)
              + (NI.highRate+health.highRate)*max(0, min(taxableBase, ceiling 50695) - 7522)
net           = cash - tax - niHealth - pension - studyFund - participation - familyGapShare
```

Maintenance (אחזקה) is taxable and NOT pensionable. Unused car budget is never paid as cash (`unusedBudget: not_paid`); when a car costs less than the budget, say so in the explanation.

### 3.2 EV refund (grossed up to exactly +250 ₪ net)

Only drive code 3 (electric) qualifies; hybrid/plug-in do not. `grossUpForNet(state, 250)`: bisection on `evGrossUp` (tolerance 0.005) such that `net(state with g) − net(state without) = 250` (same state otherwise, including the new car's benefit and participation). Flag `electric.method`: `gross_up` (default) | `gross_250` (simply add 250 gross). Expected gross-up amounts: Noa 440, Yossi 440, Rachel 473, Eli 473.

### 3.3 Scenario builder and explanation

`buildScenario(profile, request) → {today, alternative, applied[], blocked?}`. Types: `change_car`, `go_electric`, `family_track`, `waive_car`, `keep`. Today = current car (benefit from lookup, participation from profile/catalog) or current waiver (occupation maintenance, no benefit, no participation).
The total difference is the exact sum of sequential steps, each measured as the change in net after applying it on top of the previous ones, order: (1) benefit change, (2) maintenance change, (3) participation change, (4) family-track gap share, (5) EV refund. Each step: `{key, label_he, deltaNet, explanation_he}`; assert `sum(deltaNet) === net_alt − net_today` (before display rounding) in code and tests. Also produce a two-line plain-Hebrew explanation (e.g. "שווי שימוש 4,070 → 3,130 ₪ · +250 ₪ נטו החזר חשמל (מגולם)").

## 4. Data (embed exactly; engine reads it from files)

### 4.1 `/data/strauss-rules.json` (the official sample file; use verbatim)

```json
{
  "version": "mock-2026-10-12",
  "budgets": { "א": 3500, "ב": 3700, "ג": 4500, "ד": 5200 },
  "groupOrder": ["א", "ב", "ג", "ד"],
  "chooseFrom": "own_group_or_lower",
  "electric": { "netBonus": 250, "method": "gross_up" },
  "familyTrack": {
    "minChildren": 4,
    "childMaxAge": 23,
    "carPrice": 6000,
    "gapSplitEmployee": 0.5
  },
  "waiver": {
    "allowedBy": "occupation",
    "maintenanceIsTaxable": true,
    "maintenanceIsPensionable": false
  },
  "unusedBudget": "not_paid",
  "netMethod": {
    "basis": "monthly",
    "taxYear": 2025,
    "creditPointValue": 242,
    "brackets": [
      [7010, 0.1],
      [10060, 0.14],
      [16150, 0.2],
      [22440, 0.31],
      [46690, 0.35],
      [60130, 0.47],
      [null, 0.5]
    ],
    "nationalInsurance": {
      "threshold": 7522,
      "ceiling": 50695,
      "lowRate": 0.0104,
      "highRate": 0.07
    },
    "health": {
      "threshold": 7522,
      "ceiling": 50695,
      "lowRate": 0.0323,
      "highRate": 0.0517
    },
    "pensionCredit": { "rate": 0.35, "incomeCeiling": 9500 }
  },
  "valueOfUse": {
    "source": "רשות המסים - הקובץ המורחב 2026",
    "key": ["שנת מס", "שנת רישום", "קוד סוג רכב", "קוד תוצר", "קוד דגם"],
    "driveField": {
      "0": "בנזין",
      "1": "היברידי",
      "2": "פלאג-אין",
      "3": "חשמלי"
    }
  }
}
```

Family-track car prices (company cost): CARNIVAL 6,000, SANTA FE 5,600 (from the catalog `companyCost`; `carPrice` 6,000 is the Carnival default). Gap = carCompanyCost − budget(employee group); employee pays `gapSplitEmployee` (50%) of the gap, deducted from net; employer pays the rest. Verified example from the brief: budget 3,500, cost 6,000, gap 2,500 → employer 1,250, employee 1,250. David: group ב (3,700) + Carnival → gap 2,300 → employee 1,150.

### 4.2 Catalog (20 rows; CSV columns: id, group, make, model, productCode, modelCode, description, year, fuel, listPrice, benefit, companyCost, participation)

```
CAR-01,א,קיה קוריאה,PICANTO,00885,00643,B351A,2025,בנזין,105900,2690,2650,150
CAR-02,א,טויוטה צרפת,YARIS CROSS HSD,00672,00130,MXPJ10L-BHXNBW,2025,היברידי,154990,3350,3400,200
CAR-03,א,בי ווי די,BYD DOLPHIN,01014,00012,EM2E-1,2025,חשמלי,150990,2590,3300,200
CAR-04,א,סיאט ספרד,LEON,00778,00618,KL12TZ,2025,בנזין,152900,3880,3450,200
CAR-05,ב,קיה קוריאה,NIRO,00885,00619,CP81EG,2025,היברידי,139000,2950,3600,250
CAR-06,ב,מ.ג סין,MG4,00443,00032,WH40,2025,חשמלי,150000,2430,3550,250
CAR-07,ב,טויוטה טורקיה,COROLLA,00839,00295,MZEA11L-DEXNBW,2026,בנזין,165990,4120,3700,250
CAR-08,ב,יונדאי צ'כיה,KONA EV,00253,00138,H781A,2026,חשמלי,174990,2960,3650,250
CAR-09,ג,טויוטה יפן,COROLLA CROSS,00413,00296,ZVG12L-KHXGBW,2025,היברידי,182990,4070,4300,300
CAR-10,ג,בי ווי די,ATTO 3,01014,00003,SC2E-SC2E01,2025,חשמלי,177500,3130,4100,300
CAR-11,ג,קיה קוריאה,EV3,00885,00675,FC81B,2025,חשמלי,169900,2930,4350,300
CAR-12,ג,יונדאי צ'כיה,TUCSON,00253,00133,JB81B,2025,בנזין,188497,4790,4450,400
CAR-13,ג,מזדה יפן,MAZDA 3,00588,00446,BP,2025,בנזין,179900,4570,4200,350
CAR-14,ד,טסלה סין,MODEL 3,01327,00730,3E7F,2025,חשמלי,217813,4150,5100,500
CAR-15,ד,סקודה צ'כיה,OCTAVIA,00676,01455,NX-NX337D,2025,בנזין,202690,5150,5000,500
CAR-16,ד,קיה סלובקיה,SPORTAGE HEV,00416,00294,PV81G,2026,פלאג-אין,229900,4550,5150,500
CAR-17,ד,בי ווי די,SEAL,01014,00014,H6CD,2025,חשמלי,250000,4970,5200,500
CAR-18,ד,טויוטה יפן,RAV4,00413,00368,AXAL52L-ANXXBW,2025,היברידי,199000,4470,5200,500
CAR-19,משפחתי,קיה קוריאה,CARNIVAL,00885,00648,NG5K3,2025,בנזין,319900,8120,6000,500
CAR-20,משפחתי,יונדאי קוריאה,SANTA FE,00481,00533,P2DG1,2025,בנזין,185000,4700,5600,500
```

Keep codes as strings with leading zeros. Family-track cars are selectable only via the family track.

### 4.3 Occupations (14; columns: occupation, group, carMandatory, canWaive, maintenance)

```
נציג/ת מכירות שטח,ב,כן,לא,0
מנהל/ת אזור מכירות,ג,כן,לא,0
טכנאי/ת שירות,א,כן,לא,0
נהג/ת הפצה,א,כן,לא,0
מפקח/ת איכות במפעל,א,לא,כן,1200
רכז/ת רכש,א,לא,כן,1200
מהנדס/ת תהליך,ב,לא,כן,1500
מפתח/ת תוכנה,ב,לא,כן,1500
אנליסט/ית נתונים,ב,לא,כן,1500
מנהל/ת מוצר,ג,לא,כן,2000
מנהל/ת פיתוח,ג,לא,כן,2000
מנהל/ת משאבי אנוש,ג,לא,כן,2000
מנהל/ת מחלקה,ד,לא,כן,2600
מנהל/ת חטיבה,ד,לא,כן,3000
```

Mandatory-car occupations cannot waive: block with an explanation and offer alternatives (other car, electric, family track if eligible).

### 4.4 Six sample employees (fictional; the children column is already "children up to age 23")

| id    | name       | occupation         | group | base  | comm. | bonus | pension % | study fund % | credit pts | children≤23 | today                            |
| ----- | ---------- | ------------------ | ----- | ----- | ----- | ----- | --------- | ------------ | ---------- | ----------- | -------------------------------- |
| E-001 | נועה לוי   | מנהל/ת מוצר        | ג     | 18500 | 0     | 0     | 6         | 2.5          | 2.75       | 2           | COROLLA CROSS, participation 300 |
| E-002 | דוד כהן    | נציג/ת מכירות שטח  | ב     | 9800  | 2400  | 0     | 6         | 0            | 2.25       | 5           | NIRO, 250                        |
| E-003 | רחל פרידמן | מפתח/ת תוכנה       | ב     | 21000 | 0     | 0     | 6.5       | 2.5          | 2.75       | 0           | no car, waiver maintenance 1500  |
| E-004 | יוסי מזרחי | מנהל/ת אזור מכירות | ג     | 16000 | 3000  | 0     | 6         | 2.5          | 2.25       | 3           | TUCSON, 400                      |
| E-005 | מיכל אברהם | מנהל/ת פיתוח       | ג     | 27000 | 0     | 0     | 7         | 2.5          | 2.75       | 1           | MAZDA 3, 350                     |
| E-006 | אלי שמעון  | מנהל/ת מחלקה       | ד     | 32000 | 0     | 2000  | 6         | 2.5          | 2.25       | 4           | OCTAVIA, 500                     |

For a new (non-sample) employee, always ask "כמה ילדים עד גיל 23" (changed 2026-10-13; previously only for the family track). Sample employees are for dry runs only; a real conversation starts with an empty profile.

## 5. Comparison card (understood in one second)

- One big number: monthly net difference, green for +, red for −, with a short sentence ("הנטו שלך יעלה ב-661 ₪ בחודש").
- For each alternative: the car (or waiver), **eligible or not and why** ("הרכב מהקבוצה שלך או נמוכה ממנה", "העיסוק מאפשר ויתור", "מסלול ברוכת ילדים (5 ילדים); על הפער מעל התקציב 50% עובד"), company cost vs. group budget, participations, benefit value, EV refund or maintenance, net, difference vs. today, and the two-line plain-Hebrew explanation.
- Two columns "היום" / "החלופה", then "למה?" with the delta steps and a waterfall chart (inline SVG), then an expandable "איך חישבנו" with the full breakdown and sources (e.g. "שווי שימוש: רשות המסים 2026, שורה …").
- Buttons: "החלף רכב וחשב שוב", "השווה לאפשרות אחרת", "שלח שאלה לנציג", "הדפס". Ranked table of all eligible options when the user asks "איזה רכב עדיף".
- Footer note: "חישוב אינדיקטיבי לפי לוחות 2025; ההפרשות והזיכויים כפי שהוזנו".

## 6. Payslip / contract upload (optional path)

PDF/JPG/PNG sent as inline base64 to Gemini with `responseMimeType: application/json` and a response schema: `{occupation, base, commissions, bonus, pensionPct, studyFundPct, creditPoints, currentCar, carParticipation, maintenance, childrenUpTo23}` where every field is `{value|null, confidence, sourceQuote}`. Instruct: never guess, null when absent. Show a "מה קראנו, אשרו או תקנו" table; merge into the profile only after approval.

## 7. Agent (Gemini function calling)

System prompt (Hebrew, warm, brief, one question at a time): the bot is "יועץ הרכב של שטראוס"; never computes or states a net/benefit number itself; only asks for what `get_missing_fields` says is missing; confirms understood values briefly; max ~6 lines plus the card; does not reveal the raw rules; escalates instead of guessing.
Conversation script to support: (1) employee states the wish; (2) bot asks eligibility group (א–ד) and monthly base; (3) bot asks other components (commissions, bonuses), deductions (pension %, study fund %, credit points) and whether there is a current company car, offering upload as optional; (4) bot asks current car (make, model, registration year) and participation, then shows the eligible catalog (own group or lower) and the employee chooses; (5) bot verifies eligibility against the table, pulls both benefit values from the DB, runs the engine, adds the 250 ₪ EV refund; (6) if something is missing (e.g. participation in the new car) it says "חסר לי X, שלחתי שאלה לנציג" and shows today's state meanwhile; (7) after the rep answers the process continues from that point with the final comparison, e.g. "היום נטו 11,480 ₪ · עם הרכב החשמלי 11,690 ₪ · הפרש +210 ₪ בחודש. למה? …" (the numbers in this example are illustrative only).
Tools (executed locally): `update_profile(fields)`, `get_missing_fields(scenarioType)`, `find_car(query)` (fuzzy Hebrew/English: "קורולה קרוס", "אטו", "טסלה", "קרניבל"; ask which one if several; escalate if none), `list_options(type)` (own group or lower, never family cars; `electric` = drive 3), `run_comparison(scenario)`, `escalate_to_rep(question, summary)`.
Required fields: eligibility group (א–ד, asked directly; never derived from occupation), base, commissions, bonus, pensionPct, studyFundPct, creditPoints, current car + participation OR current waiver, and children≤23 (asked for every scenario; changed from "family track only" on 2026-10-13). Occupation is required only for `waive_car`: it decides whether waiving is allowed (carMandatory, canWaive) and the maintenance amount; it is not asked for change_car, go_electric or family_track (changed 2026-10-14). Every value comes from the employee: never assume a typical value.
Escalate when: car or occupation not in data; benefit value not found; policy question or exception; unclear child data; extraction low confidence; the user asks for a person.
Guardrails: post-check that every number in the final text exists in this turn's tool outputs or in the user's messages; otherwise regenerate (max 2) and finally show only the card. Tool-loop cap 6, 30s timeout. Reply in Hebrew unless the user writes in another language.
Opening message: "היי, אני יועץ הרכב. אפשר לשאול אותי מה יקרה לנטו אם תעברו לרכב חשמלי, תחליפו רכב, תוותרו על הרכב או תבחרו במסלול ברוכת ילדים. נתחיל מהשכר: באיזו קבוצת זכאות (א–ד) אתם ומה שכר הבסיס החודשי?"
Sample questions (chips): (1) "אם אעבור מהקורולה קרוס ל-BYD Atto 3 החשמלי - כמה זה ישנה לי בנטו?" (2) "יש לי 5 ילדים. אם אקח קרניבל במסלול ברוכת ילדים - מה יקרה לנטו?" (3) "היום אני מקבלת אחזקת רכב. אם אקח MG4 חשמלי - כמה אפסיד או ארוויח בנטו?" (4) "אם אחליף את הטוסון ב-EV3 - מה ההפרש בנטו?" (5) "אם אוותר על הרכב ואקבל אחזקה - כמה אקבל בנטו?" (6) "אם אעבור מהאוקטביה לטסלה מודל 3 - מה יקרה לנטו?"

## 8. Calibration and tests (Admin → "בדיקות כיול"; run on tab open; green/red table; tolerance ±1 ₪)

These values come from the official workbook sheet "חישובים" and were reproduced exactly by this specification. If your implementation deviates, fix the implementation, not the expectations.

### 8.1 Net, tax and NI+health

| employee | today → alternative                                      | net today | net alt | diff   | tax today → alt | NI+health today → alt | EV gross-up |
| -------- | -------------------------------------------------------- | --------- | ------- | ------ | --------------- | --------------------- | ----------- |
| נועה     | COROLLA CROSS → ATTO 3                                   | 11,032    | 11,693  | +661   | 3,443 → 3,283   | 2,153 → 2,092         | 440         |
| דוד      | NIRO → CARNIVAL (family; share 1,150; participation 500) | 8,600     | 5,078   | −3,522 | 1,369 → 2,861   | 1,250 → 1,879         | 0           |
| רחל      | waiver 1,500 → MG4 (participation 250)                   | 15,047    | 13,109  | −1,938 | 3,419 → 3,910   | 2,144 → 2,315         | 473         |
| יוסי     | TUCSON → EV3 (participation 300)                         | 10,693    | 11,900  | +1,207 | 3,991 → 3,497   | 2,301 → 2,128         | 440         |
| מיכל     | MAZDA 3 → waiver 2,000 (participation removed)           | 14,244    | 17,806  | +3,562 | 6,593 → 5,694   | 3,248 → 2,935         | 0           |
| אלי      | OCTAVIA → MODEL 3                                        | 17,073    | 17,794  | +721   | 9,367 → 9,183   | 4,170 → 4,106         | 473         |

### 8.2 Rule assertions

Delta steps sum exactly to the total; EV gross-up returns exactly +250 net; hybrid and plug-in get no refund; mandatory-car occupation cannot waive; family track needs ≥4 children up to 23 (David 5 ✓, Noa 2 ✗); a car above the employee's group is rejected; family cars are not selectable outside the family track; the family-gap example (budget 3,500, cost 6,000 → 1,250/1,250); CSV lookup with the vehicle-type code returns 3,130 for ATTO 3 and never 6,950; all 20 catalog benefit values equal the CSV values (when loaded).

### 8.3 Generic Group-B waiver (required by the brief: it must work for more than the script example)

Profile "מהנדסת תהליך", group ב, base 15,000, no commissions/bonus, pension 6%, study fund 2.5%, 2.25 credit points, current car NIRO participation 250, asks to waive: maintenance 1,500 is taxable, not pensionable, benefit and participation are removed. No fixed expected number; assert the sanity rules (alternative net > today's net only if benefit+participation effect exceeds the tax on 1,500; steps sum to the total).

## 9. Design

Clean, light and calm. Background #FAFBFC, ink #1C2733, accent teal #0E6E8C, borders #E3E8EE, success #1B8A5A, loss #C0392B, warning #B4690E. Generous spacing, 8px radius, one accent, Heebo, a clear type scale. The memorable element is the comparison card's big number; everything else is quiet. Respect `prefers-reduced-motion`, visible focus states, WCAG AA contrast, buttons named by action ("חשב השוואה", "שלח לנציג").

## 10. Code quality and deliverables

- Structure: `/engine` (tax.ts, net.ts, rules.ts, scenario.ts, explain.ts, benefit.ts, types.ts), `/data`, `/agent` (prompt.ts, tools.ts, loop.ts, guard.ts, extract.ts, llm.ts with backoff and fallback), `/store` (adapters), `/ui`, `/workers` (csv.worker.ts), `/tests` (runnable in-app; also vitest files), `/supabase/schema.sql`.
- Strict TypeScript, no `any` in the engine, pure functions, one-line doc comment per public function, error handling everywhere.
- Include: `README.md` (install, env vars, run tests, how to replace data), `.env.example` without secrets (`GEMINI_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FALLBACK_*`), the sample `strauss-rules.json`, and a short `SUMMARY.md` in Hebrew: what works, limitations, what is needed for a pilot at Strauss (real payroll/HR integration, real rules and budgets, official tax tables, security review).
- When finished, reply with: what was built, assumptions made, and how to run the calibration tests.

Start building now and produce the complete app.
