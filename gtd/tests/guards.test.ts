// A static safety net: every page, layout, Server Action file and route handler under app/ must
// either be on the public list below or call one of the session guards. Adding a new GTD entry
// point without a guard fails this test, so it can't silently open GTD to finance-only accounts.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..", "app");
const entry = /(^|\/)(page\.tsx|layout\.tsx|route\.ts|actions\.ts|queries\.ts)$/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// Entry points that do not need a session guard, and why.
const publicFiles = new Set([
  "layout.tsx", // root layout: markup only
  "login/page.tsx", // the sign-in page
  "error.tsx",
  "offline/page.tsx", // static offline notice
  "manifest.ts",
  "sw.js/route.ts", // service worker script: no user data
  "api/auth/google/route.ts", // starts Google sign-in
  "api/auth/callback/route.ts", // finishes Google sign-in
  "api/mcp/route.ts", // bearer / OAuth access token, checked in the route
  "oauth/register/route.ts", // OAuth protocol endpoints
  "oauth/token/route.ts",
  ".well-known/oauth-authorization-server/route.ts",
  ".well-known/oauth-protected-resource/[[...path]]/route.ts",
]);

const guard = /requireSession|requireFinanceSession|getGtdSessionEmail|getSessionEmail|handler\(/;

// A page is also covered when a layout above it (inside app/) is guarded.
function guarded(file: string): boolean {
  if (guard.test(readFileSync(file, "utf8"))) return true;
  if (!/page\.tsx$/.test(file)) return false;
  for (let dir = dirname(file); dir.startsWith(root) && dir !== dirname(root); dir = dirname(dir)) {
    const layout = join(dir, "layout.tsx");
    if (dir !== root && statSync(layout, { throwIfNoEntry: false })?.isFile() && guard.test(readFileSync(layout, "utf8"))) return true;
  }
  return false;
}

test("every app entry point is guarded or explicitly public", () => {
  const unguarded: string[] = [];
  for (const file of walk(root)) {
    const rel = relative(root, file).split("\\").join("/");
    if (!entry.test(rel) || publicFiles.has(rel)) continue;
    if (!guarded(file)) unguarded.push(rel);
  }
  assert.deepEqual(unguarded, []);
});

test("finance files use the finance guard, everything else uses the GTD guard", () => {
  for (const file of walk(root)) {
    const rel = relative(root, file).split("\\").join("/");
    if (!entry.test(rel)) continue;
    const src = readFileSync(file, "utf8");
    if (rel.startsWith("(finance)/")) {
      assert.ok(!/[^e]requireSession\(/.test(src), `${rel} must not use the GTD guard`);
    } else if (/requireFinanceSession/.test(src)) {
      assert.fail(`${rel} is outside (finance)/ but uses the finance guard`);
    }
  }
});

test("the GTD layout and the REST helpers guard with the GTD checks", () => {
  const gtdLayout = readFileSync(join(root, "(app)", "layout.tsx"), "utf8");
  assert.match(gtdLayout, /requireSession\(\)/);
  const api = readFileSync(join(root, "..", "lib", "api.ts"), "utf8");
  assert.match(api, /getGtdSessionEmail/);
  assert.doesNotMatch(api, /getSessionEmail\(/);
});
