import { doublePrecision, integer, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

// The finance module lives in its own Postgres schema, and is reached through its own connection
// string (DATABASE_URL_FINANCE), so it can be moved to a separate database without code changes.
// It is migrated by hand (npm run db:finance:migrate), never by a build, so a preview deploy
// can't touch it.
export const finance = pgSchema("finance");

// One row of the inventory (an asset, a loan, a parameter such as the dollar rate, or a scenario).
// Every field is text, exactly as in the CSV: the page parses numbers and dates itself.
export const financeItems = finance.table("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  position: integer("position").notNull(),
  name: text("name").notNull().default(""),
  type: text("type").notNull().default(""),
  owner: text("owner").notNull().default(""),
  inst: text("inst").notNull().default(""),
  liq: text("liq").notNull().default(""),
  liqDate: text("liq_date").notNull().default(""),
  purpose: text("purpose").notNull().default(""),
  value: text("value").notNull().default(""),
  cur: text("cur").notNull().default(""),
  monthly: text("monthly").notNull().default(""),
  updated: text("updated").notNull().default(""),
  how: text("how").notNull().default(""),
  check: text("check").notNull().default(""),
  notes: text("notes").notNull().default(""),
  link: text("link").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// A dated copy of the whole inventory with the headline numbers, for the history of net worth.
export const financeSnapshots = finance.table("snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
  takenBy: text("taken_by").notNull().default(""),
  net: doublePrecision("net").notNull(),
  total: doublePrecision("total").notNull(),
  debt: doublePrecision("debt").notNull(),
  liquid: doublePrecision("liquid").notNull(),
  rows: jsonb("rows").notNull(),
});

// The plan behind the "how much is enough" simulator (ages, return, children, capital events).
// One shared row: the household has one plan. Personal numbers live here, never in the code.
export const financeSim = finance.table("sim_settings", {
  id: text("id").primaryKey().default("main"),
  data: jsonb("data").notNull(),
  updatedBy: text("updated_by").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
