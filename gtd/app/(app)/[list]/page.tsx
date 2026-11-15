import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Capture } from "@/components/capture";
import { FilterBar } from "@/components/filter-bar";
import { listIcons } from "@/components/icons";
import { TaskCard } from "@/components/task-card";
import type { Task } from "@/db/schema";
import { daysBetween, todayInIsrael } from "@/lib/labels";
import { captureStatus, isList, listHints, listLabels } from "@/lib/lists";
import { allProjects, listTasks, subtasksOf, type TaskFilters } from "@/lib/queries";
import { readySubtasks } from "@/lib/sequence";
import { requireSession } from "@/lib/session";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { idParam, taskFilters } from "@/lib/validation";

// Scheduled groups by due date; Deferred groups by start date (always in the future there).
const buckets = [
  { key: "overdue", label: "באיחור", test: (d: number) => d < 0 },
  { key: "today", label: "היום", test: (d: number) => d === 0 },
  { key: "tomorrow", label: "מחר", test: (d: number) => d === 1 },
  { key: "week", label: "השבוע", test: (d: number) => d > 1 && d < 7 },
  { key: "later", label: "בהמשך", test: (d: number) => d >= 7 },
];

export default async function ListPage({ params, searchParams }: PageProps<"/[list]">) {
  await requireSession();
  const { list } = await params;
  if (!isList(list)) notFound();

  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filters: TaskFilters = {
    context: first(sp.context) === "none" ? "none" : taskFilters.shape.context.safeParse(first(sp.context)).data,
    projectId: idParam.safeParse(first(sp.project)).data,
    q: first(sp.q)?.trim() || undefined,
  };

  const today = todayInIsrael();
  // Status lists hold top-level tasks, but the actions to do are often subtasks. A context filter
  // there also matches the ready subtasks of the listed tasks (see readySubtasks), and the chip
  // counts include them. Date views already list subtasks on their own.
  const statusList = list === "inbox" || list === "next" || list === "waiting" || list === "someday";
  const [base, projects] = await Promise.all([
    listTasks(list, statusList ? { ...filters, context: undefined } : filters),
    allProjects(),
  ]);
  const topIds = base.filter((t) => !t.parentId).map((t) => t.id);
  const children = await subtasksOf(topIds);
  const childrenOf = (id: string) => children.filter((c) => c.parentId === id);
  const ready = statusList ? base.flatMap((t) => readySubtasks(t, childrenOf(t.id), list, today)) : [];
  const matches = (t: Task) => !filters.context || (filters.context === "none" ? !t.context : t.context === filters.context);
  // A matching parent already shows its ready subtasks, so only subtasks of non-matching parents
  // get cards of their own, right where their parent would be.
  const rows = statusList
    ? base.flatMap((t) => (matches(t) ? [t] : filters.context ? readySubtasks(t, childrenOf(t.id), list, today).filter(matches) : []))
    : base;

  // Subtasks listed on their own name their parent.
  const known = new Map(base.map((t) => [t.id, t.title]));
  const missing = [...new Set(rows.flatMap((t) => (t.parentId && !known.has(t.parentId) ? [t.parentId] : [])))];
  const parents = missing.length ? await db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(inArray(tasks.id, missing)) : [];
  const parentTitle = new Map([...known, ...parents.map((p) => [p.id, p.title] as const)]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const query = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
  const from = `/${list}${query ? `?${query}` : ""}`;
  // Chip counts match what each filter would show: a subtask counts on its own only when its
  // parent doesn't match the same context (otherwise it's inside the parent's card).
  const contextOf = new Map(base.map((t) => [t.id, t.context]));
  const counted = statusList ? [...base, ...ready.filter((s) => s.context !== contextOf.get(s.parentId!))] : rows;
  const contextCounts: Partial<Record<NonNullable<Task["context"]>, number>> = {};
  for (const t of counted) if (t.context) contextCounts[t.context] = (contextCounts[t.context] ?? 0) + 1;
  // Next actions are filtered by context, so Next nudges toward giving each one a context.
  const nudgeContext = list === "next";
  const withoutContext = counted.filter((t) => !t.context).length;

  const Icon = listIcons[list];
  const card = (task: Task) => (
    <TaskCard
      key={task.id}
      task={task}
      project={task.projectId ? projectById.get(task.projectId) : undefined}
      today={today}
      from={from}
      subtasks={childrenOf(task.id)}
      parentTitle={task.parentId ? parentTitle.get(task.parentId) : undefined}
      pickContext={nudgeContext && !task.context}
    />
  );

  return (
    <>
      <header className={`page-head head-${list}`}>
        <Icon size={26} className="page-icon" />
        <div>
          <h1>
            {listLabels[list]} <span className="head-count">{rows.length}</span>
          </h1>
          <p className="hint">{listHints[list]}</p>
        </div>
      </header>

      {list !== "done" && list !== "deferred" && (
        <Capture
          autoFocus={first(sp.capture) === "1"}
          status={captureStatus(list)}
          placeholder={list === "inbox" || list === "scheduled" ? "מה על הראש?" : `הוספה ל${listLabels[list]}`}
        />
      )}

      <Suspense>
        <FilterBar
          projects={projects.filter((p) => p.status !== "done")}
          contextCounts={contextCounts}
          withoutContext={nudgeContext ? withoutContext : undefined}
        />
      </Suspense>

      {rows.length === 0 ? (
        <div className="empty-state">
          <Icon size={40} strokeWidth={1.5} />
          <p>{filters.context || filters.projectId || filters.q ? "אין תוצאות לסינון הזה" : "הרשימה ריקה"}</p>
        </div>
      ) : list === "scheduled" || list === "deferred" ? (
        buckets.map((b) => {
          const group = rows.filter((t) => b.test(daysBetween(today, (list === "deferred" ? t.startDate : t.dueDate)!)));
          return (
            group.length > 0 && (
              <section key={b.key} className={`bucket bucket-${b.key}`}>
                <h2>
                  {b.label} <span className="head-count">{group.length}</span>
                </h2>
                <ul className="cards">{group.map(card)}</ul>
              </section>
            )
          );
        })
      ) : (
        <ul className="cards">{rows.map(card)}</ul>
      )}
    </>
  );
}
