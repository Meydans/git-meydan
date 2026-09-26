import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowRight, Trash2 } from "lucide-react";
import { deleteTask, updateTask } from "@/app/actions";
import { CopyLink } from "@/components/copy-link";
import { DueDateField } from "@/components/due-date-field";
import { contextIcons, listIcons } from "@/components/icons";
import { db } from "@/db";
import { taskContext, taskStatus, tasks } from "@/db/schema";
import { contextLabels, taskStatusLabels, todayInIsrael } from "@/lib/labels";
import { allProjects } from "@/lib/queries";
import { requireSession } from "@/lib/session";
import { safePath } from "@/lib/safe-path";
import { idParam } from "@/lib/validation";

export default async function TaskPage({ params, searchParams }: PageProps<"/tasks/[id]">) {
  await requireSession();
  const { id } = await params;
  if (!idParam.safeParse(id).success) notFound();
  const [[task], projects] = await Promise.all([db.select().from(tasks).where(eq(tasks.id, id)), allProjects()]);
  if (!task) notFound();

  const { from } = await searchParams;
  const back = safePath(from, `/${task.status}`);
  const selectable = projects.filter((p) => p.status !== "done" || p.id === task.projectId);

  return (
    <div className="detail">
      <div className="detail-top">
        <Link href={back} className="back">
          <ArrowRight size={18} /> חזרה
        </Link>
        <CopyLink path={`/tasks/${task.id}`} title={task.title} />
      </div>

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
          <select name="projectId" defaultValue={task.projectId ?? ""}>
            <option value="">ללא פרויקט</option>
            {selectable.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        <div className="field">
          <span className="field-label">תאריך יעד</span>
          <DueDateField defaultValue={task.dueDate} today={todayInIsrael()} />
        </div>

        <div className="detail-actions">
          <button className="primary">שמירה</button>
          <Link href={back} className="button">ביטול</Link>
        </div>
      </form>

      <form action={deleteTask} className="danger-zone">
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="returnTo" value={back} />
        <button className="danger"><Trash2 size={16} /> מחיקת משימה</button>
      </form>
    </div>
  );
}
