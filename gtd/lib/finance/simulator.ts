// "כמה זה מספיק": a year-by-year projection of liquid capital up to age 90, with the "rule of 300"
// (financial independence = 300 × monthly spending, i.e. a 4% withdrawal rate). Pure functions, no
// I/O, so they can be tested and used from the browser. All personal numbers come in as inputs.

export type CapitalEvent = { desc: string; age: number; amount: number };

// A monthly income that starts (or stops, if negative) at fromAge and lasts until toAge, or until
// retirement when toAge is null. In today's money: it grows with inflation and real wage growth
// like the salary. It does not change the pension, which is a share of today's income.
export type IncomeChange = { desc: string; monthly: number; fromAge: number; toAge: number | null };

// What the person keeps between visits (saved in the finance database).
export type Assumptions = {
  currentAge: number;
  // When set, currentAge follows it (this year minus birthYear), so the plan ages by itself.
  birthYear: number | null;
  retirementAge: number;
  pensionAge: number;
  // Share of today's income that the pension replaces from pensionAge.
  pensionRatio: number; // 0..100
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

export function simulate(base: Base, a: Assumptions, s: Scenario = { incomeChange: 0, expenseAdjust: 0 }): Result {
  const income = base.income + s.incomeChange;
  const expense = Math.max(0, base.expense + s.expenseAdjust);
  const kids = Math.min(Math.max(0, a.kidsMonthly), expense);
  const rest = expense - kids;
  const pension = income * (a.pensionRatio / 100);

  let balance = base.liquid;
  let lowest = balance;
  let lowestAge = a.currentAge;
  let fiAge: number | null = null;
  let fiYears: number | null = null;
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
    if (age >= a.pensionAge) yearlyIncome += pension * 12;

    const adults = a.childrenAges.filter((c) => c + y >= 21 && c + y < a.adultSupportUntil).length;
    const monthlyExpense =
      (rest + kids * kidsFactor(a.childrenAges, y) + a.adultSupport * adults) * Math.pow(1 + (a.inflation + a.lifestyleCreep) / 100, y);
    const fiTarget = monthlyExpense * a.rule;
    if (fiAge === null && y > 0 && balance >= fiTarget) {
      fiAge = age;
      fiYears = y;
    }

    const roi = a.glidePath ? (y < 10 ? 8 : 4) : a.roi;
    balance = balance * (1 + roi / 100) + yearlyIncome - monthlyExpense * 12;
    const events = a.events.filter((e) => e.age === age);
    // Event amounts are in today's money, like income and spending.
    for (const e of events) balance += e.amount * Math.pow(1 + a.inflation / 100, y);
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
    atRetirement: ret ? ret.balance : null,
    fiTargetAtRetirement: ret ? ret.fiTarget : null,
    survives: timeline.length > 0 && timeline[timeline.length - 1].balance > 0,
    monthlyIncome: income,
    monthlyExpense: expense,
    surplus: income - expense,
  };
}

// "How do I retire at goalAge?": the saving or the return that gets the capital to the target.
export function goalSeek(base: Base, a: Assumptions, s: Scenario, goalAge: number) {
  const years = Math.max(0, goalAge - a.currentAge);
  const income = base.income + s.incomeChange;
  const expense = Math.max(0, base.expense + s.expenseAdjust);
  const target = expense * Math.pow(1 + a.inflation / 100, years) * a.rule;
  return {
    years,
    target,
    surplus: requiredSurplus(base.liquid, target, a.roi, years),
    roi: requiredRoi(base.liquid, target, income - expense, years),
  };
}

// currentAge from birthYear, as of `now`.
export function withAge(a: Assumptions, now = new Date()): Assumptions {
  if (a.birthYear == null) return a;
  return { ...a, currentAge: Math.min(90, Math.max(18, now.getFullYear() - a.birthYear)) };
}
