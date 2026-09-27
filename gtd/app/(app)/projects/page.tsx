import Link from "next/link";
import { AlertTriangle, FolderKanban, Plus } from "lucide-react";
import { createProject } from "@/app/actions";
import { contextIcons } from "@/components/icons";
import { reviewBadge } from "@/components/review-meta";
import { StatusBar, StatusKey } from "@/components/status-bar";
import { projectStatus, type Project } from "@/db/schema";
import { contextLabels, projectHue, projectStatusLabels } from "@/lib/labels";
import { projectFocus } from "@/lib/next-action";
import { projectsWithCounts } from "@/lib/queries";
import { projectHealth } from "@/lib/review";
import { requireSession } from "@/lib/session";

// More next actions than this, side by side and with nothing done yet, is a hint to pick one.
const MANY_PARALLEL = 3;

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  await requireSession();
  const { status: raw } = await searchParams;
  const status = projectStatus.enumValues.find((s) => s === raw) ?? "active";
  const [all, health] = await Promise.all([projectsWithCounts(), projectHealth()]);
  const healthById = new Map(health.map((h) => [h.id, h]));
  const list = all.filter((p) => p.status === status);
  const focus = await projectFocus(status === "active" ? list : []);
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
        <summary className="button primary"><Plus size={16} /> פרויקט חדש</summary>
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
            const h = healthById.get(p.id);
            const badge = h ? reviewBadge(h) : null;
            const f = focus.get(p.id);
            const next = f?.nextAction;
            const ContextIcon = next?.context ? contextIcons[next.context] : null;
            const tooMany = !!f && f.parallelNext > MANY_PARALLEL && p.done === 0;
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className={`project-card${badge?.due ? " needs-review" : ""}`}
                style={{ "--hue": projectHue(p.id) } as React.CSSProperties}
              >
                <div className="project-card-head">
                  <span className="project-dot" />
                  <h2>{p.name}</h2>
                  {badge && (
                    <span className={`review-badge${badge.due ? " due" : ""}`} title={badge.text}>
                      <span>{badge.text}</span>
                    </span>
                  )}
                </div>
                {p.outcome && <p className="outcome clamp">{p.outcome}</p>}
                {status === "active" &&
                  (next ? (
                    <div className="next-inset">
                      <span className="inset-label">הפעולה הבאה{f.parent ? ` · ${f.parent.title}` : ""}</span>
                      <div className="next-row">
                        <span className="next-title">{next.title}</span>
                        {ContextIcon && next.context && (
                          <span className={`chip ctx ctx-${next.context.slice(1)}`}>
                            <ContextIcon size={13} />
                            {contextLabels[next.context]}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    h?.isStalled && (
                      <div className="next-inset stalled">
                        <AlertTriangle size={15} /> אין פעולה הבאה זמינה: הפרויקט תקוע
                      </div>
                    )
                  ))}
                <StatusBar counts={p.byStatus} />
                {tooMany && <p className="soft-warn">{f.parallelNext} פעולות &quot;הבאות&quot; במקביל – לבחור אחת?</p>}
              </Link>
            );
          })}
          <StatusKey />
        </div>
      )}
    </>
  );
}
