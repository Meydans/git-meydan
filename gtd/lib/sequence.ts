import { sql } from "drizzle-orm";
import type { Task } from "@/db/schema";

// Sequential rule. In a sequential project (its top-level tasks) or under a sequential parent
// (its subtasks), a task is blocked while an earlier open task exists in manual order.
// "Open" means inbox, next or waiting: someday and done items never block. Blocked tasks stay
// out of Next and its count. The same rule exists as SQL (for list filters) and JS (for pages
// that already hold every sibling).

const OPEN = ["inbox", "next", "waiting"] as const;
export const isOpenStatus = (status: Task["status"]) => (OPEN as readonly string[]).includes(status);

export const isUnblocked = sql`not exists (
  select 1 from tasks s
  where s.status in ('inbox', 'next', 'waiting')
    and s.id <> "tasks"."id"
    and s.position < "tasks"."position"
    and (
      ("tasks"."parent_id" is null and s.parent_id is null and s.project_id = "tasks"."project_id"
        and exists (select 1 from projects p where p.id = "tasks"."project_id" and p.sequential))
      or ("tasks"."parent_id" is not null and s.parent_id = "tasks"."parent_id"
        and exists (select 1 from tasks pt where pt.id = "tasks"."parent_id" and pt.sequential))
    )
)`;

// Ids of blocked tasks among siblings (one project's top-level tasks, or one parent's subtasks).
export function blockedIds(siblings: Pick<Task, "id" | "status" | "position">[], sequential: boolean) {
  const blocked = new Set<string>();
  if (!sequential) return blocked;
  let seenOpen = false;
  for (const task of [...siblings].sort((a, b) => a.position - b.position)) {
    if (!isOpenStatus(task.status)) continue;
    if (seenOpen) blocked.add(task.id);
    seenOpen = true;
  }
  return blocked;
}
