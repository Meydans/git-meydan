import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { canUseGtd, isFinanceOnly } from "../lib/auth/access.ts";

const original = process.env.FINANCE_ONLY_EMAILS;
afterEach(() => {
  if (original === undefined) delete process.env.FINANCE_ONLY_EMAILS;
  else process.env.FINANCE_ONLY_EMAILS = original;
});

test("nobody is restricted when FINANCE_ONLY_EMAILS is unset or empty", () => {
  delete process.env.FINANCE_ONLY_EMAILS;
  assert.equal(isFinanceOnly("a@example.com"), false);
  process.env.FINANCE_ONLY_EMAILS = " , ";
  assert.equal(isFinanceOnly("a@example.com"), false);
});

test("a listed email is finance-only, case and spaces ignored", () => {
  process.env.FINANCE_ONLY_EMAILS = "x@example.com, Efrat@Example.com ";
  assert.equal(isFinanceOnly("efrat@example.COM"), true);
  assert.equal(isFinanceOnly(" x@example.com"), true);
  assert.equal(isFinanceOnly("other@example.com"), false);
});

test("GTD is closed to finance-only and to signed-out", () => {
  process.env.FINANCE_ONLY_EMAILS = "efrat@example.com";
  assert.equal(canUseGtd("efrat@example.com"), false);
  assert.equal(canUseGtd("me@example.com"), true);
  assert.equal(canUseGtd(null), false);
  assert.equal(canUseGtd(undefined), false);
});
