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
    context: taskFilters.shape.context.safeParse(first(sp.context)).data,
    projectId: idParam.safeParse(first(sp.project)).data,
    q: first(sp.q)?.trim() || undefined,
  };

  const [rows, projects] = await Promise.all([listTasks(list, filters), allProjects()]);
  // Parents show their subtasks collapsed; subtasks listed on their own (date views) name their parent.
  const parentIds = [...new Set(rows.flatMap((t) => (t.parentId ? [t.parentId] : [])))];
  const [children, parents] = await Promise.all([
    subtasksOf(rows.filter((t) => !t.parentId).map((t) => t.id)),
    parentIds.length ? db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(inArray(tasks.id, parentIds)) : [],
  ]);
  const childrenOf = (id: string) => children.filter((c) => c.parentId === id);
  const parentTitle = new Map(parents.map((p) => [p.id, p.title]));
  const today = todayInIsrael();
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const query = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
  const from = `/${list}${query ? `?${query}` : ""}`;
  const contextCounts: Partial<Record<NonNullable<Task["context"]>, number>> = {};
  for (const t of rows) if (t.context) contextCounts[t.context] = (contextCounts[t.context] ?? 0) + 1;

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
        <FilterBar projects={projects.filter((p) => p.status !== "done")} contextCounts={contextCounts} />
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
