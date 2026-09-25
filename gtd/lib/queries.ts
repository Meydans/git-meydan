import { and, asc, count, desc, eq, ilike, isNotNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks, type Task } from "@/db/schema";
import type { ListKey } from "./lists";

export type TaskFilters = { context?: Task["context"]; projectId?: string; q?: string };

function filterConditions({ context, projectId, q }: TaskFilters): SQL[] {
  const conditions: SQL[] = [];
  if (context) conditions.push(eq(tasks.context, context));
  if (projectId) conditions.push(eq(tasks.projectId, projectId));
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(or(ilike(tasks.title, pattern), ilike(tasks.notes, pattern))!);
  }
  return conditions;
}

const byDueThenCreated = [sql`${tasks.dueDate} asc nulls last`, asc(tasks.createdAt)];

export function listTasks(list: ListKey, filters: TaskFilters) {
  const conditions = filterConditions(filters);
  if (list === "scheduled") {
    return db
      .select()
      .from(tasks)
      .where(and(ne(tasks.status, "done"), isNotNull(tasks.dueDate), ...conditions))
      .orderBy(...byDueThenCreated);
  }
  if (list === "done") {
    return db
      .select()
      .from(tasks)
      .where(and(eq(tasks.status, "done"), ...conditions))
      .orderBy(desc(tasks.updatedAt))
      .limit(100);
  }
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.status, list), ...conditions))
    .orderBy(...byDueThenCreated);
}

export async function listCounts(today: string) {
  const [byStatus, [scheduled]] = await Promise.all([
    db.select({ status: tasks.status, n: count() }).from(tasks).groupBy(tasks.status),
    db
      .select({
        n: count(),
        overdue: sql<number>`count(*) filter (where ${tasks.dueDate} < ${today})`.mapWith(Number),
      })
      .from(tasks)
      .where(and(ne(tasks.status, "done"), isNotNull(tasks.dueDate))),
  ]);
  const counts: Record<ListKey, number> = { inbox: 0, next: 0, waiting: 0, someday: 0, done: 0, scheduled: scheduled.n };
  for (const row of byStatus) counts[row.status] = row.n;
  return { counts, overdue: scheduled.overdue };
}

export function allProjects() {
  return db.select().from(projects).orderBy(asc(projects.name));
}

export function projectTaskCounts() {
  return db
    .select({ projectId: tasks.projectId, status: tasks.status, n: count() })
    .from(tasks)
    .where(isNotNull(tasks.projectId))
    .groupBy(tasks.projectId, tasks.status);
}

export async function projectsWithCounts() {
  const [rows, counts] = await Promise.all([allProjects(), projectTaskCounts()]);
  return rows.map((project) => {
    const mine = counts.filter((c) => c.projectId === project.id);
    const byStatus = Object.fromEntries(mine.map((c) => [c.status, c.n])) as Partial<Record<Task["status"], number>>;
    const total = mine.reduce((sum, c) => sum + c.n, 0);
    return { ...project, byStatus, total, done: byStatus.done ?? 0 };
  });
}
