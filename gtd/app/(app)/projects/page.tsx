import Link from "next/link";
import { AlertTriangle, FolderKanban, Plus } from "lucide-react";
import { createProject } from "@/app/actions";
import { projectStatus, type Project } from "@/db/schema";
import { projectHue, projectStatusLabels } from "@/lib/labels";
import { projectsWithCounts } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  await requireSession();
  const { status: raw } = await searchParams;
  const status = projectStatus.enumValues.find((s) => s === raw) ?? "active";
  const all = await projectsWithCounts();
  const list = all.filter((p) => p.status === status);
  const tabCount = (s: Project["status"]) => all.filter((p) => p.status === s).length;

  return (
    <>
      <header className="page-head">
        <FolderKanban size={26} className="page-icon" />
        <div>
          <h1>פרויקטים</h1>
          <p className="hint">כל תוצאה שדורשת יותר מפעולה אחת. לכל פרויקט פעיל צריכה להיות פעולה הבאה.</p>
        </div>
      </header>

      <details className="new-project">
        <summary className="button"><Plus size={16} /> פרויקט חדש</summary>
        <form action={createProject} className="stack">
          <input name="name" placeholder="שם הפרויקט" required />
          <textarea name="outcome" rows={2} placeholder="התוצאה הרצויה: איך ייראה 'בוצע'?" />
          <button className="primary">יצירה</button>
        </form>
      </details>

      <nav className="tabs">
        {projectStatus.enumValues.map((s) => (
          <Link key={s} href={s === "active" ? "/projects" : `/projects?status=${s}`} aria-current={s === status ? "page" : undefined}>
            {projectStatusLabels[s]} <span className="head-count">{tabCount(s)}</span>
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <div className="empty-state">
          <FolderKanban size={40} strokeWidth={1.5} />
          <p>אין פרויקטים כאן</p>
        </div>
      ) : (
        <div className="project-grid">
          {list.map((p) => {
            const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
            const stuck = p.status === "active" && !p.byStatus.next;
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="project-card" style={{ "--hue": projectHue(p.id) } as React.CSSProperties}>
                <div className="project-card-head">
                  <span className="project-dot" />
                  <h2>{p.name}</h2>
                </div>
                {p.outcome && <p className="outcome">{p.outcome}</p>}
                <div className="progress" aria-label={`${pct}% הושלם`}>
                  <span style={{ width: `${pct}%` }} />
                </div>
                <div className="project-stats">
                  <span>{p.done}/{p.total} הושלמו</span>
                  {p.byStatus.next ? <span>{p.byStatus.next} הבאות</span> : null}
                  {p.byStatus.waiting ? <span>{p.byStatus.waiting} ממתינות</span> : null}
                  {stuck && (
                    <span className="warn"><AlertTriangle size={13} /> אין פעולה הבאה</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
