import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks, type Project } from "@/db/schema";
import { todayInIsrael } from "./labels";
import { isAvailable } from "./queries";
import { isUnblocked } from "./sequence";

// Project governance: one place that decides which projects need a review, used by the
// sidebar badge, the review screen, the project pages and MCP. Nothing here touches the
// daily task lists.

const DAY_MS = 24 * 60 * 60 * 1000;

export type ProjectHealth = Project & {
  // Active, and no task in Next that's available now (not deferred, not blocked in a sequence).
  isStalled: boolean;
  // Active, and never reviewed or its last review is older than its cadence.
  isDueForReview: boolean;
  // When the next review is due; null means now (never reviewed).
  nextReviewAt: Date | null;
  daysSinceReview: number | null;
  // In the review queue: due, or stalled in a way the last review didn't already acknowledge.
  needsReview: boolean;
};

// Projects that have at least one actionable next action (top-level or subtask).
async function projectsWithNextAction(today: string) {
  const rows = await db
    .selectDistinct({ projectId: tasks.projectId })
    .from(tasks)
    .where(and(eq(tasks.status, "next"), isNotNull(tasks.projectId), isAvailable(today), isUnblocked));
  return new Set(rows.map((r) => r.projectId!));
}

export function healthOf(project: Project, hasNextAction: boolean, now = new Date()): ProjectHealth {
  const active = project.status === "active";
  const isStalled = active && !hasNextAction;
  const nextReviewAt = project.lastReviewedAt ? new Date(project.lastReviewedAt.getTime() + project.reviewCadenceDays * DAY_MS) : null;
  const isDueForReview = active && (nextReviewAt === null || nextReviewAt <= now);
  const daysSinceReview = project.lastReviewedAt ? Math.floor((now.getTime() - project.lastReviewedAt.getTime()) / DAY_MS) : null;
  const needsReview = isDueForReview || (isStalled && !project.stallAcknowledged);
  return { ...project, isStalled, isDueForReview, nextReviewAt, daysSinceReview, needsReview };
}

export async function projectHealth(): Promise<ProjectHealth[]> {
  const today = todayInIsrael();
  const [all, withNext] = await Promise.all([db.select().from(projects).orderBy(asc(projects.name)), projectsWithNextAction(today)]);
  const now = new Date();
  // An acknowledged stall ends once the project has a next action again, so a later stall
  // counts as new and enters the queue right away.
  const recovered = all.filter((p) => p.stallAcknowledged && withNext.has(p.id)).map((p) => p.id);
  if (recovered.length) await db.update(projects).set({ stallAcknowledged: false }).where(inArray(projects.id, recovered));
  return all.map((p) => healthOf(p, withNext.has(p.id), now));
}

export async function healthOfProject(id: string): Promise<ProjectHealth | undefined> {
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) return undefined;
  const withNext = await projectsWithNextAction(todayInIsrael());
  if (project.stallAcknowledged && withNext.has(id)) {
    await db.update(projects).set({ stallAcknowledged: false }).where(eq(projects.id, id));
    project.stallAcknowledged = false;
  }
  return healthOf(project, withNext.has(id));
}

// The review queue: stalled projects first, then the longest overdue (never reviewed first).
export function queueOf(health: ProjectHealth[]) {
  return health.filter((p) => p.needsReview).sort(
    (a, b) =>
      Number(b.isStalled) - Number(a.isStalled) ||
      (a.nextReviewAt?.getTime() ?? -Infinity) - (b.nextReviewAt?.getTime() ?? -Infinity),
  );
}

export async function reviewQueue() {
  return queueOf(await projectHealth());
}

export async function reviewCount() {
  return (await reviewQueue()).length;
}

// Marks a project reviewed now. The next review comes due after its cadence; a stall present
// at this moment counts as acknowledged until then.
export async function markProjectReviewed(id: string) {
  const health = await healthOfProject(id);
  if (!health) return undefined;
  const [project] = await db
    .update(projects)
    .set({ lastReviewedAt: sql`now()`, stallAcknowledged: health.isStalled })
    .where(eq(projects.id, id))
    .returning();
  return healthOf(project, !health.isStalled);
}
