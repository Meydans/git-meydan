import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowRight, ChevronLeft, ClipboardCheck, ListOrdered, MoreHorizontal, Pencil, Shuffle, Trash2 } from "lucide-react";
import { deleteProject, markReviewed, setReviewCadence, setSequential, updateProject } from "@/app/actions";
import { Capture } from "@/components/capture";
import { OpenEditButton } from "@/components/project-client";
import { ProjectTaskGroup, ProjectTaskRow } from "@/components/project-tasks";
import { reviewBadge, reviewedLabel } from "@/components/review-meta";
import { StatusBar } from "@/components/status-bar";
import { projectStatus, type Task } from "@/db/schema";
import { projectHue, projectStatusLabels, todayInIsrael } from "@/lib/labels";
import { projectFocus } from "@/lib/next-action";
import { projectTasksOrdered } from "@/lib/queries";
import { healthOfProject } from "@/lib/review";
import { blockedIds } from "@/lib/sequence";
import { requireSession } from "@/lib/session";
import { idParam } from "@/lib/validation";

const CADENCES = [1, 3, 7, 14, 30, 60, 90];
const created = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", year: "numeric" });

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  await requireSession();
  const { id } = await params;
  if (!idParam.safeParse(id).success) notFound();
  const [project, projectTasks] = await Promise.all([healthOfProject(id), projectTasksOrdered(id)]);
  if (!project) notFound();

  const today = todayInIsrael();
  const from = `/projects/${id}`;
  const active = project.status === "active";
  const focus = (await projectFocus([project], today)).get(project.id)!;
  const badge = reviewBadge(project);
  const top = projectTasks.filter((t) => !t.parentId);
  const childrenOf = (parentId: string) => projectTasks.filter((t) => t.parentId === parentId);
  const blocked = blockedIds(top, project.sequential);
  const byStatus: Partial<Record<Task["status"], number>> = {};
  for (const t of projectTasks) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;

  const nextTop = top.filter((t) => t.status === "next" || t.status === "inbox");
  const waitingTop = top.filter((t) => t.status === "waiting");
  const somedayTop = top.filter((t) => t.status === "someday");
  const doneTop = top.filter((t) => t.status === "done");
  // Next actions held back by a sequence: blocked top-level ones, and later steps of sequential parents.
  const queued = nextTop.reduce((n, t) => n + (blocked.has(t.id) ? 1 : blockedIds(childrenOf(t.id), t.sequential).size), 0);

  const item = (t: Task, movable: boolean) => {
    const children = childrenOf(t.id);
    return children.length > 0 ? (
      <ProjectTaskGroup key={t.id} parent={t} subtasks={children} today={today} from={from} currentId={focus.nextAction?.id} blocked={blocked.has(t.id)} movable={movable} />
    ) : (
      <ProjectTaskRow key={t.id} task={t} today={today} from={from} current={t.id === focus.nextAction?.id} blocked={blocked.has(t.id)} movable={movable} />
    );
  };
  const reviewHref = `/review?step=projects&project=${project.id}`;

  return (
    <div className="project-page" style={{ "--hue": projectHue(project.id) } as React.CSSProperties}>
      <div className="project-mobile-bar">
        <Link href="/projects" className="back-link">
          <ArrowRight size={18} /> פרויקטים
        </Link>
        <details className="menu">
          <summary className="icon-button" aria-label="עוד פעולות">
            <MoreHorizontal size={22} />
          </summary>
          <div className="menu-panel">
            {active && (
              <Link href={reviewHref} className="menu-item">
                <ClipboardCheck size={15} /> סקור עכשיו
              </Link>
            )}
            <OpenEditButton />
          </div>
        </details>
      </div>

      <nav className="breadcrumb" aria-label="מיקום">
        <Link href="/projects">פרויקטים</Link> <ChevronLeft size={14} aria-hidden />
      </nav>

      <header className="project-hero">
        <div className="hero-text">
          <h1>
            <span className="project-dot" />
            {project.name}
            {badge && <span className={`review-badge${badge.due ? " due" : ""}`}>{badge.text}</span>}
            {!active && <span className="status-pill">{projectStatusLabels[project.status]}</span>}
          </h1>
          {project.outcome && (
            <p className="hero-outcome">
              <span className="field-caption">תוצאה רצויה</span> {project.outcome}
            </p>
          )}
        </div>
        <div className="hero-actions">
          <details className="edit-project" id="edit-project">
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
          {active && (
            <Link href={reviewHref} className="button review-now">
              <ClipboardCheck size={15} /> סקור עכשיו
            </Link>
          )}
        </div>
      </header>

      <input type="radio" name="ptab" id="ptab-tasks" className="ptab-radio" defaultChecked />
      <input type="radio" name="ptab" id="ptab-info" className="ptab-radio" />
      <div className="ptabs" role="tablist">
        <label htmlFor="ptab-tasks" role="tab">משימות</label>
        <label htmlFor="ptab-info" role="tab">מידע</label>
      </div>

      <div className="project-layout">
        <div className="project-main">
          {project.isStalled && (
            <p className="stalled-box">
              <AlertTriangle size={16} /> תקוע: אין פעולה הבאה זמינה. הוסף פעולה, או שנה סטטוס.
            </p>
          )}

          <section className="psection psection-next">
            <div className="psection-head">
              <h2>הבאות</h2>
              <span className="psection-meta">
                {focus.parallelNext} {focus.parallelNext === 1 ? "זמינה" : "זמינות"} עכשיו
                {queued > 0 ? ` · ${queued} ${queued === 1 ? "חסומה" : "חסומות"} בתור` : ""}
              </span>
              <form action={setSequential} className="sequence-toggle">
                <input type="hidden" name="kind" value="project" />
                <input type="hidden" name="id" value={project.id} />
                <input type="hidden" name="sequential" value={String(!project.sequential)} />
                <button className={project.sequential ? "on" : undefined} aria-pressed={project.sequential} title={project.sequential ? "ברצף: רק המשימה הראשונה פעילה" : "במקביל: כל המשימות פעילות"}>
                  {project.sequential ? <ListOrdered size={15} /> : <Shuffle size={15} />}
                  {project.sequential ? "ברצף" : "במקביל"}
                </button>
              </form>
            </div>
            {nextTop.length > 0 ? (
              <ul className="ptask-list">{nextTop.map((t) => item(t, true))}</ul>
            ) : (
              <p className="hint empty-line">אין פעולות הבאות. מה הצעד הפיזי הבא?</p>
            )}
          </section>

          {waitingTop.length > 0 && (
            <section className="psection psection-waiting">
              <div className="psection-head">
                <h2>ממתין ל…</h2>
                <span className="psection-meta">{waitingTop.length}</span>
              </div>
              <ul className="ptask-list">{waitingTop.map((t) => item(t, true))}</ul>
            </section>
          )}

          {somedayTop.length > 0 && (
            <details className="psection psection-someday">
              <summary className="psection-head">
                <h2>אולי / מתישהו</h2>
                <span className="psection-meta">
                  {somedayTop.length} · {somedayTop.slice(0, 3).map((t) => t.title).join(" · ")}
                </span>
              </summary>
              <ul className="ptask-list">{somedayTop.map((t) => item(t, true))}</ul>
            </details>
          )}

          {doneTop.length > 0 && (
            <details className="psection psection-done">
              <summary className="psection-head">
                <h2>הושלם</h2>
                <span className="psection-meta">{doneTop.length}</span>
              </summary>
              <ul className="ptask-list">{doneTop.map((t) => item(t, false))}</ul>
            </details>
          )}

          <div className="project-quick-add">
            <Capture status="next" projectId={project.id} placeholder="הוסף משימה… (למשל: להתקשר לשמאי @קצר)" />
          </div>
        </div>

        <aside className="project-side">
          <section className="side-card">
            <div className="side-card-head">
              <h3>התקדמות</h3>
              <span className="progress-pct">{projectTasks.length ? Math.round(((byStatus.done ?? 0) / projectTasks.length) * 100) : 0}%</span>
            </div>
            <StatusBar counts={byStatus} />
          </section>
          <section className="side-card">
            <h3>סקירה</h3>
            <dl className="side-facts">
              <div>
                <dt>תדירות</dt>
                <dd>
                  <form action={setReviewCadence} className="cadence">
                    <input type="hidden" name="id" value={project.id} />
                    <select name="reviewCadenceDays" defaultValue={project.reviewCadenceDays} aria-label="תדירות סקירה">
                      {(CADENCES.includes(project.reviewCadenceDays) ? CADENCES : [...CADENCES, project.reviewCadenceDays].sort((a, b) => a - b)).map((d) => (
                        <option key={d} value={d}>{d === 1 ? "כל יום" : `כל ${d} ימים`}</option>
                      ))}
                    </select>
                    <button>עדכון</button>
                  </form>
                </dd>
              </div>
              <div>
                <dt>נסקר לאחרונה</dt>
                <dd className={project.daysSinceReview === null || project.isDueForReview ? "warn-text" : undefined}>
                  {project.daysSinceReview === null ? "אף פעם" : reviewedLabel(project.daysSinceReview).replace("נסקר ", "")}
                </dd>
              </div>
              <div>
                <dt>נוצר</dt>
                <dd>{created.format(project.createdAt)}</dd>
              </div>
            </dl>
            {active && (
              <form action={markReviewed} className="review-line">
                <input type="hidden" name="id" value={project.id} />
                <button className={project.needsReview ? "primary" : undefined}>
                  <ClipboardCheck size={15} /> סומן כנסקר
                </button>
              </form>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
