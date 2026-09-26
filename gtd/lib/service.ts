import { and, asc, eq, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks, type NewProject, type NewTask, type Project, type Task } from "@/db/schema";
import { todayInIsrael } from "./labels";
import type { ListKey } from "./lists";
import { isAvailable, listCounts, listTasks, projectsWithCounts, projectTasksOrdered, subtasksOf, type TaskFilters } from "./queries";
import { projectHealth } from "./review";
import { blockedIds, isOpenStatus } from "./sequence";

export class NotFound extends Error {}
export class InvalidRequest extends Error {}

// Attaches each parent's subtasks (in manual order, with their blocked flag) to a list of tasks.
async function withSubtasks<T extends Task>(rows: T[]) {
  const children = await subtasksOf(rows.filter((t) => !t.parentId).map((t) => t.id));
  return rows.map((task) => {
    const mine = children.filter((c) => c.parentId === task.id);
    if (mine.length === 0) return task;
    const blocked = blockedIds(mine, task.sequential);
    return { ...task, subtasks: mine.map((c) => ({ ...c, blocked: blocked.has(c.id) })) };
  });
}

// The earlier open task a task is waiting for in its sequential parent or project, if any.
export async function blockingTask(task: Task): Promise<Task | undefined> {
  let siblings: Task[] = [];
  let sequential = false;
  if (task.parentId) {
    const [parent] = await db.select({ sequential: tasks.sequential }).from(tasks).where(eq(tasks.id, task.parentId));
    sequential = parent?.sequential ?? false;
    if (sequential) siblings = await subtasksOf([task.parentId]);
  } else if (task.projectId) {
    const [project] = await db.select({ sequential: projects.sequential }).from(projects).where(eq(projects.id, task.projectId));
    sequential = project?.sequential ?? false;
    if (sequential) siblings = (await projectTasksOrdered(task.projectId)).filter((t) => !t.parentId);
  }
  if (!blockedIds(siblings, sequential).has(task.id)) return undefined;
  return siblings.find((s) => isOpenStatus(s.status) && s.position < task.position);
}

// All open tasks (every status but done), grouped by list, for when no list is given.
async function openTasks(filters: TaskFilters) {
  const lists = ["inbox", "next", "waiting", "someday"] as const;
  const rows = await Promise.all(lists.map((l) => listTasks(l, filters)));
  return rows.flat();
}

export async function findTasks(list: ListKey | "open", filters: TaskFilters, limit: number) {
  const rows = list === "open" ? await openTasks(filters) : await listTasks(list, filters);
  return { total: rows.length, tasks: await withSubtasks(rows.slice(0, limit)) };
}

export async function getTask(id: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) throw new NotFound(`Task ${id} not found`);
  const [[withChildren], blocker] = await Promise.all([withSubtasks([task]), blockingTask(task)]);
  return { ...withChildren, blocked: !!blocker, blockedBy: blocker ? { id: blocker.id, title: blocker.title } : null };
}

// Puts the given tasks in this order. They must be siblings: subtasks of one parent, or
// top-level tasks of one project. They take over their own existing positions, so the rest
// of the list is untouched.
export async function reorderTasks(ids: string[]) {
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(tasks).where(inArray(tasks.id, ids));
    if (rows.length !== ids.length) throw new NotFound("Some task ids were not found");
    const [first] = rows;
    const sameScope = rows.every((t) =>
      first.parentId ? t.parentId === first.parentId : !t.parentId && t.projectId !== null && t.projectId === first.projectId,
    );
    if (!sameScope) throw new InvalidRequest("Tasks must be subtasks of the same parent, or top-level tasks of the same project");
    const positions = rows.map((t) => t.position).sort((a, b) => a - b);
    for (const [i, id] of ids.entries()) await tx.update(tasks).set({ position: positions[i] }).where(eq(tasks.id, id));
    const scope = first.parentId ? eq(tasks.parentId, first.parentId) : and(eq(tasks.projectId, first.projectId!), isNull(tasks.parentId));
    return tx.select().from(tasks).where(scope).orderBy(asc(tasks.position));
  });
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

export async function findProjects(status?: Project["status"]) {
  const [all, health] = await Promise.all([projectsWithCounts(), projectHealth()]);
  const healthById = new Map(health.map((h) => [h.id, h]));
  return all
    .filter((p) => !status || p.status === status)
    .map(({ byStatus, total, done, ...p }) => {
      const h = healthById.get(p.id)!;
      return {
        ...p,
        taskCounts: { ...byStatus, total },
        progress: total ? Math.round((done / total) * 100) : 0,
        hasNextAction: !h.isStalled && p.status === "active",
        isStalled: h.isStalled,
        isDueForReview: h.isDueForReview,
        needsReview: h.needsReview,
        nextReviewAt: h.nextReviewAt,
        daysSinceReview: h.daysSinceReview,
      };
    });
}

export async function getProject(id: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) throw new NotFound(`Project ${id} not found`);
  const all = await projectTasksOrdered(id);
  const topLevel = all.filter((t) => !t.parentId);
  const blocked = blockedIds(topLevel, project.sequential);
  const tasksWithSubtasks = await withSubtasks(topLevel);
  return { ...project, tasks: tasksWithSubtasks.map((t) => ({ ...t, blocked: blocked.has(t.id) })) };
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
    activeProjectsWithoutNextAction: allProjects.filter((p) => p.isStalled).map(({ id, name, outcome }) => ({ id, name, outcome })),
    reviewQueue: allProjects
      .filter((p) => p.needsReview)
      .map(({ id, name, isStalled, isDueForReview, daysSinceReview }) => ({ id, name, isStalled, isDueForReview, daysSinceReview })),
  };
}
