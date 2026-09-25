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
