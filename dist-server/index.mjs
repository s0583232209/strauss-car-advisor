process.env.NODE_ENV='production';

// server/index.ts
import dotenv from "dotenv";
import express4 from "express";
import path3 from "node:path";

// server/api/app.ts
import express3, { Router as Router6 } from "express";

// server/data/strauss-rules.json
var strauss_rules_default = {
  version: "mock-2026-10-12",
  budgets: { \u05D0: 3500, \u05D1: 3700, \u05D2: 4500, \u05D3: 5200 },
  groupOrder: ["\u05D0", "\u05D1", "\u05D2", "\u05D3"],
  chooseFrom: "own_group_or_lower",
  electric: { netBonus: 250, method: "gross_up" },
  familyTrack: { minChildren: 4, childMaxAge: 23, carPrice: 6e3, gapSplitEmployee: 0.5 },
  waiver: { allowedBy: "occupation", maintenanceIsTaxable: true, maintenanceIsPensionable: false },
  unusedBudget: "not_paid",
  netMethod: {
    basis: "monthly",
    taxYear: 2025,
    creditPointValue: 242,
    brackets: [
      [7010, 0.1],
      [10060, 0.14],
      [16150, 0.2],
      [22440, 0.31],
      [46690, 0.35],
      [60130, 0.47],
      [null, 0.5]
    ],
    nationalInsurance: {
      threshold: 7522,
      ceiling: 50695,
      lowRate: 0.0104,
      highRate: 0.07
    },
    health: {
      threshold: 7522,
      ceiling: 50695,
      lowRate: 0.0323,
      highRate: 0.0517
    },
    pensionCredit: {
      rate: 0.35,
      incomeCeiling: 9500
    }
  },
  valueOfUse: {
    source: "\u05E8\u05E9\u05D5\u05EA \u05D4\u05DE\u05E1\u05D9\u05DD - \u05D4\u05E7\u05D5\u05D1\u05E5 \u05D4\u05DE\u05D5\u05E8\u05D7\u05D1 2026",
    key: ["\u05E9\u05E0\u05EA \u05DE\u05E1", "\u05E9\u05E0\u05EA \u05E8\u05D9\u05E9\u05D5\u05DD", "\u05E7\u05D5\u05D3 \u05E1\u05D5\u05D2 \u05E8\u05DB\u05D1", "\u05E7\u05D5\u05D3 \u05EA\u05D5\u05E6\u05E8", "\u05E7\u05D5\u05D3 \u05D3\u05D2\u05DD"],
    driveField: {
      "0": "\u05D1\u05E0\u05D6\u05D9\u05DF",
      "1": "\u05D4\u05D9\u05D1\u05E8\u05D9\u05D3\u05D9",
      "2": "\u05E4\u05DC\u05D0\u05D2-\u05D0\u05D9\u05DF",
      "3": "\u05D7\u05E9\u05DE\u05DC\u05D9"
    }
  }
};

// server/bl/engine/rules.ts
var activeRules = JSON.parse(JSON.stringify(strauss_rules_default));
function getRules() {
  return activeRules;
}
function setRules(newRules) {
  activeRules = JSON.parse(JSON.stringify(newRules));
}
function resetRules() {
  activeRules = JSON.parse(JSON.stringify(strauss_rules_default));
}
function getGroupBudget(group) {
  return activeRules.budgets[group] || 0;
}
function canSelectCarGroup(employeeGroup, carGroup) {
  if (carGroup === "\u05DE\u05E9\u05E4\u05D7\u05EA\u05D9") {
    return false;
  }
  const order = activeRules.groupOrder;
  const empIdx = order.indexOf(employeeGroup);
  const carIdx = order.indexOf(carGroup);
  if (empIdx === -1 || carIdx === -1) return false;
  return carIdx <= empIdx;
}

// server/bl/services/sessionService.ts
import { randomInt, randomUUID } from "node:crypto";

// server/data/catalog.json
var catalog_default = [
  {
    id: "CAR-01",
    group: "\u05D0",
    make: "\u05E7\u05D9\u05D4 \u05E7\u05D5\u05E8\u05D9\u05D0\u05D4",
    model: "PICANTO",
    productCode: "00885",
    modelCode: "00643",
    description: "B351A",
    year: 2025,
    fuel: "\u05D1\u05E0\u05D6\u05D9\u05DF",
    driveCode: 0,
    listPrice: 105900,
    benefit: 2690,
    companyCost: 2650,
    participation: 150
  },
  {
    id: "CAR-02",
    group: "\u05D0",
    make: "\u05D8\u05D5\u05D9\u05D5\u05D8\u05D4 \u05E6\u05E8\u05E4\u05EA",
    model: "YARIS CROSS HSD",
    productCode: "00672",
    modelCode: "00130",
    description: "MXPJ10L-BHXNBW",
    year: 2025,
    fuel: "\u05D4\u05D9\u05D1\u05E8\u05D9\u05D3\u05D9",
    driveCode: 1,
    listPrice: 154990,
    benefit: 3350,
    companyCost: 3400,
    participation: 200
  },
  {
    id: "CAR-03",
    group: "\u05D0",
    make: "\u05D1\u05D9 \u05D5\u05D5\u05D9 \u05D3\u05D9",
    model: "BYD DOLPHIN",
    productCode: "01014",
    modelCode: "00012",
    description: "EM2E-1",
    year: 2025,
    fuel: "\u05D7\u05E9\u05DE\u05DC\u05D9",
    driveCode: 3,
    listPrice: 150990,
    benefit: 2590,
    companyCost: 3300,
    participation: 200
  },
  {
    id: "CAR-04",
    group: "\u05D0",
    make: "\u05E1\u05D9\u05D0\u05D8 \u05E1\u05E4\u05E8\u05D3",
    model: "LEON",
    productCode: "00778",
    modelCode: "00618",
    description: "KL12TZ",
    year: 2025,
    fuel: "\u05D1\u05E0\u05D6\u05D9\u05DF",
    driveCode: 0,
    listPrice: 152900,
    benefit: 3880,
    companyCost: 3450,
    participation: 200
  },
  {
    id: "CAR-05",
    group: "\u05D1",
    make: "\u05E7\u05D9\u05D4 \u05E7\u05D5\u05E8\u05D9\u05D0\u05D4",
    model: "NIRO",
    productCode: "00885",
    modelCode: "00619",
    description: "CP81EG",
    year: 2025,
    fuel: "\u05D4\u05D9\u05D1\u05E8\u05D9\u05D3\u05D9",
    driveCode: 1,
    listPrice: 139e3,
    benefit: 2950,
    companyCost: 3600,
    participation: 250
  },
  {
    id: "CAR-06",
    group: "\u05D1",
    make: "\u05DE.\u05D2 \u05E1\u05D9\u05DF",
    model: "MG4",
    productCode: "00443",
    modelCode: "00032",
    description: "WH40",
    year: 2025,
    fuel: "\u05D7\u05E9\u05DE\u05DC\u05D9",
    driveCode: 3,
    listPrice: 15e4,
    benefit: 2430,
    companyCost: 3550,
    participation: 250
  },
  {
    id: "CAR-07",
    group: "\u05D1",
    make: "\u05D8\u05D5\u05D9\u05D5\u05D8\u05D4 \u05D8\u05D5\u05E8\u05E7\u05D9\u05D4",
    model: "COROLLA",
    productCode: "00839",
    modelCode: "00295",
    description: "MZEA11L-DEXNBW",
    year: 2026,
    fuel: "\u05D1\u05E0\u05D6\u05D9\u05DF",
    driveCode: 0,
    listPrice: 165990,
    benefit: 4120,
    companyCost: 3700,
    participation: 250
  },
  {
    id: "CAR-08",
    group: "\u05D1",
    make: "\u05D9\u05D5\u05E0\u05D3\u05D0\u05D9 \u05E6'\u05DB\u05D9\u05D4",
    model: "KONA EV",
    productCode: "00253",
    modelCode: "00138",
    description: "H781A",
    year: 2026,
    fuel: "\u05D7\u05E9\u05DE\u05DC\u05D9",
    driveCode: 3,
    listPrice: 174990,
    benefit: 2960,
    companyCost: 3650,
    participation: 250
  },
  {
    id: "CAR-09",
    group: "\u05D2",
    make: "\u05D8\u05D5\u05D9\u05D5\u05D8\u05D4 \u05D9\u05E4\u05DF",
    model: "COROLLA CROSS",
    productCode: "00413",
    modelCode: "00296",
    description: "ZVG12L-KHXGBW",
    year: 2025,
    fuel: "\u05D4\u05D9\u05D1\u05E8\u05D9\u05D3\u05D9",
    driveCode: 1,
    listPrice: 182990,
    benefit: 4070,
    companyCost: 4300,
    participation: 300
  },
  {
    id: "CAR-10",
    group: "\u05D2",
    make: "\u05D1\u05D9 \u05D5\u05D5\u05D9 \u05D3\u05D9",
    model: "ATTO 3",
    productCode: "01014",
    modelCode: "00003",
    description: "SC2E-SC2E01",
    year: 2025,
    fuel: "\u05D7\u05E9\u05DE\u05DC\u05D9",
    driveCode: 3,
    listPrice: 177500,
    benefit: 3130,
    companyCost: 4100,
    participation: 300
  },
  {
    id: "CAR-11",
    group: "\u05D2",
    make: "\u05E7\u05D9\u05D4 \u05E7\u05D5\u05E8\u05D9\u05D0\u05D4",
    model: "EV3",
    productCode: "00885",
    modelCode: "00675",
    description: "FC81B",
    year: 2025,
    fuel: "\u05D7\u05E9\u05DE\u05DC\u05D9",
    driveCode: 3,
    listPrice: 169900,
    benefit: 2930,
    companyCost: 4350,
    participation: 300
  },
  {
    id: "CAR-12",
    group: "\u05D2",
    make: "\u05D9\u05D5\u05E0\u05D3\u05D0\u05D9 \u05E6'\u05DB\u05D9\u05D4",
    model: "TUCSON",
    productCode: "00253",
    modelCode: "00133",
    description: "JB81B",
    year: 2025,
    fuel: "\u05D1\u05E0\u05D6\u05D9\u05DF",
    driveCode: 0,
    listPrice: 188497,
    benefit: 4790,
    companyCost: 4450,
    participation: 400
  },
  {
    id: "CAR-13",
    group: "\u05D2",
    make: "\u05DE\u05D6\u05D3\u05D4 \u05D9\u05E4\u05DF",
    model: "MAZDA 3",
    productCode: "00588",
    modelCode: "00446",
    description: "BP",
    year: 2025,
    fuel: "\u05D1\u05E0\u05D6\u05D9\u05DF",
    driveCode: 0,
    listPrice: 179900,
    benefit: 4570,
    companyCost: 4200,
    participation: 350
  },
  {
    id: "CAR-14",
    group: "\u05D3",
    make: "\u05D8\u05E1\u05DC\u05D4 \u05E1\u05D9\u05DF",
    model: "MODEL 3",
    productCode: "01327",
    modelCode: "00730",
    description: "3E7F",
    year: 2025,
    fuel: "\u05D7\u05E9\u05DE\u05DC\u05D9",
    driveCode: 3,
    listPrice: 217813,
    benefit: 4150,
    companyCost: 5100,
    participation: 500
  },
  {
    id: "CAR-15",
    group: "\u05D3",
    make: "\u05E1\u05E7\u05D5\u05D3\u05D4 \u05E6'\u05DB\u05D9\u05D4",
    model: "OCTAVIA",
    productCode: "00676",
    modelCode: "01455",
    description: "NX-NX337D",
    year: 2025,
    fuel: "\u05D1\u05E0\u05D6\u05D9\u05DF",
    driveCode: 0,
    listPrice: 202690,
    benefit: 5150,
    companyCost: 5e3,
    participation: 500
  },
  {
    id: "CAR-16",
    group: "\u05D3",
    make: "\u05E7\u05D9\u05D4 \u05E1\u05DC\u05D5\u05D1\u05E7\u05D9\u05D4",
    model: "SPORTAGE HEV",
    productCode: "00416",
    modelCode: "00294",
    description: "PV81G",
    year: 2026,
    fuel: "\u05E4\u05DC\u05D0\u05D2-\u05D0\u05D9\u05DF",
    driveCode: 2,
    listPrice: 229900,
    benefit: 4550,
    companyCost: 5150,
    participation: 500
  },
  {
    id: "CAR-17",
    group: "\u05D3",
    make: "\u05D1\u05D9 \u05D5\u05D5\u05D9 \u05D3\u05D9",
    model: "SEAL",
    productCode: "01014",
    modelCode: "00014",
    description: "H6CD",
    year: 2025,
    fuel: "\u05D7\u05E9\u05DE\u05DC\u05D9",
    driveCode: 3,
    listPrice: 25e4,
    benefit: 4970,
    companyCost: 5200,
    participation: 500
  },
  {
    id: "CAR-18",
    group: "\u05D3",
    make: "\u05D8\u05D5\u05D9\u05D5\u05D8\u05D4 \u05D9\u05E4\u05DF",
    model: "RAV4",
    productCode: "00413",
    modelCode: "00368",
    description: "AXAL52L-ANXXBW",
    year: 2025,
    fuel: "\u05D4\u05D9\u05D1\u05E8\u05D9\u05D3\u05D9",
    driveCode: 1,
    listPrice: 199e3,
    benefit: 4470,
    companyCost: 5200,
    participation: 500
  },
  {
    id: "CAR-19",
    group: "\u05DE\u05E9\u05E4\u05D7\u05EA\u05D9",
    make: "\u05E7\u05D9\u05D4 \u05E7\u05D5\u05E8\u05D9\u05D0\u05D4",
    model: "CARNIVAL",
    productCode: "00885",
    modelCode: "00648",
    description: "NG5K3",
    year: 2025,
    fuel: "\u05D1\u05E0\u05D6\u05D9\u05DF",
    driveCode: 0,
    listPrice: 319900,
    benefit: 8120,
    companyCost: 6e3,
    participation: 500
  },
  {
    id: "CAR-20",
    group: "\u05DE\u05E9\u05E4\u05D7\u05EA\u05D9",
    make: "\u05D9\u05D5\u05E0\u05D3\u05D0\u05D9 \u05E7\u05D5\u05E8\u05D9\u05D0\u05D4",
    model: "SANTA FE",
    productCode: "00481",
    modelCode: "00533",
    description: "P2DG1",
    year: 2025,
    fuel: "\u05D1\u05E0\u05D6\u05D9\u05DF",
    driveCode: 0,
    listPrice: 185e3,
    benefit: 4700,
    companyCost: 5600,
    participation: 500
  }
];

// server/data/employees.json
var employees_default = [
  {
    id: "E-001",
    name: "\u05E0\u05D5\u05E2\u05D4 \u05DC\u05D5\u05D9",
    occupation: "\u05DE\u05E0\u05D4\u05DC/\u05EA \u05DE\u05D5\u05E6\u05E8",
    group: "\u05D2",
    base: 18500,
    commissions: 0,
    bonus: 0,
    pensionPct: 6,
    studyFundPct: 2.5,
    creditPoints: 2.75,
    childrenUpTo23: 2,
    hasCar: true,
    currentCarId: "CAR-09",
    currentCarName: "COROLLA CROSS",
    currentParticipation: 300,
    currentBenefit: 4070,
    currentMaintenance: 0
  },
  {
    id: "E-002",
    name: "\u05D3\u05D5\u05D3 \u05DB\u05D4\u05DF",
    occupation: "\u05E0\u05E6\u05D9\u05D2/\u05EA \u05DE\u05DB\u05D9\u05E8\u05D5\u05EA \u05E9\u05D8\u05D7",
    group: "\u05D1",
    base: 9800,
    commissions: 2400,
    bonus: 0,
    pensionPct: 6,
    studyFundPct: 0,
    creditPoints: 2.25,
    childrenUpTo23: 5,
    hasCar: true,
    currentCarId: "CAR-05",
    currentCarName: "NIRO",
    currentParticipation: 250,
    currentBenefit: 2950,
    currentMaintenance: 0
  },
  {
    id: "E-003",
    name: "\u05E8\u05D7\u05DC \u05E4\u05E8\u05D9\u05D3\u05DE\u05DF",
    occupation: "\u05DE\u05E4\u05EA\u05D7/\u05EA \u05EA\u05D5\u05DB\u05E0\u05D4",
    group: "\u05D1",
    base: 21e3,
    commissions: 0,
    bonus: 0,
    pensionPct: 6.5,
    studyFundPct: 2.5,
    creditPoints: 2.75,
    childrenUpTo23: 0,
    hasCar: false,
    currentCarId: null,
    currentCarName: "\u05DC\u05DC\u05D0 \u05E8\u05DB\u05D1 (\u05D5\u05D9\u05EA\u05D5\u05E8)",
    currentParticipation: 0,
    currentBenefit: 0,
    currentMaintenance: 1500
  },
  {
    id: "E-004",
    name: "\u05D9\u05D5\u05E1\u05D9 \u05DE\u05D6\u05E8\u05D7\u05D9",
    occupation: "\u05DE\u05E0\u05D4\u05DC/\u05EA \u05D0\u05D6\u05D5\u05E8 \u05DE\u05DB\u05D9\u05E8\u05D5\u05EA",
    group: "\u05D2",
    base: 16e3,
    commissions: 3e3,
    bonus: 0,
    pensionPct: 6,
    studyFundPct: 2.5,
    creditPoints: 2.25,
    childrenUpTo23: 3,
    hasCar: true,
    currentCarId: "CAR-12",
    currentCarName: "TUCSON",
    currentParticipation: 400,
    currentBenefit: 4790,
    currentMaintenance: 0
  },
  {
    id: "E-005",
    name: "\u05DE\u05D9\u05DB\u05DC \u05D0\u05D1\u05E8\u05D4\u05DD",
    occupation: "\u05DE\u05E0\u05D4\u05DC/\u05EA \u05E4\u05D9\u05EA\u05D5\u05D7",
    group: "\u05D2",
    base: 27e3,
    commissions: 0,
    bonus: 0,
    pensionPct: 7,
    studyFundPct: 2.5,
    creditPoints: 2.75,
    childrenUpTo23: 1,
    hasCar: true,
    currentCarId: "CAR-13",
    currentCarName: "MAZDA 3",
    currentParticipation: 350,
    currentBenefit: 4570,
    currentMaintenance: 0
  },
  {
    id: "E-006",
    name: "\u05D0\u05DC\u05D9 \u05E9\u05DE\u05E2\u05D5\u05DF",
    occupation: "\u05DE\u05E0\u05D4\u05DC/\u05EA \u05DE\u05D7\u05DC\u05E7\u05D4",
    group: "\u05D3",
    base: 32e3,
    commissions: 0,
    bonus: 2e3,
    pensionPct: 6,
    studyFundPct: 2.5,
    creditPoints: 2.25,
    childrenUpTo23: 4,
    hasCar: true,
    currentCarId: "CAR-15",
    currentCarName: "OCTAVIA",
    currentParticipation: 500,
    currentBenefit: 5150,
    currentMaintenance: 0
  },
  {
    id: "E-GEN-B",
    name: "\u05E9\u05D9\u05E8\u05D4 (\u05DE\u05D4\u05E0\u05D3\u05E1\u05EA \u05EA\u05D4\u05DC\u05D9\u05DA - \u05E7\u05D1\u05D5\u05E6\u05D4 \u05D1')",
    occupation: "\u05DE\u05D4\u05E0\u05D3\u05E1/\u05EA \u05EA\u05D4\u05DC\u05D9\u05DA",
    group: "\u05D1",
    base: 15e3,
    commissions: 0,
    bonus: 0,
    pensionPct: 6,
    studyFundPct: 2.5,
    creditPoints: 2.25,
    childrenUpTo23: 0,
    hasCar: true,
    currentCarId: "CAR-05",
    currentCarName: "NIRO",
    currentParticipation: 250,
    currentBenefit: 2950,
    currentMaintenance: 0
  }
];

// server/data/occupations.json
var occupations_default = [
  {
    occupation: "\u05E0\u05E6\u05D9\u05D2/\u05EA \u05DE\u05DB\u05D9\u05E8\u05D5\u05EA \u05E9\u05D8\u05D7",
    group: "\u05D1",
    carMandatory: true,
    canWaive: false,
    maintenance: 0
  },
  {
    occupation: "\u05DE\u05E0\u05D4\u05DC/\u05EA \u05D0\u05D6\u05D5\u05E8 \u05DE\u05DB\u05D9\u05E8\u05D5\u05EA",
    group: "\u05D2",
    carMandatory: true,
    canWaive: false,
    maintenance: 0
  },
  {
    occupation: "\u05D8\u05DB\u05E0\u05D0\u05D9/\u05EA \u05E9\u05D9\u05E8\u05D5\u05EA",
    group: "\u05D0",
    carMandatory: true,
    canWaive: false,
    maintenance: 0
  },
  {
    occupation: "\u05E0\u05D4\u05D2/\u05EA \u05D4\u05E4\u05E6\u05D4",
    group: "\u05D0",
    carMandatory: true,
    canWaive: false,
    maintenance: 0
  },
  {
    occupation: "\u05DE\u05E4\u05E7\u05D7/\u05EA \u05D0\u05D9\u05DB\u05D5\u05EA \u05D1\u05DE\u05E4\u05E2\u05DC",
    group: "\u05D0",
    carMandatory: false,
    canWaive: true,
    maintenance: 1200
  },
  {
    occupation: "\u05E8\u05DB\u05D6/\u05EA \u05E8\u05DB\u05E9",
    group: "\u05D0",
    carMandatory: false,
    canWaive: true,
    maintenance: 1200
  },
  {
    occupation: "\u05DE\u05D4\u05E0\u05D3\u05E1/\u05EA \u05EA\u05D4\u05DC\u05D9\u05DA",
    group: "\u05D1",
    carMandatory: false,
    canWaive: true,
    maintenance: 1500
  },
  {
    occupation: "\u05DE\u05E4\u05EA\u05D7/\u05EA \u05EA\u05D5\u05DB\u05E0\u05D4",
    group: "\u05D1",
    carMandatory: false,
    canWaive: true,
    maintenance: 1500
  },
  {
    occupation: "\u05D0\u05E0\u05DC\u05D9\u05E1\u05D8/\u05D9\u05EA \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD",
    group: "\u05D1",
    carMandatory: false,
    canWaive: true,
    maintenance: 1500
  },
  {
    occupation: "\u05DE\u05E0\u05D4\u05DC/\u05EA \u05DE\u05D5\u05E6\u05E8",
    group: "\u05D2",
    carMandatory: false,
    canWaive: true,
    maintenance: 2e3
  },
  {
    occupation: "\u05DE\u05E0\u05D4\u05DC/\u05EA \u05E4\u05D9\u05EA\u05D5\u05D7",
    group: "\u05D2",
    carMandatory: false,
    canWaive: true,
    maintenance: 2e3
  },
  {
    occupation: "\u05DE\u05E0\u05D4\u05DC/\u05EA \u05DE\u05E9\u05D0\u05D1\u05D9 \u05D0\u05E0\u05D5\u05E9",
    group: "\u05D2",
    carMandatory: false,
    canWaive: true,
    maintenance: 2e3
  },
  {
    occupation: "\u05DE\u05E0\u05D4\u05DC/\u05EA \u05DE\u05D7\u05DC\u05E7\u05D4",
    group: "\u05D3",
    carMandatory: false,
    canWaive: true,
    maintenance: 2600
  },
  {
    occupation: "\u05DE\u05E0\u05D4\u05DC/\u05EA \u05D7\u05D8\u05D9\u05D1\u05D4",
    group: "\u05D3",
    carMandatory: false,
    canWaive: true,
    maintenance: 3e3
  }
];

// server/bl/engine/referenceData.ts
var REFERENCE_KINDS = ["catalog", "occupations", "employees"];
var clone = (v) => JSON.parse(JSON.stringify(v));
var defaults = {
  catalog: catalog_default,
  occupations: occupations_default,
  employees: employees_default
};
var active = clone(defaults);
var version = 0;
var getCatalog = () => active.catalog;
var getOccupations = () => active.occupations;
var getEmployees = () => active.employees;
var referenceVersion = () => version;
function setReferenceData(kind, rows) {
  active[kind] = clone(rows);
  version++;
}
function resetReferenceData(kind) {
  setReferenceData(kind, defaults[kind]);
}

// server/bl/agent/profileStatus.ts
var UNKNOWN_CAR_NAME = "\u05E8\u05DB\u05D1 \u05D7\u05D1\u05E8\u05D4 \u05E0\u05D5\u05DB\u05D7\u05D9";
function getProfileFieldStatus(profile) {
  const num = (v) => typeof v === "number" && Number.isFinite(v);
  const str = (v) => typeof v === "string" && v.trim() !== "";
  const fields = [
    { field: "base", label_he: "\u05E9\u05DB\u05E8 \u05D1\u05E1\u05D9\u05E1 \u05D7\u05D5\u05D3\u05E9\u05D9", known: num(profile.base) && profile.base > 0, value: String(profile.base) },
    { field: "group", label_he: "\u05E7\u05D1\u05D5\u05E6\u05EA \u05D6\u05DB\u05D0\u05D5\u05EA", known: str(profile.group), value: profile.group },
    { field: "occupation", label_he: "\u05E2\u05D9\u05E1\u05D5\u05E7/\u05EA\u05E4\u05E7\u05D9\u05D3", known: str(profile.occupation), value: profile.occupation },
    { field: "hasCar", label_he: "\u05E8\u05DB\u05D1 \u05D7\u05D1\u05E8\u05D4 \u05DB\u05D9\u05D5\u05DD", known: typeof profile.hasCar === "boolean", value: profile.hasCar ? "\u05DB\u05DF" : "\u05DC\u05D0" },
    { field: "commissions", label_he: "\u05E2\u05DE\u05DC\u05D5\u05EA", known: num(profile.commissions), value: String(profile.commissions) },
    { field: "bonus", label_he: "\u05D1\u05D5\u05E0\u05D5\u05E1", known: num(profile.bonus), value: String(profile.bonus) },
    { field: "pensionPct", label_he: "\u05D0\u05D7\u05D5\u05D6 \u05D4\u05E4\u05E8\u05E9\u05D4 \u05DC\u05E4\u05E0\u05E1\u05D9\u05D4", known: num(profile.pensionPct), value: String(profile.pensionPct) },
    { field: "studyFundPct", label_he: "\u05D0\u05D7\u05D5\u05D6 \u05D4\u05E4\u05E8\u05E9\u05D4 \u05DC\u05E7\u05E8\u05DF \u05D4\u05E9\u05EA\u05DC\u05DE\u05D5\u05EA", known: num(profile.studyFundPct), value: String(profile.studyFundPct) },
    { field: "creditPoints", label_he: "\u05E0\u05E7\u05D5\u05D3\u05D5\u05EA \u05D6\u05D9\u05DB\u05D5\u05D9", known: num(profile.creditPoints), value: String(profile.creditPoints) },
    { field: "childrenUpTo23", label_he: "\u05DE\u05E1\u05E4\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD \u05E2\u05D3 \u05D2\u05D9\u05DC 23", known: num(profile.childrenUpTo23), value: String(profile.childrenUpTo23) }
  ];
  if (profile.hasCar) {
    fields.push(
      {
        field: "currentCarName",
        label_he: "\u05D3\u05D2\u05DD \u05E8\u05DB\u05D1 \u05E0\u05D5\u05DB\u05D7\u05D9",
        known: str(profile.currentCarName) && profile.currentCarName !== UNKNOWN_CAR_NAME,
        value: profile.currentCarName
      },
      { field: "currentBenefit", label_he: "\u05E9\u05D5\u05D5\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9 \u05E0\u05D5\u05DB\u05D7\u05D9", known: num(profile.currentBenefit) && profile.currentBenefit > 0, value: String(profile.currentBenefit) },
      { field: "currentParticipation", label_he: "\u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05E2\u05D5\u05D1\u05D3 \u05D1\u05E8\u05DB\u05D1 \u05D4\u05E0\u05D5\u05DB\u05D7\u05D9", known: num(profile.currentParticipation), value: String(profile.currentParticipation) }
    );
  } else {
    fields.push({ field: "currentMaintenance", label_he: "\u05D3\u05DE\u05D9 \u05D0\u05D7\u05D6\u05E7\u05EA \u05E8\u05DB\u05D1", known: num(profile.currentMaintenance), value: String(profile.currentMaintenance) });
  }
  return fields.map((f) => f.known ? f : { ...f, value: void 0 });
}
function describeProfileCard(profile) {
  const lines = getProfileFieldStatus(profile).map(
    (f) => f.known ? `- ${f.label_he} (${f.field}): \u2713 \u05E7\u05D9\u05D9\u05DD \u05D1\u05DB\u05E8\u05D8\u05D9\u05E1 = ${f.value}` : `- ${f.label_he} (${f.field}): \u2717 \u05D7\u05E1\u05E8`
  );
  return `\u05DB\u05E8\u05D8\u05D9\u05E1 \u05D4\u05E2\u05D5\u05D1\u05D3 \u05D4\u05E0\u05D5\u05DB\u05D7\u05D9 (\u05DE\u05EA\u05E2\u05D3\u05DB\u05DF \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05D0\u05D7\u05E8\u05D9 \u05DB\u05DC update_profile):
${lines.join("\n")}`;
}
function buildOpeningMessage(profile) {
  const intro = "\u05D4\u05D9\u05D9, \u05D0\u05E0\u05D9 \u05D9\u05D5\u05E2\u05E5 \u05D4\u05E8\u05DB\u05D1. \u05D0\u05E4\u05E9\u05E8 \u05DC\u05E9\u05D0\u05D5\u05DC \u05D0\u05D5\u05EA\u05D9 \u05DE\u05D4 \u05D9\u05E7\u05E8\u05D4 \u05DC\u05E0\u05D8\u05D5 \u05D0\u05DD \u05EA\u05E2\u05D1\u05E8\u05D5 \u05DC\u05E8\u05DB\u05D1 \u05D7\u05E9\u05DE\u05DC\u05D9, \u05EA\u05D7\u05DC\u05D9\u05E4\u05D5 \u05E8\u05DB\u05D1, \u05EA\u05D5\u05D5\u05EA\u05E8\u05D5 \u05E2\u05DC \u05D4\u05E8\u05DB\u05D1 \u05D0\u05D5 \u05EA\u05D1\u05D7\u05E8\u05D5 \u05D1\u05DE\u05E1\u05DC\u05D5\u05DC \u05D1\u05E8\u05D5\u05DB\u05EA \u05D9\u05DC\u05D3\u05D9\u05DD.";
  const status = getProfileFieldStatus(profile);
  const baseKnown = status.find((f) => f.field === "base")?.known;
  const groupKnown = status.find((f) => f.field === "group")?.known;
  if (baseKnown && groupKnown) return `${intro} \u05E4\u05E8\u05D8\u05D9 \u05D4\u05E9\u05DB\u05E8 \u05D5\u05E7\u05D1\u05D5\u05E6\u05EA \u05D4\u05D6\u05DB\u05D0\u05D5\u05EA \u05DB\u05D1\u05E8 \u05DE\u05D5\u05E4\u05D9\u05E2\u05D9\u05DD \u05D1\u05DB\u05E8\u05D8\u05D9\u05E1 \u05E9\u05DC\u05DA, \u05D0\u05D6 \u05D0\u05E4\u05E9\u05E8 \u05DC\u05E9\u05D0\u05D5\u05DC \u05D9\u05E9\u05E8.`;
  if (baseKnown) return `${intro} \u05E9\u05DB\u05E8 \u05D4\u05D1\u05E1\u05D9\u05E1 \u05DB\u05D1\u05E8 \u05D1\u05DB\u05E8\u05D8\u05D9\u05E1. \u05D1\u05D0\u05D9\u05D6\u05D5 \u05E7\u05D1\u05D5\u05E6\u05EA \u05D6\u05DB\u05D0\u05D5\u05EA (\u05D0\u2013\u05D3) \u05D0\u05EA\u05DD?`;
  if (groupKnown) return `${intro} \u05E7\u05D1\u05D5\u05E6\u05EA \u05D4\u05D6\u05DB\u05D0\u05D5\u05EA \u05DB\u05D1\u05E8 \u05D1\u05DB\u05E8\u05D8\u05D9\u05E1. \u05DE\u05D4 \u05E9\u05DB\u05E8 \u05D4\u05D1\u05E1\u05D9\u05E1 \u05D4\u05D7\u05D5\u05D3\u05E9\u05D9 \u05E9\u05DC\u05DB\u05DD?`;
  return `${intro} \u05E0\u05EA\u05D7\u05D9\u05DC \u05DE\u05D4\u05E9\u05DB\u05E8: \u05D1\u05D0\u05D9\u05D6\u05D5 \u05E7\u05D1\u05D5\u05E6\u05EA \u05D6\u05DB\u05D0\u05D5\u05EA (\u05D0\u2013\u05D3) \u05D0\u05EA\u05DD \u05D5\u05DE\u05D4 \u05E9\u05DB\u05E8 \u05D4\u05D1\u05E1\u05D9\u05E1 \u05D4\u05D7\u05D5\u05D3\u05E9\u05D9?`;
}

// server/data/occupation-aliases.json
var occupation_aliases_default = {
  "\u05E0\u05E6\u05D9\u05D2/\u05EA \u05DE\u05DB\u05D9\u05E8\u05D5\u05EA \u05E9\u05D8\u05D7": ["\u05E1\u05D5\u05DB\u05DF \u05DE\u05DB\u05D9\u05E8\u05D5\u05EA \u05E9\u05D8\u05D7", "\u05E1\u05D5\u05DB\u05E0\u05EA \u05DE\u05DB\u05D9\u05E8\u05D5\u05EA \u05E9\u05D8\u05D7", "\u05E1\u05D5\u05DB\u05DF \u05E9\u05D8\u05D7", "\u05E1\u05D5\u05DB\u05E0\u05EA \u05E9\u05D8\u05D7", "\u05E0\u05E6\u05D9\u05D2 \u05E9\u05D8\u05D7", "\u05E0\u05E6\u05D9\u05D2\u05EA \u05E9\u05D8\u05D7", "\u05D0\u05D9\u05E9 \u05DE\u05DB\u05D9\u05E8\u05D5\u05EA \u05E9\u05D8\u05D7", "\u05D0\u05E9\u05EA \u05DE\u05DB\u05D9\u05E8\u05D5\u05EA \u05E9\u05D8\u05D7"],
  "\u05D8\u05DB\u05E0\u05D0\u05D9/\u05EA \u05E9\u05D9\u05E8\u05D5\u05EA": ["\u05D8\u05DB\u05E0\u05D0\u05D9", "\u05D8\u05DB\u05E0\u05D0\u05D9\u05EA"],
  "\u05E0\u05D4\u05D2/\u05EA \u05D4\u05E4\u05E6\u05D4": ["\u05E0\u05D4\u05D2 \u05D7\u05DC\u05D5\u05E7\u05D4", "\u05E0\u05D4\u05D2\u05EA \u05D7\u05DC\u05D5\u05E7\u05D4"],
  "\u05DE\u05E4\u05EA\u05D7/\u05EA \u05EA\u05D5\u05DB\u05E0\u05D4": ["\u05DE\u05EA\u05DB\u05E0\u05EA", "\u05DE\u05EA\u05DB\u05E0\u05EA\u05EA", "\u05DE\u05E4\u05EA\u05D7", "\u05DE\u05E4\u05EA\u05D7\u05EA"],
  "\u05D0\u05E0\u05DC\u05D9\u05E1\u05D8/\u05D9\u05EA \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD": ["\u05D0\u05E0\u05DC\u05D9\u05E1\u05D8", "\u05D0\u05E0\u05DC\u05D9\u05E1\u05D8\u05D9\u05EA", "\u05D3\u05D0\u05D8\u05D4 \u05D0\u05E0\u05DC\u05D9\u05E1\u05D8", "\u05D3\u05D0\u05D8\u05D4 \u05D0\u05E0\u05DC\u05D9\u05E1\u05D8\u05D9\u05EA"],
  "\u05DE\u05E0\u05D4\u05DC/\u05EA \u05DE\u05E9\u05D0\u05D1\u05D9 \u05D0\u05E0\u05D5\u05E9": ["\u05DE\u05E0\u05D4\u05DC hr", "\u05DE\u05E0\u05D4\u05DC\u05EA hr", "\u05DE\u05E0\u05D4\u05DC \u05DB\u05D5\u05D7 \u05D0\u05D3\u05DD", "\u05DE\u05E0\u05D4\u05DC\u05EA \u05DB\u05D5\u05D7 \u05D0\u05D3\u05DD"]
};

// server/bl/engine/tax.ts
function calculateBracketTax(taxableBase) {
  if (taxableBase <= 0) return 0;
  const rules = getRules();
  const brackets = rules.netMethod.brackets;
  let totalTax = 0;
  let prevCeiling = 0;
  for (const [ceiling, rate] of brackets) {
    if (taxableBase <= prevCeiling) break;
    const currentLimit = ceiling === null ? Infinity : ceiling;
    const taxableInBracket = Math.min(taxableBase, currentLimit) - prevCeiling;
    if (taxableInBracket > 0) {
      totalTax += taxableInBracket * rate;
    }
    if (ceiling === null || taxableBase <= currentLimit) {
      break;
    }
    prevCeiling = ceiling;
  }
  return totalTax;
}
function calculatePensionCredit(pensionDeposit) {
  if (pensionDeposit <= 0) return 0;
  const rules = getRules();
  const cfg = rules.netMethod.pensionCredit;
  const maxDeposit = 0.07 * cfg.incomeCeiling;
  const eligibleDeposit = Math.min(pensionDeposit, maxDeposit);
  return cfg.rate * eligibleDeposit;
}
function calculateIncomeTax(taxableBase, pensionDeposit, creditPoints) {
  const rules = getRules();
  const bracketTax = calculateBracketTax(taxableBase);
  const pensionCredit = calculatePensionCredit(pensionDeposit);
  const creditPointDeduction = creditPoints * rules.netMethod.creditPointValue;
  const rawTax = bracketTax - creditPointDeduction - pensionCredit;
  const tax = Math.max(0, rawTax);
  return { bracketTax, pensionCredit, tax };
}
function calculateNationalInsuranceAndHealth(taxableBase) {
  if (taxableBase <= 0) return 0;
  const rules = getRules();
  const ni = rules.netMethod.nationalInsurance;
  const health = rules.netMethod.health;
  const lowRate = ni.lowRate + health.lowRate;
  const highRate = ni.highRate + health.highRate;
  const threshold = ni.threshold;
  const ceiling = ni.ceiling;
  const lowPortion = Math.min(taxableBase, threshold);
  const highPortion = Math.max(0, Math.min(taxableBase, ceiling) - threshold);
  return lowPortion * lowRate + highPortion * highRate;
}

// server/bl/engine/net.ts
function calculateNetBreakdown(state) {
  const pensionable = state.base + state.commissions + state.bonus;
  const pension = state.pensionPct / 100 * pensionable;
  const studyFund = state.studyFundPct / 100 * pensionable;
  const cash = pensionable + state.maintenance + state.evGrossUp;
  const taxableBase = cash + state.benefitValue;
  const { bracketTax, pensionCredit, tax } = calculateIncomeTax(
    taxableBase,
    pension,
    state.creditPoints
  );
  const niHealth = calculateNationalInsuranceAndHealth(taxableBase);
  const net = cash - tax - niHealth - pension - studyFund - state.participation - state.familyGapShare;
  return {
    pensionable,
    pension,
    studyFund,
    cash,
    taxableBase,
    bracketTax,
    pensionCredit,
    tax,
    niHealth,
    participation: state.participation,
    familyGapShare: state.familyGapShare,
    evGrossUp: state.evGrossUp,
    net
  };
}
function calculateEVGrossUp(stateWithoutEV, targetNetBonus = 250) {
  const rules = getRules();
  if (rules.electric.method === "gross_250") {
    return targetNetBonus;
  }
  const baseNet = calculateNetBreakdown({ ...stateWithoutEV, evGrossUp: 0 }).net;
  let low = 0;
  let high = 1500;
  let bestGross = 0;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    const testNet = calculateNetBreakdown({ ...stateWithoutEV, evGrossUp: mid }).net;
    const delta = testNet - baseNet;
    if (Math.abs(delta - targetNetBonus) < 5e-3) {
      bestGross = mid;
      break;
    }
    if (delta < targetNetBonus) {
      low = mid;
    } else {
      high = mid;
    }
    bestGross = mid;
  }
  const roundedGross = Math.round(bestGross);
  const roundedNetDelta = calculateNetBreakdown({ ...stateWithoutEV, evGrossUp: roundedGross }).net - baseNet;
  if (Math.abs(roundedNetDelta - targetNetBonus) <= 1) {
    return roundedGross;
  }
  return bestGross;
}

// server/bl/engine/explain.ts
function buildDeltaSteps(todayState, altState) {
  const steps = [];
  const s0 = { ...todayState };
  const net0 = calculateNetBreakdown(s0).net;
  const s1 = { ...s0, benefitValue: altState.benefitValue };
  const net1 = calculateNetBreakdown(s1).net;
  const d1 = net1 - net0;
  if (Math.abs(todayState.benefitValue - altState.benefitValue) > 1e-3 || Math.abs(d1) > 0.01) {
    steps.push({
      key: "benefit",
      label_he: "\u05E9\u05D9\u05E0\u05D5\u05D9 \u05E9\u05D5\u05D5\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9",
      deltaNet: d1,
      explanation_he: `\u05E9\u05D5\u05D5\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9 ${Math.round(todayState.benefitValue).toLocaleString()} \u20AA \u2190 ${Math.round(altState.benefitValue).toLocaleString()} \u20AA (\u05DE\u05E9\u05E4\u05D9\u05E2 \u05E2\u05DC \u05DE\u05E1 \u05D4\u05DB\u05E0\u05E1\u05D4, \u05D1\u05D9\u05D8\u05D5\u05D7 \u05DC\u05D0\u05D5\u05DE\u05D9 \u05D5\u05DE\u05E1 \u05D1\u05E8\u05D9\u05D0\u05D5\u05EA)`
    });
  }
  const s2 = { ...s1, maintenance: altState.maintenance };
  const net2 = calculateNetBreakdown(s2).net;
  const d2 = net2 - net1;
  if (Math.abs(todayState.maintenance - altState.maintenance) > 1e-3 || Math.abs(d2) > 0.01) {
    steps.push({
      key: "maintenance",
      label_he: "\u05E9\u05D9\u05E0\u05D5\u05D9 \u05D3\u05DE\u05D9 \u05D0\u05D7\u05D6\u05E7\u05D4",
      deltaNet: d2,
      explanation_he: `\u05D3\u05DE\u05D9 \u05D0\u05D7\u05D6\u05E7\u05D4 ${Math.round(todayState.maintenance).toLocaleString()} \u20AA \u2190 ${Math.round(altState.maintenance).toLocaleString()} \u20AA (\u05EA\u05D5\u05E1\u05E4\u05EA \u05DC\u05D1\u05E8\u05D5\u05D8\u05D5 \u05D4\u05D7\u05D9\u05D9\u05D1 \u05D1\u05DE\u05E1, \u05DC\u05DC\u05D0 \u05D4\u05E4\u05E8\u05E9\u05D5\u05EA \u05E4\u05E0\u05E1\u05D9\u05D5\u05E0\u05D9\u05D5\u05EA)`
    });
  }
  const s3 = { ...s2, participation: altState.participation };
  const net3 = calculateNetBreakdown(s3).net;
  const d3 = net3 - net2;
  if (Math.abs(todayState.participation - altState.participation) > 1e-3 || Math.abs(d3) > 0.01) {
    steps.push({
      key: "participation",
      label_he: "\u05E9\u05D9\u05E0\u05D5\u05D9 \u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05E2\u05D5\u05D1\u05D3",
      deltaNet: d3,
      explanation_he: `\u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05E2\u05E6\u05DE\u05D9\u05EA ${Math.round(todayState.participation).toLocaleString()} \u20AA \u2190 ${Math.round(altState.participation).toLocaleString()} \u20AA (\u05E0\u05D9\u05DB\u05D5\u05D9 \u05D9\u05E9\u05D9\u05E8 \u05DE\u05E9\u05DB\u05E8 \u05D4\u05E0\u05D8\u05D5)`
    });
  }
  const s4 = { ...s3, familyGapShare: altState.familyGapShare };
  const net4 = calculateNetBreakdown(s4).net;
  const d4 = net4 - net3;
  if (Math.abs(todayState.familyGapShare - altState.familyGapShare) > 1e-3 || Math.abs(d4) > 0.01) {
    steps.push({
      key: "familyGap",
      label_he: "\u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05D1\u05E4\u05E2\u05E8 \u05EA\u05E7\u05E6\u05D9\u05D1 \u05DE\u05E9\u05E4\u05D7\u05EA\u05D9",
      deltaNet: d4,
      explanation_he: `\u05D7\u05DC\u05E7 \u05D4\u05E2\u05D5\u05D1\u05D3 (50%) \u05D1\u05E4\u05E2\u05E8 \u05E9\u05DE\u05E2\u05DC \u05EA\u05E7\u05E6\u05D9\u05D1 \u05D4\u05E7\u05D1\u05D5\u05E6\u05D4 \u05E2\u05D1\u05D5\u05E8 \u05E8\u05DB\u05D1 7-8 \u05DE\u05E7\u05D5\u05DE\u05D5\u05EA (${Math.round(altState.familyGapShare).toLocaleString()} \u20AA)`
    });
  }
  const s5 = { ...s4, evGrossUp: altState.evGrossUp };
  const net5 = calculateNetBreakdown(s5).net;
  const d5 = net5 - net4;
  if (Math.abs(todayState.evGrossUp - altState.evGrossUp) > 1e-3 || Math.abs(d5) > 0.01) {
    steps.push({
      key: "evGrossUp",
      label_he: "\u05D4\u05D7\u05D6\u05E8 \u05D8\u05E2\u05D9\u05E0\u05D4 \u05D7\u05E9\u05DE\u05DC\u05D9\u05EA",
      deltaNet: d5,
      explanation_he: `\u05EA\u05D5\u05E1\u05E4\u05EA \u05E0\u05D8\u05D5 \u05E9\u05DC +250 \u20AA \u05D1\u05D2\u05D9\u05DF \u05D4\u05D7\u05D6\u05E8 \u05D8\u05E2\u05D9\u05E0\u05D4 \u05D7\u05E9\u05DE\u05DC\u05D9\u05EA (\u05DE\u05D2\u05D5\u05DC\u05DD \u05D1\u05E9\u05DB\u05E8 \u05D4\u05D1\u05E8\u05D5\u05D8\u05D5 \u05D1-${Math.round(altState.evGrossUp).toLocaleString()} \u20AA)`
    });
  }
  const exactDiff = net5 - net0;
  const sumSteps = steps.reduce((acc, step) => acc + step.deltaNet, 0);
  return { steps, sumSteps, exactDiff };
}
function roundStepsToTotal(steps, totalRounded) {
  if (steps.length === 0) {
    if (totalRounded !== 0) {
      throw new Error(`roundStepsToTotal: no steps but the displayed difference is ${totalRounded}`);
    }
    return [];
  }
  const rounded = steps.map((s) => ({ ...s, deltaNetRounded: Math.round(s.deltaNet) }));
  const leftover = totalRounded - rounded.reduce((acc, s) => acc + s.deltaNetRounded, 0);
  if (leftover !== 0) {
    let largest = 0;
    for (let i = 1; i < steps.length; i++) {
      if (Math.abs(steps[i].deltaNet) > Math.abs(steps[largest].deltaNet)) largest = i;
    }
    rounded[largest].deltaNetRounded += leftover;
  }
  for (const s of rounded) s.deltaNetRounded = s.deltaNetRounded + 0;
  return rounded;
}
function buildPlainHebrewSummary(todayState, altState, todayLabel, altLabel) {
  const parts = [];
  if (Math.abs(todayState.benefitValue - altState.benefitValue) > 0) {
    parts.push(
      `\u05E9\u05D5\u05D5\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9 ${Math.round(todayState.benefitValue).toLocaleString()} \u2190 ${Math.round(altState.benefitValue).toLocaleString()} \u20AA`
    );
  }
  if (altState.evGrossUp > 0) {
    parts.push(`+250 \u20AA \u05E0\u05D8\u05D5 \u05D4\u05D7\u05D6\u05E8 \u05D7\u05E9\u05DE\u05DC (\u05DE\u05D2\u05D5\u05DC\u05DD)`);
  }
  if (Math.abs(todayState.participation - altState.participation) > 0) {
    parts.push(
      `\u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA ${Math.round(todayState.participation).toLocaleString()} \u2190 ${Math.round(altState.participation).toLocaleString()} \u20AA`
    );
  }
  if (altState.familyGapShare > 0) {
    parts.push(`\u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05D1\u05E4\u05E2\u05E8 \u05E8\u05DB\u05D1 \u05DE\u05E9\u05E4\u05D7\u05EA\u05D9 ${Math.round(altState.familyGapShare).toLocaleString()} \u20AA`);
  }
  if (altState.maintenance > 0 || todayState.maintenance > 0) {
    parts.push(
      `\u05D0\u05D7\u05D6\u05E7\u05EA \u05E8\u05DB\u05D1 ${Math.round(todayState.maintenance).toLocaleString()} \u2190 ${Math.round(altState.maintenance).toLocaleString()} \u20AA`
    );
  }
  const line1 = `${todayLabel} \u2190 ${altLabel}`;
  const line2 = parts.join(" \xB7 ") || "\u05DC\u05DC\u05D0 \u05E9\u05D9\u05E0\u05D5\u05D9 \u05D1\u05E8\u05DB\u05D9\u05D1\u05D9 \u05D4\u05E8\u05DB\u05D1";
  return [line1, line2];
}

// server/bl/engine/scenario.ts
var normOccupation = (s) => s.replace(/\/(ית|ת|ה)(?=\s|$)/g, "").replace(/["'׳״]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
var occupationIndex = null;
function index() {
  if (occupationIndex?.version === referenceVersion()) return occupationIndex;
  const list2 = getOccupations();
  const words = new Set(list2.flatMap((o) => normOccupation(o.occupation).split(" ")));
  occupationIndex = { version: referenceVersion(), words, names: [] };
  occupationIndex.names = list2.flatMap((o) => [o.occupation, ...occupation_aliases_default[o.occupation] ?? []].map((n) => ({ key: occupationKey(n), occ: o }))).sort((a, b) => b.key.length - a.key.length);
  return occupationIndex;
}
function baseWord(w) {
  const occupationWords = index().words;
  if (occupationWords.has(w)) return w;
  for (const suffix of ["\u05D9\u05EA", "\u05EA", "\u05D4"]) {
    if (w.endsWith(suffix) && occupationWords.has(w.slice(0, -suffix.length))) return w.slice(0, -suffix.length);
  }
  return w;
}
var occupationKey = (s) => normOccupation(s).split(" ").map(baseWord).join(" ");
function findOccupation(occupationName) {
  const key = occupationKey(occupationName ?? "");
  if (!key) return void 0;
  const occupationNames = index().names;
  const exact = occupationNames.find((n) => n.key === key);
  if (exact) return exact.occ;
  return occupationNames.find((n) => ` ${key} `.includes(` ${n.key} `))?.occ;
}
function buildScenario(profile, request) {
  const rules = getRules();
  const occ = findOccupation(profile.occupation);
  const budget = getGroupBudget(profile.group);
  const todayState = {
    base: profile.base,
    commissions: profile.commissions,
    bonus: profile.bonus,
    pensionPct: profile.pensionPct,
    studyFundPct: profile.studyFundPct,
    creditPoints: profile.creditPoints,
    benefitValue: profile.hasCar ? profile.currentBenefit : 0,
    maintenance: profile.hasCar ? 0 : profile.currentMaintenance,
    participation: profile.hasCar ? profile.currentParticipation : 0,
    familyGapShare: 0,
    evGrossUp: 0
  };
  const todayCarLabel = profile.hasCar ? profile.currentCarName || "\u05E8\u05DB\u05D1 \u05D7\u05D1\u05E8\u05D4 \u05E0\u05D5\u05DB\u05D7\u05D9" : `\u05DC\u05DC\u05D0 \u05E8\u05DB\u05D1 (\u05D3\u05DE\u05D9 \u05D0\u05D7\u05D6\u05E7\u05D4 ${profile.currentMaintenance.toLocaleString()} \u20AA)`;
  let eligible = true;
  let eligibilityReason_he = "";
  let altCarLabel = "";
  let targetCar = request.targetCar;
  let companyCost = 0;
  let employeeGap = 0;
  let employerGap = 0;
  let sourceNote = "";
  const altState = {
    base: profile.base,
    commissions: profile.commissions,
    bonus: profile.bonus,
    pensionPct: profile.pensionPct,
    studyFundPct: profile.studyFundPct,
    creditPoints: profile.creditPoints,
    benefitValue: 0,
    maintenance: 0,
    participation: 0,
    familyGapShare: 0,
    evGrossUp: 0
  };
  if (request.type === "keep") {
    altCarLabel = todayCarLabel;
    altState.benefitValue = todayState.benefitValue;
    altState.maintenance = todayState.maintenance;
    altState.participation = todayState.participation;
    altState.familyGapShare = todayState.familyGapShare;
    altState.evGrossUp = 0;
  } else if (request.type === "waive_car") {
    if (!occ) {
      altCarLabel = "\u05D5\u05D9\u05EA\u05D5\u05E8 \u05E2\u05DC \u05E8\u05DB\u05D1 (\u05D4\u05E2\u05D9\u05E1\u05D5\u05E7 \u05DC\u05D0 \u05D6\u05D5\u05D4\u05D4)";
      eligible = false;
      eligibilityReason_he = `\u05D4\u05E2\u05D9\u05E1\u05D5\u05E7 "${profile.occupation ?? ""}" \u05DC\u05D0 \u05D6\u05D5\u05D4\u05D4 \u05D1\u05E8\u05E9\u05D9\u05DE\u05EA \u05D4\u05E2\u05D9\u05E1\u05D5\u05E7\u05D9\u05DD, \u05D5\u05DC\u05DB\u05DF \u05D0\u05D9 \u05D0\u05E4\u05E9\u05E8 \u05DC\u05E7\u05D1\u05D5\u05E2 \u05D0\u05DD \u05DE\u05D5\u05EA\u05E8 \u05DC\u05D5\u05D5\u05EA\u05E8 \u05E2\u05DC \u05D4\u05E8\u05DB\u05D1 \u05D5\u05DE\u05D4\u05D5 \u05E1\u05DB\u05D5\u05DD \u05D4\u05D0\u05D7\u05D6\u05E7\u05D4. \u05D9\u05E9 \u05DC\u05D1\u05D7\u05D5\u05E8 \u05E2\u05D9\u05E1\u05D5\u05E7 \u05DE\u05D4\u05E8\u05E9\u05D9\u05DE\u05D4 \u05D0\u05D5 \u05DC\u05E4\u05E0\u05D5\u05EA \u05DC\u05E0\u05E6\u05D9\u05D2 \u05E9\u05DB\u05E8.`;
    } else if (occ.carMandatory || !occ.canWaive) {
      altCarLabel = `\u05D5\u05D9\u05EA\u05D5\u05E8 \u05E2\u05DC \u05E8\u05DB\u05D1 \u05D5\u05D0\u05D7\u05D6\u05E7\u05EA \u05E8\u05DB\u05D1 (${occ.maintenance.toLocaleString()} \u20AA)`;
      eligible = false;
      eligibilityReason_he = `\u05E2\u05D9\u05E1\u05D5\u05E7\u05DA (${occ.occupation}) \u05DE\u05D5\u05D2\u05D3\u05E8 \u05DB\u05D1\u05E2\u05DC \u05E8\u05DB\u05D1 \u05D7\u05D5\u05D1\u05D4 \u05EA\u05E4\u05E2\u05D5\u05DC\u05D9 \u05D5\u05D0\u05D9\u05E0\u05D5 \u05DE\u05D0\u05E4\u05E9\u05E8 \u05D5\u05D9\u05EA\u05D5\u05E8 \u05E2\u05DC \u05D4\u05E8\u05DB\u05D1. \u05D1\u05D0\u05E4\u05E9\u05E8\u05D5\u05EA\u05DA \u05DC\u05D1\u05D7\u05D5\u05E8 \u05E8\u05DB\u05D1 \u05D0\u05D7\u05E8, \u05DC\u05E2\u05D1\u05D5\u05E8 \u05DC\u05E8\u05DB\u05D1 \u05D7\u05E9\u05DE\u05DC\u05D9 \u05D0\u05D5 \u05DC\u05D1\u05D7\u05D5\u05E8 \u05D1\u05DE\u05E1\u05DC\u05D5\u05DC \u05DE\u05E9\u05E4\u05D7\u05EA\u05D9.`;
    } else {
      altCarLabel = `\u05D5\u05D9\u05EA\u05D5\u05E8 \u05E2\u05DC \u05E8\u05DB\u05D1 \u05D5\u05D0\u05D7\u05D6\u05E7\u05EA \u05E8\u05DB\u05D1 (${occ.maintenance.toLocaleString()} \u20AA)`;
      eligibilityReason_he = "\u05D4\u05E2\u05D9\u05E1\u05D5\u05E7 \u05E9\u05DC\u05DA \u05DE\u05D0\u05E4\u05E9\u05E8 \u05D5\u05D9\u05EA\u05D5\u05E8 \u05E2\u05DC \u05E8\u05DB\u05D1 \u05D7\u05D1\u05E8\u05D4 \u05DB\u05E0\u05D2\u05D3 \u05D3\u05DE\u05D9 \u05D0\u05D7\u05D6\u05E7\u05EA \u05E8\u05DB\u05D1 \u05DC\u05E4\u05D9 \u05D4\u05E0\u05D4\u05DC\u05D9\u05DD.";
    }
    altState.benefitValue = 0;
    altState.maintenance = occ?.maintenance ?? 0;
    altState.participation = 0;
    altState.familyGapShare = 0;
    altState.evGrossUp = 0;
  } else if (request.type === "family_track") {
    const targetCarId = request.targetCarId || "CAR-19";
    targetCar = getCatalog().find((c) => c.id === targetCarId) || getCatalog().find((c) => c.id === "CAR-19");
    altCarLabel = `${targetCar.model} (${targetCar.fuel}) - \u05DE\u05E1\u05DC\u05D5\u05DC \u05D1\u05E8\u05D5\u05DB\u05EA \u05D9\u05DC\u05D3\u05D9\u05DD`;
    companyCost = targetCar.companyCost;
    const minKids = rules.familyTrack.minChildren;
    if (profile.childrenUpTo23 < minKids) {
      eligible = false;
      eligibilityReason_he = `\u05DE\u05E1\u05DC\u05D5\u05DC \u05D1\u05E8\u05D5\u05DB\u05EA \u05D9\u05DC\u05D3\u05D9\u05DD \u05D3\u05D5\u05E8\u05E9 \u05DC\u05E4\u05D7\u05D5\u05EA ${minKids} \u05D9\u05DC\u05D3\u05D9\u05DD \u05E2\u05D3 \u05D2\u05D9\u05DC ${rules.familyTrack.childMaxAge} (\u05D4\u05D5\u05D6\u05E0\u05D5 ${profile.childrenUpTo23} \u05D9\u05DC\u05D3\u05D9\u05DD).`;
    } else {
      eligibilityReason_he = `\u05D6\u05DB\u05D0\u05D9/\u05EA \u05DC\u05DE\u05E1\u05DC\u05D5\u05DC \u05D1\u05E8\u05D5\u05DB\u05EA \u05D9\u05DC\u05D3\u05D9\u05DD (${profile.childrenUpTo23} \u05D9\u05DC\u05D3\u05D9\u05DD \u05E2\u05D3 \u05D2\u05D9\u05DC ${rules.familyTrack.childMaxAge}). \u05D4\u05D7\u05D1\u05E8\u05D4 \u05DE\u05E9\u05EA\u05EA\u05E4\u05EA \u05D1-50% \u05DE\u05D4\u05E4\u05E2\u05E8 \u05E9\u05DE\u05E2\u05DC \u05D4\u05EA\u05E7\u05E6\u05D9\u05D1.`;
    }
    const gap = Math.max(0, companyCost - budget);
    employeeGap = gap * rules.familyTrack.gapSplitEmployee;
    employerGap = gap * (1 - rules.familyTrack.gapSplitEmployee);
    const participation = request.overrideParticipation !== void 0 ? request.overrideParticipation : targetCar.participation;
    altState.benefitValue = targetCar.benefit;
    altState.maintenance = 0;
    altState.participation = participation;
    altState.familyGapShare = employeeGap;
    altState.evGrossUp = 0;
  } else {
    if (!targetCar && request.targetCarId) {
      targetCar = getCatalog().find((c) => c.id === request.targetCarId);
    }
    if (!targetCar) {
      targetCar = request.type === "go_electric" ? getCatalog().find((c) => c.group === profile.group && c.driveCode === 3) || getCatalog().find((c) => c.id === "CAR-10") : getCatalog().find((c) => c.group === profile.group);
    }
    companyCost = targetCar.companyCost;
    altCarLabel = `${targetCar.model} (${targetCar.fuel})`;
    const canChoose = canSelectCarGroup(profile.group, targetCar.group);
    if (!canChoose) {
      eligible = false;
      eligibilityReason_he = `\u05D4\u05E8\u05DB\u05D1 (${targetCar.model}) \u05E9\u05D9\u05D9\u05DA \u05DC\u05E7\u05D1\u05D5\u05E6\u05D4 ${targetCar.group}, \u05D1\u05E2\u05D5\u05D3 \u05E7\u05D1\u05D5\u05E6\u05EA \u05D4\u05D6\u05DB\u05D0\u05D5\u05EA \u05E9\u05DC\u05DA \u05D4\u05D9\u05D0 ${profile.group}. \u05DC\u05E4\u05D9 \u05D4\u05E0\u05D4\u05DC\u05D9\u05DD \u05E0\u05D9\u05EA\u05DF \u05DC\u05D1\u05D7\u05D5\u05E8 \u05E8\u05DB\u05D1 \u05DE\u05E7\u05D1\u05D5\u05E6\u05EA\u05DA \u05D0\u05D5 \u05E0\u05DE\u05D5\u05DB\u05D4 \u05DE\u05DE\u05E0\u05D4 \u05D1\u05DC\u05D1\u05D3.`;
    } else {
      eligibilityReason_he = `\u05D4\u05E8\u05DB\u05D1 \u05DE\u05E7\u05D1\u05D5\u05E6\u05EA \u05D4\u05D6\u05DB\u05D0\u05D5\u05EA \u05E9\u05DC\u05DA (${profile.group}) \u05D0\u05D5 \u05DE\u05E7\u05D1\u05D5\u05E6\u05D4 \u05E0\u05DE\u05D5\u05DB\u05D4 \u05DE\u05DE\u05E0\u05D4.`;
    }
    if (companyCost < budget) {
      sourceNote = `\u05E2\u05DC\u05D5\u05EA \u05D4\u05E8\u05DB\u05D1 \u05DC\u05DE\u05E2\u05E1\u05D9\u05E7 (${companyCost.toLocaleString()} \u20AA) \u05E0\u05DE\u05D5\u05DB\u05D4 \u05DE\u05EA\u05E7\u05E6\u05D9\u05D1 \u05D4\u05E7\u05D1\u05D5\u05E6\u05D4 (${budget.toLocaleString()} \u20AA). \u05DC\u05E4\u05D9 \u05E0\u05D5\u05D4\u05DC \u05E9\u05D8\u05E8\u05D0\u05D5\u05E1, \u05D9\u05EA\u05E8\u05EA \u05EA\u05E7\u05E6\u05D9\u05D1 \u05D0\u05D9\u05E0\u05D4 \u05E0\u05E4\u05D3\u05D9\u05EA \u05D1\u05DE\u05D6\u05D5\u05DE\u05DF.`;
    }
    const participation = request.overrideParticipation !== void 0 ? request.overrideParticipation : targetCar.participation;
    altState.benefitValue = targetCar.benefit;
    altState.maintenance = 0;
    altState.participation = participation;
    altState.familyGapShare = 0;
    if (targetCar.driveCode === 3) {
      const stateWithoutEV = { ...altState, evGrossUp: 0 };
      altState.evGrossUp = calculateEVGrossUp(stateWithoutEV, rules.electric.netBonus);
    } else {
      altState.evGrossUp = 0;
    }
  }
  const todayBreakdown = calculateNetBreakdown(todayState);
  const altBreakdown = calculateNetBreakdown(altState);
  const diffNet = Math.round(altBreakdown.net) - Math.round(todayBreakdown.net);
  const exactDiff = altBreakdown.net - todayBreakdown.net;
  const { steps: exactSteps, sumSteps } = request.type === "keep" ? { steps: [], sumSteps: 0 } : buildDeltaSteps(todayState, altState);
  const steps = roundStepsToTotal(exactSteps, diffNet);
  if (Math.abs(sumSteps - exactDiff) > 1e-6) {
    throw new Error(
      `buildScenario(${request.type}): sum of steps (${sumSteps}) != exactDiff (${exactDiff})`
    );
  }
  const summary_he = buildPlainHebrewSummary(todayState, altState, todayCarLabel, altCarLabel);
  return {
    scenarioType: request.type,
    requestedScenarioType: request.type,
    requestedCarId: request.targetCarId ?? targetCar?.id,
    eligible,
    eligibilityReason_he,
    todayState,
    todayBreakdown,
    altState,
    altBreakdown,
    diffNet,
    exactDiff,
    steps,
    sumSteps,
    summary_he,
    todayCarLabel,
    altCarLabel,
    targetCar,
    budget,
    companyCost,
    employeeGap,
    employerGap,
    sourceNote
  };
}

// server/data/car-aliases.json
var car_aliases_default = {
  "CAR-01": ["\u05E4\u05D9\u05E7\u05E0\u05D8\u05D5"],
  "CAR-02": ["\u05D9\u05D0\u05E8\u05D9\u05E1 \u05E7\u05E8\u05D5\u05E1", "\u05D9\u05D0\u05E8\u05D9\u05E1"],
  "CAR-03": ["\u05D3\u05D5\u05DC\u05E4\u05D9\u05DF", "\u05D1\u05D9\u05D5\u05D5\u05D0\u05D9\u05D3\u05D9 \u05D3\u05D5\u05DC\u05E4\u05D9\u05DF"],
  "CAR-04": ["\u05DC\u05D0\u05D5\u05DF", "\u05DC\u05D9\u05D0\u05D5\u05DF"],
  "CAR-05": ["\u05E0\u05D9\u05E8\u05D5"],
  "CAR-06": ["\u05D0\u05DE \u05D2\u05D9 4", "\u05D0\u05DD \u05D2\u05D9 4", "\u05D0\u05DE\u05D2\u05D9", "\u05DE\u05D2 4"],
  "CAR-07": ["\u05E7\u05D5\u05E8\u05D5\u05DC\u05D4"],
  "CAR-08": ["\u05E7\u05D5\u05E0\u05D4", "\u05E7\u05D5\u05E0\u05D4 \u05D7\u05E9\u05DE\u05DC\u05D9\u05EA", "kona"],
  "CAR-09": ["\u05E7\u05D5\u05E8\u05D5\u05DC\u05D4 \u05E7\u05E8\u05D5\u05E1"],
  "CAR-10": ["\u05D0\u05D8\u05D5", "\u05D0\u05D8\u05D5 3", "atto"],
  "CAR-11": ["\u05D0\u05D9\u05D5\u05D5\u05D9 3", "\u05D0\u05D9 \u05D5\u05D9 3", "ev 3"],
  "CAR-12": ["\u05D8\u05D5\u05E1\u05D5\u05DF", "\u05D8\u05D5\u05E1\u05D0\u05DF"],
  "CAR-13": ["\u05DE\u05D0\u05D6\u05D3\u05D4 3", "\u05DE\u05D6\u05D3\u05D4 3"],
  "CAR-14": ["\u05DE\u05D5\u05D3\u05DC 3", "\u05D8\u05E1\u05DC\u05D4", "tesla"],
  "CAR-15": ["\u05D0\u05D5\u05E7\u05D8\u05D1\u05D9\u05D4", "\u05D0\u05D5\u05E7\u05D8\u05D0\u05D1\u05D9\u05D4"],
  "CAR-16": ["\u05E1\u05E4\u05D5\u05E8\u05D8\u05D6", "\u05E1\u05E4\u05D5\u05E8\u05D8\u05D0\u05D6"],
  "CAR-17": ["\u05E1\u05D9\u05DC", "\u05E1\u05D9\u05DC \u05D7\u05E9\u05DE\u05DC\u05D9\u05EA"],
  "CAR-18": ["\u05E8\u05D0\u05D1 4", "\u05E8\u05D0\u05D1 \u05E4\u05D5\u05E8", "rav 4"],
  "CAR-19": ["\u05E7\u05E8\u05E0\u05D9\u05D1\u05DC"],
  "CAR-20": ["\u05E1\u05E0\u05D8\u05D4 \u05E4\u05D4", "\u05E1\u05E0\u05D8\u05E4\u05D4"]
};

// server/bl/agent/carSearch.ts
var aliases = car_aliases_default;
var FOUND_SCORE = 0.9;
var MAX_SUGGESTIONS = 5;
var norm = (s) => s.toLowerCase().replace(/["'׳״`\-]/g, "").replace(/\s+/g, " ").trim();
var compact = (s) => norm(s).replace(/ /g, "");
function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}
function scoreCar(car, query) {
  return nameScore(query, [car.model, car.make, car.make.split(" ")[0], ...aliases[car.id] ?? []]);
}
function nameScore(query, names) {
  const q = compact(query);
  if (!q) return 0;
  let best = 0;
  for (const name of names) {
    const n = compact(name);
    if (!n) continue;
    if (n === q) return 1;
    if (q.length >= 2 && (n.includes(q) || q.includes(n))) best = Math.max(best, FOUND_SCORE);
    else best = Math.max(best, 1 - levenshtein(q, n) / Math.max(q.length, n.length));
  }
  return best;
}
function searchCars(query, employeeGroup) {
  const q = query.trim();
  const byId = getCatalog().filter((c) => c.id.toLowerCase() === q.toLowerCase());
  if (byId.length > 0) return { matches: byId, suggestions: [] };
  const scored = getCatalog().map((car) => ({ car, score: scoreCar(car, q) })).sort((a, b) => b.score - a.score);
  const exact = scored.filter((s) => s.score === 1);
  if (exact.length > 0) return { matches: exact.map((s) => s.car), suggestions: [] };
  const contained = scored.filter((s) => s.score >= FOUND_SCORE);
  if (contained.length > 0) return { matches: contained.map((s) => s.car), suggestions: [] };
  const selectable = scored.filter(
    (s) => s.car.group !== "\u05DE\u05E9\u05E4\u05D7\u05EA\u05D9" && (!employeeGroup || canSelectCarGroup(employeeGroup, s.car.group))
  );
  return { matches: [], suggestions: selectable.slice(0, MAX_SUGGESTIONS).map((s) => s.car) };
}
function numberedLine(text2, n) {
  if (!text2) return void 0;
  const re = new RegExp(`^\\s*${n}\\s*[.)]\\s+(.+)$`, "m");
  return text2.match(re)?.[1];
}
function carOnLine(line) {
  const upper = line.toUpperCase();
  const byId = getCatalog().find((c) => new RegExp(`\\b${c.id}\\b`).test(upper));
  if (byId) return byId;
  return getCatalog().filter((c) => upper.includes(c.model.toUpperCase())).sort((a, b) => b.model.length - a.model.length)[0];
}

// server/bl/agent/normalize.ts
var FIELD_RANGES = {
  pensionPct: [0, 20],
  studyFundPct: [0, 10],
  creditPoints: [0, 15],
  childrenUpTo23: [0, 15]
};
var FIELD_LABELS_HE = {
  pensionPct: "\u05D4\u05E4\u05E8\u05E9\u05D4 \u05DC\u05E4\u05E0\u05E1\u05D9\u05D4",
  studyFundPct: "\u05D4\u05E4\u05E8\u05E9\u05D4 \u05DC\u05E7\u05E8\u05DF \u05D4\u05E9\u05EA\u05DC\u05DE\u05D5\u05EA",
  creditPoints: "\u05E0\u05E7\u05D5\u05D3\u05D5\u05EA \u05D6\u05D9\u05DB\u05D5\u05D9",
  childrenUpTo23: "\u05DE\u05E1\u05E4\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD \u05E2\u05D3 \u05D2\u05D9\u05DC 23",
  base: "\u05E9\u05DB\u05E8 \u05D1\u05E1\u05D9\u05E1",
  commissions: "\u05E2\u05DE\u05DC\u05D5\u05EA",
  bonus: "\u05D1\u05D5\u05E0\u05D5\u05E1",
  currentParticipation: "\u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05D1\u05E8\u05DB\u05D1",
  currentBenefit: "\u05E9\u05D5\u05D5\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9",
  currentMaintenance: "\u05D3\u05DE\u05D9 \u05D0\u05D7\u05D6\u05E7\u05D4"
};
var PERCENT_FIELDS = /* @__PURE__ */ new Set(["pensionPct", "studyFundPct"]);
var COUNT_FIELDS = /* @__PURE__ */ new Set(["creditPoints", "childrenUpTo23"]);
var UNITS = {
  \u05D0\u05E4\u05E1: 0,
  \u05D0\u05D7\u05D3: 1,
  \u05D0\u05D7\u05EA: 1,
  \u05E9\u05E0\u05D9\u05D9\u05DD: 2,
  \u05E9\u05EA\u05D9\u05D9\u05DD: 2,
  \u05E9\u05E0\u05D9: 2,
  \u05E9\u05EA\u05D9: 2,
  \u05E9\u05E0\u05D9\u05DD: 2,
  \u05E9\u05EA\u05D9\u05DD: 2,
  \u05E9\u05DC\u05D5\u05E9\u05D4: 3,
  \u05E9\u05DC\u05D5\u05E9: 3,
  \u05E9\u05DC\u05E9\u05D4: 3,
  \u05E9\u05DC\u05E9: 3,
  \u05D0\u05E8\u05D1\u05E2\u05D4: 4,
  \u05D0\u05E8\u05D1\u05E2: 4,
  \u05D7\u05DE\u05D9\u05E9\u05D4: 5,
  \u05D7\u05DE\u05E9: 5,
  \u05D7\u05DE\u05E9\u05D4: 5,
  \u05E9\u05D9\u05E9\u05D4: 6,
  \u05E9\u05E9: 6,
  \u05E9\u05E9\u05D4: 6,
  \u05E9\u05D1\u05E2\u05D4: 7,
  \u05E9\u05D1\u05E2: 7,
  \u05E9\u05DE\u05D5\u05E0\u05D4: 8,
  \u05EA\u05E9\u05E2\u05D4: 9,
  \u05EA\u05E9\u05E2: 9,
  \u05E2\u05E9\u05E8\u05D4: 10,
  \u05E2\u05E9\u05E8: 10
};
var TEEN_SUFFIX = /* @__PURE__ */ new Set(["\u05E2\u05E9\u05E8", "\u05E2\u05E9\u05E8\u05D4"]);
var TENS = { \u05E2\u05E9\u05E8\u05D9\u05DD: 20 };
var HALF = /* @__PURE__ */ new Set(["\u05D5\u05D7\u05E6\u05D9", "\u05D7\u05E6\u05D9"]);
var THOUSAND = /* @__PURE__ */ new Set(["\u05D0\u05DC\u05E3", "\u05D0\u05DC\u05E4\u05D9\u05DD", "k", "K"]);
function wordValue(word, table) {
  if (word in table) return table[word];
  const stripped = word.replace(/^[והבלשמ]/, "");
  return stripped !== word && stripped in table ? table[stripped] : void 0;
}
function extractNumbers(text2) {
  const found = [];
  const tokens = text2.replace(/([א-ת])[-־](?=\d)/g, "$1 ").replace(/(\d)([^\d.,\s])/g, "$1 $2").replace(/([^\d.,\s-])(\d)/g, "$1 $2").split(/[\s;:!?()"'״׳/]+|,(?!\d)|(?<!\d),/).filter((t) => t !== "");
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    let value;
    let negative2 = false;
    const digits = tok.match(/^(-?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\.?$/);
    if (digits) {
      negative2 = digits[1] === "-";
      value = Number(digits[2].replace(/,/g, "") + (digits[3] ?? ""));
    } else {
      const unit = wordValue(tok, UNITS);
      const tens = wordValue(tok, TENS);
      if (unit !== void 0) {
        value = unit;
        if (unit > 0 && unit < 10 && TEEN_SUFFIX.has(tokens[i + 1] ?? "")) {
          value = unit + 10;
          i++;
        }
      } else if (tens !== void 0) {
        value = tens;
      }
    }
    if (value === void 0 || !Number.isFinite(value)) continue;
    let next = tokens[i + 1] ?? "";
    if (HALF.has(next)) {
      value += 0.5;
      next = tokens[++i + 1] ?? "";
    }
    if (THOUSAND.has(next)) {
      value *= 1e3;
      next = tokens[++i + 1] ?? "";
      if (HALF.has(next)) {
        value += 500;
        next = tokens[++i + 1] ?? "";
      }
    }
    const percent = next === "%" || /^(ו?אחוז|אחוזים)$/.test(next);
    found.push({ value: Math.round(value * 1e6) / 1e6, percent, negative: negative2 });
  }
  return found;
}
function firstNumber(raw) {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? { value: Math.abs(raw), percent: false, negative: raw < 0 } : void 0;
  }
  if (typeof raw !== "string") return void 0;
  return extractNumbers(raw)[0];
}
function unreadable(field) {
  return { ok: false, reason: "unreadable", question_he: `\u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9 \u05DC\u05D4\u05D1\u05D9\u05DF \u05D0\u05EA \u05D4${FIELD_LABELS_HE[field]}. \u05D0\u05E4\u05E9\u05E8 \u05DC\u05DB\u05EA\u05D5\u05D1 \u05DE\u05E1\u05E4\u05E8?` };
}
function negative(field) {
  return { ok: false, reason: "negative", question_he: `\u05D4${FIELD_LABELS_HE[field]} \u05DC\u05D0 \u05D9\u05DB\u05D5\u05DC \u05DC\u05D4\u05D9\u05D5\u05EA \u05E9\u05DC\u05D9\u05DC\u05D9. \u05DE\u05D4 \u05D4\u05E2\u05E8\u05DA \u05D4\u05E0\u05DB\u05D5\u05DF?` };
}
function outOfRange(field, value) {
  const [min, max] = FIELD_RANGES[field];
  const unit = PERCENT_FIELDS.has(field) ? "%" : "";
  return {
    ok: false,
    reason: "out_of_range",
    question_he: `${value}${unit} \u05E0\u05E8\u05D0\u05D4 \u05DC\u05D0 \u05E1\u05D1\u05D9\u05E8 \u05E2\u05D1\u05D5\u05E8 ${FIELD_LABELS_HE[field]} (\u05D8\u05D5\u05D5\u05D7 \u05EA\u05E7\u05D9\u05DF ${min}\u2013${max}${unit}). \u05DE\u05D4 \u05D4\u05E2\u05E8\u05DA \u05D4\u05E0\u05DB\u05D5\u05DF?`
  };
}
var inRange = (field, v) => v >= FIELD_RANGES[field][0] && v <= FIELD_RANGES[field][1];
function parsePercent(raw, field) {
  const n = firstNumber(raw);
  if (!n) return unreadable(field);
  if (n.negative) return negative(field);
  let value = n.value;
  if (value > 0 && value < 1) {
    const asPercent = Math.round(value * 100 * 1e6) / 1e6;
    if (!inRange(field, asPercent)) {
      return { ok: false, ambiguous: true, suggested: value, question_he: `\u05D4\u05EA\u05DB\u05D5\u05D5\u05E0\u05EA \u05DC-${value}%?` };
    }
    value = asPercent;
  }
  if (!inRange(field, value)) return outOfRange(field, value);
  return { ok: true, value };
}
function parseMoney(raw, field = "base") {
  const n = firstNumber(raw);
  if (!n) return unreadable(field);
  if (n.negative) return negative(field);
  return { ok: true, value: Math.round(n.value * 100) / 100 };
}
function parseCount(raw, field) {
  const n = firstNumber(raw);
  if (!n) return unreadable(field);
  if (n.negative) return negative(field);
  if (field === "childrenUpTo23" && !Number.isInteger(n.value)) return outOfRange(field, n.value);
  if (!inRange(field, n.value)) return outOfRange(field, n.value);
  return { ok: true, value: n.value };
}
function normalizeField(field, raw) {
  if (PERCENT_FIELDS.has(field)) return parsePercent(raw, field);
  if (COUNT_FIELDS.has(field)) return parseCount(raw, field);
  return parseMoney(raw, field);
}
function describeValue(field, value) {
  if (PERCENT_FIELDS.has(field)) return `${FIELD_LABELS_HE[field]} ${value}%`;
  if (COUNT_FIELDS.has(field)) return `${FIELD_LABELS_HE[field]} ${value}`;
  return `${FIELD_LABELS_HE[field]} ${value.toLocaleString("en-US")} \u20AA`;
}
var GROUP_LETTERS = ["\u05D0", "\u05D1", "\u05D2", "\u05D3"];
var FAMILY_GROUP = "\u05DE\u05E9\u05E4\u05D7\u05EA\u05D9";
var stripQuotes = (s) => s.replace(/^["'׳״`]+|["'׳״`]+$/g, "");
function normalizeGroup(raw) {
  if (typeof raw !== "string") return void 0;
  const t = stripQuotes(raw.trim().replace(/^קבוצ(ה|ת)\s+/, "").trim());
  if (GROUP_LETTERS.includes(t)) return t;
  return t.startsWith(FAMILY_GROUP) ? FAMILY_GROUP : void 0;
}
function groupStated(texts2, group) {
  if (group === FAMILY_GROUP) return texts2.some((t) => t.includes(FAMILY_GROUP));
  return texts2.some(
    (t) => t.split(/[\s,.:;!?()/]+/).map(stripQuotes).some((word) => word === group)
  );
}

// server/bl/agent/tools.ts
var isUnset = (v) => v === void 0 || v === null || typeof v === "number" && !Number.isFinite(v);
var isBlank = (v) => isUnset(v) || String(v).trim() === "";
function statedNumbers(texts2) {
  const found = /* @__PURE__ */ new Set();
  for (const text2 of texts2) for (const n of extractNumbers(text2)) found.add(n.value);
  return found;
}
var NUMERIC_PROFILE_FIELDS = [
  "base",
  "commissions",
  "bonus",
  "pensionPct",
  "studyFundPct",
  "creditPoints",
  "childrenUpTo23",
  "currentParticipation",
  "currentBenefit",
  "currentMaintenance"
];
var GROUP_MISSING = {
  field: "group",
  label_he: "\u05E7\u05D1\u05D5\u05E6\u05EA \u05D6\u05DB\u05D0\u05D5\u05EA (\u05D0\u2013\u05D3)",
  whyNeeded_he: "\u05DC\u05E7\u05D1\u05D9\u05E2\u05EA \u05EA\u05E7\u05E6\u05D9\u05D1 \u05D4\u05E8\u05DB\u05D1 \u05D5\u05D4\u05E8\u05DB\u05D1\u05D9\u05DD \u05D4\u05DE\u05D5\u05EA\u05E8\u05D9\u05DD"
};
function getMissingFields(prof, scenarioType = "general") {
  const missing = [];
  if (isBlank(prof.group)) missing.push(GROUP_MISSING);
  if (isUnset(prof.base)) {
    missing.push({ field: "base", label_he: "\u05E9\u05DB\u05E8 \u05D1\u05E1\u05D9\u05E1 \u05D7\u05D5\u05D3\u05E9\u05D9", whyNeeded_he: "\u05DC\u05E7\u05D1\u05D9\u05E2\u05EA \u05DE\u05D3\u05E8\u05D2\u05D5\u05EA \u05D4\u05DE\u05E1 \u05D5\u05D7\u05D9\u05E9\u05D5\u05D1 \u05E9\u05DB\u05E8 \u05D4\u05E0\u05D8\u05D5" });
  }
  if (prof.hasCar === void 0 || prof.hasCar === null) {
    missing.push({ field: "hasCar", label_he: "\u05D4\u05D0\u05DD \u05D9\u05E9 \u05DB\u05D9\u05D5\u05DD \u05E8\u05DB\u05D1 \u05D7\u05D1\u05E8\u05D4 \u05D0\u05D5 \u05D5\u05D9\u05EA\u05D5\u05E8 (\u05D0\u05D7\u05D6\u05E7\u05D4)", whyNeeded_he: "\u05DC\u05E7\u05D1\u05D9\u05E2\u05EA \u05DE\u05E6\u05D1 \u05D4\u05D9\u05D5\u05DD \u05E9\u05D0\u05DC\u05D9\u05D5 \u05DE\u05E9\u05D5\u05D5\u05D9\u05DD" });
  }
  if (isUnset(prof.childrenUpTo23)) {
    missing.push({ field: "childrenUpTo23", label_he: "\u05DE\u05E1\u05E4\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD \u05E2\u05D3 \u05D2\u05D9\u05DC 23 (0 \u05D0\u05DD \u05D0\u05D9\u05DF)", whyNeeded_he: "\u05DC\u05D1\u05D3\u05D9\u05E7\u05EA \u05D6\u05DB\u05D0\u05D5\u05EA \u05DC\u05DE\u05E1\u05DC\u05D5\u05DC \u05D1\u05E8\u05D5\u05DB\u05EA \u05D9\u05DC\u05D3\u05D9\u05DD" });
  }
  if (scenarioType === "waive_car" && !findOccupation(prof.occupation)) {
    missing.push({ field: "occupation", label_he: "\u05E2\u05D9\u05E1\u05D5\u05E7 / \u05EA\u05E4\u05E7\u05D9\u05D3 (\u05DE\u05EA\u05D5\u05DA \u05E8\u05E9\u05D9\u05DE\u05EA \u05D4\u05E2\u05D9\u05E1\u05D5\u05E7\u05D9\u05DD)", whyNeeded_he: "\u05DC\u05D1\u05D3\u05D9\u05E7\u05D4 \u05D0\u05DD \u05DE\u05D5\u05EA\u05E8 \u05DC\u05D5\u05D5\u05EA\u05E8 \u05E2\u05DC \u05D4\u05E8\u05DB\u05D1 \u05D5\u05DE\u05D4\u05D5 \u05E1\u05DB\u05D5\u05DD \u05D4\u05D0\u05D7\u05D6\u05E7\u05D4" });
  }
  if (isUnset(prof.commissions)) {
    missing.push({ field: "commissions", label_he: "\u05E2\u05DE\u05DC\u05D5\u05EA \u05D7\u05D5\u05D3\u05E9\u05D9\u05D5\u05EA (0 \u05D0\u05DD \u05D0\u05D9\u05DF)", whyNeeded_he: "\u05D7\u05DC\u05E7 \u05DE\u05D4\u05D4\u05DB\u05E0\u05E1\u05D4 \u05D4\u05D7\u05D9\u05D9\u05D1\u05EA \u05D1\u05DE\u05E1" });
  }
  if (isUnset(prof.bonus)) {
    missing.push({ field: "bonus", label_he: "\u05D1\u05D5\u05E0\u05D5\u05E1 \u05D7\u05D5\u05D3\u05E9\u05D9 (0 \u05D0\u05DD \u05D0\u05D9\u05DF)", whyNeeded_he: "\u05D7\u05DC\u05E7 \u05DE\u05D4\u05D4\u05DB\u05E0\u05E1\u05D4 \u05D4\u05D7\u05D9\u05D9\u05D1\u05EA \u05D1\u05DE\u05E1" });
  }
  if (isUnset(prof.pensionPct)) {
    missing.push({ field: "pensionPct", label_he: "\u05D0\u05D7\u05D5\u05D6 \u05D4\u05E4\u05E8\u05E9\u05EA \u05E2\u05D5\u05D1\u05D3 \u05DC\u05E4\u05E0\u05E1\u05D9\u05D4", whyNeeded_he: "\u05DE\u05E9\u05E4\u05D9\u05E2 \u05E2\u05DC \u05D4\u05E0\u05D8\u05D5 \u05D5\u05E2\u05DC \u05D6\u05D9\u05DB\u05D5\u05D9 \u05D4\u05E4\u05E0\u05E1\u05D9\u05D4 \u05D1\u05DE\u05E1" });
  }
  if (isUnset(prof.studyFundPct)) {
    missing.push({ field: "studyFundPct", label_he: "\u05D0\u05D7\u05D5\u05D6 \u05D4\u05E4\u05E8\u05E9\u05D4 \u05DC\u05E7\u05E8\u05DF \u05D4\u05E9\u05EA\u05DC\u05DE\u05D5\u05EA (0 \u05D0\u05DD \u05D0\u05D9\u05DF)", whyNeeded_he: "\u05E0\u05D9\u05DB\u05D5\u05D9 \u05DE\u05D4\u05E9\u05DB\u05E8 \u05E9\u05DE\u05E9\u05E4\u05D9\u05E2 \u05E2\u05DC \u05D4\u05E0\u05D8\u05D5" });
  }
  if (isUnset(prof.creditPoints)) {
    missing.push({ field: "creditPoints", label_he: "\u05E0\u05E7\u05D5\u05D3\u05D5\u05EA \u05D6\u05D9\u05DB\u05D5\u05D9 \u05D1\u05DE\u05E1", whyNeeded_he: "\u05DC\u05D7\u05D9\u05E9\u05D5\u05D1 \u05D4\u05DE\u05E1 \u05DC\u05EA\u05E9\u05DC\u05D5\u05DD" });
  }
  if (prof.hasCar === true) {
    const carNameMissing = isBlank(prof.currentCarName) || prof.currentCarName === "\u05E8\u05DB\u05D1 \u05D7\u05D1\u05E8\u05D4 \u05E0\u05D5\u05DB\u05D7\u05D9";
    if (carNameMissing) {
      missing.push({ field: "currentCarName", label_he: "\u05D3\u05D2\u05DD \u05E8\u05DB\u05D1 \u05E0\u05D5\u05DB\u05D7\u05D9", whyNeeded_he: "\u05DC\u05E9\u05DC\u05D9\u05E4\u05EA \u05E9\u05D5\u05D5\u05D9 \u05D4\u05E9\u05D9\u05DE\u05D5\u05E9 \u05D4\u05E0\u05D5\u05DB\u05D7\u05D9 \u05DC\u05E6\u05D5\u05E8\u05DA \u05D4\u05E9\u05D5\u05D5\u05D0\u05D4 \u05DE\u05D3\u05D5\u05D9\u05E7\u05EA" });
    }
    if (isUnset(prof.currentParticipation)) {
      missing.push({ field: "currentParticipation", label_he: "\u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05E2\u05D5\u05D1\u05D3 \u05D1\u05E8\u05DB\u05D1 \u05D4\u05E0\u05D5\u05DB\u05D7\u05D9 (0 \u05D0\u05DD \u05D0\u05D9\u05DF)", whyNeeded_he: "\u05DE\u05E0\u05D5\u05DB\u05D4 \u05DE\u05D4\u05E0\u05D8\u05D5 \u05D1\u05DE\u05E6\u05D1 \u05D4\u05D9\u05D5\u05DD" });
    }
    if (!carNameMissing && isUnset(prof.currentBenefit)) {
      missing.push({ field: "currentBenefit", label_he: "\u05E9\u05D5\u05D5\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9 \u05E9\u05DC \u05D4\u05E8\u05DB\u05D1 \u05D4\u05E0\u05D5\u05DB\u05D7\u05D9", whyNeeded_he: "\u05D4\u05E8\u05DB\u05D1 \u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0 \u05D1\u05E7\u05D8\u05DC\u05D5\u05D2; \u05D9\u05E9 \u05DC\u05D4\u05E2\u05D1\u05D9\u05E8 \u05E9\u05D0\u05DC\u05D4 \u05DC\u05E0\u05E6\u05D9\u05D2" });
    }
  } else if (prof.hasCar === false && isUnset(prof.currentMaintenance)) {
    missing.push({ field: "currentMaintenance", label_he: "\u05D3\u05DE\u05D9 \u05D0\u05D7\u05D6\u05E7\u05EA \u05E8\u05DB\u05D1 \u05E0\u05D5\u05DB\u05D7\u05D9\u05D9\u05DD", whyNeeded_he: "\u05D7\u05DC\u05E7 \u05DE\u05D4\u05E9\u05DB\u05E8 \u05D1\u05DE\u05E6\u05D1 \u05D4\u05D9\u05D5\u05DD (\u05D5\u05D9\u05EA\u05D5\u05E8 \u05E2\u05DC \u05E8\u05DB\u05D1)" });
  }
  return missing;
}
var MAX_OCCUPATION_SUGGESTIONS = 5;
function suggestOccupations(query) {
  const scored = getOccupations().map((o) => ({ o, score: nameScore(query, [o.occupation, o.occupation.replace(/\/(ית|ת|ה)(?=\s|$)/g, "")]) })).sort((a, b) => b.score - a.score);
  const containing = scored.filter((s) => s.score >= 0.9);
  return (containing.length > 0 ? containing : scored.slice(0, MAX_OCCUPATION_SUGGESTIONS)).map((s) => s.o);
}
var ASK_AT_ONCE = 2;
var REP_ONLY_FIELDS = /* @__PURE__ */ new Set(["currentBenefit"]);
function nextQuestions(allMissing, pendingFields = []) {
  if (allMissing.length === 0) return {};
  const missing = allMissing.filter((m) => !REP_ONLY_FIELDS.has(m.field));
  const forRep = allMissing.filter((m) => REP_ONLY_FIELDS.has(m.field));
  if (missing.length === 0) {
    return {
      askNow: [],
      forRep,
      instruction: `\u05D7\u05E1\u05E8: ${forRep.map((m) => m.label_he).join("; ")}. \u05D4\u05E2\u05D5\u05D1\u05D3 \u05DC\u05D0 \u05D0\u05DE\u05D5\u05E8 \u05DC\u05D3\u05E2\u05EA \u05D0\u05EA \u05D6\u05D4: \u05D0\u05DC \u05EA\u05E9\u05D0\u05DC \u05D0\u05D5\u05EA\u05D5. \u05E7\u05E8\u05D0 \u05DC-escalate_to_rep, \u05D5\u05E1\u05E4\u05E8 \u05DC\u05E2\u05D5\u05D1\u05D3 \u05D1\u05E7\u05E6\u05E8\u05D4 \u05E9\u05E9\u05DC\u05D7\u05EA \u05E9\u05D0\u05DC\u05D4 \u05DC\u05E0\u05E6\u05D9\u05D2 \u05D5\u05E9\u05EA\u05DE\u05E9\u05D9\u05DA \u05DB\u05E9\u05EA\u05D2\u05D9\u05E2 \u05EA\u05E9\u05D5\u05D1\u05D4.`
    };
  }
  const unanswered = missing.filter((m) => pendingFields.includes(m.field));
  const askNow = (unanswered.length > 0 ? unanswered : missing).slice(0, ASK_AT_ONCE);
  const fields = askNow.map((m) => m.label_he).join("; ");
  return {
    next: askNow[0],
    askNow,
    instruction: unanswered.length > 0 ? `\u05D4\u05E2\u05D5\u05D1\u05D3 \u05E2\u05D5\u05D3 \u05DC\u05D0 \u05E2\u05E0\u05D4 \u05D1\u05D1\u05D9\u05E8\u05D5\u05E8 \u05E2\u05DC: ${fields}. \u05E9\u05D0\u05DC \u05E9\u05D5\u05D1 \u05E8\u05E7 \u05E2\u05DC \u05D6\u05D4, \u05D5\u05D0\u05DC \u05EA\u05E2\u05D1\u05D5\u05E8 \u05DC\u05E9\u05D0\u05DC\u05D4 \u05D4\u05D1\u05D0\u05D4 \u05E2\u05D3 \u05E9\u05EA\u05EA\u05E7\u05D1\u05DC \u05EA\u05E9\u05D5\u05D1\u05D4 \u05D1\u05E8\u05D5\u05E8\u05D4. \u05D0\u05DC \u05EA\u05E4\u05E0\u05D4 \u05DC\u05E0\u05E6\u05D9\u05D2 \u05D1\u05D2\u05DC\u05DC \u05D6\u05D4 \u05D5\u05D0\u05DC \u05EA\u05E0\u05D9\u05D7 \u05E2\u05E8\u05DA.` : `\u05E9\u05D0\u05DC \u05D0\u05EA \u05D4\u05E2\u05D5\u05D1\u05D3 \u05E2\u05DB\u05E9\u05D9\u05D5, \u05D1\u05D4\u05D5\u05D3\u05E2\u05D4 \u05D0\u05D7\u05EA, \u05E8\u05E7 \u05E2\u05DC: ${fields}. \u05D0\u05DC \u05EA\u05E9\u05D0\u05DC \u05E2\u05DC \u05E9\u05D3\u05D5\u05EA \u05E0\u05D5\u05E1\u05E4\u05D9\u05DD \u05D1\u05D4\u05D5\u05D3\u05E2\u05D4 \u05D4\u05D6\u05D5. \u05D0\u05DC\u05D4 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05E9\u05D4\u05E2\u05D5\u05D1\u05D3 \u05D9\u05D5\u05D3\u05E2: \u05D0\u05DC \u05EA\u05E4\u05E0\u05D4 \u05DC\u05E0\u05E6\u05D9\u05D2 \u05D1\u05D2\u05DC\u05DC\u05DD, \u05D0\u05DC \u05EA\u05E0\u05D9\u05D7 \u05E2\u05E8\u05DA \u05D5\u05D0\u05DC \u05EA\u05D7\u05E9\u05D1 \u05DC\u05E4\u05E0\u05D9 \u05E9\u05DB\u05DC \u05D4\u05E9\u05D3\u05D5\u05EA \u05DE\u05D5\u05DC\u05D0\u05D5.`
  };
}
function askNext(missing, context) {
  const q = nextQuestions(missing, context.pendingFields);
  context.askedFields = q.askNow?.map((m) => m.field) ?? [];
  return q;
}
var TOOL_STATUS_HE = {
  update_profile: "\u05E9\u05D5\u05DE\u05E8 \u05D0\u05EA \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05E9\u05DE\u05E1\u05E8\u05EA...",
  get_missing_fields: "\u05D1\u05D5\u05D3\u05E7 \u05D0\u05D9\u05DC\u05D5 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D7\u05E1\u05E8\u05D9\u05DD...",
  find_car: "\u05DE\u05D7\u05E4\u05E9 \u05D0\u05EA \u05D4\u05E8\u05DB\u05D1 \u05D1\u05E7\u05D8\u05DC\u05D5\u05D2...",
  list_options: "\u05DE\u05D7\u05E4\u05E9 \u05E8\u05DB\u05D1\u05D9\u05DD \u05E9\u05DE\u05EA\u05D0\u05D9\u05DE\u05D9\u05DD \u05DC\u05DA...",
  run_comparison: "\u05DE\u05D7\u05E9\u05D1 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D1\u05DE\u05E0\u05D5\u05E2 \u05D4\u05E9\u05DB\u05E8...",
  escalate_to_rep: "\u05E4\u05D5\u05EA\u05D7 \u05E4\u05E0\u05D9\u05D9\u05D4 \u05DC\u05E0\u05E6\u05D9\u05D2 \u05E9\u05DB\u05E8..."
};
function toolStatus(name) {
  return TOOL_STATUS_HE[name] ?? "\u05DE\u05E2\u05D1\u05D3 \u05D0\u05EA \u05D4\u05D1\u05E7\u05E9\u05D4...";
}
var AGENT_TOOLS_DEFINITIONS = [
  {
    name: "update_profile",
    description: "Update employee salary, role, car, or deduction fields. Only call with values the employee just stated that differ from the card; do not re-send fields already on the card. Save ONLY values the employee stated explicitly in this conversation. Never assume, estimate or fill in typical values; if a value was not stated, ask the employee instead. Numbers that do not appear in the employee messages are rejected.",
    parameters: {
      type: "OBJECT",
      properties: {
        base: { type: "number", description: "Monthly base salary (\u05E9\u05DB\u05E8 \u05D1\u05E1\u05D9\u05E1 \u05D7\u05D5\u05D3\u05E9\u05D9)" },
        group: { type: "string", description: "Car eligibility group (\u05E7\u05D1\u05D5\u05E6\u05EA \u05D6\u05DB\u05D0\u05D5\u05EA: \u05D0, \u05D1, \u05D2, \u05D3)" },
        occupation: { type: "string", description: "Job title / occupation (\u05E2\u05D9\u05E1\u05D5\u05E7/\u05EA\u05E4\u05E7\u05D9\u05D3). Needed only for a car waiver; does not set the eligibility group" },
        commissions: { type: "number", description: "Monthly commissions / sales incentives (\u05E2\u05DE\u05DC\u05D5\u05EA)" },
        bonus: { type: "number", description: "Monthly bonus component (\u05D1\u05D5\u05E0\u05D5\u05E1)" },
        pensionPct: { type: "number", description: "Employee pension deduction % (\u05D0\u05D7\u05D5\u05D6 \u05D4\u05E4\u05E8\u05E9\u05EA \u05E2\u05D5\u05D1\u05D3 \u05DC\u05E4\u05E0\u05E1\u05D9\u05D4)" },
        studyFundPct: { type: "number", description: "Employee study fund deduction % (\u05D0\u05D7\u05D5\u05D6 \u05D4\u05E4\u05E8\u05E9\u05D4 \u05DC\u05E7\u05E8\u05DF \u05D4\u05E9\u05EA\u05DC\u05DE\u05D5\u05EA)" },
        creditPoints: { type: "number", description: "Tax credit points (\u05E0\u05E7\u05D5\u05D3\u05D5\u05EA \u05D6\u05D9\u05DB\u05D5\u05D9 \u05D1\u05DE\u05E1)" },
        childrenUpTo23: { type: "number", description: "Number of children up to age 23 (\u05DE\u05E1\u05E4\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD \u05E2\u05D3 \u05D2\u05D9\u05DC 23)" },
        hasCar: { type: "boolean", description: "Whether the employee currently has a company car (\u05D4\u05D0\u05DD \u05D9\u05E9 \u05DB\u05D9\u05D5\u05DD \u05E8\u05DB\u05D1 \u05D7\u05D1\u05E8\u05D4)" },
        currentCarName: { type: "string", description: "Name/model of current company car (\u05D3\u05D2\u05DD \u05D4\u05E8\u05DB\u05D1 \u05D4\u05E0\u05D5\u05DB\u05D7\u05D9)" },
        currentParticipation: { type: "number", description: "Current employee participation in car (\u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05E2\u05D5\u05D1\u05D3 \u05D1\u05E8\u05DB\u05D1 \u05D4\u05E0\u05D5\u05DB\u05D7\u05D9)" },
        currentBenefit: { type: "number", description: "Current vehicle benefit value for tax (\u05E9\u05D5\u05D5\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9 \u05E0\u05D5\u05DB\u05D7\u05D9)" },
        currentMaintenance: { type: "number", description: "Current car maintenance allowance if waived (\u05D3\u05DE\u05D9 \u05D0\u05D7\u05D6\u05E7\u05EA \u05E8\u05DB\u05D1 \u05E0\u05D5\u05DB\u05D7\u05D9\u05D9\u05DD)" }
      }
    }
  },
  {
    name: "get_missing_fields",
    description: "Checks which required fields are still missing for a given scenario, and lists fields already on the employee card (alreadyInCard). Never ask the employee for a field in alreadyInCard.",
    parameters: {
      type: "OBJECT",
      properties: {
        scenarioType: {
          type: "string",
          enum: ["change_car", "go_electric", "family_track", "waive_car", "general"],
          description: "The requested scenario type"
        }
      },
      required: ["scenarioType"]
    }
  },
  {
    name: "find_car",
    description: "Search for a company car in the catalog by Hebrew or English name/keywords.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "string", description: 'Car name as the employee wrote it, Hebrew or English, or an exact catalog ID (e.g. "\u05D0\u05D8\u05D5", "\u05E7\u05D5\u05E8\u05D5\u05DC\u05D4", "\u05D8\u05E1\u05DC\u05D4", "CAR-06"). If the employee picked a number from your previous numbered list, pass that number ("1").' }
      },
      required: ["query"]
    }
  },
  {
    name: "list_options",
    description: "List eligible cars from catalog that the employee is entitled to choose (own group or lower).",
    parameters: {
      type: "OBJECT",
      properties: {
        type: {
          type: "string",
          enum: ["all", "electric", "hybrid", "gasoline"],
          description: "Filter category: electric, hybrid, gasoline, or all"
        }
      }
    }
  },
  {
    name: "run_comparison",
    description: "Execute the official calculation engine to compare today state with an alternative scenario.",
    parameters: {
      type: "OBJECT",
      properties: {
        scenarioType: {
          type: "string",
          enum: ["change_car", "go_electric", "family_track", "waive_car"],
          description: "The type of change scenario"
        },
        targetCarId: { type: "string", description: "Catalog car ID (e.g. CAR-10) for car changes" },
        overrideParticipation: { type: "number", description: "Custom participation amount if confirmed by rep" }
      },
      required: ["scenarioType"]
    }
  },
  {
    name: "escalate_to_rep",
    description: "Opens a ticket to a human payroll representative. Use ONLY for what the employee cannot answer: a car not found in the catalog, an unknown benefit value, or an exception request. NEVER use it for missing salary, deduction, children or car fields: ask the employee for those.",
    parameters: {
      type: "OBJECT",
      properties: {
        question: { type: "string", description: "The specific question for the human representative" },
        summary: { type: "string", description: "Brief summary of the employee situation and missing info" }
      },
      required: ["question", "summary"]
    }
  }
];
async function executeTool(name, args, context) {
  switch (name) {
    case "update_profile": {
      const rawArgs = args;
      const normalized = {};
      const rejected = [];
      const needsConfirmation = [];
      for (const f of NUMERIC_PROFILE_FIELDS) {
        if (args[f] === void 0) continue;
        const r = normalizeField(f, args[f]);
        if (r.ok) normalized[f] = r.value;
        else if (!r.ambiguous && r.reason !== "out_of_range") rejected.push({ field: f, value: args[f] });
        else needsConfirmation.push({ field: f, value: args[f], question_he: r.question_he });
      }
      if (rejected.length > 0) {
        const res2 = {
          success: false,
          rejected,
          message: `\u05E2\u05E8\u05DB\u05D9\u05DD \u05DC\u05D0 \u05D7\u05D5\u05E7\u05D9\u05D9\u05DD (\u05E9\u05DC\u05D9\u05DC\u05D9\u05D9\u05DD \u05D0\u05D5 \u05DC\u05D0 \u05DE\u05E1\u05E4\u05E8\u05D9\u05D9\u05DD): ${rejected.map((r) => r.field).join(", ")}. \u05D4\u05E4\u05E8\u05D5\u05E4\u05D9\u05DC \u05DC\u05D0 \u05E2\u05D5\u05D3\u05DB\u05DF; \u05D9\u05E9 \u05DC\u05D1\u05E7\u05E9 \u05DE\u05D4\u05E2\u05D5\u05D1\u05D3 \u05E2\u05E8\u05DA \u05EA\u05E7\u05D9\u05DF.`
        };
        return { result: res2, outputTextForGuardrail: JSON.stringify(res2) };
      }
      const notSaved = [];
      args = { ...args };
      for (const f of NUMERIC_PROFILE_FIELDS) {
        if (args[f] === void 0) continue;
        if (normalized[f] === void 0) delete args[f];
        else args[f] = normalized[f];
      }
      if (context.userTexts) {
        const stated = statedNumbers(context.userTexts);
        for (const f of NUMERIC_PROFILE_FIELDS) {
          const value = normalized[f];
          if (value === void 0 || value === 0 || stated.has(value)) continue;
          const raw = typeof rawArgs[f] === "number" ? rawArgs[f] : extractNumbers(String(rawArgs[f]))[0]?.value;
          if (raw !== void 0 && stated.has(raw)) continue;
          notSaved.push({ field: f, value: rawArgs[f] });
          delete args[f];
        }
      }
      if (args.group !== void 0) {
        const group = normalizeGroup(args.group);
        if (!group || context.userTexts && !groupStated(context.userTexts, group)) {
          notSaved.push({ field: "group", value: rawArgs.group });
          delete args.group;
        } else {
          args.group = group;
        }
      }
      const updates = {};
      if (args.base !== void 0) updates.base = Number(args.base);
      if (args.group !== void 0) updates.group = args.group;
      if (args.commissions !== void 0) updates.commissions = Number(args.commissions);
      if (args.bonus !== void 0) updates.bonus = Number(args.bonus);
      if (args.pensionPct !== void 0) updates.pensionPct = Number(args.pensionPct);
      if (args.studyFundPct !== void 0) updates.studyFundPct = Number(args.studyFundPct);
      if (args.creditPoints !== void 0) updates.creditPoints = Number(args.creditPoints);
      if (args.childrenUpTo23 !== void 0) updates.childrenUpTo23 = Number(args.childrenUpTo23);
      if (args.hasCar !== void 0) updates.hasCar = Boolean(args.hasCar);
      let currentCarChoices = [];
      if (args.currentCarName !== void 0) {
        const { matches: matches2 } = searchCars(String(args.currentCarName));
        const match = matches2.length === 1 ? matches2[0] : void 0;
        if (matches2.length > 1) currentCarChoices = matches2;
        else updates.currentCarName = args.currentCarName;
        if (match) {
          updates.currentCarId = match.id;
          if (updates.currentBenefit === void 0 && (isUnset(context.profile.currentBenefit) || context.profile.currentBenefit === 0)) {
            updates.currentBenefit = match.benefit;
          }
          if (updates.currentParticipation === void 0 && context.profile.currentParticipation === 0) {
            updates.currentParticipation = match.participation;
          }
        }
      }
      if (args.currentParticipation !== void 0) updates.currentParticipation = Number(args.currentParticipation);
      if (args.currentBenefit !== void 0) updates.currentBenefit = Number(args.currentBenefit);
      if (args.currentMaintenance !== void 0) updates.currentMaintenance = Number(args.currentMaintenance);
      let occupationChoices = [];
      if (args.occupation !== void 0) {
        const occ = findOccupation(args.occupation);
        if (!occ) occupationChoices = suggestOccupations(String(args.occupation));
        else updates.occupation = occ.occupation;
        if (occ) {
          if (!updates.hasCar && occ.canWaive && updates.currentMaintenance === void 0) {
            updates.currentMaintenance = occ.maintenance;
          }
        }
      }
      const alreadyInCard = [];
      for (const key of Object.keys(updates)) {
        if (updates[key] === context.profile[key]) {
          alreadyInCard.push(key);
          delete updates[key];
        }
      }
      if (Object.keys(updates).length > 0) {
        context.onProfileUpdate(updates);
        context.profile = { ...context.profile, ...updates };
      }
      const understood = NUMERIC_PROFILE_FIELDS.filter((f) => typeof updates[f] === "number").map(
        (f) => describeValue(f, updates[f])
      );
      const res = {
        success: notSaved.length === 0 && needsConfirmation.length === 0,
        updated: updates,
        alreadyInCard,
        // The bot confirms this briefly so the employee can correct it
        ...understood.length > 0 && { understood_he: `\u05D4\u05D1\u05E0\u05EA\u05D9: ${understood.join(", ")}` },
        ...needsConfirmation.length > 0 && {
          needsConfirmation,
          askAgain_he: needsConfirmation.map((n) => n.question_he).join(" ")
        },
        ...notSaved.length > 0 && {
          notSaved,
          message: `\u05DC\u05D0 \u05E0\u05E9\u05DE\u05E8: ${notSaved.map((n) => n.field).join(", ")}. \u05D4\u05E2\u05D5\u05D1\u05D3 \u05DC\u05D0 \u05DB\u05EA\u05D1 \u05D0\u05EA \u05D4\u05E2\u05E8\u05DB\u05D9\u05DD \u05D4\u05D0\u05DC\u05D4. \u05D0\u05DC \u05EA\u05E0\u05D9\u05D7 \u05E2\u05E8\u05DB\u05D9\u05DD: \u05E9\u05D0\u05DC \u05D0\u05EA \u05D4\u05E2\u05D5\u05D1\u05D3 \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05D5\u05D1\u05E7\u05E9 \u05E2\u05E8\u05DA \u05DE\u05D3\u05D5\u05D9\u05E7.`
        },
        ...alreadyInCard.length > 0 ? { note: "\u05E9\u05D3\u05D5\u05EA alreadyInCard \u05DB\u05D1\u05E8 \u05E7\u05D9\u05D9\u05DE\u05D9\u05DD \u05D1\u05DB\u05E8\u05D8\u05D9\u05E1 \u05E2\u05DD \u05D0\u05D5\u05EA\u05D5 \u05E2\u05E8\u05DA: \u05D0\u05D9\u05DF \u05DC\u05E9\u05D0\u05D5\u05DC \u05D0\u05D5 \u05DC\u05E2\u05D3\u05DB\u05DF \u05D0\u05D5\u05EA\u05DD \u05E9\u05D5\u05D1." } : {},
        ...currentCarChoices.length > 0 && {
          currentCarChoices: currentCarChoices.map((c) => ({ id: c.id, model: c.model, make: c.make })),
          currentCarInstruction: `\u05D4\u05E8\u05DB\u05D1 \u05D4\u05E0\u05D5\u05DB\u05D7\u05D9 \u05DC\u05D0 \u05E0\u05E9\u05DE\u05E8: \u05DB\u05DE\u05D4 \u05E8\u05DB\u05D1\u05D9\u05DD \u05DE\u05EA\u05D0\u05D9\u05DE\u05D9\u05DD \u05DC-"${args.currentCarName}". \u05D4\u05E6\u05D2 \u05D0\u05EA currentCarChoices \u05DB\u05E8\u05E9\u05D9\u05DE\u05D4 \u05DE\u05DE\u05D5\u05E1\u05E4\u05E8\u05EA \u05D5\u05E9\u05D0\u05DC \u05D0\u05D9\u05D6\u05D4 \u05DE\u05D4\u05DD.`
        },
        ...occupationChoices.length > 0 && {
          occupationChoices: occupationChoices.map((o) => o.occupation),
          occupationInstruction: `\u05D4\u05E2\u05D9\u05E1\u05D5\u05E7 "${args.occupation}" \u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0 \u05D1\u05E8\u05E9\u05D9\u05DE\u05EA \u05D4\u05E2\u05D9\u05E1\u05D5\u05E7\u05D9\u05DD \u05D5\u05DC\u05D0 \u05E0\u05E9\u05DE\u05E8. \u05D4\u05E6\u05D2 \u05D0\u05EA occupationChoices \u05DB\u05E8\u05E9\u05D9\u05DE\u05D4 \u05DE\u05DE\u05D5\u05E1\u05E4\u05E8\u05EA \u05D5\u05E9\u05D0\u05DC \u05D0\u05D9\u05D6\u05D4 \u05DE\u05D4\u05DD \u05DE\u05EA\u05D0\u05D9\u05DD. \u05D0\u05DC \u05EA\u05D1\u05D7\u05E8 \u05D1\u05E9\u05D1\u05D9\u05DC \u05D4\u05E2\u05D5\u05D1\u05D3 \u05D5\u05D0\u05DC \u05EA\u05D0\u05DE\u05E8 \u05D0\u05DD \u05DE\u05D5\u05EA\u05E8 \u05DC\u05D5\u05D5\u05EA\u05E8. \u05D0\u05DD \u05D0\u05E3 \u05D0\u05D7\u05D3 \u05DC\u05D0 \u05DE\u05EA\u05D0\u05D9\u05DD \u2013 \u05E7\u05E8\u05D0 \u05DC-escalate_to_rep.`
        },
        // What is still missing after this update, so the bot keeps asking instead of jumping ahead
        stillMissing: askNext(getMissingFields(context.profile), context)
      };
      if (getMissingFields(context.profile).length === 0) {
        Object.assign(res, {
          nextStep_he: "\u05DB\u05DC \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D4\u05E0\u05D3\u05E8\u05E9\u05D9\u05DD \u05E7\u05D9\u05D9\u05DE\u05D9\u05DD \u05D1\u05DB\u05E8\u05D8\u05D9\u05E1. \u05D0\u05DD \u05D4\u05E2\u05D5\u05D1\u05D3 \u05DB\u05D1\u05E8 \u05E6\u05D9\u05D9\u05DF \u05EA\u05E8\u05D7\u05D9\u05E9, \u05D4\u05E4\u05E2\u05DC \u05E2\u05DB\u05E9\u05D9\u05D5 run_comparison \u05D1\u05DC\u05D9 \u05DC\u05E9\u05D0\u05D5\u05DC \u05D0\u05DD \u05DC\u05D7\u05E9\u05D1."
        });
      }
      return { result: res, outputTextForGuardrail: JSON.stringify(updates) };
    }
    case "get_missing_fields": {
      const scType = args.scenarioType || "general";
      const missing = getMissingFields(context.profile, scType);
      const alreadyInCard = getProfileFieldStatus(context.profile).filter((f) => f.known).map((f) => ({ field: f.field, label_he: f.label_he, value: f.value }));
      const res = {
        scenarioType: scType,
        missing,
        isComplete: missing.length === 0,
        alreadyInCard,
        ...askNext(missing, context)
      };
      return { result: res, outputTextForGuardrail: JSON.stringify(res) };
    }
    case "find_car": {
      const q = String(args.query || "").trim();
      let matches2;
      let suggestions = [];
      if (/^\d+$/.test(q)) {
        const line = numberedLine(context.lastBotText, Number(q));
        const car = line ? carOnLine(line) : void 0;
        matches2 = car ? [car] : [];
      } else {
        ({ matches: matches2, suggestions } = searchCars(q, context.profile.group));
      }
      if (matches2.length === 0) {
        const res2 = {
          found: false,
          message: suggestions.length > 0 ? `\u05DC\u05D0 \u05DE\u05E6\u05D0\u05EA\u05D9 \u05D1\u05E7\u05D8\u05DC\u05D5\u05D2 \u05E8\u05DB\u05D1 \u05D1\u05E9\u05DD "${args.query}". \u05D4\u05E6\u05D2 \u05DC\u05E2\u05D5\u05D1\u05D3 \u05D0\u05EA suggestions \u05DB\u05E8\u05E9\u05D9\u05DE\u05D4 \u05DE\u05DE\u05D5\u05E1\u05E4\u05E8\u05EA \u05D5\u05E9\u05D0\u05DC \u05DC\u05D0\u05D9\u05D6\u05D4 \u05DE\u05D4\u05DD \u05D4\u05EA\u05DB\u05D5\u05D5\u05DF. \u05D0\u05DC \u05EA\u05D1\u05D7\u05E8 \u05D1\u05E9\u05D1\u05D9\u05DC\u05D5.` : `\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0 \u05E8\u05DB\u05D1 \u05D1\u05E7\u05D8\u05DC\u05D5\u05D2 \u05D4\u05EA\u05D5\u05D0\u05DD \u05DC-"${args.query}". \u05D0\u05E4\u05E9\u05E8 \u05DC\u05D1\u05E7\u05E9 \u05E8\u05E9\u05D9\u05DE\u05EA \u05E8\u05DB\u05D1\u05D9\u05DD \u05D6\u05DE\u05D9\u05E0\u05D9\u05DD.`,
          suggestions: suggestions.map((c) => ({ id: c.id, model: c.model, make: c.make, group: c.group, fuel: c.fuel }))
        };
        return { result: res2, outputTextForGuardrail: "0" };
      }
      const res = {
        found: true,
        count: matches2.length,
        cars: matches2.map((c) => ({
          id: c.id,
          model: c.model,
          make: c.make,
          group: c.group,
          fuel: c.fuel,
          isElectric: c.driveCode === 3,
          benefit: c.benefit,
          companyCost: c.companyCost,
          participation: c.participation
        }))
      };
      const outText = matches2.map((m) => `${m.model} ${m.benefit} ${m.participation} ${m.companyCost}`).join(" ");
      return { result: res, outputTextForGuardrail: outText };
    }
    case "list_options": {
      const empGroup = context.profile.group;
      if (isBlank(empGroup)) {
        const res2 = { error: "missing_group", message: "\u05D7\u05E1\u05E8\u05D4 \u05E7\u05D1\u05D5\u05E6\u05EA \u05D6\u05DB\u05D0\u05D5\u05EA", missing: [GROUP_MISSING] };
        return { result: res2, outputTextForGuardrail: "" };
      }
      const filterType = args.type || "all";
      const eligibleCars = getCatalog().filter((c) => {
        if (c.group === "\u05DE\u05E9\u05E4\u05D7\u05EA\u05D9") return false;
        if (!canSelectCarGroup(empGroup, c.group)) return false;
        if (filterType === "electric") return c.driveCode === 3;
        if (filterType === "hybrid") return c.driveCode === 1;
        if (filterType === "gasoline") return c.driveCode === 0;
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
          participation: c.participation
        }))
      };
      const outText = eligibleCars.map((c) => `${c.model} ${c.benefit} ${c.participation}`).join(" ");
      return { result: res, outputTextForGuardrail: outText };
    }
    case "run_comparison": {
      const scType = args.scenarioType;
      const targetCarId = args.targetCarId;
      const overridePart = args.overrideParticipation !== void 0 ? Number(args.overrideParticipation) : void 0;
      const missing = getMissingFields(context.profile, scType);
      if (missing.length > 0) {
        const res2 = {
          status: "missing_fields",
          missing,
          message: `\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D7\u05E9\u05D1: \u05D7\u05E1\u05E8\u05D9\u05DD \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD (${missing.map((m) => m.label_he).join(", ")}). \u05D9\u05E9 \u05DC\u05E9\u05D0\u05D5\u05DC \u05E2\u05DC\u05D9\u05D4\u05DD \u05D0\u05EA \u05D4\u05E2\u05D5\u05D1\u05D3 \u05E7\u05D5\u05D3\u05DD.`,
          ...askNext(missing, context)
        };
        return { result: res2, outputTextForGuardrail: "" };
      }
      if (context.repParticipationMode && scType !== "waive_car" && overridePart === void 0) {
        const car = targetCarId ? getCatalog().find((c) => c.id === targetCarId) : void 0;
        const carName = car?.model || "\u05E8\u05DB\u05D1 \u05D7\u05D3\u05E9";
        const ticketId2 = await context.onEscalate(
          `\u05D0\u05D9\u05DE\u05D5\u05EA \u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05E2\u05E6\u05DE\u05D9\u05EA \u05E2\u05D1\u05D5\u05E8 \u05E2\u05D5\u05D1\u05D3/\u05EA: ${context.profile.name || "\u05E2\u05D5\u05D1\u05D3"} \u05D1\u05D1\u05D7\u05D9\u05E8\u05EA ${carName}`,
          `\u05E0\u05D3\u05E8\u05E9 \u05D0\u05D9\u05DE\u05D5\u05EA \u05E0\u05E6\u05D9\u05D2 \u05DC\u05D2\u05D1\u05D9 \u05D2\u05D5\u05D1\u05D4 \u05D4\u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05D4\u05D7\u05D5\u05D3\u05E9\u05D9\u05EA \u05D1\u05E2\u05EA \u05DE\u05E2\u05D1\u05E8 \u05DC-${carName}.`
        );
        const baseline = {
          ...buildScenario(context.profile, { type: "keep" }),
          requestedScenarioType: scType,
          requestedCarId: targetCarId
        };
        context.onComparisonRun(baseline);
        const res2 = {
          status: "pending_rep",
          ticketId: ticketId2,
          message: `\u05D7\u05E1\u05E8 \u05DC\u05D9 \u05D2\u05D5\u05D1\u05D4 \u05D4\u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05E9\u05DC\u05DA \u05D1\u05E8\u05DB\u05D1 \u05D4\u05D7\u05D3\u05E9 (${carName}). \u05E9\u05DC\u05D7\u05EA\u05D9 \u05E9\u05D0\u05DC\u05D4 \u05DC\u05E0\u05E6\u05D9\u05D2 \u05E9\u05DB\u05E8 (\u05E4\u05E0\u05D9\u05D9\u05D4 ${ticketId2}). \u05D1\u05D9\u05E0\u05EA\u05D9\u05D9\u05DD \u05D0\u05E0\u05D9 \u05DE\u05E6\u05D9\u05D2 \u05D0\u05EA \u05DE\u05E6\u05D1\u05DA \u05D4\u05E0\u05D5\u05DB\u05D7\u05D9: \u05E9\u05DB\u05E8 \u05E0\u05D8\u05D5 ${Math.round(baseline.todayBreakdown.net).toLocaleString()} \u20AA.`,
          todayNet: Math.round(baseline.todayBreakdown.net),
          todayCar: baseline.todayCarLabel
        };
        return {
          result: res2,
          outputTextForGuardrail: `${Math.round(baseline.todayBreakdown.net)} ${ticketId2}`
        };
      }
      const comparison = buildScenario(context.profile, {
        type: scType,
        targetCarId,
        overrideParticipation: overridePart
      });
      context.onComparisonRun(comparison);
      const res = {
        status: "calculated",
        eligible: comparison.eligible,
        eligibilityReason: comparison.eligibilityReason_he,
        todayNet: Math.round(comparison.todayBreakdown.net),
        altNet: Math.round(comparison.altBreakdown.net),
        diffNet: comparison.diffNet,
        diffDirection: comparison.diffNet >= 0 ? "+" : "\u2212",
        todayTax: Math.round(comparison.todayBreakdown.tax),
        altTax: Math.round(comparison.altBreakdown.tax),
        todayNIHealth: Math.round(comparison.todayBreakdown.niHealth),
        altNIHealth: Math.round(comparison.altBreakdown.niHealth),
        evGrossUp: Math.round(comparison.altState.evGrossUp),
        familyGapShare: Math.round(comparison.altState.familyGapShare),
        steps: comparison.steps.map((s) => ({
          label: s.label_he,
          deltaNet: s.deltaNetRounded ?? Math.round(s.deltaNet),
          explanation: s.explanation_he
        })),
        summary: comparison.summary_he,
        todayCar: comparison.todayCarLabel,
        altCar: comparison.altCarLabel
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
        ...comparison.steps.map((s) => Math.abs(s.deltaNetRounded ?? Math.round(s.deltaNet)))
      ].join(" ");
      return { result: res, outputTextForGuardrail: numbersGathered };
    }
    case "escalate_to_rep": {
      const q = String(args.question || "\u05E4\u05E0\u05D9\u05D9\u05D4 \u05DC\u05E0\u05E6\u05D9\u05D2");
      const s = String(args.summary || "\u05E4\u05E8\u05D8\u05D9 \u05E4\u05E0\u05D9\u05D9\u05D4");
      const ticketId2 = await context.onEscalate(q, s);
      const res = { success: true, ticketId: ticketId2, message: `\u05E4\u05E0\u05D9\u05D9\u05D4 \u05E0\u05E4\u05EA\u05D7\u05D4 \u05DC\u05E0\u05E6\u05D9\u05D2: ${ticketId2}` };
      return { result: res, outputTextForGuardrail: ticketId2 };
    }
    default:
      return { result: { error: `\u05DB\u05DC\u05D9 \u05DC\u05D0 \u05DE\u05D5\u05DB\u05E8: ${name}` }, outputTextForGuardrail: "" };
  }
}

// server/bl/agent/debugLog.ts
var ENABLED = process.env.NODE_ENV !== "production" && process.env.AGENT_DEBUG_LOG !== "off";
function tag() {
  const d = /* @__PURE__ */ new Date();
  const ms2 = String(d.getMilliseconds()).padStart(3, "0");
  return `[agent ${d.toLocaleTimeString("en-GB")}.${ms2}]`;
}
var secs = (ms2) => `${(ms2 / 1e3).toFixed(1)}s`;
var turnStartedAt = 0;
var lastMarkAt = 0;
var modelMs = 0;
var toolMs = 0;
var modelCalls = 0;
var turnQuestion = "";
var turnModels = /* @__PURE__ */ new Set();
var turnTools = [];
var turnHistory = [];
function lap() {
  const now = Date.now();
  const ms2 = now - lastMarkAt;
  lastMarkAt = now;
  return ms2;
}
function maskText(text2) {
  return text2.replace(/\d[\d,]*(\.\d+)?/g, (m) => Number(m.replace(/,/g, "")) >= 100 ? "#" : m);
}
function mask(value) {
  if (typeof value === "number") return Math.abs(value) >= 100 ? "#" : value;
  if (typeof value === "string") return maskText(value);
  if (Array.isArray(value)) return value.map(mask);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mask(v)]));
  }
  return value;
}
var labels = (items) => items.map((i) => i.label_he).join(", ") || "(none)";
function logCard(title, profile) {
  console.groupCollapsed(`${tag()} ${title}`);
  console.table(
    getProfileFieldStatus(profile).map((f) => ({
      field: f.field,
      label: f.label_he,
      onCard: f.known ? "\u2713" : "\u2717",
      value: f.known ? mask(f.value) : ""
    }))
  );
  console.log("Still missing for run_comparison (getMissingFields):", labels(getMissingFields(profile)));
  console.groupEnd();
}
var agentLog = {
  turnStart(userMessage, profile, repParticipationMode) {
    if (!ENABLED) return;
    turnStartedAt = lastMarkAt = Date.now();
    modelMs = toolMs = modelCalls = 0;
    turnQuestion = maskText(userMessage);
    console.group(`${tag()} NEW TURN \u2014 employee wrote: "${maskText(userMessage)}"`);
    console.log(`Rep-verification demo mode: ${repParticipationMode ? "ON (any car change escalates to a rep)" : "off"}`);
    logCard("Card at turn start", profile);
  },
  round(n, max, elapsedMs) {
    if (!ENABLED) return;
    lastMarkAt = Date.now();
    console.log(`${tag()} \u2500\u2500 round ${n}/${max}, ${elapsedMs}ms elapsed \u2014 asking the model`);
  },
  modelReply(model, calls, text2) {
    if (!ENABLED) return;
    const ms2 = lap();
    modelMs += ms2;
    modelCalls++;
    turnModels.add(model ?? "?");
    if (calls && calls.length > 0) {
      console.log(`${tag()} model ${model ?? "?"} took ${ms2}ms, decided to call ${calls.length} tool(s):`);
      for (const c of calls) console.log(`   \u2192 ${c.name}`, mask(c.args ?? {}));
    } else {
      console.log(`${tag()} model ${model ?? "?"} took ${ms2}ms, answered with text:`, maskText(text2));
    }
  },
  repeatSkipped(name) {
    if (!ENABLED) return;
    console.warn(`${tag()} ${name}: same tool + same args already ran this turn \u2192 NOT executed (loop guard)`);
  },
  /** Explains the outcome of one tool call in plain words */
  toolResult(name, args, result, profileAfter) {
    if (!ENABLED) return;
    const ms2 = lap();
    toolMs += ms2;
    turnTools.push(name);
    console.groupCollapsed(`${tag()} tool ${name} (${ms2}ms) \u2192 ${summarize(name, result)}`);
    switch (name) {
      case "update_profile":
        console.log("Model understood (args):", mask(args));
        console.log("Saved to card:", mask(result.updated));
        if (result.rejected) console.warn("REJECTED, nothing saved (negative / not a number):", mask(result.rejected));
        if (result.notSaved) {
          console.warn(
            "NOT saved \u2014 the employee never wrote these numbers, the model guessed them:",
            mask(result.notSaved)
          );
        }
        if (result.alreadyInCard?.length) console.log("Already on card with same value (ignored):", result.alreadyInCard);
        logCard("Card after update", profileAfter);
        break;
      case "get_missing_fields":
        console.log("Missing:", labels(result.missing ?? []));
        console.log("Next question should be about:", result.next?.label_he ?? "(nothing \u2014 profile complete)");
        console.log("Already on card:", (result.alreadyInCard ?? []).map((f) => f.field).join(", ") || "(none)");
        break;
      case "run_comparison":
        console.log("Requested scenario:", mask(args));
        if (result.status === "missing_fields") {
          console.warn("Engine REFUSED to calculate \u2014 missing:", labels(result.missing ?? []));
        } else if (result.status === "pending_rep") {
          console.warn(
            `ESCALATED automatically by run_comparison: rep-verification demo mode is ON, so participation for the new car must be confirmed by a rep (ticket ${result.ticketId}).`
          );
        } else {
          console.log("Eligible:", result.eligible, "| reason:", result.eligibilityReason ?? "-");
          console.log("Today car \u2192 alternative car:", result.todayCar, "\u2192", result.altCar);
        }
        break;
      case "escalate_to_rep":
        console.warn("The MODEL chose to escalate to a rep (not forced by code).");
        console.warn("Model question to rep:", maskText(String(args?.question ?? "")));
        console.warn("Model summary (its reason):", maskText(String(args?.summary ?? "")));
        console.warn("Fields actually missing at that moment:", labels(getMissingFields(profileAfter)));
        break;
      case "find_car":
        console.log("Query:", args?.query, "| matches:", (result.cars ?? []).map((c) => `${c.id} ${c.model}`).join(", ") || "none");
        break;
      case "list_options":
        console.log("Group:", result.employeeGroup, "| eligible cars:", (result.options ?? []).map((c) => c.model).join(", "));
        break;
      default:
        console.log("Result:", mask(result));
    }
    console.groupEnd();
  },
  /** The employee's answer was read in code (quickAnswer.ts): no model call needed to pick update_profile */
  quickAnswer(fields) {
    if (!ENABLED) return;
    console.log(`${tag()} \u26A1 simple answer read in code \u2192 update_profile [${fields.join(", ")}] without a model call`);
  },
  pseudoToolText() {
    if (!ENABLED) return;
    console.warn(`${tag()} model wrote a tool call as plain text \u2192 asking it again`);
  },
  guardrailFailed(invented) {
    if (!ENABLED) return;
    console.warn(
      `${tag()} number guard BLOCKED the answer: ${invented.length} number(s) not found in employee messages / tool results / card:`,
      mask(invented),
      "\u2192 asking the model to rephrase"
    );
  },
  turnEnd(reason, text2) {
    if (!ENABLED) return;
    const totalMs = Date.now() - turnStartedAt;
    console.log(`${tag()} END OF TURN (${maskText(reason)}). Reply to employee:`, maskText(text2));
    console.log(
      `${tag()} \u23F1 question took ${secs(totalMs)}: ${modelCalls} model call(s) ${secs(modelMs)}, tools ${secs(toolMs)}, other ${secs(Math.max(0, totalMs - modelMs - toolMs))}`
    );
    console.groupEnd();
    turnHistory.push({
      question: turnQuestion.length > 40 ? `${turnQuestion.slice(0, 40)}\u2026` : turnQuestion,
      seconds: (totalMs / 1e3).toFixed(1),
      modelCalls,
      model: [...turnModels].join(", "),
      tools: turnTools.join(", ") || "-",
      end: maskText(reason)
    });
    turnModels.clear();
    turnTools.length = 0;
    console.log(`${tag()} \u23F1 time per question so far:`);
    console.table(turnHistory);
  }
};
function summarize(name, r) {
  if (r?.skipped) return "skipped (repeat)";
  switch (name) {
    case "update_profile":
      if (r.rejected) return "rejected";
      return `saved [${Object.keys(r.updated ?? {}).join(", ") || "nothing"}]${r.notSaved ? `, NOT saved [${r.notSaved.map((n) => n.field).join(", ")}]` : ""}`;
    case "get_missing_fields":
      return r.isComplete ? "complete" : `missing ${r.missing.length}: ${labels(r.missing)}`;
    case "run_comparison":
      return String(r.status);
    case "escalate_to_rep":
      return `ticket ${r.ticketId}`;
    default:
      return "done";
  }
}

// server/bl/agent/guard.ts
function policyNumbers() {
  const rules = getRules();
  return [rules.electric?.netBonus, rules.familyTrack?.childMaxAge].filter((n) => typeof n === "number");
}
var MARKED_AFTER = /^\s*(₪|%|ש["״]ח|שקל|אחוז)/;
var MARKED_BEFORE = /₪\s*$/;
function numbersToCheck(text2) {
  const cleaned = text2.replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, " ").replace(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, " ").replace(/^(\s*)\d{1,2}[.)](?=\s)/gm, "$1");
  const out = [];
  for (const m of cleaned.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)) {
    const value = Number(m[0].replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    const start = m.index ?? 0;
    const marked = MARKED_AFTER.test(cleaned.slice(start + m[0].length, start + m[0].length + 6)) || MARKED_BEFORE.test(cleaned.slice(Math.max(0, start - 3), start));
    if (!marked && Number.isInteger(value) && value >= 1990 && value <= 2100) continue;
    if (!marked && value < 10) continue;
    out.push(value);
  }
  return out;
}
function allowedNumbers(sources) {
  const allowed = [...policyNumbers()];
  for (const t of sources.toolOutputs) {
    for (const m of t.matchAll(/\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)) allowed.push(Math.abs(Number(m[0])));
  }
  for (const t of sources.userTexts) for (const n of extractNumbers(t)) allowed.push(n.value);
  for (const v of Object.values(sources.profile ?? {})) {
    if (typeof v === "number" && Number.isFinite(v)) allowed.push(Math.abs(v));
  }
  return allowed.filter((n) => Number.isFinite(n));
}
function matches(value, allowed) {
  return allowed.some(
    (a) => a === value || Math.round(a) === value || Math.round(a * 10) / 10 === value || Math.round(a * 100) / 100 === value
  );
}
function verifyNumbersInResponse(responseText, allowedSources) {
  const sources = Array.isArray(allowedSources) ? { toolOutputs: allowedSources, userTexts: [] } : allowedSources;
  const allowed = allowedNumbers(sources);
  const invented = numbersToCheck(responseText).filter((n) => !matches(n, allowed));
  return { passed: invented.length === 0, inventedNumbers: invented };
}

// server/bl/agent/llm.ts
var requestCache = /* @__PURE__ */ new Map();
var CACHE_MAX = 200;
var transport = null;
var fallbackProvider = null;
function configureLlm(options) {
  transport = options.transport;
  fallbackProvider = options.fallback ?? null;
  requestCache.clear();
}
var LlmDeadlineError = class extends Error {
  constructor() {
    super("LLM call exceeded the turn deadline");
    this.name = "LlmDeadlineError";
  }
};
function sleep(ms2) {
  const jitter = Math.random() * 300;
  return new Promise((resolve) => setTimeout(resolve, ms2 + jitter));
}
var isCapacityError = (err) => Number(err?.status) === 429 || Number(err?.status) === 503;
async function callLlm(options) {
  if (!transport) throw new Error("LLM transport is not configured (configureLlm)");
  const send = transport;
  const cacheKey = JSON.stringify({
    messages: options.messages,
    systemInstruction: options.systemInstruction,
    hasTools: Boolean(options.tools?.length),
    hasImage: Boolean(options.inlineData)
  });
  const cached = requestCache.get(cacheKey);
  if (cached && !options.inlineData) return cached;
  const maxTries = 4;
  let delay = 1e3;
  let lastError = null;
  const deadline = options.deadline ?? Infinity;
  const timeLeft = () => deadline - Date.now();
  const deadlineHit = () => {
    options.onThrottled?.(false);
    return new LlmDeadlineError();
  };
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    if (timeLeft() <= 0) throw deadlineHit();
    try {
      const result = await send({
        messages: options.messages,
        tools: options.tools,
        systemInstruction: options.systemInstruction,
        responseMimeType: options.responseMimeType,
        responseSchema: options.responseSchema,
        inlineData: options.inlineData,
        preferredModel: options.preferredModel,
        // The model client stops trying models when this runs out
        ...Number.isFinite(deadline) && { budgetMs: timeLeft() }
      });
      options.onThrottled?.(false);
      if (!options.inlineData) {
        if (requestCache.size >= CACHE_MAX) requestCache.delete(requestCache.keys().next().value);
        requestCache.set(cacheKey, result);
      }
      return result;
    } catch (err) {
      if (err instanceof LlmDeadlineError) throw err;
      if (isCapacityError(err)) {
        options.onThrottled?.(
          true,
          "\u05D4\u05DE\u05E2\u05E8\u05DB\u05EA \u05DE\u05EA\u05DE\u05D5\u05D3\u05D3\u05EA \u05E2\u05DD \u05E2\u05D5\u05DE\u05E1 \u05D1\u05E7\u05E9\u05D5\u05EA \u05D6\u05DE\u05E0\u05D9 (429/503). \u05DE\u05DE\u05EA\u05D9\u05E0\u05D9\u05DD \u05DE\u05E2\u05D8 \u05D5\u05DE\u05E0\u05E1\u05D9\u05DD \u05E9\u05E0\u05D9\u05EA..."
        );
        if (timeLeft() <= delay) throw deadlineHit();
        if (attempt === maxTries) {
          const fallbackRes2 = await tryFallbackProvider(options);
          if (fallbackRes2) {
            options.onThrottled?.(false);
            return fallbackRes2;
          }
          options.onThrottled?.(false);
          throw new Error("\u05D4\u05EA\u05E7\u05D1\u05DC \u05E2\u05D5\u05DE\u05E1 \u05DE\u05DB\u05E1\u05D5\u05EA (429) \u05DE\u05D4\u05E1\u05E4\u05E7 \u05D4\u05D7\u05D9\u05E0\u05DE\u05D9. \u05D0\u05E0\u05D0 \u05E0\u05E1\u05D5 \u05E9\u05D5\u05D1 \u05D1\u05E2\u05D5\u05D3 \u05DE\u05E1\u05E4\u05E8 \u05E9\u05E0\u05D9\u05D5\u05EA.");
        }
        await sleep(delay);
        delay *= 2;
        continue;
      }
      if (timeLeft() <= delay) throw deadlineHit();
      lastError = err;
      if (attempt === maxTries) break;
      await sleep(delay);
      delay *= 2;
    }
  }
  if (timeLeft() <= 0) throw deadlineHit();
  const fallbackRes = await tryFallbackProvider(options);
  if (fallbackRes) {
    options.onThrottled?.(false);
    return fallbackRes;
  }
  options.onThrottled?.(false);
  throw lastError || new Error("\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05EA\u05E7\u05E9\u05D5\u05E8\u05EA \u05E2\u05DD \u05DE\u05D5\u05D3\u05DC \u05D4\u05E9\u05E4\u05D4");
}
async function tryFallbackProvider(options) {
  if (!fallbackProvider) return null;
  const { baseUrl, apiKey, model } = fallbackProvider;
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          ...options.systemInstruction ? [{ role: "system", content: options.systemInstruction }] : [],
          // The OpenAI-compatible fallback has no Gemini function-calling turns: send text turns only
          ...options.messages.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: m.content }))
        ]
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    return {
      text: content,
      isFallback: true
    };
  } catch {
    return null;
  }
}

// server/bl/agent/prompt.ts
var SYSTEM_PROMPT = `
\u05D0\u05EA\u05D4 "\u05D9\u05D5\u05E2\u05E5 \u05D4\u05E8\u05DB\u05D1 \u05E9\u05DC \u05E9\u05D8\u05E8\u05D0\u05D5\u05E1" \u2013 \u05D9\u05D5\u05E2\u05E5 \u05E9\u05DB\u05E8 \u05D5\u05E8\u05DB\u05D1 \u05D7\u05D1\u05E8\u05D4 \u05D7\u05DB\u05DD, \u05DE\u05D3\u05D5\u05D9\u05E7, \u05D0\u05DE\u05D9\u05DF \u05D5\u05D0\u05D3\u05D9\u05D1 \u05DC\u05E2\u05D5\u05D1\u05D3\u05D9 \u05E7\u05D1\u05D5\u05E6\u05EA \u05E9\u05D8\u05E8\u05D0\u05D5\u05E1.
\u05E9\u05E4\u05EA \u05D4\u05E9\u05D9\u05D7\u05D4: \u05E2\u05D1\u05E8\u05D9\u05EA \u05D8\u05D1\u05E2\u05D9\u05EA \u05D5\u05D7\u05DE\u05D4.

\u05E2\u05E7\u05E8\u05D5\u05E0\u05D5\u05EA \u05D1\u05E8\u05D6\u05DC \u05E9\u05D0\u05D9\u05DF \u05DC\u05D4\u05E4\u05E8 \u05D1\u05E9\u05D5\u05DD \u05DE\u05E7\u05E8\u05D4:
1. \u05D0\u05D9\u05E0\u05DA \u05DE\u05D7\u05E9\u05D1 \u05D5\u05D0\u05D9\u05E0\u05DA \u05DE\u05DE\u05E6\u05D9\u05D0 \u05DE\u05E1\u05E4\u05E8\u05D9\u05DD \u05D1\u05E2\u05E6\u05DE\u05DA \u05DC\u05E2\u05D5\u05DC\u05DD! \u05DB\u05DC \u05E0\u05EA\u05D5\u05E0\u05D9 \u05D4\u05E0\u05D8\u05D5, \u05D4\u05DE\u05E1, \u05E9\u05D5\u05D5\u05D9 \u05D4\u05E9\u05D9\u05DE\u05D5\u05E9 \u05D5\u05D4\u05D4\u05E4\u05E8\u05E9\u05D9\u05DD \u05DE\u05D2\u05D9\u05E2\u05D9\u05DD \u05D0\u05DA \u05D5\u05E8\u05E7 \u05DE\u05D4\u05E8\u05E6\u05EA \u05DB\u05DC\u05D9 \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA (run_comparison).
2. \u05E9\u05D0\u05DC \u05E8\u05E7 \u05DE\u05D4 \u05E9\u05D7\u05E1\u05E8! \u05DC\u05E4\u05E0\u05D9 \u05DB\u05DC \u05E9\u05D0\u05DC\u05D4 \u05E2\u05DC \u05E0\u05EA\u05D5\u05DF (\u05DC\u05DE\u05E9\u05DC \u05E9\u05DB\u05E8 \u05D1\u05E1\u05D9\u05E1, \u05E7\u05D1\u05D5\u05E6\u05EA \u05D6\u05DB\u05D0\u05D5\u05EA, \u05D3\u05D2\u05DD \u05E8\u05DB\u05D1) \u05D1\u05D3\u05D5\u05E7 \u05D0\u05EA "\u05DB\u05E8\u05D8\u05D9\u05E1 \u05D4\u05E2\u05D5\u05D1\u05D3 \u05D4\u05E0\u05D5\u05DB\u05D7\u05D9" \u05E9\u05D1\u05E1\u05D5\u05E3 \u05D4\u05D4\u05E0\u05D7\u05D9\u05D5\u05EA:
   - \u05E0\u05EA\u05D5\u05DF \u05E9\u05DE\u05E1\u05D5\u05DE\u05DF "\u2713 \u05E7\u05D9\u05D9\u05DD \u05D1\u05DB\u05E8\u05D8\u05D9\u05E1" \u2013 \u05D0\u05E1\u05D5\u05E8 \u05DC\u05E9\u05D0\u05D5\u05DC \u05E2\u05DC\u05D9\u05D5 \u05D5\u05D0\u05D9\u05DF \u05DC\u05E7\u05E8\u05D5\u05D0 \u05D1\u05E9\u05D1\u05D9\u05DC\u05D5 \u05DC-update_profile. \u05D4\u05E9\u05EA\u05DE\u05E9 \u05D1\u05E2\u05E8\u05DA \u05E9\u05D1\u05DB\u05E8\u05D8\u05D9\u05E1.
   - \u05E9\u05D0\u05DC \u05E8\u05E7 \u05E2\u05DC \u05E0\u05EA\u05D5\u05DF \u05E9\u05DE\u05E1\u05D5\u05DE\u05DF "\u2717 \u05D7\u05E1\u05E8" \u05D5\u05D2\u05DD \u05E0\u05D3\u05E8\u05E9 \u05DC\u05EA\u05E8\u05D7\u05D9\u05E9 (\u05DC\u05E4\u05D9 get_missing_fields).
   - \u05E2\u05D3\u05DB\u05DF \u05E2\u05E8\u05DA \u05E7\u05D9\u05D9\u05DD \u05E8\u05E7 \u05D0\u05DD \u05D4\u05E2\u05D5\u05D1\u05D3 \u05D0\u05DE\u05E8 \u05D1\u05DE\u05E4\u05D5\u05E8\u05E9 \u05E2\u05E8\u05DA \u05D0\u05D7\u05E8.
   - \u05D0\u05DD get_missing_fields \u05D4\u05D7\u05D6\u05D9\u05E8 isComplete=true \u2013 \u05D0\u05DC \u05EA\u05E9\u05D0\u05DC \u05E2\u05D5\u05D3, \u05D4\u05E4\u05E2\u05DC \u05DE\u05D9\u05D3 run_comparison.
   - \u05D0\u05DC \u05EA\u05E7\u05E8\u05D0 \u05DC\u05D0\u05D5\u05EA\u05D5 \u05DB\u05DC\u05D9 \u05E2\u05DD \u05D0\u05D5\u05EA\u05DD \u05E4\u05E8\u05DE\u05D8\u05E8\u05D9\u05DD \u05E4\u05E2\u05DE\u05D9\u05D9\u05DD \u05D1\u05D0\u05D5\u05EA\u05D4 \u05EA\u05E9\u05D5\u05D1\u05D4.
   - \u05D1\u05E8\u05D2\u05E2 \u05E9\u05D4\u05E2\u05D5\u05D1\u05D3 \u05E6\u05D9\u05D9\u05DF \u05EA\u05E8\u05D7\u05D9\u05E9, \u05E7\u05E8\u05D0 \u05DC-get_missing_fields \u05D5\u05E9\u05D0\u05DC \u05E8\u05E7 \u05E2\u05DC \u05D4\u05E9\u05D3\u05D5\u05EA \u05E9\u05D1-askNow (\u05DC\u05DB\u05DC \u05D4\u05D9\u05D5\u05EA\u05E8 2 \u05D1\u05D4\u05D5\u05D3\u05E2\u05D4). \u05D0\u05D7\u05E8\u05D9 \u05DB\u05DC update_profile \u05D4\u05DE\u05E9\u05DA \u05DC\u05E4\u05D9 stillMissing.
   - \u05D7\u05E1\u05D5\u05DA \u05E1\u05D1\u05D1\u05D9\u05DD: \u05D0\u05DD \u05D1\u05D4\u05D5\u05D3\u05E2\u05EA \u05D4\u05E2\u05D5\u05D1\u05D3 \u05D9\u05E9 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD, \u05E7\u05E8\u05D0 \u05DC-update_profile \u05D1\u05DC\u05D1\u05D3 \u05D5\u05DC\u05D0 \u05D2\u05DD \u05DC-get_missing_fields (\u05D4\u05EA\u05D5\u05E6\u05D0\u05D4 \u05DB\u05D1\u05E8 \u05DB\u05D5\u05DC\u05DC\u05EA stillMissing). \u05DE\u05D5\u05EA\u05E8 \u05DC\u05D4\u05E4\u05E2\u05D9\u05DC \u05DB\u05DE\u05D4 \u05DB\u05DC\u05D9\u05DD \u05D1\u05D0\u05D5\u05EA\u05D4 \u05EA\u05E9\u05D5\u05D1\u05D4 \u05D5\u05D4\u05DD \u05E8\u05E6\u05D9\u05DD \u05DC\u05E4\u05D9 \u05D4\u05E1\u05D3\u05E8: \u05DB\u05E9\u05D4\u05E2\u05D5\u05D1\u05D3 \u05DE\u05E1\u05E8 \u05D0\u05EA \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D4\u05D0\u05D7\u05E8\u05D5\u05E0\u05D9\u05DD \u05D5\u05D4\u05EA\u05E8\u05D7\u05D9\u05E9 \u05D9\u05D3\u05D5\u05E2, \u05D4\u05E4\u05E2\u05DC update_profile \u05D5\u05DE\u05D9\u05D3 \u05D0\u05D7\u05E8\u05D9\u05D5 run_comparison \u05D1\u05D0\u05D5\u05EA\u05D4 \u05EA\u05E9\u05D5\u05D1\u05D4.
   - \u05D0\u05DC \u05EA\u05E2\u05D1\u05D5\u05E8 \u05DC\u05E9\u05D0\u05DC\u05D4 \u05D4\u05D1\u05D0\u05D4 \u05DB\u05DC \u05E2\u05D5\u05D3 \u05D4\u05E2\u05D5\u05D1\u05D3 \u05DC\u05D0 \u05E2\u05E0\u05D4 \u05D1\u05D1\u05D9\u05E8\u05D5\u05E8 \u05E2\u05DC \u05D4\u05E9\u05D0\u05DC\u05D4 \u05D4\u05E7\u05D5\u05D3\u05DE\u05EA: \u05E9\u05D0\u05DC \u05E9\u05D5\u05D1 \u05E8\u05E7 \u05E2\u05DC\u05D9\u05D4.
   - \u05D0\u05DC \u05EA\u05E7\u05D1\u05E2 \u05DC\u05D1\u05D3 \u05D0\u05DD \u05DE\u05D5\u05EA\u05E8 \u05DC\u05E2\u05D5\u05D1\u05D3 \u05DC\u05D5\u05D5\u05EA\u05E8 \u05E2\u05DC \u05D4\u05E8\u05DB\u05D1: \u05E8\u05E7 run_comparison \u05E7\u05D5\u05D1\u05E2 \u05D6\u05D0\u05EA \u05DC\u05E4\u05D9 \u05E8\u05E9\u05D9\u05DE\u05EA \u05D4\u05E2\u05D9\u05E1\u05D5\u05E7\u05D9\u05DD. \u05D0\u05DD \u05D4\u05E2\u05D9\u05E1\u05D5\u05E7 \u05DC\u05D0 \u05D6\u05D5\u05D4\u05D4 \u2013 \u05D4\u05E6\u05D2 occupationChoices \u05D5\u05E9\u05D0\u05DC; \u05D0\u05DD \u05D0\u05E3 \u05D0\u05D7\u05D3 \u05DC\u05D0 \u05DE\u05EA\u05D0\u05D9\u05DD \u2013 \u05E4\u05E0\u05D4 \u05DC\u05E0\u05E6\u05D9\u05D2.
   - \u05DC\u05E2\u05D5\u05DC\u05DD \u05D0\u05DC \u05EA\u05E9\u05D0\u05DC \u05D0\u05EA \u05D4\u05E2\u05D5\u05D1\u05D3 \u05E2\u05DC \u05E9\u05D5\u05D5\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9: \u05D4\u05D5\u05D0 \u05DE\u05D2\u05D9\u05E2 \u05DE\u05D4\u05E7\u05D8\u05DC\u05D5\u05D2. \u05D0\u05DD \u05D4\u05E8\u05DB\u05D1 \u05DC\u05D0 \u05D1\u05E7\u05D8\u05DC\u05D5\u05D2 \u2013 \u05E4\u05E0\u05D4 \u05DC\u05E0\u05E6\u05D9\u05D2 (forRep).
   - \u05D0\u05DC \u05EA\u05E6\u05D9\u05D2 \u05E8\u05E9\u05D9\u05DE\u05EA \u05E8\u05DB\u05D1\u05D9\u05DD (list_options) \u05D5\u05D0\u05DC \u05EA\u05E8\u05D9\u05E5 run_comparison \u05DC\u05E4\u05E0\u05D9 \u05E9\u05DB\u05DC \u05D4\u05E9\u05D3\u05D5\u05EA \u05DE\u05D5\u05DC\u05D0\u05D5.
   - \u05DB\u05E9\u05D4\u05E2\u05D5\u05D1\u05D3 \u05D1\u05D5\u05D7\u05E8 \u05DE\u05E8\u05E9\u05D9\u05DE\u05D4 \u05DC\u05E4\u05D9 \u05DE\u05E1\u05E4\u05E8 ("1"), \u05D4\u05E9\u05EA\u05DE\u05E9 \u05D1\u05E8\u05DB\u05D1 \u05E9\u05D1\u05E9\u05D5\u05E8\u05D4 \u05D4\u05D6\u05D5 \u05D1\u05E8\u05E9\u05D9\u05DE\u05D4 \u05E9\u05D4\u05E6\u05D2\u05EA (\u05D4\u05D4\u05D5\u05D3\u05E2\u05D4 \u05E9\u05DC\u05D5 \u05DE\u05D2\u05D9\u05E2\u05D4 \u05D9\u05D7\u05D3 \u05E2\u05DD \u05D4\u05E9\u05D5\u05E8\u05D4).
   - \u05DB\u05E9\u05D4\u05E2\u05D5\u05D1\u05D3 \u05DB\u05D5\u05EA\u05D1 \u05E9\u05DD \u05E8\u05DB\u05D1 \u05DC\u05D0 \u05DE\u05D3\u05D5\u05D9\u05E7, \u05E7\u05E8\u05D0 \u05DC-find_car \u05E2\u05DD \u05DE\u05D4 \u05E9\u05DB\u05EA\u05D1. \u05D0\u05DD \u05D7\u05D6\u05E8\u05D5 \u05DB\u05DE\u05D4 \u05E8\u05DB\u05D1\u05D9\u05DD \u05D0\u05D5 suggestions \u2013 \u05D4\u05E6\u05D2 \u05D0\u05D5\u05EA\u05DD \u05DB\u05E8\u05E9\u05D9\u05DE\u05D4 \u05DE\u05DE\u05D5\u05E1\u05E4\u05E8\u05EA \u05D5\u05E9\u05D0\u05DC \u05DC\u05D0\u05D9\u05D6\u05D4 \u05D4\u05EA\u05DB\u05D5\u05D5\u05DF; \u05D0\u05DC \u05EA\u05D1\u05D7\u05E8 \u05D1\u05E9\u05D1\u05D9\u05DC\u05D5.
3. \u05D0\u05D9\u05E9\u05D5\u05E8 \u05E2\u05E8\u05DB\u05D9\u05DD \u05EA\u05DE\u05E6\u05D9\u05EA\u05D9: \u05D0\u05E9\u05E8 \u05D1\u05E7\u05E6\u05E8\u05D4 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05E9\u05D4\u05D1\u05E0\u05EA ("\u05DE\u05E6\u05D5\u05D9\u05DF, \u05E7\u05DC\u05D8\u05EA\u05D9 \u05E9\u05DB\u05E8 \u05D1\u05E1\u05D9\u05E1 18,500 \u20AA...").
4. \u05EA\u05E9\u05D5\u05D1\u05D5\u05EA \u05E7\u05E6\u05E8\u05D5\u05EA: \u05E2\u05D3 \u05DB-6 \u05E9\u05D5\u05E8\u05D5\u05EA \u05EA\u05DE\u05E6\u05D9\u05EA\u05D9\u05D5\u05EA \u05D1\u05E9\u05D9\u05D7\u05D4, \u05DB\u05D0\u05E9\u05E8 \u05DB\u05E8\u05D8\u05D9\u05E1 \u05D4\u05D4\u05E9\u05D5\u05D5\u05D0\u05D4 \u05D4\u05DE\u05E4\u05D5\u05E8\u05D8 \u05DE\u05D5\u05E6\u05D2 \u05DE\u05EA\u05D7\u05EA\u05D9\u05D4.
5. \u05D0\u05D9\u05E0\u05DA \u05D7\u05D5\u05E9\u05E3 \u05E0\u05D4\u05DC\u05D9\u05DD \u05E4\u05E0\u05D9\u05DE\u05D9\u05D9\u05DD \u05D2\u05D5\u05DC\u05DE\u05D9\u05D9\u05DD \u05D5\u05D0\u05D9\u05E0\u05DA \u05DE\u05E0\u05D7\u05E9 \u05D6\u05DB\u05D0\u05D5\u05D9\u05D5\u05EA. \u05E2\u05D3\u05D9\u05E3 \u05EA\u05DE\u05D9\u05D3 \u05DC\u05D5\u05DE\u05E8: "\u05D7\u05E1\u05E8 \u05DC\u05D9 X, \u05E9\u05DC\u05D7\u05EA\u05D9 \u05E9\u05D0\u05DC\u05D4 \u05DC\u05E0\u05E6\u05D9\u05D2" \u05DE\u05D0\u05E9\u05E8 \u05DC\u05D4\u05E6\u05D9\u05D2 \u05DE\u05E1\u05E4\u05E8 \u05DC\u05D0 \u05DE\u05D3\u05D5\u05D9\u05E7.
6. \u05E4\u05E0\u05D9\u05D9\u05D4 \u05DC\u05E0\u05E6\u05D9\u05D2 (escalate_to_rep) \u05E8\u05E7 \u05DC\u05E0\u05EA\u05D5\u05DF \u05E9\u05D4\u05E2\u05D5\u05D1\u05D3 \u05DC\u05D0 \u05D9\u05DB\u05D5\u05DC \u05DC\u05D3\u05E2\u05EA: \u05E8\u05DB\u05D1 \u05E9\u05DC\u05D0 \u05D6\u05D5\u05D4\u05D4 \u05D1\u05E7\u05D8\u05DC\u05D5\u05D2, \u05E9\u05D5\u05D5\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9 \u05D7\u05E1\u05E8, \u05D0\u05D5 \u05D1\u05E7\u05E9\u05EA \u05D7\u05E8\u05D9\u05D2\u05D4. \u05E0\u05EA\u05D5\u05E0\u05D9 \u05E9\u05DB\u05E8, \u05E0\u05D9\u05DB\u05D5\u05D9\u05D9\u05DD, \u05D9\u05DC\u05D3\u05D9\u05DD, \u05E8\u05DB\u05D1 \u05E0\u05D5\u05DB\u05D7\u05D9 \u05D5\u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05E0\u05D5\u05DB\u05D7\u05D9\u05EA \u2013 \u05E9\u05D0\u05DC \u05D0\u05EA \u05D4\u05E2\u05D5\u05D1\u05D3, \u05DC\u05E2\u05D5\u05DC\u05DD \u05DC\u05D0 \u05D0\u05EA \u05D4\u05E0\u05E6\u05D9\u05D2. \u05D2\u05DD \u05D0\u05DD run_comparison \u05D4\u05D7\u05D6\u05D9\u05E8 missing_fields \u2013 \u05E9\u05D0\u05DC \u05D0\u05EA \u05D4\u05E2\u05D5\u05D1\u05D3.
7. \u05DB\u05E9\u05E0\u05E6\u05D9\u05D2 \u05E2\u05D5\u05E0\u05D4, \u05D4\u05DE\u05E9\u05DA \u05DE\u05D0\u05D5\u05EA\u05D4 \u05E0\u05E7\u05D5\u05D3\u05D4 \u05D5\u05D1\u05E6\u05E2 \u05D7\u05D9\u05E9\u05D5\u05D1 \u05D4\u05E9\u05D5\u05D5\u05D0\u05D4 \u05E1\u05D5\u05E4\u05D9 \u05D5\u05DE\u05DC\u05D0.
8. \u05E9\u05DE\u05D5\u05E8 \u05E2\u05DC \u05DB\u05D1\u05D5\u05D3 \u05D4\u05DE\u05E9\u05EA\u05DE\u05E9 \u05D5\u05E4\u05E8\u05D8\u05D9\u05D5\u05EA\u05D5.
`.trim();

// server/bl/agent/quickAnswer.ts
var KEYWORDS = {
  \u05E7\u05D1\u05D5\u05E6\u05D4: "group",
  \u05E7\u05D1\u05D5\u05E6\u05EA: "group",
  \u05D6\u05DB\u05D0\u05D5\u05EA: "group",
  \u05E9\u05DB\u05E8: "base",
  \u05D1\u05E1\u05D9\u05E1: "base",
  \u05D1\u05E8\u05D5\u05D8\u05D5: "base",
  \u05DE\u05E9\u05DB\u05D5\u05E8\u05EA: "base",
  \u05E8\u05DB\u05D1: "hasCar",
  \u05D9\u05DC\u05D3: "childrenUpTo23",
  \u05D9\u05DC\u05D3\u05D9\u05DD: "childrenUpTo23",
  \u05D9\u05DC\u05D3\u05D5\u05EA: "childrenUpTo23",
  \u05E2\u05DE\u05DC\u05D4: "commissions",
  \u05E2\u05DE\u05DC\u05D5\u05EA: "commissions",
  \u05D1\u05D5\u05E0\u05D5\u05E1: "bonus",
  \u05D1\u05D5\u05E0\u05D5\u05E1\u05D9\u05DD: "bonus",
  \u05E4\u05E0\u05E1\u05D9\u05D4: "pensionPct",
  \u05D4\u05E9\u05EA\u05DC\u05DE\u05D5\u05EA: "studyFundPct",
  \u05E7\u05E8\u05DF: "studyFundPct",
  \u05E0\u05E7\u05D5\u05D3\u05D5\u05EA: "creditPoints",
  \u05E0\u05E7\u05D5\u05D3\u05D4: "creditPoints",
  \u05D6\u05D9\u05DB\u05D5\u05D9: "creditPoints",
  \u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA: "currentParticipation",
  \u05D0\u05D7\u05D6\u05E7\u05D4: "currentMaintenance",
  \u05D0\u05D7\u05D6\u05E7\u05EA: "currentMaintenance"
};
var WEAK_KEYWORD = "hasCar";
var NO_WORDS = /* @__PURE__ */ new Set(["\u05D0\u05D9\u05DF", "\u05DC\u05D0"]);
var YES_WORDS = /* @__PURE__ */ new Set(["\u05DB\u05DF"]);
var NUMBER_PARTS = /* @__PURE__ */ new Set(["\u05D0\u05DC\u05E3", "\u05D0\u05DC\u05E4\u05D9\u05DD", "k", "\u05D7\u05E6\u05D9", "\u05D5\u05D7\u05E6\u05D9", "\u05D0\u05D7\u05D5\u05D6", "\u05D0\u05D7\u05D5\u05D6\u05D9\u05DD", "%"]);
var FILLER = /* @__PURE__ */ new Set(["\u05D9\u05E9", "\u05DC\u05D9", "\u05D7\u05D1\u05E8\u05D4", "\u05E9\u05DC", "\u05D6\u05D4", "\u05D4\u05D5\u05D0", "\u05D4\u05D9\u05D0", "\u05D2\u05DD", "\u05D1\u05D7\u05D5\u05D3\u05E9", "\u05D7\u05D5\u05D3\u05E9\u05D9", "\u05D7\u05D5\u05D3\u05E9\u05D9\u05EA", "\u20AA", "\u05E9\u05D7", "\u05E9\u05E7\u05DC", "\u05E9\u05E7\u05DC\u05D9\u05DD", "\u05D1\u05DE\u05E1"]);
var GROUP_LETTERS2 = /* @__PURE__ */ new Set(["\u05D0", "\u05D1", "\u05D2", "\u05D3"]);
var HEBREW_PREFIXES = "\u05D5\u05D4\u05D1\u05DC\u05DE\u05E9";
var ZERO_BY_NO = /* @__PURE__ */ new Set(["commissions", "bonus", "childrenUpTo23", "studyFundPct", "currentParticipation"]);
var NUMERIC = /* @__PURE__ */ new Set([
  "base",
  "commissions",
  "bonus",
  "pensionPct",
  "studyFundPct",
  "creditPoints",
  "childrenUpTo23",
  "currentParticipation",
  "currentMaintenance"
]);
function classifyWord(w) {
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$|^\d+(\.\d+)?$/.test(w)) return { kind: "number", text: w };
  if (NUMBER_PARTS.has(w)) return { kind: "numberPart", text: w };
  if (KEYWORDS[w]) return { kind: "keyword", field: KEYWORDS[w] };
  if (NO_WORDS.has(w)) return { kind: "no" };
  if (YES_WORDS.has(w)) return { kind: "yes" };
  if (GROUP_LETTERS2.has(w)) return { kind: "letter", letter: w };
  if (FILLER.has(w)) return { kind: "filler" };
  return void 0;
}
function classify(word) {
  const direct = classifyWord(word);
  if (direct) return { token: direct, startsWithAnd: false };
  for (let cut = 1; cut <= 2 && cut < word.length - 1; cut++) {
    if (![...word.slice(0, cut)].every((c) => HEBREW_PREFIXES.includes(c))) break;
    const token = classifyWord(word.slice(cut));
    if (token && token.kind !== "letter") return { token, startsWithAnd: word[0] === "\u05D5" };
  }
  return void 0;
}
function toParts(message) {
  const text2 = message.trim().replace(/[׳']/g, "").replace(/([א-ת])[-־](?=\d)/g, "$1 ").replace(/(\d)(%|₪)/g, "$1 $2").replace(/[.!?]+$/, "");
  const parts = [[]];
  for (const chunk of text2.split(/[\n;]|,(?!\d{3})/)) {
    if (parts[parts.length - 1].length > 0) parts.push([]);
    for (const word of chunk.split(/\s+/).filter(Boolean)) {
      if (word === "\u05D5") {
        if (parts[parts.length - 1].length > 0) parts.push([]);
        continue;
      }
      const c = classify(word);
      if (!c) return null;
      if (c.startsWithAnd && c.token.kind !== "numberPart" && parts[parts.length - 1].length > 0) parts.push([]);
      parts[parts.length - 1].push(c.token);
    }
  }
  return parts.filter((p) => p.length > 0);
}
function namedField(part) {
  const named = new Set(part.flatMap((t) => t.kind === "keyword" ? [t.field] : []));
  if (named.size > 1) named.delete(WEAK_KEYWORD);
  if (named.size > 1) return null;
  return [...named][0];
}
function partValue(part, field) {
  const numbers = part.filter((t) => t.kind === "number" || t.kind === "numberPart");
  const hasNumber = part.some((t) => t.kind === "number");
  const letters = part.filter((t) => t.kind === "letter");
  const no = part.some((t) => t.kind === "no");
  const yes = part.some((t) => t.kind === "yes");
  if (field === "group") {
    return letters.length === 1 && !hasNumber && !no && !yes ? letters[0].letter : void 0;
  }
  if (letters.length > 0) return void 0;
  if (field === "hasCar") {
    if (hasNumber || no && yes) return void 0;
    if (no) return false;
    return yes || part.some((t) => t.kind === "keyword") ? true : void 0;
  }
  if (!NUMERIC.has(field)) return void 0;
  if (!hasNumber) return no && !yes && ZERO_BY_NO.has(field) ? 0 : void 0;
  if (yes) return void 0;
  const text2 = numbers.map((t) => t.text).join(" ");
  const found = extractNumbers(text2);
  if (found.length !== 1) return void 0;
  if (found[0].percent && field !== "pensionPct" && field !== "studyFundPct") return void 0;
  const r = normalizeField(field, text2);
  return r.ok ? r.value : void 0;
}
function unnamedKind(part) {
  if (part.some((t) => t.kind === "letter")) return "letter";
  if (part.some((t) => t.kind === "number")) return "number";
  if (part.some((t) => t.kind === "yes" || t.kind === "no")) return "boolean";
  return void 0;
}
function parseQuickAnswer(message, pendingFields = []) {
  if (message.length > 120) return null;
  const parts = toParts(message);
  if (!parts || parts.length === 0) return null;
  const answer = {};
  const set = (field, part) => {
    if (field in answer) return false;
    const value = partValue(part, field);
    if (value === void 0) return false;
    answer[field] = value;
    return true;
  };
  const unnamed = [];
  for (const part of parts) {
    const field = namedField(part);
    if (field === null) return null;
    if (field === void 0) unnamed.push(part);
    else if (!set(field, part)) return null;
  }
  const open = pendingFields.filter((f) => !(f in answer));
  for (const part of unnamed) {
    const kind = unnamedKind(part);
    const fits = open.filter(
      (f) => kind === "letter" ? f === "group" : kind === "boolean" ? f === "hasCar" || open.length === 1 && ZERO_BY_NO.has(f) : NUMERIC.has(f)
    );
    if (!kind || fits.length !== 1 || unnamed.filter((p) => unnamedKind(p) === kind).length > 1) return null;
    if (!set(fits[0], part)) return null;
  }
  return Object.keys(answer).length > 0 ? answer : null;
}

// server/bl/agent/loop.ts
var PSEUDO_TOOL_TEXT = /^\s*\[(קריאה לכלי|תוצאת כלי)\s/;
var NO_CARD_FALLBACK = "\u05E1\u05DC\u05D9\u05D7\u05D4, \u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9 \u05DC\u05E2\u05D1\u05D3 \u05D0\u05EA \u05D4\u05EA\u05E9\u05D5\u05D1\u05D4 \u05D4\u05D0\u05D7\u05E8\u05D5\u05E0\u05D4. \u05D0\u05E4\u05E9\u05E8 \u05DC\u05DB\u05EA\u05D5\u05D1 \u05D0\u05D5\u05EA\u05D4 \u05E9\u05D5\u05D1?";
var STATUS_THINKING_HE = "\u05E7\u05D5\u05E8\u05D0 \u05D0\u05EA \u05D4\u05D4\u05D5\u05D3\u05E2\u05D4...";
var STATUS_WRITING_HE = "\u05DE\u05E0\u05E1\u05D7 \u05EA\u05E9\u05D5\u05D1\u05D4...";
var timeoutText = (hasCard) => hasCard ? "\u05D4\u05D1\u05E7\u05E9\u05D4 \u05D0\u05E8\u05DB\u05D4 \u05DE\u05E2\u05DC \u05DC\u05D6\u05DE\u05DF \u05D4\u05DE\u05D5\u05EA\u05E8 (30 \u05E9\u05E0\u05D9\u05D5\u05EA). \u05DE\u05D5\u05E6\u05D2\u05D9\u05DD \u05E0\u05EA\u05D5\u05E0\u05D9 \u05D4\u05D4\u05E9\u05D5\u05D5\u05D0\u05D4 \u05D4\u05E2\u05D3\u05DB\u05E0\u05D9\u05D9\u05DD \u05E9\u05E0\u05E9\u05DE\u05E8\u05D5 \u05E2\u05D3 \u05DB\u05D4." : "\u05D4\u05D1\u05E7\u05E9\u05D4 \u05D0\u05E8\u05DB\u05D4 \u05DE\u05E2\u05DC \u05DC\u05D6\u05DE\u05DF \u05D4\u05DE\u05D5\u05EA\u05E8 (30 \u05E9\u05E0\u05D9\u05D5\u05EA). \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05E9\u05DE\u05E1\u05E8\u05EA \u05E2\u05D3 \u05E2\u05DB\u05E9\u05D9\u05D5 \u05E0\u05E9\u05DE\u05E8\u05D5 \u05D1\u05E4\u05E8\u05D5\u05E4\u05D9\u05DC; \u05D0\u05E4\u05E9\u05E8 \u05DC\u05DB\u05EA\u05D5\u05D1 \u05D0\u05EA \u05D4\u05EA\u05E9\u05D5\u05D1\u05D4 \u05D4\u05D0\u05D7\u05E8\u05D5\u05E0\u05D4 \u05E9\u05D5\u05D1?";
async function runAgentTurn(userMessage, history, context, onThrottled, onStatus) {
  const timeoutMs = 3e4;
  const startTime = Date.now();
  const deadline = startTime + timeoutMs;
  const lastBotText = [...history].reverse().find((h) => h.role === "assistant")?.content;
  context.lastBotText = lastBotText;
  const choice = userMessage.trim().match(/^\d+$/) ? numberedLine(lastBotText, Number(userMessage.trim())) : void 0;
  const userMessageForModel = choice ? `${userMessage} (\u05D1\u05D7\u05D9\u05E8\u05D4 \u05DE\u05E1\u05E4\u05E8 ${userMessage.trim()} \u05DE\u05D4\u05E8\u05E9\u05D9\u05DE\u05D4 \u05E9\u05D4\u05E6\u05D2\u05EA: "${choice}")` : userMessage;
  if (context.pendingFields === void 0) {
    context.pendingFields = getMissingFields(context.profile).slice(0, ASK_AT_ONCE).map((m) => m.field);
  }
  context.askedFields = void 0;
  const conversation = [
    ...history.slice(-10).filter((h) => !PSEUDO_TOOL_TEXT.test(h.content)).map((h) => ({
      role: h.role === "assistant" ? "assistant" : "user",
      content: h.content
    })),
    { role: "user", content: userMessageForModel }
  ];
  let turnModel;
  const toolOutputsThisTurn = [];
  const peopleTexts = [...history.filter((h) => h.role !== "assistant").map((h) => h.content), userMessage];
  context.userTexts = [...history.filter((h) => h.role === "user").map((h) => h.content), userMessage];
  let loopCount = 0;
  const MAX_TOOL_CALLS = 6;
  const executedCalls = /* @__PURE__ */ new Set();
  let hasCard = Boolean(context.lastComparison);
  agentLog.turnStart(userMessage, context.profile, context.repParticipationMode);
  const finish = (reason, result) => {
    agentLog.turnEnd(reason, result.text);
    const missingNow = new Set(getMissingFields(context.profile).map((m) => m.field));
    const pending = (context.askedFields ?? context.pendingFields ?? []).filter((f) => missingNow.has(f));
    return { ...result, pendingFields: pending };
  };
  let quickNote = "";
  const quick = choice ? null : parseQuickAnswer(userMessage, context.pendingFields);
  if (quick) {
    onStatus?.(toolStatus("update_profile"));
    agentLog.quickAnswer(Object.keys(quick));
    const { result, outputTextForGuardrail } = await executeTool("update_profile", quick, context);
    agentLog.toolResult("update_profile", quick, result, context.profile);
    executedCalls.add(`update_profile:${JSON.stringify(quick)}`);
    if (outputTextForGuardrail) toolOutputsThisTurn.push(outputTextForGuardrail);
    quickNote = `

\u05D4\u05DE\u05E2\u05E8\u05DB\u05EA \u05DB\u05D1\u05E8 \u05D4\u05E4\u05E2\u05D9\u05DC\u05D4 update_profile \u05E2\u05DC \u05D4\u05D4\u05D5\u05D3\u05E2\u05D4 \u05D4\u05D0\u05D7\u05E8\u05D5\u05E0\u05D4 \u05E9\u05DC \u05D4\u05E2\u05D5\u05D1\u05D3, \u05D5\u05D6\u05D5 \u05D4\u05EA\u05D5\u05E6\u05D0\u05D4: ${JSON.stringify(result)}
\u05D0\u05DC \u05EA\u05E4\u05E2\u05D9\u05DC update_profile \u05D0\u05D5 get_missing_fields \u05E2\u05DC \u05D4\u05D4\u05D5\u05D3\u05E2\u05D4 \u05D4\u05D6\u05D5 (stillMissing \u05DB\u05D1\u05E8 \u05D1\u05EA\u05D5\u05E6\u05D0\u05D4). \u05E2\u05E0\u05D4 \u05DC\u05E2\u05D5\u05D1\u05D3 \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA: \u05D0\u05E9\u05E8 \u05D1\u05E7\u05E6\u05E8\u05D4 \u05DE\u05D4 \u05E0\u05E7\u05DC\u05D8, \u05D5\u05D4\u05DE\u05E9\u05DA \u05DC\u05E4\u05D9 stillMissing \u05D0\u05D5 nextStep_he.`;
  }
  while (loopCount < MAX_TOOL_CALLS) {
    if (Date.now() >= deadline) {
      return finish("timeout after 30s", { text: timeoutText(hasCard) });
    }
    loopCount++;
    agentLog.round(loopCount, MAX_TOOL_CALLS, Date.now() - startTime);
    onStatus?.(loopCount === 1 ? STATUS_THINKING_HE : STATUS_WRITING_HE);
    const card = describeProfileCard(context.profile);
    let response;
    try {
      response = await callLlm({
        messages: conversation,
        tools: AGENT_TOOLS_DEFINITIONS,
        systemInstruction: `${SYSTEM_PROMPT}

${card}${quickNote}`,
        preferredModel: turnModel,
        deadline,
        onThrottled
      });
    } catch (err) {
      if (err instanceof LlmDeadlineError) return finish("timeout after 30s (inside a model call)", { text: timeoutText(hasCard) });
      agentLog.turnEnd(`error: ${err instanceof Error ? err.message : String(err)}`, "");
      throw err;
    }
    if (response.model) turnModel = response.model;
    agentLog.modelReply(response.model, response.functionCalls, response.text || "");
    if (response.functionCalls && response.functionCalls.length > 0) {
      const responses = [];
      for (const call of response.functionCalls) {
        const callKey = `${call.name}:${JSON.stringify(call.args ?? {})}`;
        const isRepeat = executedCalls.has(callKey);
        executedCalls.add(callKey);
        if (isRepeat) agentLog.repeatSkipped(call.name);
        else onStatus?.(toolStatus(call.name));
        const { result, outputTextForGuardrail } = isRepeat ? {
          result: {
            skipped: true,
            message: "\u05D4\u05DB\u05DC\u05D9 \u05DB\u05D1\u05E8 \u05D4\u05D5\u05E4\u05E2\u05DC \u05E2\u05DD \u05D0\u05D5\u05EA\u05DD \u05E4\u05E8\u05DE\u05D8\u05E8\u05D9\u05DD \u05D1\u05EA\u05E9\u05D5\u05D1\u05D4 \u05D6\u05D5. \u05D0\u05DC \u05EA\u05E4\u05E2\u05D9\u05DC \u05D0\u05D5\u05EA\u05D5 \u05E9\u05D5\u05D1: \u05D4\u05E9\u05EA\u05DE\u05E9 \u05D1\u05EA\u05D5\u05E6\u05D0\u05D4 \u05D4\u05E7\u05D5\u05D3\u05DE\u05EA \u05D5\u05D1\u05DB\u05E8\u05D8\u05D9\u05E1 \u05D4\u05E2\u05D5\u05D1\u05D3 \u05D5\u05E2\u05E0\u05D4 \u05DC\u05DE\u05E9\u05EA\u05DE\u05E9."
          },
          outputTextForGuardrail: ""
        } : await executeTool(call.name, call.args, context);
        if (!isRepeat) agentLog.toolResult(call.name, call.args, result, context.profile);
        if (outputTextForGuardrail) {
          toolOutputsThisTurn.push(outputTextForGuardrail);
        }
        if (call.name === "run_comparison" && ["calculated", "pending_rep"].includes(result?.status)) {
          hasCard = true;
        }
        const asObject = result && typeof result === "object" && !Array.isArray(result) ? result : { result };
        responses.push({ name: call.name, ...call.id ? { id: call.id } : {}, response: asObject });
      }
      conversation.push({
        role: "model_content",
        content: response.modelContent ?? {
          role: "model",
          parts: response.functionCalls.map((c) => ({ functionCall: { name: c.name, args: c.args } }))
        }
      });
      conversation.push({ role: "tool_responses", responses });
      continue;
    }
    const candidateText = response.text || "";
    if (PSEUDO_TOOL_TEXT.test(candidateText) && loopCount < MAX_TOOL_CALLS) {
      agentLog.pseudoToolText();
      conversation.push({ role: "assistant", content: candidateText });
      conversation.push({
        role: "user",
        content: "\u05D0\u05DC \u05EA\u05DB\u05EA\u05D5\u05D1 \u05E7\u05E8\u05D9\u05D0\u05D4 \u05DC\u05DB\u05DC\u05D9 \u05DB\u05D8\u05E7\u05E1\u05D8. \u05D0\u05DD \u05E6\u05E8\u05D9\u05DA \u05DB\u05DC\u05D9, \u05D4\u05E4\u05E2\u05DC \u05D0\u05D5\u05EA\u05D5 \u05D1\u05D0\u05DE\u05EA; \u05D0\u05D7\u05E8\u05EA \u05E2\u05E0\u05D4 \u05DC\u05DE\u05E9\u05EA\u05DE\u05E9 \u05D1\u05E2\u05D1\u05E8\u05D9\u05EA."
      });
      continue;
    }
    const guardrail = verifyNumbersInResponse(candidateText, {
      toolOutputs: toolOutputsThisTurn,
      userTexts: peopleTexts,
      profile: context.profile
    });
    if (guardrail.passed) {
      return finish("answered", { text: candidateText });
    }
    agentLog.guardrailFailed(guardrail.inventedNumbers);
    if (loopCount < MAX_TOOL_CALLS) {
      conversation.push({
        role: "user",
        content: `\u05E9\u05D9\u05DD \u05DC\u05D1: \u05D0\u05E1\u05D5\u05E8 \u05DC\u05D4\u05DE\u05E6\u05D9\u05D0 \u05D0\u05D5 \u05DC\u05D7\u05E9\u05D1 \u05DE\u05E1\u05E4\u05E8\u05D9\u05DD \u05D1\u05E2\u05E6\u05DE\u05DA, \u05D5\u05D2\u05DD \u05DC\u05D0 \u05DC\u05EA\u05EA \u05DE\u05E1\u05E4\u05E8\u05D9\u05DD \u05DC\u05D3\u05D5\u05D2\u05DE\u05D4. \u05D4\u05DE\u05E1\u05E4\u05E8\u05D9\u05DD ${guardrail.inventedNumbers.join(", ")} \u05DC\u05D0 \u05D4\u05D5\u05E4\u05D9\u05E2\u05D5 \u05D1\u05E0\u05EA\u05D5\u05E0\u05D9 \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA. \u05E0\u05E1\u05D7 \u05DE\u05D7\u05D3\u05E9 \u05D1\u05E7\u05E6\u05E8\u05D4 \u05D1\u05DC\u05D9 \u05DE\u05E1\u05E4\u05E8\u05D9\u05DD \u05DE\u05D5\u05DE\u05E6\u05D0\u05D9\u05DD${hasCard ? ", \u05D0\u05D5 \u05D4\u05E4\u05E0\u05D4 \u05DC\u05DB\u05E8\u05D8\u05D9\u05E1 \u05D4\u05D4\u05E9\u05D5\u05D5\u05D0\u05D4 \u05D4\u05DE\u05D5\u05E4\u05D9\u05E2 \u05DE\u05D8\u05D4" : ""}.`
      });
      continue;
    }
    return finish("number guard failed on last round", {
      text: hasCard ? "\u05DE\u05E6\u05D5\u05E8\u05E3 \u05DC\u05DE\u05D8\u05D4 \u05DB\u05E8\u05D8\u05D9\u05E1 \u05D4\u05E9\u05D5\u05D5\u05D0\u05EA \u05D4\u05E9\u05DB\u05E8 \u05D4\u05DE\u05E4\u05D5\u05E8\u05D8 \u05D5\u05DE\u05D3\u05D5\u05D9\u05E7 \u05E2\u05DC \u05E4\u05D9 \u05E0\u05EA\u05D5\u05E0\u05D9 \u05D4\u05DE\u05D7\u05E9\u05D1\u05D5\u05DF:" : NO_CARD_FALLBACK
    });
  }
  return finish(`hit the ${MAX_TOOL_CALLS}-round limit (loop)`, {
    text: hasCard ? "\u05E1\u05D9\u05D9\u05DE\u05EA\u05D9 \u05D0\u05EA \u05D7\u05D9\u05E9\u05D5\u05D1 \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD. \u05DB\u05E8\u05D8\u05D9\u05E1 \u05D4\u05D4\u05E9\u05D5\u05D5\u05D0\u05D4 \u05D4\u05DE\u05DC\u05D0 \u05DE\u05D5\u05E4\u05D9\u05E2 \u05DC\u05DE\u05D8\u05D4." : NO_CARD_FALLBACK
  });
}

// server/bl/services/repAnswer.ts
function findUndeliveredAnswers(tickets, sessionId2) {
  return tickets.filter(
    (t) => t.sessionId === sessionId2 && t.status === "answered" && t.answer !== void 0 && t.answer.deliveredAt === void 0
  );
}
function applyRepAnswer(ticket, profile, currentComparison, now) {
  const answer = ticket.answer;
  const effective = answer.effectiveFrom ? ` (\u05D1\u05EA\u05D5\u05E7\u05E3 \u05DE-${answer.effectiveFrom})` : "";
  const repMessageText = `\u05EA\u05E9\u05D5\u05D1\u05EA \u05E0\u05E6\u05D9\u05D2: ${answer.text}${effective}`;
  const delivered = { ...ticket, answer: { ...answer, deliveredAt: now } };
  const source = ticket.lastComparison ?? currentComparison ?? void 0;
  const scenarioType = source?.requestedScenarioType ?? source?.scenarioType;
  const carId = source?.requestedCarId ?? source?.targetCar?.id;
  if (answer.value === void 0 || !scenarioType || scenarioType === "keep") {
    return { ticket: delivered, repMessageText };
  }
  const comparison = buildScenario(profile, {
    type: scenarioType,
    targetCarId: carId,
    overrideParticipation: answer.value
  });
  const carLabel = comparison.targetCar?.model ?? carId ?? "";
  const agentNote = `[\u05D4\u05D5\u05D3\u05E2\u05D4 \u05E4\u05E0\u05D9\u05DE\u05D9\u05EA \u05DE\u05D4\u05DE\u05E2\u05E8\u05DB\u05EA] \u05E0\u05E6\u05D9\u05D2 \u05D4\u05E9\u05DB\u05E8 \u05E2\u05E0\u05D4 \u05E2\u05DC \u05D4\u05E4\u05E0\u05D9\u05D9\u05D4 ${ticket.id}: \u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05E2\u05E6\u05DE\u05D9\u05EA \u05E9\u05DC ${answer.value} \u20AA \u05D1\u05E8\u05DB\u05D1 ${carLabel}${effective}. \u05DE\u05E0\u05D5\u05E2 \u05D4\u05E9\u05DB\u05E8 \u05D7\u05D9\u05E9\u05D1 \u05DE\u05D7\u05D3\u05E9 \u05D0\u05EA \u05D4\u05D4\u05E9\u05D5\u05D5\u05D0\u05D4: \u05E0\u05D8\u05D5 \u05D4\u05D9\u05D5\u05DD ${Math.round(comparison.todayBreakdown.net)} \u20AA, \u05E0\u05D8\u05D5 \u05D1\u05D7\u05DC\u05D5\u05E4\u05D4 ${Math.round(comparison.altBreakdown.net)} \u20AA, \u05D4\u05E4\u05E8\u05E9 ${comparison.diffNet} \u20AA. \u05D4\u05DE\u05E9\u05DA \u05D0\u05EA \u05D4\u05E9\u05D9\u05D7\u05D4 \u05DE\u05D0\u05D5\u05EA\u05D4 \u05E0\u05E7\u05D5\u05D3\u05D4 \u05D1\u05DC\u05D9 \u05DC\u05D7\u05E9\u05D1 \u05DE\u05E1\u05E4\u05E8\u05D9\u05DD \u05D1\u05E2\u05E6\u05DE\u05DA.`;
  return { ticket: delivered, repMessageText, comparison, agentNote };
}

// server/bl/services/sessionService.ts
var SAMPLE_LOADED_PREFIX = "\u05E0\u05D8\u05E2\u05E0\u05D5 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4 \u05E0\u05EA\u05D5\u05E0\u05D9 \u05D4\u05D3\u05D5\u05D2\u05DE\u05D4 \u05E9\u05DC";
var emptyProfile = () => ({});
var NotFoundError = class extends Error {
  constructor() {
    super(...arguments);
    this.status = 404;
  }
};
function recomputeIfComplete(p, prev) {
  return getMissingFields(p, prev.scenarioType).length > 0 ? null : buildScenario(p, { type: prev.scenarioType, targetCarId: prev.targetCar?.id });
}
var toState = (s) => ({
  id: s.id,
  profile: s.profile,
  messages: s.messages,
  lastComparison: s.lastComparison
});
function sampleEmployees() {
  return getEmployees().map((e) => ({ id: e.id, name: e.name, occupation: e.occupation, group: e.group }));
}
function createSessionService(repo, now = Date.now) {
  const msgId = (prefix) => `${prefix}-${randomUUID()}`;
  const message = (role, content, prefix, comparison) => ({
    id: msgId(prefix),
    role,
    content,
    ...comparison ? { comparison } : {},
    timestamp: now()
  });
  const locks = /* @__PURE__ */ new Map();
  function withLock(id, fn) {
    const prev = locks.get(id) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    const tail = next.catch(() => void 0);
    locks.set(id, tail);
    tail.then(() => locks.get(id) === tail && locks.delete(id));
    return next;
  }
  async function load(id) {
    const s = await repo.getSession(id);
    if (!s) throw new NotFoundError("session not found");
    return s;
  }
  async function saveState(s) {
    s.updatedAt = now();
    const { messages: _messages, ...state } = s;
    await repo.saveSessionState(state);
  }
  async function append(s, ...msgs) {
    s.messages.push(...msgs);
    await repo.appendMessages(s.id, msgs);
  }
  async function newTicketId() {
    for (; ; ) {
      const id = `TICK-${randomInt(1e5, 1e6)}`;
      if (!await repo.getTicket(id)) return id;
    }
  }
  async function startConversation(s) {
    s.profile = emptyProfile();
    s.lastComparison = null;
    s.pendingFields = void 0;
    s.messages = [message("assistant", buildOpeningMessage(emptyProfile()), "msg")];
    await saveState(s);
    await repo.replaceMessages(s.id, s.messages);
  }
  async function agentTurn(s, text2, opts, events = {}) {
    if (!opts.internal) await append(s, message("user", text2, "usr"));
    const history = [...s.messages];
    let turnComparison;
    try {
      const result = await runAgentTurn(
        text2,
        history,
        {
          // Copy: tools mutate the turn profile in place (tools.ts update_profile)
          profile: { ...s.profile },
          lastComparison: s.lastComparison,
          repParticipationMode: Boolean(opts.repParticipationMode),
          pendingFields: s.pendingFields,
          onProfileUpdate: (updates) => {
            s.profile = { ...s.profile, ...updates };
            const recomputed = s.lastComparison ? recomputeIfComplete(s.profile, s.lastComparison) : null;
            if (recomputed) s.lastComparison = recomputed;
          },
          onComparisonRun: (comp) => {
            turnComparison = comp;
            s.lastComparison = comp;
          },
          onEscalate: async (question, summary) => {
            const ticket = {
              id: await newTicketId(),
              sessionId: s.id,
              question,
              summary,
              status: "open",
              profile: s.profile,
              lastComparison: s.lastComparison || void 0,
              transcript: history,
              createdAt: now()
            };
            await repo.saveTicket(ticket);
            return ticket.id;
          }
        },
        events.onThrottled,
        events.onStatus
      );
      s.pendingFields = result.pendingFields;
      await saveState(s);
      await append(s, message("assistant", result.text, "ast", turnComparison));
    } catch (err) {
      console.error(`agent turn failed for a session: ${err?.name ?? "Error"} ${err?.status ?? ""}`.trim());
      await saveState(s);
      await append(s, message("system", "\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05E2\u05D9\u05D1\u05D5\u05D3 \u05D4\u05D1\u05E7\u05E9\u05D4. \u05D0\u05E0\u05D0 \u05E0\u05E1\u05D5 \u05E9\u05E0\u05D9\u05EA \u05D1\u05E2\u05D5\u05D3 \u05E8\u05D2\u05E2.", "err"));
    }
  }
  return {
    /** userId = the logged-in owner; undefined only without login (development) */
    async create(userId) {
      const s = {
        id: randomUUID(),
        ...userId ? { userId } : {},
        profile: emptyProfile(),
        lastComparison: null,
        messages: [],
        createdAt: now(),
        updatedAt: now()
      };
      await repo.saveSessionState(s);
      await startConversation(s);
      return toState(s);
    },
    async get(id) {
      return toState(await load(id));
    },
    /**
     * Someone else's conversation looks like a missing one (404), so ids cannot be probed.
     * userId undefined = no login (development): every conversation is open, as before.
     */
    async assertOwner(id, userId) {
      const s = await load(id);
      if (userId !== void 0 && s.userId !== userId) throw new NotFoundError("session not found");
    },
    /** The user's latest conversation, to continue it on another device */
    async latestFor(userId) {
      const id = await repo.findLatestSessionId(userId);
      if (!id) throw new NotFoundError("session not found");
      return toState(await load(id));
    },
    /** New conversation: an empty profile, no data carried over */
    reset(id) {
      return withLock(id, async () => {
        const s = await load(id);
        await startConversation(s);
        return toState(s);
      });
    },
    loadSample(id, employeeId) {
      return withLock(id, async () => {
        const target = getEmployees().find((e) => e.id === employeeId);
        if (!target) throw new NotFoundError("sample employee not found");
        const s = await load(id);
        s.profile = structuredClone(target);
        s.lastComparison = buildScenario(target, { type: "keep" });
        s.pendingFields = void 0;
        await saveState(s);
        await append(
          s,
          message(
            "system",
            `${SAMPLE_LOADED_PREFIX} ${target.name} (${target.occupation}, \u05E7\u05D1\u05D5\u05E6\u05D4 ${target.group}, \u05E9\u05DB\u05E8 \u05D1\u05E1\u05D9\u05E1 ${target.base?.toLocaleString()} \u20AA).`,
            "sys"
          )
        );
        return toState(s);
      });
    },
    /** Manual card edit or confirmed payslip fields (already validated by the API layer) */
    updateProfile(id, updates, source) {
      return withLock(id, async () => {
        const s = await load(id);
        s.profile = { ...s.profile, ...updates };
        const recomputed = s.lastComparison ? recomputeIfComplete(s.profile, s.lastComparison) : null;
        if (recomputed) s.lastComparison = recomputed;
        await saveState(s);
        if (source === "payslip") {
          await append(s, message("system", "\u05E0\u05EA\u05D5\u05E0\u05D9 \u05EA\u05DC\u05D5\u05E9 \u05D4\u05E9\u05DB\u05E8 \u05DE\u05D5\u05D6\u05D2\u05D5 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4 \u05DC\u05EA\u05D5\u05DA \u05D4\u05E4\u05E8\u05D5\u05E4\u05D9\u05DC. \u05D4\u05DE\u05D7\u05E9\u05D1\u05D5\u05DF \u05E2\u05D5\u05D3\u05DB\u05DF.", "sys"));
        }
        return toState(s);
      });
    },
    sendMessage(id, text2, opts, events) {
      return withLock(id, async () => {
        const s = await load(id);
        await agentTurn(s, text2, opts, events);
        return toState(s);
      });
    },
    /** "Ask a rep" button on the comparison card */
    askRep(id) {
      return withLock(id, async () => {
        const s = await load(id);
        const comp = s.lastComparison;
        if (!comp) throw Object.assign(new Error("no comparison to ask about"), { status: 409 });
        const ticket = {
          id: await newTicketId(),
          sessionId: s.id,
          question: `\u05E9\u05D0\u05DC\u05D4 \u05DC\u05D2\u05D1\u05D9 \u05D4\u05E9\u05D5\u05D5\u05D0\u05EA \u05E9\u05DB\u05E8 \u05D1\u05D9\u05DF ${comp.todayCarLabel} \u05DC-${comp.altCarLabel}`,
          summary: "\u05D4\u05E2\u05D5\u05D1\u05D3 \u05D1\u05D9\u05E7\u05E9 \u05D1\u05D9\u05E8\u05D5\u05E8 \u05D9\u05D3\u05E0\u05D9 \u05DC\u05D2\u05D1\u05D9 \u05D4\u05E9\u05D5\u05D5\u05D0\u05EA \u05D4\u05E9\u05DB\u05E8 \u05D4\u05DE\u05D5\u05E6\u05D2\u05EA.",
          status: "open",
          profile: s.profile,
          lastComparison: comp,
          transcript: s.messages,
          createdAt: now()
        };
        await repo.saveTicket(ticket);
        await append(
          s,
          message("system", `\u05D4\u05E4\u05E0\u05D9\u05D9\u05D4 \u05E0\u05E9\u05DC\u05D7\u05D4 \u05DC\u05E0\u05E6\u05D9\u05D2 \u05E9\u05DB\u05E8 (\u05DE\u05E1\u05E4\u05E8 \u05E4\u05E0\u05D9\u05D9\u05D4: ${ticket.id}). \u05E0\u05E6\u05D9\u05D2 \u05D9\u05D1\u05D3\u05D5\u05E7 \u05D0\u05EA \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D5\u05D9\u05E9\u05D9\u05D1 \u05D1\u05D4\u05E7\u05D3\u05DD.`, "tick")
        );
        return toState(s);
      });
    },
    /**
     * Delivers rep answers not shown in this chat yet: the rep message, the recomputed comparison,
     * and an agent turn so the bot continues. Called by the employee screen's polling.
     */
    sync(id, opts = {}) {
      return withLock(id, async () => {
        const s = await load(id);
        for (const ticket of findUndeliveredAnswers(await repo.listTicketsForSession(id), id)) {
          const delivery = applyRepAnswer(ticket, s.profile, s.lastComparison, now());
          await repo.saveTicket(delivery.ticket);
          await append(s, { ...message("rep", delivery.repMessageText, "rep", delivery.comparison), id: `rep-ans-${ticket.id}` });
          if (delivery.comparison) {
            s.lastComparison = delivery.comparison;
            await saveState(s);
          }
          if (delivery.agentNote) await agentTurn(s, delivery.agentNote, { ...opts, internal: true });
        }
        return toState(s);
      });
    }
  };
}

// server/api/authCookies.ts
var ACCESS_COOKIE = "yoetz_at";
var REFRESH_COOKIE = "yoetz_rt";
var ACCESS_PATH = "/api";
var REFRESH_PATH = "/api/auth";
var REFRESH_MAX_AGE_S = 7 * 24 * 60 * 60;
function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      const value = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(value) || void 0;
      } catch {
        return void 0;
      }
    }
  }
  return void 0;
}
function cookie(name, value, path4, maxAgeS, secure) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path4}`,
    `Max-Age=${maxAgeS}`,
    "HttpOnly",
    "SameSite=Strict",
    ...secure ? ["Secure"] : []
  ].join("; ");
}
function setAuthCookies(res, tokens, secure) {
  res.append("Set-Cookie", cookie(ACCESS_COOKIE, tokens.accessToken, ACCESS_PATH, Math.max(1, Math.floor(tokens.expiresIn)), secure));
  res.append("Set-Cookie", cookie(REFRESH_COOKIE, tokens.refreshToken, REFRESH_PATH, REFRESH_MAX_AGE_S, secure));
}
function clearAuthCookies(res, secure) {
  res.append("Set-Cookie", cookie(ACCESS_COOKIE, "", ACCESS_PATH, 0, secure));
  res.append("Set-Cookie", cookie(REFRESH_COOKIE, "", REFRESH_PATH, 0, secure));
}
async function resolveUser(req, res, auth, secure) {
  const access = readCookie(req, ACCESS_COOKIE);
  if (access) {
    const user = await auth.verify(access);
    if (user) return user;
  }
  const refresh = readCookie(req, REFRESH_COOKIE);
  if (!refresh) return null;
  const renewed = await auth.refresh(refresh);
  if (!renewed) {
    clearAuthCookies(res, secure);
    return null;
  }
  setAuthCookies(res, renewed.tokens, secure);
  return renewed.user;
}
var ALL_ROLES = ["employee", "rep", "admin"];
function requireRole(auth, roles) {
  return (req, res, next) => {
    if (!auth) return next();
    const access = readCookie(req, ACCESS_COOKIE);
    (access ? auth.verify(access) : Promise.resolve(null)).then((user) => {
      if (!user) {
        res.status(401).json({ error: "\u05E0\u05D3\u05E8\u05E9\u05EA \u05DB\u05E0\u05D9\u05E1\u05D4 \u05DC\u05DE\u05E2\u05E8\u05DB\u05EA" });
        return;
      }
      if (!roles.includes(user.role)) {
        res.status(403).json({ error: "\u05D0\u05D9\u05DF \u05DC\u05DA \u05D4\u05E8\u05E9\u05D0\u05D4 \u05DC\u05DE\u05E1\u05DA \u05D4\u05D6\u05D4" });
        return;
      }
      res.locals.user = user;
      next();
    }, next);
  };
}

// server/api/middleware.ts
var asyncHandler = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};
function securityHeaderValues(isProduction) {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin"
  };
  if (isProduction) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    headers["Content-Security-Policy"] = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join("; ");
  }
  return headers;
}
function securityHeaders(isProduction) {
  const headers = Object.entries(securityHeaderValues(isProduction));
  return (_req, res, next) => {
    for (const [name, value] of headers) res.setHeader(name, value);
    next();
  };
}
function cors(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) return next();
    let sameOrigin = false;
    try {
      sameOrigin = new URL(origin).host === req.headers.host;
    } catch {
    }
    if (!sameOrigin && !allowed.has(origin)) {
      res.status(403).json({ error: "\u05DE\u05E7\u05D5\u05E8 \u05D4\u05D1\u05E7\u05E9\u05D4 \u05D0\u05D9\u05E0\u05D5 \u05DE\u05D5\u05E8\u05E9\u05D4" });
      return;
    }
    if (!sameOrigin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  };
}
function rateLimit(options) {
  const hits = /* @__PURE__ */ new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, h] of hits) if (h.resetAt <= now) hits.delete(key);
  }, options.windowMs).unref();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    let h = hits.get(key);
    if (!h || h.resetAt <= now) {
      h = { count: 0, resetAt: now + options.windowMs };
      hits.set(key, h);
    }
    h.count++;
    if (h.count > options.max) {
      res.setHeader("Retry-After", String(Math.ceil((h.resetAt - now) / 1e3)));
      res.status(429).json({ error: "\u05D9\u05D5\u05EA\u05E8 \u05DE\u05D3\u05D9 \u05D1\u05E7\u05E9\u05D5\u05EA. \u05E0\u05E1\u05D5 \u05E9\u05D5\u05D1 \u05D1\u05E2\u05D5\u05D3 \u05E8\u05D2\u05E2." });
      return;
    }
    next();
  };
}
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function errorHandler(err, req, res, _next) {
  const status = Number(err?.status ?? err?.statusCode) || 500;
  if (res.headersSent) {
    res.end();
    return;
  }
  if (status >= 400 && status < 500) {
    const message = err?.type ? status === 413 ? "\u05D4\u05E7\u05D5\u05D1\u05E5 \u05D0\u05D5 \u05D4\u05D1\u05E7\u05E9\u05D4 \u05D2\u05D3\u05D5\u05DC\u05D9\u05DD \u05DE\u05D3\u05D9" : "\u05D1\u05E7\u05E9\u05D4 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05E0\u05D4" : err?.message;
    res.status(status).json({ error: message || "\u05D1\u05E7\u05E9\u05D4 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05E0\u05D4" });
    return;
  }
  console.error(`[api] ${req.method} ${req.path} failed: ${err?.name ?? "Error"} (${status})`);
  res.status(500).json({ error: "\u05E9\u05D2\u05D9\u05D0\u05EA \u05E9\u05E8\u05EA. \u05D0\u05E0\u05D0 \u05E0\u05E1\u05D5 \u05E9\u05E0\u05D9\u05EA." });
}

// server/api/routes/admin.ts
import express, { Router } from "express";

// server/bl/agent/extract.ts
var PAYSLIP_FIELDS = [
  "occupation",
  "base",
  "commissions",
  "bonus",
  "pensionPct",
  "studyFundPct",
  "creditPoints",
  "currentCar",
  "carParticipation",
  "maintenance",
  "childrenUpTo23"
];
var PAYSLIP_EXTRACTION_PROMPT = `
\u05D0\u05EA\u05D4 \u05DE\u05E0\u05EA\u05D7 \u05EA\u05DC\u05D5\u05E9\u05D9 \u05E9\u05DB\u05E8 \u05D5\u05D7\u05D5\u05D6\u05D9 \u05D4\u05E2\u05E1\u05E7\u05D4 \u05E8\u05E9\u05DE\u05D9\u05D9\u05DD \u05E2\u05D1\u05D5\u05E8 \u05DE\u05E2\u05E8\u05DB\u05EA \u05E9\u05DB\u05E8 \u05D9\u05E9\u05E8\u05D0\u05DC\u05D9\u05EA.
\u05E2\u05DC\u05D9\u05DA \u05DC\u05D7\u05DC\u05E5 \u05DE\u05EA\u05D5\u05DA \u05D4\u05EA\u05DE\u05D5\u05E0\u05D4/\u05DE\u05E1\u05DE\u05DA \u05D4\u05DE\u05E6\u05D5\u05E8\u05E3 \u05D0\u05DA \u05D5\u05E8\u05E7 \u05D0\u05EA \u05D4\u05E9\u05D3\u05D5\u05EA \u05D4\u05D1\u05D0\u05D9\u05DD, \u05D1\u05D3\u05D9\u05D5\u05E7 \u05E8\u05D1:
- occupation: \u05E9\u05DD \u05D4\u05EA\u05E4\u05E7\u05D9\u05D3 \u05D0\u05D5 \u05D4\u05E2\u05D9\u05E1\u05D5\u05E7
- base: \u05E9\u05DB\u05E8 \u05D9\u05E1\u05D5\u05D3 / \u05E9\u05DB\u05E8 \u05D1\u05E1\u05D9\u05E1 \u05D7\u05D5\u05D3\u05E9\u05D9
- commissions: \u05E2\u05DE\u05DC\u05D5\u05EA / \u05E4\u05E8\u05DE\u05D9\u05D5\u05EA / \u05E9\u05DB\u05E8 \u05E2\u05D9\u05D3\u05D5\u05D3
- bonus: \u05D1\u05D5\u05E0\u05D5\u05E1 \u05D7\u05D5\u05D3\u05E9\u05D9
- pensionPct: \u05D0\u05D7\u05D5\u05D6 \u05E0\u05D9\u05DB\u05D5\u05D9 \u05E2\u05D5\u05D1\u05D3 \u05DC\u05EA\u05D2\u05DE\u05D5\u05DC\u05D9\u05DD / \u05E4\u05E0\u05E1\u05D9\u05D4 (\u05D1\u05D3"\u05DB 6.0%)
- studyFundPct: \u05D0\u05D7\u05D5\u05D6 \u05E0\u05D9\u05DB\u05D5\u05D9 \u05E2\u05D5\u05D1\u05D3 \u05DC\u05E7\u05E8\u05DF \u05D4\u05E9\u05EA\u05DC\u05DE\u05D5\u05EA (\u05D1\u05D3"\u05DB 2.5%)
- creditPoints: \u05DE\u05E1\u05E4\u05E8 \u05E0\u05E7\u05D5\u05D3\u05D5\u05EA \u05D6\u05D9\u05DB\u05D5\u05D9 (\u05DC\u05DE\u05E9\u05DC 2.25, 2.75)
- currentCar: \u05E8\u05DB\u05D1 \u05D7\u05D1\u05E8\u05D4 \u05E7\u05D9\u05D9\u05DD / \u05D3\u05D2\u05DD \u05E8\u05DB\u05D1 \u05D0\u05DD \u05DE\u05E6\u05D5\u05D9\u05DF
- carParticipation: \u05E0\u05D9\u05DB\u05D5\u05D9 \u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05E2\u05D5\u05D1\u05D3 \u05D1\u05E8\u05DB\u05D1
- maintenance: \u05D3\u05DE\u05D9 \u05D0\u05D7\u05D6\u05E7\u05EA \u05E8\u05DB\u05D1 / \u05E9\u05D5\u05D5\u05D9 \u05D0\u05D7\u05D6\u05E7\u05D4
- childrenUpTo23: \u05DE\u05E1\u05E4\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD \u05E2\u05D3 \u05D2\u05D9\u05DC 23 \u05D0\u05DD \u05DE\u05D5\u05E4\u05D9\u05E2

\u05D4\u05E0\u05D7\u05D9\u05D9\u05EA \u05D1\u05E8\u05D6\u05DC:
\u05D0\u05DC \u05EA\u05E0\u05D7\u05E9 \u05DC\u05E2\u05D5\u05DC\u05DD! \u05D0\u05DD \u05E9\u05D3\u05D4 \u05D0\u05D9\u05E0\u05D5 \u05DE\u05D5\u05E4\u05D9\u05E2 \u05D0\u05D5 \u05D0\u05D9\u05E0\u05D5 \u05D1\u05E8\u05D5\u05E8, \u05D4\u05D7\u05D6\u05E8 null \u05D1\u05E2\u05E8\u05DA value.
\u05E2\u05D1\u05D5\u05E8 \u05DB\u05DC \u05E9\u05D3\u05D4 \u05E1\u05E4\u05E7:
- value: \u05D4\u05E2\u05E8\u05DA (\u05DE\u05E1\u05E4\u05E8 \u05D0\u05D5 \u05DE\u05D7\u05E8\u05D5\u05D6\u05EA) \u05D0\u05D5 null
- confidence: "high" | "medium" | "low"
- sourceQuote: \u05D4\u05E6\u05D9\u05D8\u05D5\u05D8 \u05D4\u05DE\u05D3\u05D5\u05D9\u05E7 \u05DE\u05EA\u05D5\u05DA \u05D4\u05EA\u05DC\u05D5\u05E9/\u05D7\u05D5\u05D6\u05D4
\u05D4\u05D7\u05D6\u05E8 \u05D0\u05DA \u05D5\u05E8\u05E7 \u05DE\u05D1\u05E0\u05D4 JSON \u05EA\u05E7\u05E0\u05D9.
`.trim();

// server/api/validate.ts
var fail = (message) => {
  throw new HttpError(400, message);
};
var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function object(v, allowed, what) {
  if (!isObject(v)) return fail(`${what}: \u05E0\u05D3\u05E8\u05E9 \u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 JSON`);
  const extra = Object.keys(v).filter((k) => !allowed.includes(k));
  if (extra.length) fail(`${what}: \u05E9\u05D3\u05D5\u05EA \u05DC\u05D0 \u05DE\u05D5\u05DB\u05E8\u05D9\u05DD (${extra.join(", ")})`);
  return v;
}
function text(v, field, max, required = true) {
  if (v === void 0 || v === null || v === "") return required ? fail(`${field}: \u05E9\u05D3\u05D4 \u05D7\u05D5\u05D1\u05D4`) : void 0;
  if (typeof v !== "string") return fail(`${field}: \u05E0\u05D3\u05E8\u05E9 \u05D8\u05E7\u05E1\u05D8`);
  const t = v.trim();
  if (required && !t) fail(`${field}: \u05E9\u05D3\u05D4 \u05D7\u05D5\u05D1\u05D4`);
  if (t.length > max) fail(`${field}: \u05D0\u05E8\u05D5\u05DA \u05DE\u05D3\u05D9 (\u05E2\u05D3 ${max} \u05EA\u05D5\u05D5\u05D9\u05DD)`);
  return t;
}
function number(v, field, min, max) {
  if (typeof v !== "number" || !Number.isFinite(v)) return fail(`${field}: \u05E0\u05D3\u05E8\u05E9 \u05DE\u05E1\u05E4\u05E8`);
  if (v < min || v > max) fail(`${field}: \u05DE\u05D7\u05D5\u05E5 \u05DC\u05D8\u05D5\u05D5\u05D7 (${min}\u2013${max})`);
  return v;
}
function bool(v, field) {
  if (v === void 0) return void 0;
  if (typeof v !== "boolean") return fail(`${field}: \u05E0\u05D3\u05E8\u05E9 true/false`);
  return v;
}
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function sessionId(v) {
  if (typeof v !== "string" || !UUID.test(v)) fail("\u05DE\u05D6\u05D4\u05D4 \u05E9\u05D9\u05D7\u05D4 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF");
  return v;
}
function ticketId(v) {
  if (typeof v !== "string" || !/^TICK-\d{4,8}$/.test(v)) fail("\u05DE\u05D6\u05D4\u05D4 \u05E4\u05E0\u05D9\u05D9\u05D4 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF");
  return v;
}
function messageBody(body) {
  const b = object(body, ["text", "repParticipationMode"], "\u05D4\u05D5\u05D3\u05E2\u05D4");
  return { text: text(b.text, "text", 2e3), repParticipationMode: Boolean(bool(b.repParticipationMode, "repParticipationMode")) };
}
function syncBody(body) {
  const b = object(body ?? {}, ["repParticipationMode"], "\u05E1\u05E0\u05DB\u05E8\u05D5\u05DF");
  return { repParticipationMode: Boolean(bool(b.repParticipationMode, "repParticipationMode")) };
}
function sampleBody(body) {
  const b = object(body, ["employeeId"], "\u05E2\u05D5\u05D1\u05D3 \u05DC\u05D3\u05D5\u05D2\u05DE\u05D4");
  const id = text(b.employeeId, "employeeId", 40);
  if (!/^[A-Z0-9-]+$/.test(id)) fail("employeeId: \u05DE\u05D6\u05D4\u05D4 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF");
  return { employeeId: id };
}
var MONEY_MAX = 1e7;
var NUMERIC_PROFILE = {
  base: [0, MONEY_MAX],
  commissions: [0, MONEY_MAX],
  bonus: [0, MONEY_MAX],
  pensionPct: [0, 20],
  studyFundPct: [0, 10],
  creditPoints: [0, 15],
  childrenUpTo23: [0, 15],
  currentParticipation: [0, MONEY_MAX],
  currentBenefit: [0, MONEY_MAX],
  currentMaintenance: [0, MONEY_MAX]
};
var TEXT_PROFILE = ["occupation", "currentCarName"];
var GROUPS = ["\u05D0", "\u05D1", "\u05D2", "\u05D3", "\u05DE\u05E9\u05E4\u05D7\u05EA\u05D9"];
function profileUpdateBody(body) {
  const b = object(body, ["updates", "source"], "\u05E2\u05D3\u05DB\u05D5\u05DF \u05E4\u05E8\u05D5\u05E4\u05D9\u05DC");
  const source = b.source ?? "manual";
  if (source !== "manual" && source !== "payslip") fail("source: \u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF");
  const allowed = [...Object.keys(NUMERIC_PROFILE), ...TEXT_PROFILE, "group", "hasCar"];
  const u = object(b.updates, allowed, "updates");
  const updates = {};
  for (const [key, value] of Object.entries(u)) {
    if (key in NUMERIC_PROFILE) {
      updates[key] = value === null ? void 0 : number(value, key, ...NUMERIC_PROFILE[key]);
    } else if (TEXT_PROFILE.includes(key)) {
      updates[key] = text(value, key, 120, false);
    } else if (key === "group") {
      if (!GROUPS.includes(value)) fail("group: \u05E7\u05D1\u05D5\u05E6\u05D4 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05E0\u05D4");
      updates.group = value;
    } else if (key === "hasCar") {
      updates.hasCar = bool(value, "hasCar");
    }
  }
  return { updates, source };
}
var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function loginBody(body) {
  const b = object(body, ["email", "password"], "\u05DB\u05E0\u05D9\u05E1\u05D4");
  const email = text(b.email, "email", 254).toLowerCase();
  if (!EMAIL.test(email)) fail("email: \u05DB\u05EA\u05D5\u05D1\u05EA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05E0\u05D4");
  if (typeof b.password !== "string" || !b.password) fail("password: \u05E9\u05D3\u05D4 \u05D7\u05D5\u05D1\u05D4");
  if (b.password.length > 128) fail("password: \u05D0\u05E8\u05D5\u05DA \u05DE\u05D3\u05D9 (\u05E2\u05D3 128 \u05EA\u05D5\u05D5\u05D9\u05DD)");
  return { email, password: b.password };
}
var USER_ROLES = ["employee", "rep", "admin"];
function createUserBody(body) {
  const b = object(body, ["email", "password", "role"], "\u05DE\u05E9\u05EA\u05DE\u05E9 \u05D7\u05D3\u05E9");
  const email = text(b.email, "email", 254).toLowerCase();
  if (!EMAIL.test(email)) fail("email: \u05DB\u05EA\u05D5\u05D1\u05EA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05E0\u05D4");
  if (typeof b.password !== "string" || !b.password) fail("password: \u05E9\u05D3\u05D4 \u05D7\u05D5\u05D1\u05D4");
  if (b.password.length < 8) fail("password: \u05DC\u05E4\u05D7\u05D5\u05EA 8 \u05EA\u05D5\u05D5\u05D9\u05DD");
  if (b.password.length > 72) fail("password: \u05D0\u05E8\u05D5\u05DA \u05DE\u05D3\u05D9 (\u05E2\u05D3 72 \u05EA\u05D5\u05D5\u05D9\u05DD)");
  if (!USER_ROLES.includes(b.role)) fail("role: \u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF");
  return { email, password: b.password, role: b.role };
}
function ticketAnswerBody(body) {
  const b = object(body, ["status", "text", "value", "effectiveFrom"], "\u05EA\u05E9\u05D5\u05D1\u05EA \u05E0\u05E6\u05D9\u05D2");
  if (b.status !== "answered" && b.status !== "closed") fail("status: \u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF");
  return {
    status: b.status,
    text: text(b.text, "text", 2e3, false),
    value: b.value === void 0 || b.value === null ? void 0 : number(b.value, "value", 0, MONEY_MAX),
    effectiveFrom: text(b.effectiveFrom, "effectiveFrom", 40, false)
  };
}
var PAYSLIP_MIME = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]);
var PAYSLIP_MAX_BASE64 = 14e6;
function payslipBody(body) {
  const b = object(body, ["fileData", "mimeType"], "\u05EA\u05DC\u05D5\u05E9");
  const mimeType = text(b.mimeType, "mimeType", 60);
  if (!PAYSLIP_MIME.has(mimeType)) fail("\u05E1\u05D5\u05D2 \u05E7\u05D5\u05D1\u05E5 \u05DC\u05D0 \u05E0\u05EA\u05DE\u05DA (JPG, PNG, WEBP, HEIC \u05D0\u05D5 PDF)");
  if (typeof b.fileData !== "string" || !b.fileData) fail("fileData: \u05D7\u05E1\u05E8 \u05E7\u05D5\u05D1\u05E5");
  const fileData = b.fileData;
  if (fileData.length > PAYSLIP_MAX_BASE64) fail("\u05D4\u05E7\u05D5\u05D1\u05E5 \u05D2\u05D3\u05D5\u05DC \u05DE\u05D3\u05D9 (\u05E2\u05D3 10MB)");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(fileData)) fail("fileData: \u05E7\u05D9\u05D3\u05D5\u05D3 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF");
  return { fileData, mimeType };
}
function payslipResult(raw) {
  const src = isObject(raw) ? raw : {};
  const out = {};
  for (const key of PAYSLIP_FIELDS) {
    const f = isObject(src[key]) ? src[key] : {};
    const value = typeof f.value === "number" || typeof f.value === "string" ? f.value : null;
    const confidence = f.confidence === "high" || f.confidence === "medium" ? f.confidence : "low";
    out[key] = { value, confidence, sourceQuote: typeof f.sourceQuote === "string" ? f.sourceQuote.slice(0, 300) : "" };
  }
  return out;
}
function rulesBody(body) {
  const b = object(body, ["rules"], "\u05DB\u05DC\u05DC\u05D9\u05DD");
  if (!isObject(b.rules)) fail("rules: \u05E0\u05D3\u05E8\u05E9 \u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8");
  return b.rules;
}
var DATA_TABLES = ["catalog", "occupations", "employees"];
function dataTableParam(v) {
  if (!DATA_TABLES.includes(v)) fail("\u05D8\u05D1\u05DC\u05D4 \u05DC\u05D0 \u05DE\u05D5\u05DB\u05E8\u05EA");
  return v;
}
function lookupQuery(q) {
  const digits = (v, field, max) => {
    if (typeof v !== "string" || !new RegExp(`^\\d{1,${max}}$`).test(v)) fail(`${field}: \u05E0\u05D3\u05E8\u05E9 \u05DE\u05E1\u05E4\u05E8`);
    return v;
  };
  return {
    year: digits(q.year, "year", 4),
    type: digits(q.type ?? "1", "type", 2),
    product: digits(q.product, "product", 5),
    model: digits(q.model, "model", 5)
  };
}

// server/api/routes/admin.ts
var TAX_FILE_LIMIT = "80mb";
var DATA_FILE_LIMIT = "5mb";
var XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
function adminRouter(admin, auth) {
  const router = Router();
  router.post(
    "/users",
    rateLimit({ name: "create-user", windowMs: 6e4, max: 20 }),
    express.json({ limit: "10kb" }),
    asyncHandler(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      if (!auth) {
        res.status(503).json({ error: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD \u05D3\u05D5\u05E8\u05E9\u05EA \u05D7\u05D9\u05D1\u05D5\u05E8 \u05DC-Supabase, \u05E9\u05D0\u05D9\u05E0\u05D5 \u05DE\u05D5\u05D2\u05D3\u05E8 \u05D1\u05E9\u05E8\u05EA" });
        return;
      }
      const { email, password, role } = createUserBody(req.body);
      res.status(201).json(await auth.createUser(email, password, role));
    })
  );
  router.get("/overview", asyncHandler(async (_req, res) => {
    res.json(await admin.overview());
  }));
  router.post("/rules/preview", express.json({ limit: "200kb" }), asyncHandler(async (req, res) => {
    res.json(admin.previewRules(rulesBody(req.body)));
  }));
  router.put("/rules", express.json({ limit: "200kb" }), asyncHandler(async (req, res) => {
    res.json(await admin.saveRules(rulesBody(req.body)));
  }));
  const workbook = [
    rateLimit({ name: "data-upload", windowMs: 6e4, max: 20 }),
    express.raw({ type: [XLSX_TYPE, "application/octet-stream"], limit: DATA_FILE_LIMIT })
  ];
  const fileOf = (body) => {
    if (!Buffer.isBuffer(body) || body.length === 0) throw new HttpError(400, "\u05D9\u05E9 \u05DC\u05E9\u05DC\u05D5\u05D7 \u05E7\u05D5\u05D1\u05E5 Excel (xlsx)");
    return new Uint8Array(body);
  };
  router.post("/data/preview", ...workbook, asyncHandler(async (req, res) => {
    res.json(admin.previewDataFile(fileOf(req.body)));
  }));
  router.post("/data/apply", ...workbook, asyncHandler(async (req, res) => {
    res.json(await admin.applyDataFile(fileOf(req.body)));
  }));
  router.delete("/data/:table", asyncHandler(async (req, res) => {
    await admin.resetDataTable(dataTableParam(req.params.table));
    res.status(204).end();
  }));
  router.post("/rules/reset", asyncHandler(async (_req, res) => {
    res.json(await admin.resetRules());
  }));
  router.post(
    "/tax-records",
    rateLimit({ name: "tax-upload", windowMs: 6e4, max: 5 }),
    express.raw({ type: ["text/csv", "application/octet-stream"], limit: TAX_FILE_LIMIT }),
    asyncHandler(async (req, res) => {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        throw new HttpError(400, "\u05D9\u05E9 \u05DC\u05E9\u05DC\u05D5\u05D7 \u05E7\u05D5\u05D1\u05E5 CSV (Content-Type: text/csv)");
      }
      try {
        res.json({ count: await admin.importTaxCsv(new Uint8Array(req.body)) });
      } catch (err) {
        if (err instanceof Error && !err.status && /CSV|עמודות/.test(err.message)) throw new HttpError(400, err.message);
        throw err;
      }
    })
  );
  router.delete("/tax-records", asyncHandler(async (_req, res) => {
    await admin.clearTaxRecords();
    res.status(204).end();
  }));
  router.get("/tax-records/lookup", asyncHandler(async (req, res) => {
    const q = lookupQuery(req.query);
    res.json({ result: await admin.lookup(q.year, q.type, q.product, q.model) });
  }));
  return router;
}

// server/api/routes/auth.ts
import { Router as Router2 } from "express";
function authRouter(auth, secureCookies) {
  const router = Router2();
  const loginLimit = rateLimit({ name: "login", windowMs: 15 * 6e4, max: 10 });
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  router.get("/me", asyncHandler(async (req, res) => {
    const status = auth ? { enabled: true, user: await resolveUser(req, res, auth, secureCookies) } : { enabled: false, user: null };
    res.json(status);
  }));
  router.post("/login", loginLimit, asyncHandler(async (req, res) => {
    if (!auth) {
      res.status(503).json({ error: "\u05D4\u05DB\u05E0\u05D9\u05E1\u05D4 \u05D0\u05D9\u05E0\u05D4 \u05DE\u05D5\u05D2\u05D3\u05E8\u05EA \u05D1\u05E9\u05E8\u05EA" });
      return;
    }
    const { email, password } = loginBody(req.body);
    const { tokens, user } = await auth.login(email, password);
    setAuthCookies(res, tokens, secureCookies);
    res.json(user);
  }));
  router.post("/logout", asyncHandler(async (req, res) => {
    const access = readCookie(req, ACCESS_COOKIE);
    if (auth && access) await auth.logout(access);
    clearAuthCookies(res, secureCookies);
    res.status(204).end();
  }));
  return router;
}

// server/api/routes/payslip.ts
import express2, { Router as Router3 } from "express";
function payslipRouter(extract) {
  const router = Router3();
  router.post(
    "/extract",
    rateLimit({ name: "payslip", windowMs: 10 * 6e4, max: 10 }),
    // Own body limit (base64 of a file up to ~10 MB); mounted before the global 100kb JSON parser
    express2.json({ limit: "15mb" }),
    asyncHandler(async (req, res) => {
      const { fileData, mimeType } = payslipBody(req.body);
      res.json(payslipResult(await extract(fileData, mimeType)));
    })
  );
  return router;
}

// server/api/routes/sessions.ts
import { Router as Router4 } from "express";
function sessionsRouter(sessions) {
  const router = Router4();
  const messageLimit = rateLimit({ name: "messages", windowMs: 6e4, max: 30 });
  const createLimit = rateLimit({ name: "session-create", windowMs: 6e4, max: 20 });
  const userId = (res) => res.locals.user?.id;
  router.param("id", (req, res, next, raw) => {
    Promise.resolve().then(() => sessions.assertOwner(sessionId(raw), userId(res))).then(() => next(), next);
  });
  router.post("/", createLimit, asyncHandler(async (_req, res) => {
    res.status(201).json(await sessions.create(userId(res)));
  }));
  router.get("/mine", asyncHandler(async (_req, res) => {
    const id = userId(res);
    if (!id) {
      res.status(404).json({ error: "\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0\u05D4 \u05E9\u05D9\u05D7\u05D4" });
      return;
    }
    res.json(await sessions.latestFor(id));
  }));
  router.get("/:id", asyncHandler(async (req, res) => {
    res.json(await sessions.get(sessionId(req.params.id)));
  }));
  router.post("/:id/reset", asyncHandler(async (req, res) => {
    res.json(await sessions.reset(sessionId(req.params.id)));
  }));
  router.post("/:id/sample", asyncHandler(async (req, res) => {
    const { employeeId } = sampleBody(req.body);
    res.json(await sessions.loadSample(sessionId(req.params.id), employeeId));
  }));
  router.patch("/:id/profile", asyncHandler(async (req, res) => {
    const { updates, source } = profileUpdateBody(req.body);
    res.json(await sessions.updateProfile(sessionId(req.params.id), updates, source));
  }));
  router.post("/:id/tickets", asyncHandler(async (req, res) => {
    res.status(201).json(await sessions.askRep(sessionId(req.params.id)));
  }));
  router.post("/:id/sync", asyncHandler(async (req, res) => {
    res.json(await sessions.sync(sessionId(req.params.id), syncBody(req.body)));
  }));
  router.post("/:id/messages", messageLimit, asyncHandler(async (req, res) => {
    const id = sessionId(req.params.id);
    const { text: text2, repParticipationMode } = messageBody(req.body);
    await sessions.get(id);
    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    const send = (event) => {
      if (!res.writableEnded) res.write(`${JSON.stringify(event)}
`);
    };
    let throttled = false;
    try {
      const session = await sessions.sendMessage(id, text2, { repParticipationMode }, {
        onStatus: (status) => send({ type: "status", text: status }),
        onThrottled: (on, message) => {
          if (on === throttled) return;
          throttled = on;
          send({ type: "throttled", on, text: message });
        }
      });
      send({ type: "result", session });
    } catch (err) {
      console.error(`[api] message turn failed: ${err?.name ?? "Error"} (${err?.status ?? 500})`);
      send({ type: "error", message: "\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05E2\u05D9\u05D1\u05D5\u05D3 \u05D4\u05D1\u05E7\u05E9\u05D4. \u05D0\u05E0\u05D0 \u05E0\u05E1\u05D5 \u05E9\u05E0\u05D9\u05EA." });
    }
    res.end();
  }));
  return router;
}

// server/api/routes/tickets.ts
import { Router as Router5 } from "express";
function ticketsRouter(tickets, repOnly) {
  const router = Router5();
  router.get("/summary", asyncHandler(async (_req, res) => {
    res.json({ open: await tickets.openCount() });
  }));
  router.use(repOnly);
  router.get("/", asyncHandler(async (_req, res) => {
    res.json(await tickets.list());
  }));
  router.post("/:id/answer", asyncHandler(async (req, res) => {
    res.json(await tickets.answer(ticketId(req.params.id), ticketAnswerBody(req.body)));
  }));
  return router;
}

// server/api/app.ts
function createApp(deps) {
  const { config } = deps;
  const app = express3();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(securityHeaders(config.isProduction));
  const api = Router6();
  api.use(cors(config.allowedOrigins));
  api.use(rateLimit({ name: "api", windowMs: 6e4, max: 600 }));
  const auth = deps.auth ?? null;
  const anyUser = requireRole(auth, ALL_ROLES);
  api.use(["/sessions", "/meta", "/admin"], (_req, _res, next) => {
    deps.admin.syncIfStale().then(() => next(), next);
  });
  api.use("/payslip", anyUser, payslipRouter(deps.extractPayslip));
  api.use("/admin", requireRole(auth, ["admin"]), adminRouter(deps.admin, auth));
  api.use(express3.json({ limit: "100kb" }));
  api.use("/auth", authRouter(auth, config.isProduction));
  api.use("/sessions", anyUser, sessionsRouter(deps.sessions));
  api.use("/tickets", ticketsRouter(deps.tickets, requireRole(auth, ["rep", "admin"])));
  api.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      ...config.isProduction ? {} : deps.healthDetails?.()
    });
  });
  api.get("/meta", anyUser, (_req, res) => {
    res.json({ sampleEmployees: sampleEmployees(), rules: getRules() });
  });
  api.use((_req, res) => {
    res.status(404).json({ error: "\u05E0\u05EA\u05D9\u05D1 \u05DC\u05D0 \u05E7\u05D9\u05D9\u05DD" });
  });
  api.use(errorHandler);
  app.use("/api", api);
  return app;
}

// server/bl/llm/gemini.ts
import { GoogleGenAI } from "@google/genai";
var COOLDOWN_MS = { 429: 6e4, 503: 3e4, 404: 6e5, 408: 6e5 };
var PAYSLIP_PROMPT = `
\u05E0\u05EA\u05D7 \u05D0\u05EA \u05EA\u05DC\u05D5\u05E9 \u05D4\u05E9\u05DB\u05E8 / \u05D7\u05D5\u05D6\u05D4 \u05D4\u05E2\u05E1\u05E7\u05D4 \u05D4\u05DE\u05E6\u05D5\u05E8\u05E3.
\u05D7\u05DC\u05E5 \u05D1\u05D3\u05D9\u05D5\u05E7 \u05E8\u05D1 \u05D0\u05EA \u05D4\u05E9\u05D3\u05D5\u05EA \u05D4\u05D1\u05D0\u05D9\u05DD (\u05D0\u05DD \u05E9\u05D3\u05D4 \u05D7\u05E1\u05E8 \u05D0\u05D5 \u05DC\u05D0 \u05D1\u05E8\u05D5\u05E8 \u05D4\u05D7\u05D6\u05E8 null):
- occupation: \u05EA\u05E4\u05E7\u05D9\u05D3 / \u05E2\u05D9\u05E1\u05D5\u05E7
- base: \u05E9\u05DB\u05E8 \u05D1\u05E1\u05D9\u05E1 / \u05D9\u05E1\u05D5\u05D3 (\u05DE\u05E1\u05E4\u05E8)
- commissions: \u05E2\u05DE\u05DC\u05D5\u05EA / \u05E4\u05E8\u05DE\u05D9\u05D5\u05EA (\u05DE\u05E1\u05E4\u05E8)
- bonus: \u05D1\u05D5\u05E0\u05D5\u05E1 \u05D7\u05D5\u05D3\u05E9\u05D9 (\u05DE\u05E1\u05E4\u05E8)
- pensionPct: \u05D0\u05D7\u05D5\u05D6 \u05E0\u05D9\u05DB\u05D5\u05D9 \u05EA\u05D2\u05DE\u05D5\u05DC\u05D9\u05DD/\u05E4\u05E0\u05E1\u05D9\u05D4 (\u05DE\u05E1\u05E4\u05E8, \u05DC\u05DE\u05E9\u05DC 6)
- studyFundPct: \u05D0\u05D7\u05D5\u05D6 \u05E0\u05D9\u05DB\u05D5\u05D9 \u05E7\u05E8\u05DF \u05D4\u05E9\u05EA\u05DC\u05DE\u05D5\u05EA (\u05DE\u05E1\u05E4\u05E8, \u05DC\u05DE\u05E9\u05DC 2.5)
- creditPoints: \u05E0\u05E7\u05D5\u05D3\u05D5\u05EA \u05D6\u05D9\u05DB\u05D5\u05D9 (\u05DE\u05E1\u05E4\u05E8, \u05DC\u05DE\u05E9\u05DC 2.25 \u05D0\u05D5 2.75)
- currentCar: \u05D3\u05D2\u05DD \u05E8\u05DB\u05D1 \u05D7\u05D1\u05E8\u05D4 \u05E7\u05D9\u05D9\u05DD \u05D0\u05DD \u05DE\u05D5\u05E4\u05D9\u05E2 (\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA)
- carParticipation: \u05E0\u05D9\u05DB\u05D5\u05D9 \u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05D1\u05E8\u05DB\u05D1 (\u05DE\u05E1\u05E4\u05E8)
- maintenance: \u05D3\u05DE\u05D9 \u05D0\u05D7\u05D6\u05E7\u05EA \u05E8\u05DB\u05D1 (\u05DE\u05E1\u05E4\u05E8)
- childrenUpTo23: \u05DE\u05E1\u05E4\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD \u05E2\u05D3 \u05D2\u05D9\u05DC 23 \u05D0\u05DD \u05DE\u05D5\u05E4\u05D9\u05E2 (\u05DE\u05E1\u05E4\u05E8)

\u05E2\u05D1\u05D5\u05E8 \u05DB\u05DC \u05E9\u05D3\u05D4 \u05D4\u05D7\u05D6\u05E8 \u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 \u05E2\u05DD { "value": \u05E2\u05E8\u05DA_\u05D0\u05D5_null, "confidence": "high"|"medium"|"low", "sourceQuote": "\u05E6\u05D9\u05D8\u05D5\u05D8 \u05DE\u05D4\u05DE\u05E1\u05DE\u05DA" }.
`;
function toGeminiContents(messages) {
  return messages.map((m) => {
    if (m.role === "model_content") return m.content;
    if (m.role === "tool_responses") {
      return {
        role: "user",
        parts: m.responses.map((r) => ({
          functionResponse: { name: r.name, ...r.id ? { id: r.id } : {}, response: r.response }
        }))
      };
    }
    return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
  });
}
function createGemini(config) {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const cooldownUntil = /* @__PURE__ */ new Map();
  async function generateWithFallback(params, preferredModel, budgetMs) {
    const now = Date.now();
    const deadline = budgetMs && budgetMs > 0 ? now + budgetMs : Infinity;
    const available = config.models.filter((m) => (cooldownUntil.get(m) || 0) <= now);
    let candidates = available.length > 0 ? available : config.models;
    if (preferredModel && candidates.includes(preferredModel)) {
      candidates = [preferredModel, ...candidates.filter((m) => m !== preferredModel)];
    }
    let lastError = null;
    for (const model of candidates) {
      const left = deadline - Date.now();
      if (left <= 0) break;
      const cutByBudget = left < config.modelTimeoutMs;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(config.modelTimeoutMs, left));
      try {
        const response = await ai.models.generateContent({
          ...params,
          model,
          config: { ...params.config || {}, abortSignal: controller.signal }
        });
        cooldownUntil.delete(model);
        return { response, model };
      } catch (error) {
        const timedOut = controller.signal.aborted;
        const status2 = timedOut ? 408 : Number(error?.status) || 500;
        lastError = timedOut ? Object.assign(new Error(`Gemini model ${model} timed out after ${config.modelTimeoutMs}ms`), { status: 503 }) : error;
        if (!(status2 in COOLDOWN_MS)) throw error;
        if (timedOut && cutByBudget) break;
        cooldownUntil.set(model, Date.now() + COOLDOWN_MS[status2]);
        console.warn(`Gemini model ${model} unavailable (${status2}); trying next model`);
      } finally {
        clearTimeout(timer);
      }
    }
    if (Date.now() >= deadline) {
      throw Object.assign(new Error("The caller time budget ran out before a model answered"), { status: 504 });
    }
    throw lastError || new Error("No Gemini model available");
  }
  async function generate(req) {
    const sdkConfig = {};
    if (req.systemInstruction) sdkConfig.systemInstruction = req.systemInstruction;
    if (req.tools?.length) {
      sdkConfig.tools = [
        { functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }
      ];
    }
    if (req.responseMimeType) sdkConfig.responseMimeType = req.responseMimeType;
    if (req.responseSchema) sdkConfig.responseSchema = req.responseSchema;
    const contents = toGeminiContents(req.messages);
    const { response, model } = await generateWithFallback(
      { contents: contents.length > 0 ? contents : "\u05E9\u05DC\u05D5\u05DD", config: sdkConfig },
      req.preferredModel,
      req.budgetMs
    );
    const functionCalls = response.functionCalls?.map((fc) => ({
      name: fc.name,
      args: fc.args,
      ...fc.id ? { id: fc.id } : {}
    }));
    const hasCalls = Boolean(functionCalls && functionCalls.length > 0);
    return {
      text: response.text || "",
      functionCalls: hasCalls ? functionCalls : void 0,
      // The raw model turn must be sent back with the function responses on the next call
      modelContent: hasCalls ? response.candidates?.[0]?.content : void 0,
      model
    };
  }
  async function extractPayslip(fileData, mimeType) {
    const { response } = await generateWithFallback({
      contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: fileData } }, { text: PAYSLIP_PROMPT }] }],
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  }
  function status() {
    const now = Date.now();
    return {
      hasGeminiKey: Boolean(config.apiKey),
      models: config.models.map((m) => ({
        model: m,
        coolingDownSec: Math.max(0, Math.round(((cooldownUntil.get(m) || 0) - now) / 1e3))
      }))
    };
  }
  return { generate, extractPayslip, status };
}

// server/data/tax-seed.json
var tax_seed_default = [
  {
    regYear: "2025",
    vehicleType: "1",
    productCode: "00885",
    modelCode: "00643",
    commercialName: "PICANTO",
    benefitValue: 2690,
    driveCode: 0,
    listPrice: 105900,
    sourceRow: 14210
  },
  {
    regYear: "2025",
    vehicleType: "1",
    productCode: "00672",
    modelCode: "00130",
    commercialName: "YARIS CROSS HSD",
    benefitValue: 3350,
    driveCode: 1,
    listPrice: 154990,
    sourceRow: 21045
  },
  {
    regYear: "2025",
    vehicleType: "1",
    productCode: "01014",
    modelCode: "00012",
    commercialName: "BYD DOLPHIN",
    benefitValue: 2590,
    driveCode: 3,
    listPrice: 150990,
    sourceRow: 31204
  },
  {
    regYear: "2025",
    vehicleType: "1",
    productCode: "00778",
    modelCode: "00618",
    commercialName: "LEON",
    benefitValue: 3880,
    driveCode: 0,
    listPrice: 152900,
    sourceRow: 18942
  },
  {
    regYear: "2025",
    vehicleType: "1",
    productCode: "00885",
    modelCode: "00619",
    commercialName: "NIRO",
    benefitValue: 2950,
    driveCode: 1,
    listPrice: 139e3,
    sourceRow: 14302
  },
  {
    regYear: "2025",
    vehicleType: "1",
    productCode: "00443",
    modelCode: "00032",
    commercialName: "MG4",
    benefitValue: 2430,
    driveCode: 3,
    listPrice: 15e4,
    sourceRow: 27814
  },
  {
    regYear: "2026",
    vehicleType: "1",
    productCode: "00839",
    modelCode: "00295",
    commercialName: "COROLLA",
    benefitValue: 4120,
    driveCode: 0,
    listPrice: 165990,
    sourceRow: 16400
  },
  {
    regYear: "2026",
    vehicleType: "1",
    productCode: "00253",
    modelCode: "00138",
    commercialName: "KONA EV",
    benefitValue: 2960,
    driveCode: 3,
    listPrice: 174990,
    sourceRow: 8920
  },
  {
    regYear: "2025",
    vehicleType: "1",
    productCode: "00413",
    modelCode: "00296",
    commercialName: "COROLLA CROSS",
    benefitValue: 4070,
    driveCode: 1,
    listPrice: 182990,
    sourceRow: 12890
  },
  {
    regYear: "2025",
    vehicleType: "1",
    productCode: "01014",
    modelCode: "00003",
    commercialName: "ATTO 3",
    benefitValue: 3130,
    driveCode: 3,
    listPrice: 177500,
    sourceRow: 31105
  },
  {
    regYear: "2025",
    vehicleType: "2",
    productCode: "01014",
    modelCode: "00003",
    commercialName: "TANG",
    benefitValue: 6950,
    driveCode: 3,
    listPrice: 315e3,
    sourceRow: 31106
  },
  {
    regYear: "2025",
    vehicleType: "1",
    productCode: "00885",
    modelCode: "00675",
    commercialName: "EV3",
    benefitValue: 2930,
    driveCode: 3,
    listPrice: 169900,
    sourceRow: 14450
  },
  {
    regYear: "2025",
    vehicleType: "1",
    productCode: "00253",
    modelCode: "00133",
    commercialName: "TUCSON",
    benefitValue: 4790,
    driveCode: 0,
    listPrice: 188497,
    sourceRow: 8810
  },
  {
    regYear: "2025",
    vehicleType: "1",
    productCode: "00588",
    modelCode: "00446",
    commercialName: "MAZDA 3",
    benefitValue: 4570,
    driveCode: 0,
    listPrice: 179900,
    sourceRow: 24190
  },
  {
    regYear: "2025",
    vehicleType: "1",
    productCode: "01327",
    modelCode: "00730",
    commercialName: "MODEL 3",
    benefitValue: 4150,
    driveCode: 3,
    listPrice: 217813,
    sourceRow: 45910
  },
  {
    regYear: "2025",
    vehicleType: "1",
    productCode: "00676",
    modelCode: "01455",
    commercialName: "OCTAVIA",
    benefitValue: 5150,
    driveCode: 0,
    listPrice: 202690,
    sourceRow: 29810
  },
  {
    regYear: "2026",
    vehicleType: "1",
    productCode: "00416",
    modelCode: "00294",
    commercialName: "SPORTAGE HEV",
    benefitValue: 4550,
    driveCode: 2,
    listPrice: 229900,
    sourceRow: 13910
  },
  {
    regYear: "2025",
    vehicleType: "1",
    productCode: "01014",
    modelCode: "00014",
    commercialName: "SEAL",
    benefitValue: 4970,
    driveCode: 3,
    listPrice: 25e4,
    sourceRow: 31250
  },
  {
    regYear: "2025",
    vehicleType: "1",
    productCode: "00413",
    modelCode: "00368",
    commercialName: "RAV4",
    benefitValue: 4470,
    driveCode: 1,
    listPrice: 199e3,
    sourceRow: 12940
  },
  {
    regYear: "2025",
    vehicleType: "1",
    productCode: "00885",
    modelCode: "00648",
    commercialName: "CARNIVAL",
    benefitValue: 8120,
    driveCode: 0,
    listPrice: 319900,
    sourceRow: 14500
  },
  {
    regYear: "2025",
    vehicleType: "1",
    productCode: "00481",
    modelCode: "00533",
    commercialName: "SANTA FE",
    benefitValue: 4700,
    driveCode: 0,
    listPrice: 185e3,
    sourceRow: 11400
  }
];

// server/bl/engine/benefit.ts
var seedLookupMap = /* @__PURE__ */ new Map();
for (const item of tax_seed_default) {
  const key = makeLookupKey(
    String(item.regYear).trim(),
    String(item.vehicleType).trim(),
    String(item.productCode).trim().padStart(5, "0"),
    String(item.modelCode).trim().padStart(5, "0")
  );
  seedLookupMap.set(key, {
    value: item.benefitValue,
    sourceRow: item.sourceRow,
    commercialName: item.commercialName,
    driveCode: item.driveCode,
    listPrice: item.listPrice
  });
}
function makeLookupKey(regYear, vehicleType, productCode, modelCode) {
  const y = String(regYear).trim();
  const t = String(vehicleType).trim();
  const p = String(productCode).trim().padStart(5, "0");
  const m = String(modelCode).trim().padStart(5, "0");
  return `${y}|${t}|${p}|${m}`;
}
async function lookupBenefitValue(regYear, productCode, modelCode, vehicleType = "1", customDbLookup) {
  const key = makeLookupKey(regYear, vehicleType, productCode, modelCode);
  if (customDbLookup) {
    try {
      const customRes = await customDbLookup(key);
      if (customRes) return customRes;
    } catch {
    }
  }
  if (seedLookupMap.has(key)) {
    return seedLookupMap.get(key);
  }
  const catItem = getCatalog().find(
    (c) => String(c.year) === String(regYear).trim() && c.productCode.padStart(5, "0") === String(productCode).trim().padStart(5, "0") && c.modelCode.padStart(5, "0") === String(modelCode).trim().padStart(5, "0")
  );
  if (catItem) {
    return {
      value: catItem.benefit,
      sourceRow: 0,
      commercialName: catItem.model,
      driveCode: catItem.driveCode,
      listPrice: catItem.listPrice
    };
  }
  return null;
}

// server/bl/services/xlsx.ts
import { inflateRawSync } from "node:zlib";
var XlsxError = class extends Error {
  constructor() {
    super(...arguments);
    this.status = 400;
  }
};
var MAX_ENTRY_BYTES = 20 * 1024 * 1024;
var MAX_ROWS = 5e3;
var fail2 = (message) => {
  throw new XlsxError(message);
};
function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 101010256) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) fail2("\u05D4\u05E7\u05D5\u05D1\u05E5 \u05D0\u05D9\u05E0\u05D5 \u05E7\u05D5\u05D1\u05E5 Excel \u05EA\u05E7\u05D9\u05DF (xlsx)");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = /* @__PURE__ */ new Map();
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 33639248) fail2("\u05D4\u05E7\u05D5\u05D1\u05E5 \u05D0\u05D9\u05E0\u05D5 \u05E7\u05D5\u05D1\u05E5 Excel \u05EA\u05E7\u05D9\u05DF (xlsx)");
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    entries.set(name, () => {
      if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== 67324752) fail2("\u05D4\u05E7\u05D5\u05D1\u05E5 \u05D0\u05D9\u05E0\u05D5 \u05E7\u05D5\u05D1\u05E5 Excel \u05EA\u05E7\u05D9\u05DF (xlsx)");
      const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
      const data = buf.subarray(start, start + compressedSize);
      if (method === 0) return data;
      if (method !== 8) fail2("\u05D4\u05E7\u05D5\u05D1\u05E5 \u05D3\u05D7\u05D5\u05E1 \u05D1\u05E9\u05D9\u05D8\u05D4 \u05E9\u05D0\u05D9\u05E0\u05D4 \u05E0\u05EA\u05DE\u05DB\u05EA");
      try {
        return inflateRawSync(data, { maxOutputLength: MAX_ENTRY_BYTES });
      } catch {
        return fail2("\u05D4\u05E7\u05D5\u05D1\u05E5 \u05E4\u05D2\u05D5\u05DD \u05D0\u05D5 \u05D2\u05D3\u05D5\u05DC \u05DE\u05D3\u05D9");
      }
    });
  }
  return entries;
}
function decodeXml(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => {
    const k = e.toLowerCase();
    if (k === "amp") return "&";
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "quot") return '"';
    if (k === "apos") return "'";
    return String.fromCodePoint(k.startsWith("#x") ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  });
}
var texts = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join("");
var attr = (tag2, name) => tag2.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
function columnIndex(ref) {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function parseSheet(xml, shared) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    if (rows.length >= MAX_ROWS) fail2(`\u05D4\u05D2\u05D9\u05DC\u05D9\u05D5\u05DF \u05D0\u05E8\u05D5\u05DA \u05DE\u05D3\u05D9 (\u05E2\u05D3 ${MAX_ROWS} \u05E9\u05D5\u05E8\u05D5\u05EA)`);
    const rowNum = Number(attr(rowMatch[1], "r")) || rows.length + 1;
    const row = [];
    for (const c of (rowMatch[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const type = attr(c[1], "t");
      const body = c[2] ?? "";
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value;
      if (type === "inlineStr") value = texts(body);
      else if (type === "s") value = shared[Number(v)] ?? "";
      else value = v === void 0 ? "" : decodeXml(v);
      const ref = attr(c[1], "r");
      row[ref ? columnIndex(ref) : row.length] = value;
    }
    rows[rowNum - 1] = Array.from(row, (v) => (v ?? "").trim());
  }
  return Array.from(rows, (r) => r ?? []);
}
function readXlsx(data) {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (buf.length < 22 || buf.readUInt32LE(0) !== 67324752) fail2("\u05D4\u05E7\u05D5\u05D1\u05E5 \u05D0\u05D9\u05E0\u05D5 \u05E7\u05D5\u05D1\u05E5 Excel (xlsx). \u05E9\u05DE\u05E8\u05D5 \u05D0\u05D5\u05EA\u05D5 \u05D1-Excel \u05D1\u05E4\u05D5\u05E8\u05DE\u05D8 .xlsx \u05D5\u05E0\u05E1\u05D5 \u05E9\u05D5\u05D1.");
  const zip = unzip(buf);
  const read = (name) => zip.get(name)?.().toString("utf8");
  const workbook = read("xl/workbook.xml") ?? fail2("\u05D4\u05E7\u05D5\u05D1\u05E5 \u05D0\u05D9\u05E0\u05D5 \u05E7\u05D5\u05D1\u05E5 Excel \u05EA\u05E7\u05D9\u05DF (\u05D7\u05E1\u05E8 workbook)");
  const rels = read("xl/_rels/workbook.xml.rels") ?? "";
  const targets = /* @__PURE__ */ new Map();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], "Id");
    const target = attr(m[0], "Target");
    if (id && target) targets.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  }
  const sharedXml = read("xl/sharedStrings.xml");
  const shared = sharedXml ? [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1])) : [];
  const sheets = /* @__PURE__ */ new Map();
  for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const name = decodeXml(attr(m[0], "name") ?? "");
    const target = targets.get(attr(m[0], "r:id") ?? "");
    const xml = target ? read(target) : void 0;
    if (name && xml) sheets.set(name.trim(), parseSheet(xml, shared));
  }
  return sheets;
}

// server/bl/services/referenceFile.ts
var SHEET_NAMES = {
  catalog: "\u05E7\u05D8\u05DC\u05D5\u05D2 \u05E8\u05DB\u05D1\u05D9\u05DD",
  occupations: "\u05E2\u05D9\u05E1\u05D5\u05E7\u05D9\u05DD",
  employees: "\u05E2\u05D5\u05D1\u05D3\u05D9\u05DD \u05DC\u05D3\u05D5\u05D2\u05DE\u05D4"
};
var CAR_GROUPS = ["\u05D0", "\u05D1", "\u05D2", "\u05D3", "\u05DE\u05E9\u05E4\u05D7\u05EA\u05D9"];
var EMPLOYEE_GROUPS = ["\u05D0", "\u05D1", "\u05D2", "\u05D3"];
var DRIVE_CODES = { \u05D1\u05E0\u05D6\u05D9\u05DF: 0, \u05D4\u05D9\u05D1\u05E8\u05D9\u05D3\u05D9: 1, "\u05E4\u05DC\u05D0\u05D2-\u05D0\u05D9\u05DF": 2, \u05D7\u05E9\u05DE\u05DC\u05D9: 3 };
var NO_CAR_NAME = "\u05DC\u05DC\u05D0 \u05E8\u05DB\u05D1 (\u05D5\u05D9\u05EA\u05D5\u05E8)";
var REQUIRED_CARS = {
  "CAR-19": "\u05D1\u05E8\u05D9\u05E8\u05EA \u05D4\u05DE\u05D7\u05D3\u05DC \u05D1\u05DE\u05E1\u05DC\u05D5\u05DC \u05D4\u05DE\u05E9\u05E4\u05D7\u05EA\u05D9",
  "CAR-10": "\u05D1\u05E8\u05D9\u05E8\u05EA \u05D4\u05DE\u05D7\u05D3\u05DC \u05DC\u05E8\u05DB\u05D1 \u05D7\u05E9\u05DE\u05DC\u05D9"
};
var normHeader = (h) => h.replace(/\([^)]*\)/g, "").replace(/[״"]/g, '"').replace(/\s+/g, " ").trim();
function columns(header, fields, errors) {
  const heads = header.map(normHeader);
  const out = {};
  const missing = [];
  for (const [field, name] of Object.entries(fields)) {
    let i = heads.indexOf(name);
    if (i < 0) i = heads.findIndex((h) => h.startsWith(name));
    if (i < 0) missing.push(name);
    out[field] = i;
  }
  if (missing.length) {
    errors.push(`\u05D7\u05E1\u05E8\u05D5\u05EA \u05E2\u05DE\u05D5\u05D3\u05D5\u05EA: ${missing.join(", ")}`);
    return null;
  }
  return out;
}
var dataRows = (rows) => rows.slice(1).map((cells, i) => ({ cells, line: i + 2 })).filter((r) => r.cells.some((c) => c !== ""));
var RowReader = class {
  constructor(cells, line, errors) {
    this.cells = cells;
    this.line = line;
    this.errors = errors;
  }
  error(name, message) {
    this.errors.push(`\u05E9\u05D5\u05E8\u05D4 ${this.line}, ${name}: ${message}`);
  }
  text(col, name, required = true) {
    const v = (this.cells[col] ?? "").trim();
    if (required && !v) this.error(name, "\u05D7\u05E1\u05E8 \u05E2\u05E8\u05DA");
    return v;
  }
  number(col, name, min, max) {
    const raw = (this.cells[col] ?? "").replace(/[,₪%\s]/g, "");
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n)) {
      this.error(name, raw === "" ? "\u05D7\u05E1\u05E8 \u05E2\u05E8\u05DA" : `"${this.cells[col]}" \u05D0\u05D9\u05E0\u05D5 \u05DE\u05E1\u05E4\u05E8`);
      return 0;
    }
    if (n < min || n > max) this.error(name, `${n} \u05DE\u05D7\u05D5\u05E5 \u05DC\u05D8\u05D5\u05D5\u05D7 (${min}\u2013${max})`);
    return n;
  }
  /** Product and model codes keep their leading zeros (Excel may drop them) */
  code(col, name) {
    const v = this.text(col, name);
    if (v && !/^\d{1,5}$/.test(v)) this.error(name, `"${v}" \u05D0\u05D9\u05E0\u05D5 \u05E7\u05D5\u05D3 \u05DE\u05E1\u05E4\u05E8\u05D9`);
    return v.padStart(5, "0");
  }
  yesNo(col, name) {
    const v = this.text(col, name);
    if (v === "\u05DB\u05DF") return true;
    if (v !== "\u05DC\u05D0" && v) this.error(name, `"${v}": \u05D9\u05E9 \u05DC\u05DB\u05EA\u05D5\u05D1 \u05DB\u05DF \u05D0\u05D5 \u05DC\u05D0`);
    return false;
  }
  oneOf(col, name, allowed) {
    const v = this.text(col, name).replace(/['׳]/g, "");
    if (v && !allowed.includes(v)) this.error(name, `"${v}" \u05D0\u05D9\u05E0\u05D5 \u05D0\u05D7\u05D3 \u05DE: ${allowed.join(", ")}`);
    return v;
  }
};
function duplicates(keys) {
  const seen = /* @__PURE__ */ new Set();
  return [...new Set(keys.filter((k) => seen.size === seen.add(k).size))];
}
function parseCatalogSheet(rows) {
  const errors = [];
  const warnings = [];
  const col = columns(rows[0] ?? [], {
    id: "\u05DE\u05D6\u05D4\u05D4",
    group: "\u05E7\u05D1\u05D5\u05E6\u05D4",
    make: "\u05EA\u05D5\u05E6\u05E8",
    productCode: "\u05E7\u05D5\u05D3 \u05EA\u05D5\u05E6\u05E8",
    model: "\u05D3\u05D2\u05DD",
    modelCode: "\u05E7\u05D5\u05D3 \u05D3\u05D2\u05DD",
    description: "\u05EA\u05D0\u05D5\u05E8 \u05D3\u05D2\u05DD",
    year: "\u05E9\u05E0\u05EA \u05E8\u05D9\u05E9\u05D5\u05DD",
    fuel: "\u05D4\u05E0\u05E2\u05D4",
    listPrice: "\u05DE\u05D7\u05D9\u05E8 \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF",
    benefit: "\u05E9\u05D5\u05D5\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9",
    companyCost: "\u05E2\u05DC\u05D5\u05EA \u05D7\u05D5\u05D3\u05E9\u05D9\u05EA",
    participation: "\u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA"
  }, errors);
  const cars = [];
  if (col) {
    for (const { cells, line } of dataRows(rows)) {
      const r = new RowReader(cells, line, errors);
      const fuel = r.oneOf(col.fuel, "\u05D4\u05E0\u05E2\u05D4", Object.keys(DRIVE_CODES));
      cars.push({
        id: r.text(col.id, "\u05DE\u05D6\u05D4\u05D4"),
        group: r.oneOf(col.group, "\u05E7\u05D1\u05D5\u05E6\u05D4", CAR_GROUPS),
        make: r.text(col.make, "\u05EA\u05D5\u05E6\u05E8"),
        model: r.text(col.model, "\u05D3\u05D2\u05DD"),
        productCode: r.code(col.productCode, "\u05E7\u05D5\u05D3 \u05EA\u05D5\u05E6\u05E8"),
        modelCode: r.code(col.modelCode, "\u05E7\u05D5\u05D3 \u05D3\u05D2\u05DD"),
        description: r.text(col.description, "\u05EA\u05D0\u05D5\u05E8 \u05D3\u05D2\u05DD", false),
        year: r.number(col.year, "\u05E9\u05E0\u05EA \u05E8\u05D9\u05E9\u05D5\u05DD", 1990, 2100),
        fuel,
        driveCode: DRIVE_CODES[fuel] ?? 0,
        listPrice: r.number(col.listPrice, "\u05DE\u05D7\u05D9\u05E8 \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF", 0, 1e7),
        benefit: r.number(col.benefit, "\u05E9\u05D5\u05D5\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9", 1, 1e5),
        companyCost: r.number(col.companyCost, "\u05E2\u05DC\u05D5\u05EA \u05D7\u05D5\u05D3\u05E9\u05D9\u05EA \u05DC\u05D7\u05D1\u05E8\u05D4", 0, 1e5),
        participation: r.number(col.participation, "\u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05E2\u05D5\u05D1\u05D3", 0, 1e5)
      });
    }
    if (!cars.length) errors.push("\u05D4\u05D2\u05D9\u05DC\u05D9\u05D5\u05DF \u05E8\u05D9\u05E7");
    for (const id of duplicates(cars.map((c) => c.id))) errors.push(`\u05D4\u05DE\u05D6\u05D4\u05D4 ${id} \u05DE\u05D5\u05E4\u05D9\u05E2 \u05D9\u05D5\u05EA\u05E8 \u05DE\u05E4\u05E2\u05DD \u05D0\u05D7\u05EA`);
    for (const g of ["\u05D0", "\u05D1", "\u05D2", "\u05D3"]) {
      if (cars.length && !cars.some((c) => c.group === g)) warnings.push(`\u05D0\u05D9\u05DF \u05E8\u05DB\u05D1 \u05D1\u05E7\u05D1\u05D5\u05E6\u05D4 ${g}: \u05E2\u05D5\u05D1\u05D3\u05D9 \u05D4\u05E7\u05D1\u05D5\u05E6\u05D4 \u05D9\u05D5\u05DB\u05DC\u05D5 \u05DC\u05D1\u05D7\u05D5\u05E8 \u05E8\u05E7 \u05DE\u05E7\u05D1\u05D5\u05E6\u05D5\u05EA \u05E0\u05DE\u05D5\u05DB\u05D5\u05EA \u05D9\u05D5\u05EA\u05E8`);
    }
    if (cars.length && !cars.some((c) => c.group === "\u05DE\u05E9\u05E4\u05D7\u05EA\u05D9")) warnings.push("\u05D0\u05D9\u05DF \u05E8\u05DB\u05D1 \u05D1\u05DE\u05E1\u05DC\u05D5\u05DC \u05D4\u05DE\u05E9\u05E4\u05D7\u05EA\u05D9");
    for (const [id, role] of Object.entries(REQUIRED_CARS)) {
      if (cars.length && !cars.some((c) => c.id === id)) errors.push(`\u05D7\u05E1\u05E8 \u05D4\u05E8\u05DB\u05D1 ${id} (${role}); \u05D4\u05DE\u05D7\u05E9\u05D1\u05D5\u05DF \u05E0\u05E9\u05E2\u05DF \u05E2\u05DC\u05D9\u05D5`);
    }
  }
  return { kind: "catalog", sheet: SHEET_NAMES.catalog, rows: cars, errors, warnings };
}
function parseOccupationsSheet(rows) {
  const errors = [];
  const col = columns(rows[0] ?? [], {
    occupation: "\u05E2\u05D9\u05E1\u05D5\u05E7",
    group: "\u05E7\u05D1\u05D5\u05E6\u05EA \u05D6\u05DB\u05D0\u05D5\u05EA",
    carMandatory: "\u05E8\u05DB\u05D1 \u05D7\u05D5\u05D1\u05D4",
    canWaive: "\u05DE\u05D5\u05EA\u05E8 \u05DC\u05D5\u05D5\u05EA\u05E8",
    maintenance: "\u05D0\u05D7\u05D6\u05E7\u05EA \u05E8\u05DB\u05D1"
  }, errors);
  const list2 = [];
  if (col) {
    for (const { cells, line } of dataRows(rows)) {
      const r = new RowReader(cells, line, errors);
      const occ = {
        occupation: r.text(col.occupation, "\u05E2\u05D9\u05E1\u05D5\u05E7"),
        group: r.oneOf(col.group, "\u05E7\u05D1\u05D5\u05E6\u05EA \u05D6\u05DB\u05D0\u05D5\u05EA", EMPLOYEE_GROUPS),
        carMandatory: r.yesNo(col.carMandatory, "\u05E8\u05DB\u05D1 \u05D7\u05D5\u05D1\u05D4"),
        canWaive: r.yesNo(col.canWaive, "\u05DE\u05D5\u05EA\u05E8 \u05DC\u05D5\u05D5\u05EA\u05E8"),
        maintenance: r.number(col.maintenance, "\u05D0\u05D7\u05D6\u05E7\u05EA \u05E8\u05DB\u05D1", 0, 1e5)
      };
      if (occ.carMandatory && occ.canWaive) errors.push(`\u05E9\u05D5\u05E8\u05D4 ${line}: \u05E2\u05D9\u05E1\u05D5\u05E7 \u05E2\u05DD \u05E8\u05DB\u05D1 \u05D7\u05D5\u05D1\u05D4 \u05DC\u05D0 \u05D9\u05DB\u05D5\u05DC \u05DC\u05D4\u05D9\u05D5\u05EA "\u05DE\u05D5\u05EA\u05E8 \u05DC\u05D5\u05D5\u05EA\u05E8"`);
      if (occ.canWaive && occ.maintenance <= 0) errors.push(`\u05E9\u05D5\u05E8\u05D4 ${line}: \u05DE\u05D5\u05EA\u05E8 \u05DC\u05D5\u05D5\u05EA\u05E8 \u05D0\u05D1\u05DC \u05D0\u05D7\u05D6\u05E7\u05EA \u05D4\u05E8\u05DB\u05D1 \u05D4\u05D9\u05D0 0`);
      list2.push(occ);
    }
    if (!list2.length) errors.push("\u05D4\u05D2\u05D9\u05DC\u05D9\u05D5\u05DF \u05E8\u05D9\u05E7");
    for (const name of duplicates(list2.map((o) => o.occupation))) errors.push(`\u05D4\u05E2\u05D9\u05E1\u05D5\u05E7 "${name}" \u05DE\u05D5\u05E4\u05D9\u05E2 \u05D9\u05D5\u05EA\u05E8 \u05DE\u05E4\u05E2\u05DD \u05D0\u05D7\u05EA`);
  }
  return { kind: "occupations", sheet: SHEET_NAMES.occupations, rows: list2, errors, warnings: [] };
}
function parseEmployeesSheet(rows, catalog, occupations) {
  const errors = [];
  const warnings = [];
  const col = columns(rows[0] ?? [], {
    id: "\u05DE\u05D6\u05D4\u05D4",
    name: "\u05E9\u05DD",
    occupation: "\u05E2\u05D9\u05E1\u05D5\u05E7",
    group: "\u05E7\u05D1\u05D5\u05E6\u05D4",
    base: "\u05E9\u05DB\u05E8 \u05D1\u05E1\u05D9\u05E1",
    commissions: "\u05E2\u05DE\u05DC\u05D5\u05EA",
    bonus: "\u05D1\u05D5\u05E0\u05D5\u05E1",
    pensionPct: "\u05E4\u05E0\u05E1\u05D9\u05D4 \u05E2\u05D5\u05D1\u05D3",
    studyFundPct: "\u05E7\u05E8\u05DF \u05D4\u05E9\u05EA\u05DC\u05DE\u05D5\u05EA",
    creditPoints: "\u05E0\u05E7\u05D5\u05D3\u05D5\u05EA \u05D6\u05D9\u05DB\u05D5\u05D9",
    children: "\u05D9\u05DC\u05D3\u05D9\u05DD",
    car: "\u05E8\u05DB\u05D1 \u05D4\u05D9\u05D5\u05DD",
    participation: "\u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05D4\u05D9\u05D5\u05DD"
  }, errors);
  const list2 = [];
  if (col) {
    for (const { cells, line } of dataRows(rows)) {
      const r = new RowReader(cells, line, errors);
      const carText = r.text(col.car, "\u05E8\u05DB\u05D1 \u05D4\u05D9\u05D5\u05DD");
      const noCar = /^(אין|ללא)/.test(carText);
      const car = noCar ? void 0 : catalog.find((c) => c.id.toLowerCase() === carText.toLowerCase() || c.model.toLowerCase() === carText.toLowerCase());
      if (carText && !noCar && !car) errors.push(`\u05E9\u05D5\u05E8\u05D4 ${line}, \u05E8\u05DB\u05D1 \u05D4\u05D9\u05D5\u05DD: "${carText}" \u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0 \u05D1\u05E7\u05D8\u05DC\u05D5\u05D2 \u05D4\u05E8\u05DB\u05D1\u05D9\u05DD`);
      const maintenance = noCar ? Number(carText.replace(/,/g, "").match(/\d+(\.\d+)?/)?.[0] ?? 0) : 0;
      const occupation = r.text(col.occupation, "\u05E2\u05D9\u05E1\u05D5\u05E7");
      if (occupation && !occupations.some((o) => o.occupation === occupation)) {
        warnings.push(`\u05E9\u05D5\u05E8\u05D4 ${line}: \u05D4\u05E2\u05D9\u05E1\u05D5\u05E7 "${occupation}" \u05D0\u05D9\u05E0\u05D5 \u05D1\u05D8\u05D1\u05DC\u05EA \u05D4\u05E2\u05D9\u05E1\u05D5\u05E7\u05D9\u05DD`);
      }
      list2.push({
        id: r.text(col.id, "\u05DE\u05D6\u05D4\u05D4"),
        name: r.text(col.name, "\u05E9\u05DD"),
        occupation,
        group: r.oneOf(col.group, "\u05E7\u05D1\u05D5\u05E6\u05D4", EMPLOYEE_GROUPS),
        base: r.number(col.base, "\u05E9\u05DB\u05E8 \u05D1\u05E1\u05D9\u05E1", 0, 1e6),
        commissions: r.number(col.commissions, "\u05E2\u05DE\u05DC\u05D5\u05EA", 0, 1e6),
        bonus: r.number(col.bonus, "\u05D1\u05D5\u05E0\u05D5\u05E1", 0, 1e6),
        pensionPct: r.number(col.pensionPct, "\u05E4\u05E0\u05E1\u05D9\u05D4 \u05E2\u05D5\u05D1\u05D3 %", 0, 100),
        studyFundPct: r.number(col.studyFundPct, "\u05E7\u05E8\u05DF \u05D4\u05E9\u05EA\u05DC\u05DE\u05D5\u05EA %", 0, 100),
        creditPoints: r.number(col.creditPoints, "\u05E0\u05E7\u05D5\u05D3\u05D5\u05EA \u05D6\u05D9\u05DB\u05D5\u05D9", 0, 30),
        childrenUpTo23: r.number(col.children, "\u05D9\u05DC\u05D3\u05D9\u05DD \u05E2\u05D3 23", 0, 30),
        hasCar: Boolean(car),
        currentCarId: car?.id ?? null,
        currentCarName: car?.model ?? NO_CAR_NAME,
        currentParticipation: car ? r.number(col.participation, "\u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05D4\u05D9\u05D5\u05DD", 0, 1e5) : 0,
        currentBenefit: car?.benefit ?? 0,
        currentMaintenance: maintenance
      });
    }
    if (!list2.length) errors.push("\u05D4\u05D2\u05D9\u05DC\u05D9\u05D5\u05DF \u05E8\u05D9\u05E7");
    for (const id of duplicates(list2.map((e) => e.id))) errors.push(`\u05D4\u05DE\u05D6\u05D4\u05D4 ${id} \u05DE\u05D5\u05E4\u05D9\u05E2 \u05D9\u05D5\u05EA\u05E8 \u05DE\u05E4\u05E2\u05DD \u05D0\u05D7\u05EA`);
  }
  return { kind: "employees", sheet: SHEET_NAMES.employees, rows: list2, errors, warnings };
}
function parseDataWorkbook(data, active2) {
  const sheets = readXlsx(data);
  const out = {};
  const catalogRows = sheets.get(SHEET_NAMES.catalog);
  const occupationRows = sheets.get(SHEET_NAMES.occupations);
  const employeeRows = sheets.get(SHEET_NAMES.employees);
  if (catalogRows) out.catalog = parseCatalogSheet(catalogRows);
  if (occupationRows) out.occupations = parseOccupationsSheet(occupationRows);
  if (employeeRows) {
    const catalog = out.catalog && !out.catalog.errors.length ? out.catalog.rows : active2.catalog;
    const occupations = out.occupations && !out.occupations.errors.length ? out.occupations.rows : active2.occupations;
    out.employees = parseEmployeesSheet(employeeRows, catalog, occupations);
  }
  return out;
}

// server/bl/services/taxCsv.ts
function decodeTaxCsv(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1255").decode(buffer);
  }
}
function findColumn(headers, terms, taken = []) {
  const free = (i) => i >= 0 && !taken.includes(i);
  for (const term of terms) {
    const exact = headers.findIndex((h, i) => free(i) && h === term);
    if (exact >= 0) return exact;
    const partial = headers.findIndex((h, i) => free(i) && h.includes(term));
    if (partial >= 0) return partial;
  }
  return -1;
}
function parseTaxAuthorityCsv(buffer) {
  const text2 = decodeTaxCsv(buffer);
  const lines = text2.split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error("\u05E7\u05D5\u05D1\u05E5 \u05D4-CSV \u05E8\u05D9\u05E7 \u05D0\u05D5 \u05D0\u05D9\u05E0\u05D5 \u05EA\u05E7\u05D9\u05DF");
  }
  const headers = lines[0].split(",").map((h) => h.replace(/^["']|["']$/g, "").trim());
  const idxRegYear = findColumn(headers, ["\u05E9\u05E0\u05EA \u05E8\u05D9\u05E9\u05D5\u05DD"]);
  const idxVehicleType = findColumn(headers, ["\u05E7\u05D5\u05D3 \u05E1\u05D5\u05D2 \u05E8\u05DB\u05D1"]);
  const idxProduct = findColumn(headers, ["\u05E7\u05D5\u05D3 \u05EA\u05D5\u05E6\u05E8"]);
  const idxModel = findColumn(headers, ["\u05E7\u05D5\u05D3 \u05D3\u05D2\u05DD"]);
  const idxBenefit = findColumn(headers, ["\u05E9\u05D5\u05D5\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9"]);
  const keys = [idxRegYear, idxVehicleType, idxProduct, idxModel, idxBenefit];
  const idxName = findColumn(headers, ["\u05DB\u05D9\u05E0\u05D5\u05D9 \u05DE\u05E1\u05D7\u05E8\u05D9", "\u05EA\u05D0\u05D5\u05E8 \u05D3\u05D2\u05DD", "\u05EA\u05D5\u05E6\u05E8"], keys);
  const idxPrice = findColumn(headers, ["\u05DE\u05D7\u05D9\u05E8 \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF", "\u05DE\u05D7\u05D9\u05E8 \u05DE\u05EA\u05D5\u05D0\u05DD"], keys);
  const idxDrive = findColumn(headers, ["1-\u05D7\u05E9\u05DE\u05DC\u05D9", "\u05E4\u05DC\u05D2-\u05D0\u05D9\u05DF"], keys);
  if (idxRegYear === -1 || idxProduct === -1 || idxModel === -1 || idxBenefit === -1) {
    throw new Error("\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0\u05D5 \u05E2\u05DE\u05D5\u05D3\u05D5\u05EA \u05DE\u05E4\u05EA\u05D7 \u05E0\u05D3\u05E8\u05E9\u05D5\u05EA (\u05E9\u05E0\u05EA \u05E8\u05D9\u05E9\u05D5\u05DD, \u05E7\u05D5\u05D3 \u05EA\u05D5\u05E6\u05E8, \u05E7\u05D5\u05D3 \u05D3\u05D2\u05DD, \u05E9\u05D5\u05D5\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9)");
  }
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",").map((c) => c.replace(/^["']|["']$/g, "").trim());
    if (cols.length < 5) continue;
    const regYear = cols[idxRegYear] || "2025";
    const vehicleType = idxVehicleType >= 0 && cols[idxVehicleType] ? cols[idxVehicleType] : "1";
    const productCode = (cols[idxProduct] || "").padStart(5, "0");
    const modelCode = (cols[idxModel] || "").padStart(5, "0");
    records.push({
      key: `${regYear}|${vehicleType}|${productCode}|${modelCode}`,
      regYear,
      vehicleType,
      productCode,
      modelCode,
      commercialName: idxName >= 0 ? cols[idxName] : "",
      benefitValue: parseFloat(cols[idxBenefit]) || 0,
      listPrice: idxPrice >= 0 ? parseFloat(cols[idxPrice]) || 0 : 0,
      driveCode: idxDrive >= 0 ? parseInt(cols[idxDrive], 10) || 0 : 0,
      sourceRow: i + 1
    });
  }
  return records;
}

// server/bl/services/adminService.ts
var InvalidRulesError = class extends Error {
  constructor() {
    super(...arguments);
    this.status = 400;
  }
};
var InvalidDataError = class extends Error {
  constructor() {
    super(...arguments);
    this.status = 400;
  }
};
function assertRulesShape(r) {
  const ok = r && typeof r === "object" && r.budgets && typeof r.budgets === "object" && Array.isArray(r.groupOrder) && r.netMethod && Array.isArray(r.netMethod.brackets) && typeof r.netMethod.creditPointValue === "number" && r.netMethod.nationalInsurance && r.netMethod.health && r.netMethod.pensionCredit;
  if (!ok) throw new InvalidRulesError("\u05E7\u05D5\u05D1\u05E5 \u05D4\u05DB\u05DC\u05DC\u05D9\u05DD \u05D7\u05E1\u05E8 \u05E9\u05D3\u05D5\u05EA \u05D7\u05D5\u05D1\u05D4 (budgets, groupOrder, netMethod)");
}
var ROW_KEY = {
  catalog: (c) => c.id,
  occupations: (o) => o.occupation,
  employees: (e) => e.id ?? ""
};
var ROW_NAME = {
  catalog: (c) => `${c.id} \xB7 ${c.model}`,
  occupations: (o) => o.occupation,
  employees: (e) => `${e.id} \xB7 ${e.name ?? ""}`
};
var FIELD_LABELS = {
  group: "\u05E7\u05D1\u05D5\u05E6\u05D4",
  make: "\u05EA\u05D5\u05E6\u05E8",
  model: "\u05D3\u05D2\u05DD",
  productCode: "\u05E7\u05D5\u05D3 \u05EA\u05D5\u05E6\u05E8",
  modelCode: "\u05E7\u05D5\u05D3 \u05D3\u05D2\u05DD",
  description: "\u05EA\u05D0\u05D5\u05E8 \u05D3\u05D2\u05DD",
  year: "\u05E9\u05E0\u05EA \u05E8\u05D9\u05E9\u05D5\u05DD",
  fuel: "\u05D4\u05E0\u05E2\u05D4",
  driveCode: "\u05E7\u05D5\u05D3 \u05D4\u05E0\u05E2\u05D4",
  listPrice: "\u05DE\u05D7\u05D9\u05E8 \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF",
  benefit: "\u05E9\u05D5\u05D5\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9",
  companyCost: "\u05E2\u05DC\u05D5\u05EA \u05D7\u05D5\u05D3\u05E9\u05D9\u05EA \u05DC\u05D7\u05D1\u05E8\u05D4",
  participation: "\u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05E2\u05D5\u05D1\u05D3",
  occupation: "\u05E2\u05D9\u05E1\u05D5\u05E7",
  carMandatory: "\u05E8\u05DB\u05D1 \u05D7\u05D5\u05D1\u05D4",
  canWaive: "\u05DE\u05D5\u05EA\u05E8 \u05DC\u05D5\u05D5\u05EA\u05E8",
  maintenance: "\u05D0\u05D7\u05D6\u05E7\u05EA \u05E8\u05DB\u05D1",
  name: "\u05E9\u05DD",
  base: "\u05E9\u05DB\u05E8 \u05D1\u05E1\u05D9\u05E1",
  commissions: "\u05E2\u05DE\u05DC\u05D5\u05EA",
  bonus: "\u05D1\u05D5\u05E0\u05D5\u05E1",
  pensionPct: "\u05E4\u05E0\u05E1\u05D9\u05D4 \u05E2\u05D5\u05D1\u05D3 %",
  studyFundPct: "\u05E7\u05E8\u05DF \u05D4\u05E9\u05EA\u05DC\u05DE\u05D5\u05EA %",
  creditPoints: "\u05E0\u05E7\u05D5\u05D3\u05D5\u05EA \u05D6\u05D9\u05DB\u05D5\u05D9",
  childrenUpTo23: "\u05D9\u05DC\u05D3\u05D9\u05DD \u05E2\u05D3 23",
  hasCar: "\u05D9\u05E9 \u05E8\u05DB\u05D1",
  currentCarId: "\u05E8\u05DB\u05D1 \u05D4\u05D9\u05D5\u05DD",
  currentCarName: "\u05E9\u05DD \u05D4\u05E8\u05DB\u05D1 \u05D4\u05D9\u05D5\u05DD",
  currentParticipation: "\u05D4\u05E9\u05EA\u05EA\u05E4\u05D5\u05EA \u05D4\u05D9\u05D5\u05DD",
  currentBenefit: "\u05E9\u05D5\u05D5\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9 \u05D4\u05D9\u05D5\u05DD",
  currentMaintenance: "\u05D0\u05D7\u05D6\u05E7\u05D4 \u05D4\u05D9\u05D5\u05DD"
};
var RULE_LABELS = {
  version: "\u05D2\u05E8\u05E1\u05D4",
  budgets: "\u05EA\u05E7\u05E6\u05D9\u05D1 \u05E7\u05D1\u05D5\u05E6\u05D4",
  groupOrder: "\u05E1\u05D3\u05E8 \u05D4\u05E7\u05D1\u05D5\u05E6\u05D5\u05EA",
  chooseFrom: "\u05D1\u05D7\u05D9\u05E8\u05EA \u05E8\u05DB\u05D1",
  "electric.netBonus": "\u05D4\u05D7\u05D6\u05E8 \u05D7\u05E9\u05DE\u05DC \u05E0\u05D8\u05D5",
  "electric.method": "\u05E9\u05D9\u05D8\u05EA \u05D4\u05D7\u05D6\u05E8 \u05D4\u05D7\u05E9\u05DE\u05DC",
  "familyTrack.minChildren": "\u05DE\u05E1\u05DC\u05D5\u05DC \u05DE\u05E9\u05E4\u05D7\u05EA\u05D9: \u05DE\u05D9\u05E0\u05D9\u05DE\u05D5\u05DD \u05D9\u05DC\u05D3\u05D9\u05DD",
  "familyTrack.childMaxAge": "\u05DE\u05E1\u05DC\u05D5\u05DC \u05DE\u05E9\u05E4\u05D7\u05EA\u05D9: \u05D2\u05D9\u05DC \u05D9\u05DC\u05D3 \u05DE\u05E8\u05D1\u05D9",
  "familyTrack.carPrice": "\u05DE\u05E1\u05DC\u05D5\u05DC \u05DE\u05E9\u05E4\u05D7\u05EA\u05D9: \u05DE\u05D7\u05D9\u05E8 \u05E8\u05DB\u05D1",
  "familyTrack.gapSplitEmployee": "\u05DE\u05E1\u05DC\u05D5\u05DC \u05DE\u05E9\u05E4\u05D7\u05EA\u05D9: \u05D7\u05DC\u05E7 \u05D4\u05E2\u05D5\u05D1\u05D3 \u05D1\u05E4\u05E2\u05E8",
  "netMethod.taxYear": "\u05E9\u05E0\u05EA \u05DE\u05E1",
  "netMethod.creditPointValue": "\u05E2\u05E8\u05DA \u05E0\u05E7\u05D5\u05D3\u05EA \u05D6\u05D9\u05DB\u05D5\u05D9",
  "netMethod.brackets": "\u05DE\u05D3\u05E8\u05D2\u05D5\u05EA \u05DE\u05E1",
  "netMethod.nationalInsurance": "\u05D1\u05D9\u05D8\u05D5\u05D7 \u05DC\u05D0\u05D5\u05DE\u05D9",
  "netMethod.health": "\u05DE\u05E1 \u05D1\u05E8\u05D9\u05D0\u05D5\u05EA",
  "netMethod.pensionCredit": "\u05D6\u05D9\u05DB\u05D5\u05D9 \u05E4\u05E0\u05E1\u05D9\u05D4"
};
var show = (v) => v === void 0 || v === null ? "\u2014" : typeof v === "boolean" ? v ? "\u05DB\u05DF" : "\u05DC\u05D0" : typeof v === "object" ? JSON.stringify(v) : String(v);
function diffTable(kind, before, after) {
  const key = ROW_KEY[kind];
  const name = ROW_NAME[kind];
  const old = new Map(before.map((r) => [key(r), r]));
  const next = new Set(after.map(key));
  const diff = { added: [], removed: [], changed: [], unchanged: 0 };
  for (const row of after) {
    const prev = old.get(key(row));
    if (!prev) {
      diff.added.push(name(row));
      continue;
    }
    const changes = [];
    for (const field of /* @__PURE__ */ new Set([...Object.keys(prev), ...Object.keys(row)])) {
      if (field === "driveCode" || field === "currentCarName") continue;
      if (JSON.stringify(prev[field]) !== JSON.stringify(row[field])) {
        changes.push({ field: FIELD_LABELS[field] ?? field, before: show(prev[field]), after: show(row[field]) });
      }
    }
    if (changes.length) diff.changed.push({ row: name(row), changes });
    else diff.unchanged++;
  }
  for (const row of before) if (!next.has(key(row))) diff.removed.push(name(row));
  return diff;
}
function flatten(v, prefix = "", out = {}) {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, child] of Object.entries(v)) if (k !== "note") flatten(child, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out[prefix] = v;
  }
  return out;
}
function ruleLabel(path4) {
  if (RULE_LABELS[path4]) return RULE_LABELS[path4];
  const parent = Object.keys(RULE_LABELS).filter((p) => path4.startsWith(`${p}.`)).sort((a, b) => b.length - a.length)[0];
  return parent ? `${RULE_LABELS[parent]} ${path4.slice(parent.length + 1)}` : path4;
}
function activeTable(kind) {
  const active2 = { catalog: getCatalog(), occupations: getOccupations(), employees: getEmployees() };
  return active2[kind];
}
var SYNC_MS = 3e4;
function createAdminService(repo, now = Date.now) {
  let syncedAt = 0;
  let syncing = null;
  async function loadFromStorage() {
    const [rules, ...tables] = await Promise.all([repo.getRules(), ...REFERENCE_KINDS.map((k) => repo.getReferenceData(k))]);
    if (rules) setRules(rules);
    else resetRules();
    REFERENCE_KINDS.forEach((kind, i) => {
      const rows = tables[i];
      if (rows) setReferenceData(kind, rows);
      else resetReferenceData(kind);
    });
    syncedAt = now();
  }
  function parse(file) {
    return parseDataWorkbook(file, { catalog: getCatalog(), occupations: getOccupations() });
  }
  function previewOf(parsed) {
    const tables = [];
    for (const kind of REFERENCE_KINDS) {
      const sheet = parsed[kind];
      if (!sheet) continue;
      const before = activeTable(kind);
      tables.push({
        kind,
        sheet: sheet.sheet,
        count: sheet.rows.length,
        previousCount: before.length,
        errors: sheet.errors,
        warnings: [...sheet.warnings],
        diff: diffTable(kind, before, sheet.rows)
      });
    }
    const newCatalog = parsed.catalog?.rows;
    const catalogTable = tables.find((t) => t.kind === "catalog");
    if (newCatalog && catalogTable && !parsed.employees) {
      const missing = getEmployees().filter((e) => e.currentCarId && !newCatalog.some((c) => c.id === e.currentCarId));
      if (missing.length) {
        catalogTable.warnings.push(`\u05DC\u05E2\u05D5\u05D1\u05D3\u05D9 \u05D4\u05D3\u05D5\u05D2\u05DE\u05D4 ${missing.map((e) => e.name).join(", ")} \u05D9\u05E9 \u05E8\u05DB\u05D1 \u05E9\u05D0\u05D9\u05E0\u05D5 \u05D1\u05E7\u05D8\u05DC\u05D5\u05D2 \u05D4\u05D7\u05D3\u05E9`);
      }
    }
    return { tables, canApply: tables.length > 0 && tables.every((t) => t.errors.length === 0) };
  }
  return {
    async init() {
      await loadFromStorage();
    },
    /**
     * Reloads the saved data when it is older than SYNC_MS, so an upload on one instance reaches the
     * others. A storage error keeps the data already in memory.
     */
    async syncIfStale() {
      if (now() - syncedAt < SYNC_MS) return;
      syncing ??= loadFromStorage().catch((err) => console.error(`[admin] reloading settings failed: ${err?.name ?? "Error"}`)).finally(() => {
        syncing = null;
      });
      await syncing;
    },
    async overview() {
      const [rules, ...tables] = await Promise.all([repo.getRules(), ...REFERENCE_KINDS.map((k) => repo.getReferenceData(k))]);
      const source = (v) => v ? "uploaded" : "default";
      return {
        rules: getRules(),
        catalog: getCatalog(),
        occupations: getOccupations(),
        employees: getEmployees(),
        taxRecordCount: await repo.countTaxRecords(),
        storage: repo.kind,
        sources: {
          rules: source(rules),
          catalog: source(tables[0]),
          occupations: source(tables[1]),
          employees: source(tables[2])
        }
      };
    },
    /** Checks an uploaded rules file and lists what would change; saves nothing */
    previewRules(rules) {
      const current = getRules();
      try {
        assertRulesShape(rules);
      } catch (err) {
        return { version: "", previousVersion: current.version, changes: [], errors: [err.message] };
      }
      const before = flatten(current);
      const after = flatten(rules);
      const changes = [];
      for (const path4 of new Set([...Object.keys(before), ...Object.keys(after)].filter((p) => p !== "version"))) {
        if (JSON.stringify(before[path4]) !== JSON.stringify(after[path4])) {
          changes.push({ field: ruleLabel(path4), before: show(before[path4]), after: show(after[path4]) });
        }
      }
      return { version: String(rules.version ?? ""), previousVersion: current.version, changes, errors: [] };
    },
    async saveRules(rules) {
      assertRulesShape(rules);
      setRules(rules);
      await repo.saveRules(getRules());
      return getRules();
    },
    async resetRules() {
      resetRules();
      await repo.saveRules(null);
      return getRules();
    },
    /** Checks the sheets of an uploaded data workbook and lists what would change; saves nothing */
    previewDataFile(file) {
      return previewOf(parse(file));
    },
    /** Replaces every table found in the workbook, all or nothing (the same file the preview showed) */
    async applyDataFile(file) {
      const parsed = parse(file);
      const preview = previewOf(parsed);
      if (!preview.canApply) {
        throw new InvalidDataError(
          preview.tables.length ? "\u05D1\u05E7\u05D5\u05D1\u05E5 \u05D9\u05E9 \u05E9\u05D2\u05D9\u05D0\u05D5\u05EA: \u05EA\u05E7\u05E0\u05D5 \u05D0\u05D5\u05EA\u05DF \u05D5\u05E0\u05E1\u05D5 \u05E9\u05D5\u05D1" : "\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0 \u05D1\u05E7\u05D5\u05D1\u05E5 \u05D0\u05E3 \u05D2\u05D9\u05DC\u05D9\u05D5\u05DF \u05DE\u05D5\u05DB\u05E8 (\u05E7\u05D8\u05DC\u05D5\u05D2 \u05E8\u05DB\u05D1\u05D9\u05DD, \u05E2\u05D9\u05E1\u05D5\u05E7\u05D9\u05DD, \u05E2\u05D5\u05D1\u05D3\u05D9\u05DD \u05DC\u05D3\u05D5\u05D2\u05DE\u05D4)"
        );
      }
      for (const kind of REFERENCE_KINDS) {
        const sheet = parsed[kind];
        if (!sheet) continue;
        await repo.saveReferenceData(kind, sheet.rows);
        setReferenceData(kind, sheet.rows);
      }
      return preview;
    },
    async resetDataTable(kind) {
      await repo.saveReferenceData(kind, null);
      resetReferenceData(kind);
    },
    async importTaxCsv(buffer) {
      const records = parseTaxAuthorityCsv(buffer);
      await repo.saveTaxRecords(records);
      return records.length;
    },
    clearTaxRecords: () => repo.clearTaxRecords(),
    /** Uploaded Tax Authority file first, then the seed and the catalog */
    async lookup(regYear, vehicleType, productCode, modelCode) {
      const key = makeLookupKey(regYear, vehicleType, productCode, modelCode);
      return await repo.getTaxRecord(key) ?? lookupBenefitValue(regYear, productCode, modelCode, vehicleType);
    }
  };
}

// server/bl/services/authService.ts
import { createHash } from "node:crypto";
var AuthError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
var VERIFY_CACHE_MS = 6e4;
var VERIFY_CACHE_MAX = 5e3;
var tokenKey = (token) => createHash("sha256").update(token).digest("base64url");
function createAuthService(gateway, repo, now = Date.now) {
  const cache = /* @__PURE__ */ new Map();
  function remember(token, user) {
    if (cache.size >= VERIFY_CACHE_MAX) {
      const t = now();
      for (const [k, v] of cache) if (v.until <= t) cache.delete(k);
      for (const k of cache.keys()) {
        if (cache.size < VERIFY_CACHE_MAX) break;
        cache.delete(k);
      }
    }
    cache.set(tokenKey(token), { user, until: now() + VERIFY_CACHE_MS });
  }
  async function withRole(tokens) {
    const role = await repo.getUserRole(tokens.user.id);
    if (!role) return null;
    const user = { id: tokens.user.id, email: tokens.user.email, role };
    remember(tokens.accessToken, user);
    return { tokens, user };
  }
  return {
    async login(email, password) {
      const attempt = await gateway.signInWithPassword(email, password);
      if (!attempt.ok) {
        if (attempt.reason === "rate_limited") throw new AuthError(429, "\u05D9\u05D5\u05EA\u05E8 \u05DE\u05D3\u05D9 \u05E0\u05D9\u05E1\u05D9\u05D5\u05E0\u05D5\u05EA \u05DB\u05E0\u05D9\u05E1\u05D4. \u05E0\u05E1\u05D5 \u05E9\u05D5\u05D1 \u05D1\u05E2\u05D5\u05D3 \u05DB\u05DE\u05D4 \u05D3\u05E7\u05D5\u05EA.");
        throw new AuthError(401, "\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05D0\u05D5 \u05E1\u05D9\u05E1\u05DE\u05D4 \u05E9\u05D2\u05D5\u05D9\u05D9\u05DD");
      }
      const result = await withRole(attempt.tokens);
      if (!result) {
        await gateway.signOut(attempt.tokens.accessToken);
        throw new AuthError(403, "\u05DC\u05DE\u05E9\u05EA\u05DE\u05E9 \u05D6\u05D4 \u05D0\u05D9\u05DF \u05D4\u05E8\u05E9\u05D0\u05D4 \u05DC\u05DE\u05E2\u05E8\u05DB\u05EA. \u05E4\u05E0\u05D5 \u05DC\u05DE\u05E0\u05D4\u05DC \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA.");
      }
      return result;
    },
    async verify(accessToken) {
      const hit = cache.get(tokenKey(accessToken));
      if (hit && hit.until > now()) return hit.user;
      const u = await gateway.getUser(accessToken);
      if (!u) return null;
      const role = await repo.getUserRole(u.id);
      if (!role) return null;
      const user = { id: u.id, email: u.email, role };
      remember(accessToken, user);
      return user;
    },
    async refresh(refreshToken) {
      const attempt = await gateway.refresh(refreshToken);
      return attempt.ok ? withRole(attempt.tokens) : null;
    },
    async logout(accessToken) {
      cache.delete(tokenKey(accessToken));
      await gateway.signOut(accessToken);
    },
    async createUser(email, password, role) {
      const created = await gateway.createUser(email, password);
      if (!created.ok) {
        if (created.reason === "exists") throw new AuthError(409, "\u05DB\u05D1\u05E8 \u05E7\u05D9\u05D9\u05DD \u05DE\u05E9\u05EA\u05DE\u05E9 \u05E2\u05DD \u05D4\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05D4\u05D6\u05D4");
        if (created.reason === "weak_password") throw new AuthError(400, "\u05D4\u05E1\u05D9\u05E1\u05DE\u05D4 \u05D7\u05DC\u05E9\u05D4 \u05DE\u05D3\u05D9. \u05D1\u05D7\u05E8\u05D5 \u05E1\u05D9\u05E1\u05DE\u05D4 \u05D0\u05E8\u05D5\u05DB\u05D4 \u05D5\u05DE\u05D2\u05D5\u05D5\u05E0\u05EA \u05D9\u05D5\u05EA\u05E8.");
        throw new AuthError(400, "\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D9\u05E6\u05D5\u05E8 \u05DE\u05E9\u05EA\u05DE\u05E9 \u05E2\u05DD \u05D4\u05E4\u05E8\u05D8\u05D9\u05DD \u05D4\u05D0\u05DC\u05D4");
      }
      try {
        await repo.setUserRole(created.user.id, role);
      } catch (err) {
        await gateway.deleteUser(created.user.id).catch(() => void 0);
        throw err;
      }
      return { id: created.user.id, email: created.user.email, role };
    }
  };
}

// server/bl/services/ticketService.ts
function createTicketService(repo, now = Date.now) {
  return {
    list() {
      return repo.listTickets();
    },
    /** Open-ticket count for the header badge (no ticket content) */
    async openCount() {
      return (await repo.listTickets()).filter((t) => t.status === "open").length;
    },
    /** The employee chat picks the answer up on its next sync (sessionService.sync) */
    async answer(id, input) {
      const ticket = await repo.getTicket(id);
      if (!ticket) throw new NotFoundError("ticket not found");
      const updated = {
        ...ticket,
        status: input.status,
        answeredAt: now(),
        answer: {
          text: input.text?.trim() || "\u05E4\u05E0\u05D9\u05D9\u05EA\u05DA \u05E0\u05D1\u05D3\u05E7\u05D4 \u05D5\u05D0\u05D5\u05E9\u05E8\u05D4 \u05D1\u05DE\u05E2\u05E8\u05DB\u05EA.",
          value: input.value,
          effectiveFrom: input.effectiveFrom?.trim() || void 0
        }
      };
      await repo.saveTicket(updated);
      return updated;
    }
  };
}

// server/dal/fileRepository.ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

// server/dal/types.ts
var toLookupResult = (r) => ({
  value: r.benefitValue,
  sourceRow: r.sourceRow,
  commercialName: r.commercialName,
  driveCode: r.driveCode,
  listPrice: r.listPrice
});

// server/dal/fileRepository.ts
var emptyData = () => ({ sessions: {}, tickets: [], rules: null });
var FileRepository = class {
  constructor(dir) {
    this.dir = dir;
    this.kind = "file";
    this.data = null;
    this.tax = null;
    // Writes run one after another so two saves never interleave
    this.writeQueue = Promise.resolve();
  }
  get appFile() {
    return path.join(this.dir, "app-data.json");
  }
  get taxFile() {
    return path.join(this.dir, "tax-records.json");
  }
  async readJson(file, fallback) {
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch (err) {
      if (err?.code === "ENOENT") return fallback;
      throw err;
    }
  }
  write(file, value) {
    const run = async () => {
      await mkdir(this.dir, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(value), "utf8");
      await rename(tmp, file);
    };
    this.writeQueue = this.writeQueue.then(run, run);
    return this.writeQueue;
  }
  async app() {
    if (!this.data) this.data = { ...emptyData(), ...await this.readJson(this.appFile, {}) };
    return this.data;
  }
  async taxMap() {
    if (!this.tax) this.tax = new Map((await this.readJson(this.taxFile, [])).map((r) => [r.key, r]));
    return this.tax;
  }
  async flush() {
    await this.write(this.appFile, await this.app());
  }
  async getSession(id) {
    const s = (await this.app()).sessions[id];
    return s ? structuredClone(s) : null;
  }
  async findLatestSessionId(userId) {
    let latest = null;
    for (const s of Object.values((await this.app()).sessions)) {
      if (s.userId === userId && (!latest || s.updatedAt > latest.updatedAt)) latest = s;
    }
    return latest?.id ?? null;
  }
  async saveSessionState(session) {
    const data = await this.app();
    data.sessions[session.id] = { ...structuredClone(session), messages: data.sessions[session.id]?.messages ?? [] };
    await this.flush();
  }
  async appendMessages(sessionId2, messages) {
    const s = (await this.app()).sessions[sessionId2];
    if (!s) throw new Error(`session ${sessionId2} not found`);
    s.messages.push(...structuredClone(messages));
    await this.flush();
  }
  async replaceMessages(sessionId2, messages) {
    const s = (await this.app()).sessions[sessionId2];
    if (!s) throw new Error(`session ${sessionId2} not found`);
    s.messages = structuredClone(messages);
    await this.flush();
  }
  async listTickets() {
    return structuredClone((await this.app()).tickets).sort((a, b) => b.createdAt - a.createdAt);
  }
  async listTicketsForSession(sessionId2) {
    return (await this.listTickets()).filter((t) => t.sessionId === sessionId2);
  }
  async getTicket(id) {
    const t = (await this.app()).tickets.find((x) => x.id === id);
    return t ? structuredClone(t) : null;
  }
  async saveTicket(ticket) {
    const data = await this.app();
    const idx = data.tickets.findIndex((t) => t.id === ticket.id);
    if (idx >= 0) data.tickets[idx] = structuredClone(ticket);
    else data.tickets.unshift(structuredClone(ticket));
    await this.flush();
  }
  async getRules() {
    const r = (await this.app()).rules;
    return r ? structuredClone(r) : null;
  }
  async saveRules(rules) {
    (await this.app()).rules = rules ? structuredClone(rules) : null;
    await this.flush();
  }
  async getReferenceData(kind) {
    const rows = (await this.app()).reference?.[kind];
    return rows ? structuredClone(rows) : null;
  }
  async saveReferenceData(kind, rows) {
    const data = await this.app();
    data.reference ??= {};
    if (rows) data.reference[kind] = structuredClone(rows);
    else delete data.reference[kind];
    await this.flush();
  }
  async saveTaxRecords(records) {
    const map = await this.taxMap();
    for (const r of records) map.set(r.key, r);
    await this.write(this.taxFile, [...map.values()]);
  }
  async getTaxRecord(key) {
    const r = (await this.taxMap()).get(key);
    return r ? toLookupResult(r) : null;
  }
  async countTaxRecords() {
    return (await this.taxMap()).size;
  }
  // Users live in Supabase Auth only: the file store has none (login needs Supabase)
  async getUserRole(_userId) {
    return null;
  }
  async setUserRole(_userId, _role) {
    throw new Error("Users need Supabase: the file store has no users");
  }
  async clearTaxRecords() {
    (await this.taxMap()).clear();
    await this.write(this.taxFile, []);
  }
};

// server/dal/supabaseAuth.ts
var SupabaseAuthGateway = class {
  constructor(url, apiKey) {
    this.url = url;
    this.apiKey = apiKey;
  }
  fetch(pathAndQuery, init = {}) {
    return fetch(`${this.url}/auth/v1/${pathAndQuery}`, {
      ...init,
      headers: { apikey: this.apiKey, "Content-Type": "application/json", ...init.headers }
    });
  }
  async token(grantType, body) {
    const res = await this.fetch(`token?grant_type=${grantType}`, { method: "POST", body: JSON.stringify(body) });
    if (res.status === 400 || res.status === 401) return { ok: false, reason: "invalid" };
    if (res.status === 429) return { ok: false, reason: "rate_limited" };
    if (!res.ok) throw new Error(`Supabase Auth ${grantType} failed (${res.status})`);
    const s = await res.json();
    return {
      ok: true,
      tokens: {
        accessToken: s.access_token,
        refreshToken: s.refresh_token,
        expiresIn: s.expires_in,
        user: { id: s.user.id, email: s.user.email ?? "" }
      }
    };
  }
  signInWithPassword(email, password) {
    return this.token("password", { email, password });
  }
  refresh(refreshToken) {
    return this.token("refresh_token", { refresh_token: refreshToken });
  }
  async getUser(accessToken) {
    const res = await this.fetch("user", { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) throw new Error(`Supabase Auth user failed (${res.status})`);
    const u = await res.json();
    return { id: u.id, email: u.email ?? "" };
  }
  async signOut(accessToken) {
    await this.fetch("logout?scope=local", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => void 0);
  }
  // The admin endpoints accept only the service role key as the bearer token
  admin(pathAndQuery, init) {
    return this.fetch(`admin/${pathAndQuery}`, { ...init, headers: { Authorization: `Bearer ${this.apiKey}` } });
  }
  async createUser(email, password) {
    const res = await this.admin("users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) });
    if (res.ok) {
      const u = await res.json();
      return { ok: true, user: { id: u.id, email: u.email ?? email } };
    }
    if (res.status === 400 || res.status === 409 || res.status === 422) {
      const body = await res.json().catch(() => ({}));
      const code = body.error_code ?? body.code ?? "";
      if (code === "email_exists" || code === "user_already_exists" || /already been registered/i.test(body.msg ?? "")) {
        return { ok: false, reason: "exists" };
      }
      if (code === "weak_password") return { ok: false, reason: "weak_password" };
      return { ok: false, reason: "invalid" };
    }
    throw new Error(`Supabase Auth create user failed (${res.status})`);
  }
  async deleteUser(userId) {
    const res = await this.admin(`users/${encodeURIComponent(userId)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(`Supabase Auth delete user failed (${res.status})`);
  }
};

// server/dal/supabaseRepository.ts
var TAX_BATCH = 1e3;
var iso = (ms2) => new Date(ms2).toISOString();
var ms = (s) => s ? new Date(s).getTime() : 0;
var SupabaseRepository = class {
  constructor(url, serviceKey) {
    this.url = url;
    this.serviceKey = serviceKey;
    this.kind = "supabase";
  }
  async request(pathAndQuery, init = {}) {
    const res = await fetch(`${this.url}/rest/v1/${pathAndQuery}`, {
      ...init,
      headers: {
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
        "Content-Type": "application/json",
        ...init.prefer ? { Prefer: init.prefer } : {},
        ...init.headers
      }
    });
    if (!res.ok) {
      throw new Error(`Supabase ${init.method ?? "GET"} ${pathAndQuery.split("?")[0]} failed (${res.status})`);
    }
    return res;
  }
  async rows(pathAndQuery) {
    return (await this.request(pathAndQuery)).json();
  }
  upsert(table, body) {
    return this.request(table, {
      method: "POST",
      body: JSON.stringify(body),
      prefer: "resolution=merge-duplicates,return=minimal"
    });
  }
  async getSession(id) {
    const enc = encodeURIComponent(id);
    const [session] = await this.rows(`sessions?id=eq.${enc}&select=*`);
    if (!session) return null;
    const messages = await this.rows(`messages?session_id=eq.${enc}&order=created_at.asc,id.asc&select=*`);
    return {
      id: session.id,
      ...session.user_id ? { userId: session.user_id } : {},
      profile: session.profile ?? {},
      lastComparison: session.last_comparison ?? null,
      pendingFields: session.pending_fields ?? void 0,
      createdAt: ms(session.created_at),
      updatedAt: ms(session.updated_at),
      messages: messages.map(
        (m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          ...m.metadata?.comparison ? { comparison: m.metadata.comparison } : {},
          timestamp: ms(m.created_at)
        })
      )
    };
  }
  async findLatestSessionId(userId) {
    const [row] = await this.rows(`sessions?user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc&limit=1&select=id`);
    return row?.id ?? null;
  }
  async saveSessionState(s) {
    await this.upsert("sessions", {
      id: s.id,
      user_id: s.userId ?? null,
      profile: s.profile,
      last_comparison: s.lastComparison,
      pending_fields: s.pendingFields ?? null,
      created_at: iso(s.createdAt),
      updated_at: iso(s.updatedAt)
    });
  }
  messageRow(sessionId2, m) {
    return {
      id: m.id,
      session_id: sessionId2,
      role: m.role,
      content: m.content,
      metadata: m.comparison ? { comparison: m.comparison } : {},
      created_at: iso(m.timestamp)
    };
  }
  async appendMessages(sessionId2, messages) {
    if (messages.length === 0) return;
    await this.upsert("messages", messages.map((m) => this.messageRow(sessionId2, m)));
  }
  async replaceMessages(sessionId2, messages) {
    await this.request(`messages?session_id=eq.${encodeURIComponent(sessionId2)}`, { method: "DELETE" });
    await this.appendMessages(sessionId2, messages);
  }
  toTicket(row) {
    return {
      id: row.id,
      sessionId: row.session_id,
      question: row.question,
      summary: row.summary,
      status: row.status,
      profile: row.profile ?? {},
      lastComparison: row.last_comparison ?? void 0,
      transcript: row.transcript ?? [],
      answer: row.answer ?? void 0,
      createdAt: ms(row.created_at),
      answeredAt: row.answered_at ? ms(row.answered_at) : void 0
    };
  }
  async listTickets() {
    return (await this.rows("tickets?order=created_at.desc&select=*")).map((r) => this.toTicket(r));
  }
  async listTicketsForSession(sessionId2) {
    return (await this.rows(`tickets?session_id=eq.${encodeURIComponent(sessionId2)}&order=created_at.desc&select=*`)).map((r) => this.toTicket(r));
  }
  async getTicket(id) {
    const [row] = await this.rows(`tickets?id=eq.${encodeURIComponent(id)}&select=*`);
    return row ? this.toTicket(row) : null;
  }
  async saveTicket(t) {
    await this.upsert("tickets", {
      id: t.id,
      session_id: t.sessionId,
      question: t.question,
      summary: t.summary,
      status: t.status,
      profile: t.profile,
      last_comparison: t.lastComparison ?? null,
      transcript: t.transcript,
      answer: t.answer ?? null,
      created_at: iso(t.createdAt),
      answered_at: t.answeredAt ? iso(t.answeredAt) : null
    });
  }
  async getRules() {
    const [row] = await this.rows("app_settings?key=eq.rules&select=value");
    return row?.value ?? null;
  }
  async saveRules(rules) {
    if (rules === null) {
      await this.request("app_settings?key=eq.rules", { method: "DELETE" });
      return;
    }
    await this.upsert("app_settings", { key: "rules", value: rules, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
  }
  async getReferenceData(kind) {
    const [row] = await this.rows(`app_settings?key=eq.data:${kind}&select=value`);
    return Array.isArray(row?.value) ? row.value : null;
  }
  async saveReferenceData(kind, rows) {
    if (rows === null) {
      await this.request(`app_settings?key=eq.data:${kind}`, { method: "DELETE" });
      return;
    }
    await this.upsert("app_settings", { key: `data:${kind}`, value: rows, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
  }
  async saveTaxRecords(records) {
    for (let i = 0; i < records.length; i += TAX_BATCH) {
      await this.upsert(
        "tax_records",
        records.slice(i, i + TAX_BATCH).map((r) => ({
          key: r.key,
          reg_year: r.regYear,
          vehicle_type: r.vehicleType,
          product_code: r.productCode,
          model_code: r.modelCode,
          commercial_name: r.commercialName,
          benefit_value: r.benefitValue,
          drive_code: r.driveCode,
          list_price: r.listPrice,
          source_row: r.sourceRow
        }))
      );
    }
  }
  async getTaxRecord(key) {
    const [r] = await this.rows(`tax_records?key=eq.${encodeURIComponent(key)}&select=*`);
    if (!r) return null;
    return toLookupResult({
      key: r.key,
      regYear: r.reg_year,
      vehicleType: r.vehicle_type,
      productCode: r.product_code,
      modelCode: r.model_code,
      commercialName: r.commercial_name ?? "",
      benefitValue: Number(r.benefit_value),
      driveCode: Number(r.drive_code),
      listPrice: Number(r.list_price),
      sourceRow: Number(r.source_row)
    });
  }
  async countTaxRecords() {
    const res = await this.request("tax_records?select=key", {
      method: "HEAD",
      prefer: "count=exact",
      headers: { Range: "0-0" }
    });
    const total = res.headers.get("content-range")?.split("/")[1];
    return total ? Number(total) || 0 : 0;
  }
  async clearTaxRecords() {
    await this.request("tax_records?key=not.is.null", { method: "DELETE" });
  }
  async getUserRole(userId) {
    const [row] = await this.rows(`app_users?user_id=eq.${encodeURIComponent(userId)}&select=role`);
    return row?.role ?? null;
  }
  async setUserRole(userId, role) {
    await this.upsert("app_users", { user_id: userId, role });
  }
};

// server/dal/index.ts
function createAuthGateway(env) {
  if (!env.supabaseUrl || !env.supabaseServiceKey) return null;
  return new SupabaseAuthGateway(env.supabaseUrl.replace(/\/+$/, ""), env.supabaseServiceKey);
}
function createRepository(env) {
  if (env.supabaseUrl && env.supabaseServiceKey) {
    return new SupabaseRepository(env.supabaseUrl.replace(/\/+$/, ""), env.supabaseServiceKey);
  }
  return new FileRepository(env.dataDir);
}

// server/bootstrap.ts
async function buildApiApp(config) {
  const repo = createRepository({
    supabaseUrl: config.supabaseUrl,
    supabaseServiceKey: config.supabaseServiceKey,
    dataDir: config.dataDir
  });
  const authGateway = createAuthGateway(config);
  const gemini = createGemini(config.gemini);
  configureLlm({ transport: gemini.generate, fallback: config.fallback });
  const admin = createAdminService(repo);
  await admin.init();
  const sessions = createSessionService(repo);
  const tickets = createTicketService(repo);
  const auth = authGateway ? createAuthService(authGateway, repo) : null;
  const app = createApp({
    config,
    sessions,
    tickets,
    admin,
    auth,
    extractPayslip: gemini.extractPayslip,
    healthDetails: () => ({ ...gemini.status(), storage: repo.kind })
  });
  return { app, storage: repo.kind };
}

// server/config.ts
import path2 from "node:path";
var ConfigError = class extends Error {
};
var list = (v) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
function parseTrustProxy(v) {
  if (v === void 0 || v === "") return false;
  if (v === "true") return true;
  if (v === "false") return false;
  return /^\d+$/.test(v) ? Number(v) : v;
}
function loadConfig(env = process.env) {
  const isProduction = env.NODE_ENV === "production";
  const warnings = [];
  const errors = [];
  const config = {
    isProduction,
    port: Number(env.PORT) || 3e3,
    host: env.HOST || (isProduction ? "0.0.0.0" : "127.0.0.1"),
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    allowedOrigins: list(env.ALLOWED_ORIGINS),
    gemini: {
      apiKey: env.GEMINI_API_KEY || "",
      models: list(env.GEMINI_MODEL).length ? list(env.GEMINI_MODEL) : ["gemini-3.5-flash-lite"],
      modelTimeoutMs: Number(env.GEMINI_MODEL_TIMEOUT_MS) || 1e4
    },
    fallback: env.FALLBACK_BASE_URL && env.FALLBACK_API_KEY ? {
      baseUrl: env.FALLBACK_BASE_URL.replace(/\/+$/, ""),
      apiKey: env.FALLBACK_API_KEY,
      model: env.FALLBACK_MODEL || "meta-llama/llama-3.3-70b-instruct"
    } : null,
    supabaseUrl: env.SUPABASE_URL || void 0,
    supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY || void 0,
    dataDir: path2.resolve(env.DATA_DIR || ".data"),
    staticDir: path2.resolve(env.STATIC_DIR || "dist")
  };
  if (!config.gemini.apiKey) (isProduction ? errors : warnings).push("GEMINI_API_KEY is not set: the agent cannot answer");
  if (Boolean(config.supabaseUrl) !== Boolean(config.supabaseServiceKey)) {
    errors.push("Set both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or neither");
  }
  if (!config.supabaseUrl) {
    if (isProduction) errors.push("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production (login protects employee salary data)");
    else warnings.push(`No Supabase: no login, every screen is open, and data is kept in local files under ${config.dataDir} (development only)`);
  }
  for (const legacy of ["REP_ACCESS_TOKEN", "ADMIN_ACCESS_TOKEN"]) {
    if (env[legacy]) warnings.push(`${legacy} is no longer used: users log in with Supabase Auth; delete it`);
  }
  for (const legacy of ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_FALLBACK_KEY", "VITE_FALLBACK_BASE_URL", "VITE_FALLBACK_MODEL"]) {
    if (env[legacy]) warnings.push(`${legacy} is no longer used: move it to the server variable (see .env.example) and delete it`);
  }
  if (errors.length) throw new ConfigError(`Invalid server configuration:
- ${errors.join("\n- ")}`);
  return { config, warnings };
}

// server/index.ts
dotenv.config({ quiet: true });
async function main() {
  let loaded;
  try {
    loaded = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
  const { config, warnings } = loaded;
  for (const w of warnings) console.warn(`[config] ${w}`);
  const { app, storage } = await buildApiApp(config);
  if (!config.isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express4.static(config.staticDir, { index: false, maxAge: "1h" }));
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path3.join(config.staticDir, "index.html"));
    });
  }
  const server = app.listen(config.port, config.host, () => {
    console.log(`Server listening on http://${config.host}:${config.port} (storage: ${storage})`);
  });
  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1e4).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
main().catch((err) => {
  console.error(`Server failed to start: ${err?.message ?? err}`);
  process.exit(1);
});
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
