import { asc, count } from "drizzle-orm";
import { db } from "@/db";
import { projects, projectStatus, tasks } from "@/db/schema";
import { createProject, deleteProject, updateProject } from "@/app/actions";
import { Nav } from "@/components/nav";
import { projectStatusLabels } from "@/lib/labels";
import { requireSession } from "@/lib/session";

export default async function ProjectsPage() {
  await requireSession();

  const [allProjects, taskCounts] = await Promise.all([
    db.select().from(projects).orderBy(asc(projects.name)),
    db
      .select({ projectId: tasks.projectId, status: tasks.status, n: count() })
      .from(tasks)
      .groupBy(tasks.projectId, tasks.status),
  ]);
  const countFor = (projectId: string, pick: (status: string) => boolean) =>
    taskCounts.filter((c) => c.projectId === projectId && pick(c.status)).reduce((sum, c) => sum + c.n, 0);

  return (
    <main>
      <Nav current="projects" />

      <form action={createProject} className="capture capture-project">
        <input name="name" placeholder="שם הפרויקט" required />
        <input name="outcome" placeholder="התוצאה הרצויה: איך ייראה 'בוצע'?" />
        <button className="primary">הוספה</button>
      </form>

      {projectStatus.enumValues.map((status) => {
        const list = allProjects.filter((p) => p.status === status);
        return (
          <section key={status} className="group">
            <h2>
              {projectStatusLabels[status]} <span className="count">{list.length}</span>
            </h2>
            {list.length === 0 ? (
              <p className="empty">אין פרויקטים</p>
            ) : (
              <ul className="tasks">
                {list.map((project) => {
                  const open = countFor(project.id, (s) => s !== "done");
                  const next = countFor(project.id, (s) => s === "next");
                  return (
                    <li key={project.id} className="task">
                      <details className="task-body">
                        <summary>
                          <span className="task-title">{project.name}</span>
                          <span className="meta">
                            <span className="chip">{open} פתוחות</span>
                            {status === "active" && next === 0 && (
                              <span className="chip chip-overdue">אין פעולה הבאה</span>
                            )}
                          </span>
                          {project.outcome && <span className="outcome">{project.outcome}</span>}
                        </summary>
                        <form action={updateProject} className="edit-form">
                          <input type="hidden" name="id" value={project.id} />
                          <label className="wide">
                            שם
                            <input name="name" defaultValue={project.name} required />
                          </label>
                          <label className="wide">
                            תוצאה רצויה
                            <textarea name="outcome" rows={2} defaultValue={project.outcome ?? ""} />
                          </label>
                          <label>
                            סטטוס
                            <select name="status" defaultValue={project.status}>
                              {projectStatus.enumValues.map((s) => (
                                <option key={s} value={s}>{projectStatusLabels[s]}</option>
                              ))}
                            </select>
                          </label>
                          <div className="actions wide">
                            <button className="primary">שמירה</button>
                          </div>
                        </form>
                        <form action={deleteProject} className="delete-form">
                          <input type="hidden" name="id" value={project.id} />
                          <button className="danger">מחיקת פרויקט (המשימות יישארו)</button>
                        </form>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}
