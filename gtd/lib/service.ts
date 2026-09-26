import { and, asc, eq, isNotNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks, type NewProject, type NewTask } from "@/db/schema";
import { todayInIsrael } from "./labels";
import type { ListKey } from "./lists";
import { isAvailable, listCounts, listTasks, projectsWithCounts, type TaskFilters } from "./queries";

export class NotFound extends Error {}

// All open tasks (every status but done), grouped by list, for when no list is given.
async function openTasks(filters: TaskFilters) {
  const lists = ["inbox", "next", "waiting", "someday"] as const;
  const rows = await Promise.all(lists.map((l) => listTasks(l, filters)));
  return rows.flat();
}

export async function findTasks(list: ListKey | "open", filters: TaskFilters, limit: number) {
  const rows = list === "open" ? await openTasks(filters) : await listTasks(list, filters);
  return { total: rows.length, tasks: rows.slice(0, limit) };
}

export async function getTask(id: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) throw new NotFound(`Task ${id} not found`);
  return task;
}

export async function createTasks(items: NewTask[]) {
  return db.insert(tasks).values(items).returning();
}

export async function updateTask(id: string, data: Partial<NewTask>) {
  const [task] = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
  if (!task) throw new NotFound(`Task ${id} not found`);
  return task;
}

export async function deleteTask(id: string) {
  const [task] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
  if (!task) throw new NotFound(`Task ${id} not found`);
  return task;
}

export async function findProjects(status?: "active" | "someday" | "done") {
  const all = await projectsWithCounts();
  return all
    .filter((p) => !status || p.status === status)
    .map(({ byStatus, total, done, ...p }) => ({
      ...p,
      taskCounts: { ...byStatus, total },
      progress: total ? Math.round((done / total) * 100) : 0,
      hasNextAction: (byStatus.next ?? 0) > 0,
    }));
}

export async function getProject(id: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) throw new NotFound(`Project ${id} not found`);
  const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, id)).orderBy(asc(tasks.createdAt));
  return { ...project, tasks: projectTasks };
}

export async function createProject(data: NewProject, nextActions: string[]) {
  return db.transaction(async (tx) => {
    const [project] = await tx.insert(projects).values(data).returning();
    const created = nextActions.length
      ? await tx.insert(tasks).values(nextActions.map((title) => ({ title, status: "next" as const, projectId: project.id }))).returning()
      : [];
    return { ...project, tasks: created };
  });
}

export async function updateProject(id: string, data: Partial<NewProject>) {
  const [project] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
  if (!project) throw new NotFound(`Project ${id} not found`);
  return project;
}

export async function deleteProject(id: string) {
  const [project] = await db.delete(projects).where(eq(projects.id, id)).returning();
  if (!project) throw new NotFound(`Project ${id} not found`);
  return project;
}

// A snapshot for starting a session or a weekly review.
export async function overview() {
  const today = todayInIsrael();
  const open = and(ne(tasks.status, "done"), isNotNull(tasks.dueDate));
  const [{ counts }, overdue, dueToday, startingToday, inbox, allProjects] = await Promise.all([
    listCounts(today),
    db.select().from(tasks).where(and(open, lt(tasks.dueDate, today))).orderBy(asc(tasks.dueDate)),
    db.select().from(tasks).where(and(open, eq(tasks.dueDate, today))),
    db.select().from(tasks).where(and(ne(tasks.status, "done"), eq(tasks.startDate, today))),
    db
      .select({ id: tasks.id, title: tasks.title, createdAt: tasks.createdAt })
      .from(tasks)
      .where(and(eq(tasks.status, "inbox"), isAvailable(today)))
      .orderBy(asc(tasks.createdAt))
      .limit(50),
    findProjects("active"),
  ]);
  const [{ oldestInboxDays }] = await db
    .select({ oldestInboxDays: sql<number | null>`floor(extract(epoch from now() - min(${tasks.createdAt})) / 86400)`.mapWith(Number) })
    .from(tasks)
    .where(and(eq(tasks.status, "inbox"), isAvailable(today)));
  return {
    today,
    timezone: "Asia/Jerusalem",
    counts,
    overdue,
    dueToday,
    startingToday,
    inbox: { items: inbox, oldestItemAgeDays: oldestInboxDays },
    activeProjectsWithoutNextAction: allProjects.filter((p) => !p.hasNextAction).map(({ id, name, outcome }) => ({ id, name, outcome })),
  };
}
