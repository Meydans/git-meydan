import assert from "node:assert/strict";
import { test } from "node:test";
import { inventoryBase } from "../lib/finance/inventory.ts";
import { defaultAssumptions, futureValue, goalSeek, requiredRoi, requiredSurplus, simulate } from "../lib/finance/simulator.ts";

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
  const r = simulate({ liquid: 7_000_000, income: 30_000, expense: 20_000 }, { ...A, inflation: 0 });
  assert.equal(r.fiAge, 41); // 6,000,000 needed from the start, but y must be > 0
  const none = simulate({ liquid: 0, income: 10_000, expense: 20_000 }, A);
  assert.equal(none.fiAge, null);
  assert.equal(none.survives, false);
});

test("children: each child halves at 18 and is gone at 21", () => {
  const r = simulate({ ...base, expense: 10_000 }, { ...A, inflation: 0, kidsMonthly: 4_000, childrenAges: [17, 20] });
  // year 0: ages 17 (full) and 20 (half) -> 1 - 0.5*0.5 ; year 1: 18 (half) and 21 (gone)
  assert.equal(r.timeline[0].monthlyExpense, 10_000 - 4_000 * 0.25);
  assert.equal(r.timeline[1].monthlyExpense, 10_000 - 4_000 * 0.75);
});

test("capital events land in their year", () => {
  const r = simulate(base, { ...A, events: [{ desc: "x", age: 45, amount: -100_000 }] });
  const w = simulate(base, A);
  assert.ok(Math.abs(w.timeline[5].balance - r.timeline[5].balance - 100_000) < 1e-6);
  assert.equal(r.timeline[5].events.length, 1);
});

test("goal seek inverts the compound formulas", () => {
  const fv = futureValue(100_000, 2_000, 6, 15);
  assert.ok(Math.abs(requiredSurplus(100_000, fv, 6, 15) - 2_000) < 1e-6);
  assert.ok(Math.abs(requiredRoi(100_000, fv, 2_000, 15) - 6) < 1e-4);
  assert.equal(goalSeek(base, A, { incomeLoss: 0, expenseAdjust: 0 }, 40).years, 0);
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
