// "כמה זה מספיק": a year-by-year projection of liquid capital up to age 90, with the "rule of 300"
// (financial independence = 300 × monthly spending, i.e. a 4% withdrawal rate). Pure functions, no
// I/O, so they can be tested and used from the browser. All personal numbers come in as inputs.

export type CapitalEvent = { desc: string; age: number; amount: number };

// A monthly income that starts (or stops, if negative) at fromAge and lasts until toAge, or until
// retirement when toAge is null. In today's money: it grows with inflation and real wage growth
// like the salary. It does not change the pension, which is a share of today's income.
// The pension is linked to inflation (as Israeli pension annuities are to the CPI).
export type IncomeChange = { desc: string; monthly: number; fromAge: number; toAge: number | null };

// The expected monthly pension of one person, in today's money, as the fund's annual statement
// gives it ("קצבה חודשית צפויה"): it already counts the deposits until retirement.
export type Pension = { who: string; monthly: number };

// What the person keeps between visits (saved in the finance database).
export type Assumptions = {
  currentAge: number;
  // When set, currentAge follows it (this year minus birthYear), so the plan ages by itself.
  birthYear: number | null;
  retirementAge: number;
  pensionAge: number;
  // The expected monthly pensions, from pensionAge, in today's money and linked to inflation.
  // null = not entered yet: then the pension is pensionRatio % of today's income (older plans).
  pensions: Pension[] | null;
  pensionRatio: number; // 0..100, only used while pensions is null
  roi: number; // % a year, net
  inflation: number; // % a year
  lifestyleCreep: number; // % a year above inflation
  incomeGrowth: number; // % a year above inflation
  glidePath: boolean; // 8% for the first ten years, then 4%
  workAfterRetirement: boolean;
  rule: number; // multiplier of the monthly spending that is "enough"
  childrenAges: number[];
  kidsMonthly: number; // part of today's monthly spending that goes to the children
  adultSupport: number; // monthly support per child from 21, in today's money
  adultSupportUntil: number; // the child's age when that support ends
  deductEmergency: boolean; // keep the emergency fund out of the invested capital
  events: CapitalEvent[];
  incomeChanges: IncomeChange[];
};

export const defaultAssumptions: Assumptions = {
  currentAge: 40,
  birthYear: null,
  retirementAge: 67,
  pensionAge: 67,
  pensions: null,
  pensionRatio: 50,
  roi: 7,
  inflation: 2,
  lifestyleCreep: 0,
  incomeGrowth: 0,
  glidePath: false,
  workAfterRetirement: false,
  rule: 300,
  childrenAges: [],
  kidsMonthly: 0,
  adultSupport: 0,
  adultSupportUntil: 25,
  deductEmergency: false,
  events: [],
  incomeChanges: [],
};

// What-if levers, never saved: they change the picture, not the plan.
export type Scenario = { incomeChange: number; expenseAdjust: number };

export type Base = { liquid: number; income: number; expense: number };

export type Year = {
  age: number;
  balance: number;
  monthlyExpense: number;
  monthlyIncome: number;
  fiTarget: number;
  events: CapitalEvent[];
};

export type Result = {
  timeline: Year[];
  fiAge: number | null;
  fiYears: number | null;
  lowest: number;
  lowestAge: number;
  // First age at which the capital ends the year below zero, or null if it never does.
  depletionAge: number | null;
  atRetirement: number | null;
  fiTargetAtRetirement: number | null;
  survives: boolean;
  monthlyIncome: number;
  monthlyExpense: number;
  surplus: number;
};

export const END_AGE = 90;

export function futureValue(principal: number, monthly: number, annualRate: number, years: number): number {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal + monthly * n;
  const g = Math.pow(1 + r, n);
  return principal * g + monthly * ((g - 1) / r);
}

// The monthly saving needed to turn `principal` into `target` in `years`.
export function requiredSurplus(principal: number, target: number, annualRate: number, years: number): number {
  if (years <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return (target - principal) / n;
  const g = Math.pow(1 + r, n);
  return (target - principal * g) / ((g - 1) / r);
}

// The yearly return needed to reach `target` with a fixed monthly saving (bisection, 0..50%).
export function requiredRoi(principal: number, target: number, monthly: number, years: number): number {
  if (years <= 0) return 0;
  let lo = 0;
  let hi = 50;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (futureValue(principal, monthly, mid, years) < target) lo = mid;
    else hi = mid;
  }
  return lo;
}

// How a child's cost changes with age, relative to a child under 10. From Karlinsky & Sarel,
// "Estimating the Cost of Raising Children in Israel" (Bank of Israel, Israel Economic Review
// 18(1), 2020): a child of 10+ costs about 1.8 times a younger one at every income level. During
// army service (18-20) parents' help drops to roughly a third of the teenage level (Knesset
// Research Center soldiers' survey 2018; courts often cut child support to a third). From 21 the
// recurring cost is replaced by the optional adultSupport.
export function childWeight(age: number): number {
  if (age < 10) return 1;
  if (age < 18) return 1.8;
  if (age < 21) return 0.6;
  return 0;
}

// Today's children's budget, scaled by how the children's age mix changes. With no ages given the
// budget stays as it is.
export function kidsFactor(ages: number[], y: number): number {
  if (!ages.length) return 1;
  const now = ages.reduce((s, a) => s + childWeight(a), 0);
  if (now === 0) return 0;
  return ages.reduce((s, a) => s + childWeight(a + y), 0) / now;
}

// Today's monthly pension: the entered amounts, or the old share of income until they are entered.
export function monthlyPension(a: Assumptions, income: number): number {
  if (a.pensions) return a.pensions.reduce((t, p) => t + Math.max(0, p.monthly), 0);
  return income * (a.pensionRatio / 100);
}

// Rough monthly pension that a balance alone buys at retirement, in today's money: the balance
// divided by a conversion factor (Israeli pension funds use about 200 at 67). It leaves out future
// deposits and returns, so the annual statement's figure is normally higher.
export const PENSION_FACTOR = 200;

export function simulate(base: Base, a: Assumptions, s: Scenario = { incomeChange: 0, expenseAdjust: 0 }): Result {
  const income = base.income + s.incomeChange;
  const expense = Math.max(0, base.expense + s.expenseAdjust);
  const kids = Math.min(Math.max(0, a.kidsMonthly), expense);
  const rest = expense - kids;
  const pension = monthlyPension(a, income);

  let balance = base.liquid;
  let lowest = balance;
  let lowestAge = a.currentAge;
  let fiAge: number | null = null;
  let fiYears: number | null = null;
  let depletionAge: number | null = null;
  const timeline: Year[] = [];

  for (let age = a.currentAge; age <= END_AGE; age++) {
    const y = age - a.currentAge;
    let yearlyIncome = 0;
    if (age < a.retirementAge || a.workAfterRetirement) {
      yearlyIncome = income * Math.pow(1 + (a.inflation + a.incomeGrowth) / 100, y) * 12;
    }
    for (const c of a.incomeChanges) {
      const end = c.toAge ?? (a.workAfterRetirement ? END_AGE + 1 : a.retirementAge);
      if (age >= c.fromAge && age < end) yearlyIncome += c.monthly * Math.pow(1 + (a.inflation + a.incomeGrowth) / 100, y) * 12;
    }
    const pensionNow = pension * Math.pow(1 + a.inflation / 100, y); // monthly, this year's money
    if (age >= a.pensionAge) yearlyIncome += pensionNow * 12;

    const adults = a.childrenAges.filter((c) => c + y >= 21 && c + y < a.adultSupportUntil).length;
    const monthlyExpense =
      (rest + kids * kidsFactor(a.childrenAges, y) + a.adultSupport * adults) * Math.pow(1 + (a.inflation + a.lifestyleCreep) / 100, y);
    // Enough capital = rule x the part of spending the pension does not cover, plus, before the
    // pension starts, the pension-sized part of spending for the years until it does (the bridge).
    const covered = Math.min(pensionNow, monthlyExpense);
    const fiTarget = (monthlyExpense - covered) * a.rule + (age < a.pensionAge ? covered * 12 * (a.pensionAge - age) : 0);
    if (fiAge === null && y > 0 && balance >= fiTarget) {
      fiAge = age;
      fiYears = y;
    }

    const roi = a.glidePath ? (y < 10 ? 8 : 4) : a.roi;
    // Only money that exists earns a return: a shortfall stays a shortfall, it does not compound.
    balance = (balance > 0 ? balance * (1 + roi / 100) : balance) + yearlyIncome - monthlyExpense * 12;
    const events = a.events.filter((e) => e.age === age);
    // Event amounts are in today's money, like income and spending.
    for (const e of events) balance += e.amount * Math.pow(1 + a.inflation / 100, y);
    if (depletionAge === null && balance < 0) depletionAge = age;
    if (balance < lowest) {
      lowest = balance;
      lowestAge = age;
    }
    timeline.push({ age, balance, monthlyExpense, monthlyIncome: yearlyIncome / 12, fiTarget, events });
  }

  const ret = timeline.find((t) => t.age === a.retirementAge);
  return {
    timeline,
    fiAge,
    fiYears,
    lowest,
    lowestAge,
    depletionAge,
    atRetirement: ret ? ret.balance : null,
    fiTargetAtRetirement: ret ? ret.fiTarget : null,
    survives: depletionAge === null,
    monthlyIncome: income,
    monthlyExpense: expense,
    surplus: income - expense,
  };
}

// The earliest retirement age at which the capital never runs out before END_AGE (full model).
export function earliestRetirement(base: Base, a: Assumptions, s: Scenario): number | null {
  for (let r = a.currentAge; r <= END_AGE; r++) {
    if (simulate(base, { ...a, retirementAge: r }, s).survives) return r;
  }
  return null;
}

const MAX_EXTRA = 200_000;
const MAX_ROI = 30;

// "What would it take to retire at goalAge?", on the full model: retire at goalAge and the capital
// must last to END_AGE. Either an extra monthly saving from now until goalAge (today's money,
// growing like the salary), or a higher yearly return. null = not reachable within the bounds.
export function goalSeek(base: Base, a: Assumptions, s: Scenario, goalAge: number) {
  const years = Math.max(0, goalAge - a.currentAge);
  const at = { ...a, retirementAge: goalAge };
  const income = base.income + s.incomeChange;
  if (years <= 0) return { years, alreadyOk: false, extraSaving: null as number | null, roi: null as number | null, income };
  if (simulate(base, at, s).survives) return { years, alreadyOk: true, extraSaving: 0, roi: a.glidePath ? null : a.roi, income };

  const withExtra = (x: number) => ({ ...at, incomeChanges: [...at.incomeChanges, { desc: "", monthly: x, fromAge: a.currentAge, toAge: goalAge }] });
  let extraSaving: number | null = null;
  if (simulate(base, withExtra(MAX_EXTRA), s).survives) {
    let lo = 0;
    let hi = MAX_EXTRA;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (simulate(base, withExtra(mid), s).survives) hi = mid;
      else lo = mid;
    }
    extraSaving = hi;
  }

  const withRoi = (r: number) => ({ ...at, glidePath: false, roi: r });
  let roi: number | null = null;
  if (simulate(base, withRoi(MAX_ROI), s).survives) {
    let lo = 0;
    let hi = MAX_ROI;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (simulate(base, withRoi(mid), s).survives) hi = mid;
      else lo = mid;
    }
    roi = hi;
  }
  return { years, alreadyOk: false, extraSaving, roi, income };
}

// currentAge from birthYear, as of `now`.
export function withAge(a: Assumptions, now = new Date()): Assumptions {
  if (a.birthYear == null) return a;
  return { ...a, currentAge: Math.min(90, Math.max(18, now.getFullYear() - a.birthYear)) };
}
