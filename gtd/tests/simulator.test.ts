import assert from "node:assert/strict";
import { test } from "node:test";
import { inventoryBase } from "../lib/finance/inventory.ts";
import { defaultAssumptions, earliestRetirement, futureValue, withAge, goalSeek, requiredRoi, requiredSurplus, simulate } from "../lib/finance/simulator.ts";

const A = { ...defaultAssumptions, currentAge: 40, retirementAge: 60, pensionAge: 67, pensionRatio: 50, roi: 6, inflation: 2 };
const base = { liquid: 500_000, income: 30_000, expense: 20_000 };

test("one year by hand: growth first, then the year's saving", () => {
  const r = simulate(base, { ...A, inflation: 0 });
  // age 40: 500000*1.06 + (30000-20000)*12
  assert.equal(Math.round(r.timeline[0].balance), 650_000);
});

test("income stops at retirement and the pension starts at pensionAge", () => {
  const r = simulate(base, { ...A, inflation: 0 });
  assert.equal(r.timeline.find((t) => t.age === 61)!.monthlyIncome, 0);
  assert.equal(r.timeline.find((t) => t.age === 67)!.monthlyIncome, 15_000);
  assert.equal(simulate(base, { ...A, workAfterRetirement: true }).timeline.find((t) => t.age === 61)!.monthlyIncome > 0, true);
});

test("FI is the first year after the start with balance >= rule x monthly spend", () => {
  const r = simulate({ liquid: 7_000_000, income: 30_000, expense: 20_000 }, { ...A, inflation: 0, pensionRatio: 0 });
  assert.equal(r.fiAge, 41); // 6,000,000 needed from the start, but y must be > 0
  const none = simulate({ liquid: 0, income: 10_000, expense: 20_000 }, A);
  assert.equal(none.fiAge, null);
  assert.equal(none.survives, false);
});

test("children: today's budget scales with the age mix (1 / 1.8 / 0.6 / 0)", () => {
  // Ages 8 and 5 today: weight 2. In two years the older is 10: weight 2.8 -> budget x1.4.
  const r = simulate({ ...base, expense: 10_000 }, { ...A, inflation: 0, kidsMonthly: 4_000, childrenAges: [8, 5] });
  assert.equal(r.timeline[0].monthlyExpense, 10_000);
  assert.ok(Math.abs(r.timeline[2].monthlyExpense - (6_000 + 4_000 * 1.4)) < 1e-9);
  // Age 17 today (1.8): at 18 it is 0.6 -> a third; at 21 gone.
  const t = simulate({ ...base, expense: 10_000 }, { ...A, inflation: 0, kidsMonthly: 1_800, childrenAges: [17] });
  assert.ok(Math.abs(t.timeline[1].monthlyExpense - (8_200 + 600)) < 1e-9);
  assert.equal(t.timeline[4].monthlyExpense, 8_200);
});

test("adult support counts per child from 21 until the chosen age", () => {
  const r = simulate({ ...base, expense: 10_000 }, { ...A, inflation: 0, childrenAges: [20], kidsMonthly: 0, adultSupport: 2_000, adultSupportUntil: 23 });
  assert.equal(r.timeline[0].monthlyExpense, 10_000); // 20
  assert.equal(r.timeline[1].monthlyExpense, 12_000); // 21
  assert.equal(r.timeline[2].monthlyExpense, 12_000); // 22
  assert.equal(r.timeline[3].monthlyExpense, 10_000); // 23
});

test("capital events are in today's money and grow with inflation to their year", () => {
  const r = simulate(base, { ...A, events: [{ desc: "x", age: 45, amount: -100_000 }] });
  const w = simulate(base, A);
  assert.ok(Math.abs(w.timeline[5].balance - r.timeline[5].balance - 100_000 * 1.02 ** 5) < 1e-6);
  assert.equal(r.timeline[5].events.length, 1);
});

test("compound helpers invert each other", () => {
  const fv = futureValue(100_000, 2_000, 6, 15);
  assert.ok(Math.abs(requiredSurplus(100_000, fv, 6, 15) - 2_000) < 1e-6);
  assert.ok(Math.abs(requiredRoi(100_000, fv, 2_000, 15) - 6) < 1e-4);
});

test("the pension is linked to inflation", () => {
  const r = simulate(base, A); // 2% inflation, retire 60, pension 50% from 67
  assert.ok(Math.abs(r.timeline.find((t) => t.age === 67)!.monthlyIncome - 15_000 * 1.02 ** 27) < 1e-6);
});

test("the FI target leaves out what the pension covers, plus a bridge until it starts", () => {
  const flat = { ...A, inflation: 0 };
  const r = simulate(base, flat); // expense 20k, pension 15k from 67
  assert.equal(r.timeline.find((t) => t.age === 70)!.fiTarget, 5_000 * 300);
  assert.equal(r.timeline.find((t) => t.age === 60)!.fiTarget, 5_000 * 300 + 15_000 * 12 * 7);
  const noPension = simulate(base, { ...flat, pensionRatio: 0 });
  assert.equal(noPension.timeline[0].fiTarget, 20_000 * 300);
});

test("a shortfall does not earn a return, and the depletion age is reported", () => {
  const r = simulate({ liquid: 0, income: 0, expense: 1_000 }, { ...A, inflation: 0, pensionRatio: 0 });
  assert.equal(r.timeline[0].balance, -12_000);
  assert.equal(r.timeline[1].balance, -24_000);
  assert.equal(r.depletionAge, 40);
  assert.equal(r.survives, false);
});

test("earliest retirement and goal seek use the full model", () => {
  const s0 = { incomeChange: 0, expenseAdjust: 0 };
  const e = earliestRetirement(base, A, s0);
  assert.ok(e !== null);
  assert.equal(simulate(base, { ...A, retirementAge: e! }, s0).survives, true);
  assert.equal(simulate(base, { ...A, retirementAge: e! - 1 }, s0).survives, false);
  assert.equal(goalSeek(base, A, s0, e!).alreadyOk, true);
  const g = goalSeek(base, A, s0, e! - 3);
  assert.equal(g.alreadyOk, false);
  assert.ok(g.extraSaving! > 0);
  const extra = { desc: "", monthly: g.extraSaving! + 1, fromAge: A.currentAge, toAge: e! - 3 };
  assert.equal(simulate(base, { ...A, retirementAge: e! - 3, incomeChanges: [extra] }, s0).survives, true);
  assert.ok(g.roi! > A.roi);
  assert.equal(goalSeek(base, A, s0, 40).years, 0);
});

test("inventory base: liquid, emergency, USD and unlocked funds", () => {
  const row = (o: Record<string, string>) => ({ name: "", type: "עו״ש", liq: "", liqDate: "", purpose: "", value: "", cur: "ILS", ...o });
  const b = inventoryBase(
    [
      row({ liq: "מיידי", value: "100,000", purpose: "חירום" }),
      row({ liq: "נזיל בעלות", value: "1000", cur: "USD" }),
      row({ liq: "נעול עד תאריך", liqDate: "2020-01-01", value: "50000" }),
      row({ liq: "נעול עד תאריך", liqDate: "2999-01-01", value: "70000" }),
      row({ liq: "פרישה", value: "900000" }),
      row({ name: "שער דולר", type: "פרמטר", value: "4" }),
      row({ name: "הוצאה חודשית", type: "פרמטר", value: "20000" }),
    ],
    new Date(2026, 0, 1),
  );
  assert.equal(b.liquid, 100_000 + 4_000 + 50_000);
  assert.equal(b.emergency, 100_000);
  assert.equal(b.expense, 20_000);
  assert.equal(b.income, null);
});

test("an income change counts from its start age until retirement (or its end age)", () => {
  const flat = { ...A, inflation: 0 };
  const r = simulate(base, { ...flat, incomeChanges: [{ desc: "x", monthly: 10_000, fromAge: 45, toAge: null }] });
  const at = (age: number) => r.timeline.find((t) => t.age === age)!.monthlyIncome;
  assert.equal(at(44), 30_000);
  assert.equal(at(45), 40_000);
  assert.equal(at(59), 40_000);
  assert.equal(at(60), 0); // retired at 60, pension from 67
  const ended = simulate(base, { ...flat, incomeChanges: [{ desc: "x", monthly: 10_000, fromAge: 45, toAge: 50 }] });
  assert.equal(ended.timeline.find((t) => t.age === 50)!.monthlyIncome, 30_000);
});

test("the income-change scenario can raise or cut today's income", () => {
  assert.equal(simulate(base, A, { incomeChange: 5_000, expenseAdjust: 0 }).monthlyIncome, 35_000);
  assert.equal(simulate(base, A, { incomeChange: -5_000, expenseAdjust: 0 }).monthlyIncome, 25_000);
});

test("birth year sets the current age and moves with the calendar", () => {
  const a = { ...defaultAssumptions, birthYear: 1984 };
  assert.equal(withAge(a, new Date(2026, 10, 18)).currentAge, 42);
  assert.equal(withAge(a, new Date(2027, 0, 1)).currentAge, 43);
  assert.equal(withAge({ ...defaultAssumptions, currentAge: 50 }).currentAge, 50);
});

test("the analysis report states inputs, rules and the yearly projection", async () => {
  const { analysisReport } = await import("../lib/finance/report.ts");
  const a = { ...A, childrenAges: [8], kidsMonthly: 3_000, events: [{ desc: "שיפוץ", age: 55, amount: -200_000 }] };
  const md = analysisReport({ base, liquidTotal: 600_000, emergency: 100_000, incomeMissing: false, expenseMissing: true, assumptions: a, scenario: { incomeChange: 0, expenseAdjust: 0 }, goalAge: 55, now: new Date(2026, 10, 18) });
  assert.ok(md.startsWith("# כמה זה מספיק: תמונת מצב לניתוח (2026-11-18)"));
  for (const s of ["## נקודת פתיחה", "## הנחות", "## כללי המודל", "## תוצאות", "## תחזית שנתית", "## מגבלות ידועות", "Karlinsky", "⚠ ההוצאה החודשית לא הוגדרה", "שיפוץ"]) assert.ok(md.includes(s), s);
  // one row per year, 40..90
  const rows = md.split("\n").filter((l) => /^\| \d{2} \| 20\d\d \|/.test(l));
  assert.equal(rows.length, 51);
  assert.ok(rows[0].startsWith("| 40 | 2026 |"));
});
