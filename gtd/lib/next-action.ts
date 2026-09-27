import { and, asc, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { tasks, type Project, type Task } from "@/db/schema";
import { todayInIsrael } from "./labels";
import { blockedIds } from "./sequence";

export type ProjectFocus = {
  nextAction: Task | null; // the one action to do next, in project order
  parent: Task | null; // when the next action is a subtask, its parent
  parallelNext: number; // next actions that can be done right now, side by side
};

// What a project card shows. Walks the project's top-level tasks in manual order, using the
// same rules as the Next list (available, not blocked in a sequence); a parent with open
// subtasks stands for its first actionable subtask.
export async function projectFocus(list: Pick<Project, "id" | "sequential">[], today = todayInIsrael()) {
  const ids = list.map((p) => p.id);
  const rows = ids.length
    ? await db.select().from(tasks).where(and(inArray(tasks.projectId, ids), ne(tasks.status, "done"))).orderBy(asc(tasks.position))
    : [];
  const actionable = (t: Task, blocked: Set<string>) => t.status === "next" && (!t.startDate || t.startDate <= today) && !blocked.has(t.id);

  return new Map<string, ProjectFocus>(
    list.map((p) => {
      const mine = rows.filter((t) => t.projectId === p.id);
      const top = mine.filter((t) => !t.parentId);
      const blockedTop = blockedIds(top, p.sequential);
      const focus: ProjectFocus = { nextAction: null, parent: null, parallelNext: 0 };
      for (const task of top) {
        if (!actionable(task, blockedTop)) continue;
        const children = mine.filter((c) => c.parentId === task.id);
        const blockedChildren = blockedIds(children, task.sequential);
        const ready = children.filter((c) => actionable(c, blockedChildren));
        focus.parallelNext += ready.length || 1;
        if (!focus.nextAction) {
          focus.nextAction = ready[0] ?? task;
          focus.parent = ready[0] ? task : null;
        }
      }
      return [p.id, focus];
    }),
  );
}
