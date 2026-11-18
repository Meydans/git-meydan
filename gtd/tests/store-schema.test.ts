import assert from "node:assert/strict";
import { test } from "node:test";
import { itemPatch } from "../lib/finance/fields.ts";

// fields.ts is "server-only"; the pure schema lives in fields.ts.
test("a patch keeps only the keys it names", () => {
  assert.deepEqual(itemPatch.parse({ value: " 5 " }), { value: "5" });
  assert.deepEqual(itemPatch.parse({}), {});
});

test("settings file round-trips, and older files take defaults", async () => {
  const { parseSettingsFile, settingsFile } = await import("../lib/finance/fields.ts");
  const { defaultAssumptions } = await import("../lib/finance/simulator.ts");
  const a = { ...defaultAssumptions, birthYear: 1980, events: [{ desc: "שיפוץ", age: 55, amount: -250_000 }] };
  const back = parseSettingsFile(JSON.stringify(settingsFile(a, { incomeChange: -5_000, expenseAdjust: 0 })));
  assert.ok(back.ok);
  if (back.ok) {
    assert.deepEqual(back.assumptions, a);
    assert.equal(back.scenario.incomeChange, -5_000);
  }
  const old = parseSettingsFile(JSON.stringify({ app: "gtd-enough", version: 1, assumptions: { roi: 5 } }));
  assert.ok(old.ok && old.assumptions.roi === 5 && old.assumptions.incomeChanges.length === 0);
  assert.equal(parseSettingsFile("{").ok, false);
  assert.equal(parseSettingsFile(JSON.stringify({ app: "other" })).ok, false);
  assert.equal(parseSettingsFile(JSON.stringify({ app: "gtd-enough", assumptions: { roi: 99 } })).ok, false);
});
