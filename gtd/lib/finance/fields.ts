import { z } from "zod";
import { defaultAssumptions, type Assumptions, type Scenario } from "./simulator.ts";

// The columns of the inventory CSV, in order. The page and the table share these keys.
export const itemKeys = ["name", "type", "owner", "inst", "liq", "liqDate", "purpose", "value", "cur", "monthly", "updated", "how", "check", "notes", "link"] as const;
export type ItemKey = (typeof itemKeys)[number];

const field = z.string().trim().max(2000);
export const itemFields = z.object(Object.fromEntries(itemKeys.map((k) => [k, field.default("")])) as Record<ItemKey, z.ZodDefault<z.ZodString>>);
// A patch must carry only the keys it names. Building it from itemFields.partial() would not do:
// zod 4 still applies each field's default, so every edit would blank all the other columns.
export const itemPatch = z.object(Object.fromEntries(itemKeys.map((k) => [k, field.optional()])) as Record<ItemKey, z.ZodOptional<z.ZodString>>);
export const importRows = z.array(itemFields).max(1000);

// The simulator's saved plan. Shared by the server action and the file import in the browser.
const n = (min: number, max: number) => z.number().finite().min(min).max(max);
export const assumptionsSchema = z.object({
  currentAge: n(18, 90),
  birthYear: n(1930, 2010).nullable(),
  retirementAge: n(30, 90),
  pensionAge: n(50, 90),
  pensions: z.array(z.object({ who: z.string().trim().max(100), monthly: n(0, 1_000_000) })).max(10).nullable(),
  pensionRatio: n(0, 100),
  roi: n(0, 20),
  inflation: n(0, 10),
  lifestyleCreep: n(0, 10),
  incomeGrowth: n(0, 10),
  glidePath: z.boolean(),
  workAfterRetirement: z.boolean(),
  rule: n(100, 600),
  childrenAges: z.array(n(0, 60)).max(10),
  kidsMonthly: n(0, 1_000_000),
  adultSupport: n(0, 1_000_000),
  adultSupportUntil: n(21, 40),
  deductEmergency: z.boolean(),
  events: z.array(z.object({ desc: z.string().trim().max(200), age: n(18, 90), amount: n(-1e9, 1e9) })).max(50),
  incomeChanges: z
    .array(z.object({ desc: z.string().trim().max(200), monthly: n(-1e7, 1e7), fromAge: n(18, 90), toAge: n(18, 91).nullable() }))
    .max(20),
});

// The settings file: the plan plus the what-if sliders, so a file brings back the whole picture.
export const SETTINGS_APP = "gtd-enough";
export type SettingsFile = { app: typeof SETTINGS_APP; version: 1; exportedAt: string; assumptions: Assumptions; scenario: Scenario };

const scenarioSchema = z.object({ incomeChange: n(-1e6, 1e6), expenseAdjust: n(-1e6, 1e6) });

export function settingsFile(assumptions: Assumptions, scenario: Scenario, now = new Date()): SettingsFile {
  return { app: SETTINGS_APP, version: 1, exportedAt: now.toISOString(), assumptions, scenario };
}

// Reads a settings file. Fields missing from an older file take their defaults.
export function parseSettingsFile(text: string): { ok: true; assumptions: Assumptions; scenario: Scenario } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "הקובץ אינו JSON תקין." };
  }
  const o = raw as Partial<SettingsFile> | null;
  if (!o || typeof o !== "object" || o.app !== SETTINGS_APP) return { ok: false, error: "זה לא קובץ הגדרות של הסימולטור." };
  const a = assumptionsSchema.safeParse({ ...defaultAssumptions, ...(o.assumptions ?? {}) });
  if (!a.success) return { ok: false, error: "בקובץ יש ערכים לא תקינים: " + a.error.issues.slice(0, 3).map((i) => i.path.join(".")).join(", ") };
  const s = scenarioSchema.safeParse({ incomeChange: 0, expenseAdjust: 0, ...(o.scenario ?? {}) });
  return { ok: true, assumptions: a.data, scenario: s.success ? s.data : { incomeChange: 0, expenseAdjust: 0 } };
}
