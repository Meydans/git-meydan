import assert from "node:assert/strict";
import { test } from "node:test";
import { itemPatch } from "../lib/finance/fields.ts";

// fields.ts is "server-only"; the pure schema lives in fields.ts.
test("a patch keeps only the keys it names", () => {
  assert.deepEqual(itemPatch.parse({ value: " 5 " }), { value: "5" });
  assert.deepEqual(itemPatch.parse({}), {});
});
