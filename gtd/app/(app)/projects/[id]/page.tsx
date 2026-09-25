import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { AlertTriangle, ArrowRight, Pencil, Trash2 } from "lucide-react";
import { deleteProject, updateProject } from "@/app/actions";
import { Capture } from "@/components/capture";
import { listIcons } from "@/components/icons";
import { TaskCard } from "@/components/task-card";
import { db } from "@/db";
import { projects, projectStatus, tasks } from "@/db/schema";
import { projectHue, projectStatusLabels, taskStatusLabels, todayInIsrael } from "@/lib/labels";
import { requireSession } from "@/lib/session";
import { idParam } from "@/lib/validation";

const openStatuses = ["next", "waiting", "inbox", "someday"] as const;

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  await requireSession();
  const { id } = await params;
  if (!idParam.safeParse(id).success) notFound();
  const [[project], projectTasks] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, id)),
    db.select().from(tasks).where(eq(tasks.projectId, id)).orderBy(tasks.createdAt),
  ]);
  if (!project) notFound();

  const today = todayInIsrael();
  const from = `/projects/${id}`;
  const done = projectTasks.filter((t) => t.status === "done");
  const pct = projectTasks.length ? Math.round((done.length / projectTasks.length) * 100) : 0;
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
        <p className="hint">{done.length} מתוך {projectTasks.length} משימות הושלמו</p>
        {stuck && (
          <p className="warn-box"><AlertTriangle size={16} /> לפרויקט פעיל אין פעולה הבאה. מה הצעד הפיזי הבא?</p>
        )}
      </header>

      <details className="edit-project">
        <summary className="button"><Pencil size={15} /> עריכת פרויקט</summary>
        <form action={updateProject} className="stack">
          <input type="hidden" name="id" value={project.id} />
          <input name="name" defaultValue={project.name} required aria-label="שם" />
          <textarea name="outcome" rows={2} defaultValue={project.outcome ?? ""} placeholder="התוצאה הרצויה" aria-label="תוצאה רצויה" />
          <select name="status" defaultValue={project.status} aria-label="סטטוס">
            {projectStatus.enumValues.map((s) => (
              <option key={s} value={s}>{projectStatusLabels[s]}</option>
            ))}
          </select>
          <button className="primary">שמירה</button>
        </form>
        <form action={deleteProject}>
          <input type="hidden" name="id" value={project.id} />
          <button className="danger"><Trash2 size={15} /> מחיקת הפרויקט (המשימות יישארו)</button>
        </form>
      </details>

      <Capture status="next" projectId={project.id} placeholder="פעולה הבאה בפרויקט" />

      {openStatuses.map((s) => {
        const group = projectTasks.filter((t) => t.status === s);
        const Icon = listIcons[s];
        return (
          group.length > 0 && (
            <section key={s} className="bucket">
              <h2><Icon size={16} /> {taskStatusLabels[s]} <span className="head-count">{group.length}</span></h2>
              <ul className="cards">
                {group.map((t) => <TaskCard key={t.id} task={t} project={project} today={today} from={from} hideProject />)}
              </ul>
            </section>
          )
        );
      })}

      {done.length > 0 && (
        <details className="bucket done-bucket">
          <summary><h2>הושלמו <span className="head-count">{done.length}</span></h2></summary>
          <ul className="cards">
            {done.map((t) => <TaskCard key={t.id} task={t} project={project} today={today} from={from} hideProject />)}
          </ul>
        </details>
      )}
    </div>
  );
}
