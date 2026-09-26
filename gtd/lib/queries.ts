import { and, asc, count, desc, eq, gt, ilike, isNotNull, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks, type Task } from "@/db/schema";
import { todayInIsrael } from "./labels";
import type { ListKey } from "./lists";

// includeDeferred: also return tasks whose start date is still in the future (hidden by default).
export type TaskFilters = { context?: Task["context"]; projectId?: string; q?: string; includeDeferred?: boolean };

// A task is available once its start (defer) date has arrived; no start date means available now.
export const isAvailable = (today: string) => or(isNull(tasks.startDate), lte(tasks.startDate, today))!;
export const isDeferred = (today: string) => gt(tasks.startDate, today);

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

export function listTasks(list: ListKey, filters: TaskFilters, today = todayInIsrael()) {
  const conditions = filterConditions(filters);
  if (list === "deferred") {
    return db
      .select()
      .from(tasks)
      .where(and(ne(tasks.status, "done"), isDeferred(today), ...conditions))
      .orderBy(asc(tasks.startDate), asc(tasks.createdAt));
  }
  // Scheduled shows every open task with a due date, deferred or not: it's the calendar view.
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
  const availability = filters.includeDeferred ? [] : [isAvailable(today)];
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.status, list), ...availability, ...conditions))
    .orderBy(...byDueThenCreated);
}

// Counts per list as shown in the sidebar: open lists count only available tasks.
export async function listCounts(today: string) {
  const [byStatus, [scheduled], [deferred]] = await Promise.all([
    db
      .select({ status: tasks.status, n: count() })
      .from(tasks)
      .where(or(eq(tasks.status, "done"), isAvailable(today)))
      .groupBy(tasks.status),
    db
      .select({
        n: count(),
        overdue: sql<number>`count(*) filter (where ${tasks.dueDate} < ${today})`.mapWith(Number),
      })
      .from(tasks)
      .where(and(ne(tasks.status, "done"), isNotNull(tasks.dueDate))),
    db.select({ n: count() }).from(tasks).where(and(ne(tasks.status, "done"), isDeferred(today))),
  ]);
  const counts: Record<ListKey, number> = { inbox: 0, next: 0, waiting: 0, someday: 0, done: 0, scheduled: scheduled.n, deferred: deferred.n };
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
