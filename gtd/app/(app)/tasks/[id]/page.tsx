import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { ArrowRight, CornerDownLeft, ListOrdered, ListTree, Lock, Plus, Shuffle, Trash2 } from "lucide-react";
import { createSubtask, deleteTask, setSequential, updateTask } from "@/app/actions";
import { DoneButton } from "@/components/done-button";
import { MoveButtons } from "@/components/task-card";
import { CopyLink } from "@/components/copy-link";
import { TaskDates } from "@/components/task-dates";
import { contextIcons, listIcons } from "@/components/icons";
import { db } from "@/db";
import { taskContext, taskStatus, tasks } from "@/db/schema";
import { contextLabels, taskStatusLabels, todayInIsrael } from "@/lib/labels";
import { allProjects, subtasksOf } from "@/lib/queries";
import { blockedIds } from "@/lib/sequence";
import { blockingTask } from "@/lib/service";
import { requireSession } from "@/lib/session";
import { safePath } from "@/lib/safe-path";
import { idParam } from "@/lib/validation";

const ruleMessages: Record<string, string> = {
  dates: "תאריך ההתחלה חייב להיות לפני תאריך היעד או באותו יום.",
  nested: "אפשר לקנן רק רמה אחת: משימת האב שנבחרה היא בעצמה תת־משימה.",
  "has-subtasks": "למשימה הזו יש תתי־משימות, ולכן היא לא יכולה להיות תת־משימה.",
  self: "משימה לא יכולה להיות משימת האב של עצמה.",
};

export default async function TaskPage({ params, searchParams }: PageProps<"/tasks/[id]">) {
  await requireSession();
  const { id } = await params;
  if (!idParam.safeParse(id).success) notFound();
  const [[task], projects, subtasks] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.id, id)),
    allProjects(),
    subtasksOf([id]),
  ]);
  if (!task) notFound();

  const { from, rule } = await searchParams;
  const back = safePath(from, `/${task.status}`);
  const selectable = projects.filter((p) => (p.status !== "done" && p.status !== "dropped") || p.id === task.projectId);
  const [parent] = task.parentId ? await db.select().from(tasks).where(eq(tasks.id, task.parentId)) : [];

  // Tasks this one could be nested under: open top-level tasks in the same project (or also
  // without one). A task that has subtasks can't become a subtask (one level only).
  const parentCandidates =
    subtasks.length > 0
      ? []
      : await db
          .select({ id: tasks.id, title: tasks.title })
          .from(tasks)
          .where(
            and(
              isNull(tasks.parentId),
              ne(tasks.status, "done"),
              ne(tasks.id, task.id),
              task.projectId ? eq(tasks.projectId, task.projectId) : isNull(tasks.projectId),
            ),
          )
          .orderBy(asc(tasks.position))
          .limit(100);

  // Is this task waiting on an earlier one in a sequential parent or project?
  const blockedBy = await blockingTask(task);
  const subBlocked = blockedIds(subtasks, task.sequential);
  const openSubtasks = subtasks.filter((s) => s.status !== "done").length;

  return (
    <div className="detail">
      <div className="detail-top">
        <Link href={back} className="back">
          <ArrowRight size={18} /> חזרה
        </Link>
        <CopyLink path={`/tasks/${task.id}`} title={task.title} />
      </div>

      {parent && (
        <Link href={`/tasks/${parent.id}?from=${encodeURIComponent(back)}`} className="parent-link big">
          <CornerDownLeft size={14} /> חלק מ: {parent.title}
        </Link>
      )}
      {blockedBy && (
        <p className="blocked-box">
          <Lock size={15} /> ממתינה בתור: קודם צריך לסיים את &quot;{blockedBy.title}&quot;.
        </p>
      )}

      <form action={updateTask} className="detail-form">
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="returnTo" value={back} />

        <input name="title" defaultValue={task.title} required className="title-input" aria-label="כותרת" />
        <textarea
          name="notes"
          defaultValue={task.notes ?? ""}
          rows={5}
          className="notes-input"
          placeholder={"הערות. שורה שמתחילה ב־\"- [ ] \" הופכת לצ'קליסט."}
          aria-label="הערות"
        />

        <fieldset className="segmented">
          <legend>רשימה</legend>
          {taskStatus.enumValues.map((s) => {
            const Icon = listIcons[s];
            return (
              <label key={s} className={`seg seg-${s}`}>
                <input type="radio" name="status" value={s} defaultChecked={task.status === s} />
                <Icon size={20} />
                <span>{taskStatusLabels[s]}</span>
              </label>
            );
          })}
        </fieldset>

        <div className="field">
          <span className="field-label">הקשר</span>
          <div className="radio-chips">
            <label className="chip-radio">
              <input type="radio" name="context" value="" defaultChecked={!task.context} />
              <span>ללא</span>
            </label>
            {taskContext.enumValues.map((c) => {
              const Icon = contextIcons[c];
              return (
                <label key={c} className={`chip-radio ctx-${c.slice(1)}`}>
                  <input type="radio" name="context" value={c} defaultChecked={task.context === c} />
                  <span><Icon size={14} /> {contextLabels[c]}</span>
                </label>
              );
            })}
          </div>
        </div>

        <label className="field">
          <span className="field-label">פרויקט</span>
          {/* A subtask always lives in its parent's project (enforced in the DB). */}
          <select name="projectId" defaultValue={task.projectId ?? ""} disabled={!!parent}>
            <option value="">ללא פרויקט</option>
            {selectable.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {/* A disabled select isn't submitted: keep the project if the task is detached from its parent. */}
          {parent && <input type="hidden" name="projectId" value={task.projectId ?? ""} />}
          {parent && <span className="field-hint">תת־משימה נמצאת תמיד בפרויקט של משימת האב.</span>}
        </label>

        {/* Always sent, so saving never detaches a subtask by accident. */}
        {subtasks.length > 0 ? (
          <input type="hidden" name="parentId" value="" />
        ) : (
          <label className="field">
            <span className="field-label">משימת אב</span>
            <select name="parentId" defaultValue={task.parentId ?? ""}>
              <option value="">ללא (משימה עצמאית)</option>
              {parentCandidates.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </label>
        )}

        {rule && <p className="form-error">{ruleMessages[String(rule)] ?? ruleMessages.dates}</p>}
        <TaskDates startDate={task.startDate} dueDate={task.dueDate} today={todayInIsrael()} />

        <div className="detail-actions">
          <button className="primary">שמירה</button>
          <Link href={back} className="button">ביטול</Link>
        </div>
      </form>

      {!parent && (
        <section className="subtask-panel">
          <div className="subtask-panel-head">
            <h2><ListTree size={16} /> תתי־משימות {subtasks.length > 0 && <span className="head-count">{subtasks.length - openSubtasks}/{subtasks.length}</span>}</h2>
            {subtasks.length > 1 && (
              <form action={setSequential} className="sequence-toggle">
                <input type="hidden" name="kind" value="task" />
                <input type="hidden" name="id" value={task.id} />
                <input type="hidden" name="sequential" value={String(!task.sequential)} />
                <button className={task.sequential ? "on" : undefined} aria-pressed={task.sequential}>
                  {task.sequential ? <ListOrdered size={15} /> : <Shuffle size={15} />}
                  {task.sequential ? "ברצף" : "במקביל"}
                </button>
              </form>
            )}
          </div>
          {subtasks.length > 0 && (
            <ul className="subtask-list">
              {subtasks.map((sub) => (
                <li key={sub.id} className={`subtask${sub.status === "done" ? " is-done" : ""}${subBlocked.has(sub.id) ? " is-blocked" : ""}`}>
                  <DoneButton id={sub.id} done={sub.status === "done"} small />
                  <Link href={`/tasks/${sub.id}?from=${encodeURIComponent(`/tasks/${task.id}`)}`}>
                    {subBlocked.has(sub.id) && <Lock size={12} className="lock" aria-label="חסום" />}
                    {sub.title}
                  </Link>
                  {sub.status !== "done" && <MoveButtons id={sub.id} />}
                </li>
              ))}
            </ul>
          )}
          <form action={createSubtask} className="capture subtask-add">
            <input type="hidden" name="parentId" value={task.id} />
            <Plus size={18} className="capture-icon" aria-hidden />
            <input name="title" placeholder="הוספת תת־משימה" required autoComplete="off" />
            <button className="primary">הוספה</button>
          </form>
        </section>
      )}

      <form action={deleteTask} className="danger-zone">
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="returnTo" value={back} />
        <button className="danger">
          <Trash2 size={16} /> מחיקת משימה{subtasks.length > 0 ? ` (כולל ${subtasks.length} תתי־משימות)` : ""}
        </button>
      </form>
    </div>
  );
}
