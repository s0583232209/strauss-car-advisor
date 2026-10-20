/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EligibilityGroup = 'א' | 'ב' | 'ג' | 'ד' | 'משפחתי';

export interface TaxBracket {
  ceiling: number | null;
  rate: number;
}

export interface Rules {
  version: string;
  budgets: Record<string, number>;
  groupOrder: string[];
  chooseFrom: string;
  electric: {
    netBonus: number;
    method: 'gross_up' | 'gross_250';
  };
  familyTrack: {
    minChildren: number;
    childMaxAge: number;
    carPrice: number;
    gapSplitEmployee: number;
  };
  waiver: {
    allowedBy: string;
    maintenanceIsTaxable: boolean;
    maintenanceIsPensionable: boolean;
  };
  unusedBudget: string;
  netMethod: {
    basis: string;
    taxYear: number;
    creditPointValue: number;
    brackets: Array<[number | null, number]>;
    nationalInsurance: {
      threshold: number;
      ceiling: number;
      lowRate: number;
      highRate: number;
    };
    health: {
      threshold: number;
      ceiling: number;
      lowRate: number;
      highRate: number;
    };
    pensionCredit: {
      rate: number;
      incomeCeiling: number;
    };
  };
  valueOfUse: {
    source: string;
    key: string[];
    driveField: Record<string, string>;
  };
}

export interface Car {
  id: string;
  group: EligibilityGroup;
  make: string;
  model: string;
  productCode: string;
  modelCode: string;
  description: string;
  year: number;
  fuel: string;
  driveCode: number; // 0=gasoline, 1=hybrid, 2=plug-in, 3=electric
  listPrice: number;
  benefit: number;
  companyCost: number;
  participation: number;
}

export interface Occupation {
  occupation: string;
  group: EligibilityGroup;
  carMandatory: boolean;
  canWaive: boolean;
  maintenance: number;
}

export interface EmployeeProfile {
  id?: string;
  name?: string;
  occupation: string;
  group: EligibilityGroup;
  base: number;
  commissions: number;
  bonus: number;
  pensionPct: number; // e.g. 6 means 6%
  studyFundPct: number; // e.g. 2.5 means 2.5%
  creditPoints: number; // e.g. 2.25, 2.75
  childrenUpTo23: number;
  hasCar: boolean;
  currentCarId?: string | null;
  currentCarName?: string;
  currentParticipation: number;
  currentBenefit: number;
  currentMaintenance: number;
}

export interface TaxCalculationInputs {
  base: number;
  commissions: number;
  bonus: number;
  pensionPct: number; // percentage, e.g. 6.0
  studyFundPct: number; // percentage, e.g. 2.5
  creditPoints: number;
  benefitValue: number; // שווי שימוש
  maintenance: number; // אחזקת רכב
  participation: number; // השתתפות עובד ברכב
  familyGapShare: number; // השתתפות בפער מעל התקציב במסלול ברוכת ילדים
  evGrossUp: number; // גילום החזר חשמל
}

export interface NetBreakdown {
  pensionable: number;
  pension: number;
  studyFund: number;
  cash: number;
  taxableBase: number;
  bracketTax: number;
  pensionCredit: number;
  tax: number;
  niHealth: number;
  participation: number;
  familyGapShare: number;
  evGrossUp: number;
  net: number;
}

export interface DeltaStep {
  key: 'benefit' | 'maintenance' | 'participation' | 'familyGap' | 'evGrossUp';
  label_he: string;
  deltaNet: number;
  // Whole shekels for display; the steps' rounded values add up exactly to diffNet (roundStepsToTotal).
  // Optional only for comparisons saved before 2026-10-14.
  deltaNetRounded?: number;
  explanation_he: string;
}

export type ScenarioType = 'change_car' | 'go_electric' | 'family_track' | 'waive_car' | 'keep';

export interface ScenarioRequest {
  type: ScenarioType;
  targetCarId?: string;
  targetCar?: Car;
  overrideParticipation?: number;
}

export interface ComparisonResult {
  scenarioType: ScenarioType;
  // What the user actually asked for. Differs from scenarioType when a 'keep'
  // placeholder is shown while a rep verifies the participation.
  requestedScenarioType?: ScenarioType;
  requestedCarId?: string;
  eligible: boolean;
  eligibilityReason_he: string;
  todayState: TaxCalculationInputs;
  todayBreakdown: NetBreakdown;
  altState: TaxCalculationInputs;
  altBreakdown: NetBreakdown;
  diffNet: number; // round(alt.net) - round(today.net)
  exactDiff: number; // alt.net - today.net
  steps: DeltaStep[];
  sumSteps: number;
  summary_he: [string, string];
  todayCarLabel: string;
  altCarLabel: string;
  targetCar?: Car;
  budget: number;
  companyCost: number;
  employeeGap: number;
  employerGap: number;
  sourceNote?: string;
}

export interface VehicleLookupResult {
  value: number;
  sourceRow: number;
  commercialName: string;
  driveCode: number;
  listPrice: number;
}

// ---------------------------------------------------------------------------
// Conversation, tickets and API shapes (shared by the client and the server)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'rep';
  content: string;
  comparison?: ComparisonResult;
  timestamp: number;
  isStreaming?: boolean;
}

export interface TicketAnswer {
  text: string;
  value?: number; // e.g. 350
  effectiveFrom?: string; // e.g. "1/1"
  fieldUpdated?: keyof EmployeeProfile | 'participation';
  deliveredAt?: number; // set when the employee chat has shown this answer
}

export interface SupportTicket {
  id: string;
  sessionId: string;
  question: string;
  summary: string;
  status: 'open' | 'answered' | 'closed';
  profile: EmployeeProfile;
  lastComparison?: ComparisonResult;
  transcript: ChatMessage[];
  answer?: TicketAnswer;
  createdAt: number;
  answeredAt?: number;
}

export interface ExtractedField<T = any> {
  value: T | null;
  confidence: 'high' | 'medium' | 'low';
  sourceQuote: string;
}

export interface ExtractedPayslipData {
  occupation: ExtractedField<string>;
  base: ExtractedField<number>;
  commissions: ExtractedField<number>;
  bonus: ExtractedField<number>;
  pensionPct: ExtractedField<number>;
  studyFundPct: ExtractedField<number>;
  creditPoints: ExtractedField<number>;
  currentCar: ExtractedField<string>;
  carParticipation: ExtractedField<number>;
  maintenance: ExtractedField<number>;
  childrenUpTo23: ExtractedField<number>;
}

/** What the employee screen needs about its conversation (server-only fields are left out) */
export interface SessionState {
  id: string;
  profile: EmployeeProfile;
  messages: ChatMessage[];
  lastComparison: ComparisonResult | null;
}

/** One line of the streamed reply of POST /api/sessions/:id/messages (NDJSON) */
export type ChatStreamEvent =
  | { type: 'status'; text: string }
  | { type: 'throttled'; on: boolean; text?: string }
  | { type: 'result'; session: SessionState }
  | { type: 'error'; message: string };

/** Sample employee as listed in the employee screen picker */
export interface SampleEmployee {
  id: string;
  name: string;
  occupation: string;
  group: EligibilityGroup;
}

/** Everything the admin screen shows */
export interface AdminOverview {
  rules: Rules;
  catalog: Car[];
  occupations: Occupation[];
  employees: EmployeeProfile[];
  taxRecordCount: number;
  storage: 'supabase' | 'file';
  /** Where each table comes from: the built-in file or an admin upload */
  sources: Record<'rules' | DataTableKind, 'default' | 'uploaded'>;
}

/** Tables the admin replaces by uploading the data workbook */
export type DataTableKind = 'catalog' | 'occupations' | 'employees';

export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

export interface TableDiff {
  /** Row names (e.g. "CAR-21 · BYD SEAL") */
  added: string[];
  removed: string[];
  changed: Array<{ row: string; changes: FieldChange[] }>;
  unchanged: number;
}

/** One sheet of an uploaded workbook, checked and compared with the active data (nothing saved yet) */
export interface DataTablePreview {
  kind: DataTableKind;
  sheet: string;
  count: number;
  previousCount: number;
  errors: string[];
  warnings: string[];
  diff: TableDiff;
}

export interface DataFilePreview {
  tables: DataTablePreview[];
  /** False when a sheet has errors or the file has none of the known sheets */
  canApply: boolean;
}

/** An uploaded rules file compared with the active rules (nothing saved yet) */
export interface RulesPreview {
  version: string;
  previousVersion: string;
  changes: FieldChange[];
  errors: string[];
}

/** Who may use what: employee chat, rep tickets, admin data */
export type UserRole = 'employee' | 'rep' | 'admin';

/** The logged-in user as the client sees it (from GET /api/auth/me) */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

/** GET /api/auth/me: enabled = false when the server has no login (development without Supabase) */
export interface AuthStatus {
  enabled: boolean;
  user: AuthUser | null;
}
