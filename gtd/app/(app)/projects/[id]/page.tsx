import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { AlertTriangle, ArrowRight, ListOrdered, Pencil, Shuffle, Trash2 } from "lucide-react";
import { deleteProject, setSequential, updateProject } from "@/app/actions";
import { Capture } from "@/components/capture";
import { TaskCard } from "@/components/task-card";
import { db } from "@/db";
import { projects, projectStatus } from "@/db/schema";
import { projectHue, projectStatusLabels, todayInIsrael } from "@/lib/labels";
import { projectTasksOrdered } from "@/lib/queries";
import { blockedIds } from "@/lib/sequence";
import { requireSession } from "@/lib/session";
import { idParam } from "@/lib/validation";

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  await requireSession();
  const { id } = await params;
  if (!idParam.safeParse(id).success) notFound();
  const [[project], projectTasks] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, id)),
    projectTasksOrdered(id),
  ]);
  if (!project) notFound();

  const today = todayInIsrael();
  const from = `/projects/${id}`;
  const topLevel = projectTasks.filter((t) => !t.parentId);
  const open = topLevel.filter((t) => t.status !== "done");
  const doneTop = topLevel.filter((t) => t.status === "done");
  const childrenOf = (parentId: string) => projectTasks.filter((t) => t.parentId === parentId);
  const blocked = blockedIds(topLevel, project.sequential);

  const doneCount = projectTasks.filter((t) => t.status === "done").length;
  const pct = projectTasks.length ? Math.round((doneCount / projectTasks.length) * 100) : 0;
  const stuck = project.status === "active" && !projectTasks.some((t) => t.status === "next");

  return (
    <div style={{ "--hue": projectHue(project.id) } as React.CSSProperties}>
      <Link href="/projects" className="back">
        <ArrowRight size={18} /> כל הפרויקטים
      </Link>

      <header className="project-head">
        <div className="project-card-head">
          <span className="project-dot" />
          <h1>{project.name}</h1>
          <span className="status-pill">{projectStatusLabels[project.status]}</span>
        </div>
        {project.outcome && <p className="outcome big">🎯 {project.outcome}</p>}
        <div className="progress"><span style={{ width: `${pct}%` }} /></div>
        <p className="hint">{doneCount} מתוך {projectTasks.length} משימות הושלמו</p>
        {stuck && (
          <p className="warn-box"><AlertTriangle size={16} /> לפרויקט פעיל אין פעולה הבאה. מה הצעד הפיזי הבא?</p>
        )}
      </header>

      <div className="project-tools">
        <form action={setSequential} className="sequence-toggle">
          <input type="hidden" name="kind" value="project" />
          <input type="hidden" name="id" value={project.id} />
          <input type="hidden" name="sequential" value={String(!project.sequential)} />
          <button className={project.sequential ? "on" : undefined} aria-pressed={project.sequential}>
            {project.sequential ? <ListOrdered size={16} /> : <Shuffle size={16} />}
            {project.sequential ? "ברצף: רק המשימה הראשונה פעילה" : "במקביל: כל המשימות פעילות"}
          </button>
        </form>
        <details className="edit-project">
          <summary className="button"><Pencil size={15} /> עריכה</summary>
          <form action={updateProject} className="stack">
            <input type="hidden" name="id" value={project.id} />
            <input name="name" defaultValue={project.name} required aria-label="שם" />
            <textarea name="outcome" rows={2} defaultValue={project.outcome ?? ""} placeholder="התוצאה הרצויה" aria-label="תוצאה רצויה" />
            <select name="status" defaultValue={project.status} aria-label="סטטוס">
              {projectStatus.enumValues.map((s) => (
                <option key={s} value={s}>{projectStatusLabels[s]}</option>
              ))}
            </select>
            <label className="check-field">
              <input type="checkbox" name="sequential" defaultChecked={project.sequential} />
              <input type="hidden" name="sequential-shown" value="1" />
              פרויקט ברצף (כל משימה אחרי הקודמת)
            </label>
            <button className="primary">שמירה</button>
          </form>
          <form action={deleteProject}>
            <input type="hidden" name="id" value={project.id} />
            <button className="danger"><Trash2 size={15} /> מחיקת הפרויקט (המשימות יישארו)</button>
          </form>
        </details>
      </div>

      <Capture status="next" projectId={project.id} placeholder="פעולה הבאה בפרויקט" />

      {open.length > 0 && (
        <section className="bucket">
          <h2>
            {project.sequential ? <ListOrdered size={16} /> : <Shuffle size={16} />}
            משימות לפי סדר <span className="head-count">{open.length}</span>
          </h2>
          <ul className="cards">
            {open.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                project={project}
                today={today}
                from={from}
                hideProject
                showStatus
                movable
                blocked={blocked.has(t.id)}
                subtasks={childrenOf(t.id)}
              />
            ))}
          </ul>
        </section>
      )}

      {doneTop.length > 0 && (
        <details className="bucket done-bucket">
          <summary><h2>הושלמו <span className="head-count">{doneTop.length}</span></h2></summary>
          <ul className="cards">
            {doneTop.map((t) => (
              <TaskCard key={t.id} task={t} project={project} today={today} from={from} hideProject subtasks={childrenOf(t.id)} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
