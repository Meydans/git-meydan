import { sql } from "drizzle-orm";
import { boolean, check, date, doublePrecision, index, integer, pgEnum, pgTable, text, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";

export const taskStatus = pgEnum("task_status", ["inbox", "next", "waiting", "someday", "done"]);
export const taskContext = pgEnum("task_context", ["@phone", "@computer", "@errand", "@home"]);
export const projectStatus = pgEnum("project_status", ["active", "someday", "done", "dropped"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // GTD: a project is defined by its desired outcome, not just a name.
  outcome: text("outcome"),
  status: projectStatus("status").notNull().default("active"),
  // Sequential projects surface only their first open task as actionable.
  sequential: boolean("sequential").notNull().default(false),
  // Review governance (lib/review.ts): an active project is due for review when it was never
  // reviewed or its last review is older than its cadence.
  reviewCadenceDays: integer("review_cadence_days").notNull().default(7),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  // Whether the project was stalled when last reviewed: a review acknowledges a stall until
  // the next review is due, while a stall that starts after the review surfaces right away.
  stallAcknowledged: boolean("stall_acknowledged").notNull().default(false),
  ...timestamps,
}, (p) => [check("projects_review_cadence_range", sql`${p.reviewCadenceDays} between 1 and 365`)]);

// Manual order within a project or under a parent. clock_timestamp() gives every new row
// (even in one multi-row insert) a larger value, so new tasks land at the end; reordering
// swaps values between neighbours.
const nextPosition = sql`extract(epoch from clock_timestamp())`;

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    // One level of subtasks. Depth, project inheritance and completing children are enforced by
    // triggers (see migration 0003), so every writer gets the same rules.
    parentId: uuid("parent_id").references((): AnyPgColumn => tasks.id, { onDelete: "cascade" }),
    position: doublePrecision("position").notNull().default(nextPosition),
    // For a parent task: its subtasks are done in order.
    sequential: boolean("sequential").notNull().default(false),
    status: taskStatus("status").notNull().default("inbox"),
    context: taskContext("context"),
    // Defer date: the task stays out of the working lists until this day. Null = available now.
    startDate: date("start_date", { mode: "string" }),
    dueDate: date("due_date", { mode: "string" }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    check("tasks_start_before_due", sql`${t.startDate} is null or ${t.dueDate} is null or ${t.startDate} <= ${t.dueDate}`),
    check("tasks_not_own_parent", sql`${t.parentId} is null or ${t.parentId} <> ${t.id}`),
    index("tasks_parent_idx").on(t.parentId),
    index("tasks_project_position_idx").on(t.projectId, t.position),
  ],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

// ---------- OAuth (MCP authorization server) ----------

// Clients registered through Dynamic Client Registration. Clients that use a
// Client ID Metadata Document (an https client_id) are resolved on the fly instead.
export const oauthClients = pgTable("oauth_clients", {
  id: text("id").primaryKey(),
  name: text("name"),
  redirectUris: text("redirect_uris").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Short-lived, single-use authorization codes. Only a hash of the code is stored.
export const oauthCodes = pgTable("oauth_codes", {
  codeHash: text("code_hash").primaryKey(),
  clientId: text("client_id").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  resource: text("resource").notNull(),
  scope: text("scope").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const oauthTokenKind = pgEnum("oauth_token_kind", ["access", "refresh"]);

// Access and refresh tokens, stored as hashes. secretVersion ties a token to the
// current APP_PASSWORD, so changing the password revokes every token at once.
export const oauthTokens = pgTable("oauth_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  kind: oauthTokenKind("kind").notNull(),
  clientId: text("client_id").notNull(),
  resource: text("resource").notNull(),
  scope: text("scope").notNull(),
  secretVersion: text("secret_version").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
