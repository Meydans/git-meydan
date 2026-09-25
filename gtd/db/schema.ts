import { date, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const taskStatus = pgEnum("task_status", ["inbox", "next", "waiting", "someday", "done"]);
export const taskContext = pgEnum("task_context", ["@phone", "@computer", "@errand", "@home"]);
export const projectStatus = pgEnum("project_status", ["active", "someday", "done"]);

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
  ...timestamps,
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  status: taskStatus("status").notNull().default("inbox"),
  context: taskContext("context"),
  dueDate: date("due_date", { mode: "string" }),
  notes: text("notes"),
  ...timestamps,
});

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
