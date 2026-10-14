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
