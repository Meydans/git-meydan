import Link from "next/link";
import { ArrowLeft, Check, CheckCircle2, X } from "lucide-react";
import { markReviewed, setProjectStatus } from "@/app/actions";
import { Capture } from "@/components/capture";
import { OutcomeCheck } from "@/components/review-client";
import { ReviewMeta } from "@/components/review-meta";
import { TriageItem } from "@/components/triage";
import { projectStatus, type Task } from "@/db/schema";
import { projectHue, projectStatusLabels, relativeDue, todayInIsrael } from "@/lib/labels";
import { projectFocus } from "@/lib/next-action";
import { allProjects, listTasks, projectTasksOrdered } from "@/lib/queries";
import { projectHealth, queueOf, type ProjectHealth } from "@/lib/review";
import { blockedIds } from "@/lib/sequence";
import { calendarAhead, clearable, REVIEW_STEPS, stepCounts, stepLabels, type ReviewStep } from "@/lib/weekly-review";

export const metadata = { title: "GTD · סקירה שבועית" };

const href = (step: ReviewStep, project?: string) => `/review?step=${step}${project ? `&project=${project}` : ""}`;

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const sp = await searchParams;
  const today = todayInIsrael();
  const counts = await stepCounts(today);
  // Without a step, start at the first one that has something waiting.
  const step: ReviewStep =
    REVIEW_STEPS.find((s) => s === sp.step) ?? REVIEW_STEPS.find((s) => clearable(s) && counts[s] > 0) ?? "projects";
  const index = REVIEW_STEPS.indexOf(step);
  const nextStep = REVIEW_STEPS[index + 1];

  return (
    <div className="review-flow">
      <header className="review-top">
        <div className="review-brand">
          <span className="brand">GTD</span> <strong>סקירה שבועית</strong>
        </div>
        <nav className="stepper" aria-label="שלבי הסקירה">
          {REVIEW_STEPS.map((s, i) => {
            const clear = clearable(s) && counts[s] === 0;
            return (
              <Link key={s} href={href(s)} className={`step${s === step ? " current" : ""}${clear ? " clear" : ""}`} aria-current={s === step ? "step" : undefined}>
                {clear ? <Check size={14} /> : <span>{i + 1} ·</span>} {stepLabels[s]}
                {!clear && counts[s] > 0 && <span className="step-count">{counts[s]}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="step-mobile">
          <span>
            שלב {index + 1} מתוך {REVIEW_STEPS.length} · <strong>{stepLabels[step]}</strong>
          </span>
          <div className="step-bar" aria-hidden>
            {REVIEW_STEPS.map((s, i) => (
              <span key={s} className={i < index || (clearable(s) && counts[s] === 0) ? "done" : i === index ? "current" : undefined} />
            ))}
          </div>
        </div>
        <Link href="/projects" className="review-exit" aria-label="יציאה ושמירה">
          <span>יציאה ושמירה</span>
          <X size={20} />
        </Link>
      </header>

      {step === "projects" ? (
        <ProjectsStep projectId={first(sp.project)} today={today} nextStep={nextStep} />
      ) : (
        <ListStep step={step} today={today} nextStep={nextStep} />
      )}
    </div>
  );
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function StepFooter({ nextStep, children }: { nextStep?: ReviewStep; children?: React.ReactNode }) {
  return (
    <footer className="review-footer">
      {children ?? (
        <Link href={nextStep ? href(nextStep) : "/projects"} className="button primary">
          {nextStep ? <>המשך: {stepLabels[nextStep]} <ArrowLeft size={16} /></> : <>סיום הסקירה <Check size={16} /></>}
        </Link>
      )}
    </footer>
  );
}

const stepHints: Record<Exclude<ReviewStep, "projects">, string> = {
  inbox: "כל פריט: פעולה הבאה, ממתין, אולי, או שכבר בוצע. פרטים נוספים בלחיצה על הכותרת.",
  waiting: "לכל פריט: לדחוף עכשיו, לסגור, או לקבוע מתי לבדוק שוב (הוא יחזור לרשימה ביום הזה).",
  someday: "משהו מכאן מבשיל עכשיו? אפשר להעביר להבאות, או להפעיל פרויקט.",
  calendar: `מה מגיע ב־14 הימים הקרובים, כולל מה שבאיחור. כדאי לעבור גם על היומן.`,
};

async function ListStep({ step, today, nextStep }: { step: Exclude<ReviewStep, "projects">; today: string; nextStep?: ReviewStep }) {
  const from = href(step);
  const [rows, projects] = await Promise.all([
    step === "calendar" ? calendarAhead(today) : listTasks(step, {}, today),
    step === "someday" ? allProjects() : Promise.resolve([]),
  ]);
  const somedayProjects = projects.filter((p) => p.status === "someday");

  return (
    <>
      <main className="review-main single">
        <h1>{stepLabels[step]}</h1>
        <p className="hint">{stepHints[step]}</p>

        {rows.length === 0 && somedayProjects.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 size={40} strokeWidth={1.5} />
            <p>{step === "inbox" ? "התיבה ריקה." : step === "waiting" ? "אין פריטים שממתינים למעקב עכשיו." : "אין כאן כלום."}</p>
          </div>
        ) : step === "calendar" ? (
          <ul className="calendar-list">
            {rows.map((t) => (
              <li key={t.id}>
                <span className={`chip due ${t.dueDate! < today ? "due-overdue" : ""}`}>{relativeDue(t.dueDate!, today)}</span>
                <Link href={`/tasks/${t.id}?from=${encodeURIComponent(from)}`}>{t.title}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <ul className="triage-list">
              {rows.map((t, i) => (
                <TriageItem key={t.id} task={t} from={from} today={today} index={i} total={rows.length} />
              ))}
            </ul>
            {rows.length > 1 && <p className="swipe-hint">החלק ימינה / שמאלה למשימה הבאה</p>}
            {somedayProjects.length > 0 && (
              <section className="review-box">
                <h3>פרויקטים באולי / מתישהו</h3>
                <ul className="someday-projects">
                  {somedayProjects.map((p) => (
                    <li key={p.id} style={{ "--hue": projectHue(p.id) } as React.CSSProperties}>
                      <span className="project-dot" />
                      <Link href={`/projects/${p.id}`}>{p.name}</Link>
                      <form action={setProjectStatus}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="status" value="active" />
                        <button>להפעיל</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
      <StepFooter nextStep={nextStep} />
    </>
  );
}

async function ProjectsStep({ projectId, today, nextStep }: { projectId?: string; today: string; nextStep?: ReviewStep }) {
  const health = await projectHealth();
  const queue = queueOf(health);
  const reviewedToday = health.filter((p) => p.status === "active" && !p.needsReview && p.daysSinceReview === 0);
  const done = reviewedToday.length;
  // "Review now" from a project page may open a project that isn't due yet.
  const current = queue.find((p) => p.id === projectId) ?? health.find((p) => p.id === projectId && p.status === "active") ?? queue[0];

  if (!current) {
    return (
      <>
        <main className="review-main single">
          <div className="empty-state">
            <CheckCircle2 size={40} strokeWidth={1.5} />
            <p>כל הפרויקטים הפעילים מעודכנים{done ? `. ${done} נסקרו היום` : ""}.</p>
          </div>
        </main>
        <StepFooter nextStep={nextStep} />
      </>
    );
  }

  const position = queue.indexOf(current); // -1 when reviewing a project that isn't due
  const after = position === -1 ? queue[0] : queue[position + 1];
  const then = after ? href("projects", after.id) : nextStep ? href(nextStep) : "/projects";
  const from = href("projects", current.id);
  const open = (await projectTasksOrdered(current.id)).filter((t) => t.status !== "done");
  const top = open.filter((t) => !t.parentId);
  const blocked = blockedIds(top, current.sequential);
  const subtaskCount = (t: Task) => open.filter((c) => c.parentId === t.id).length;
  const focus = (await projectFocus([current], today)).get(current.id);

  return (
    <>
      <div className="review-body">
        <aside className="review-queue-side">
          <p className="queue-caption">
            {position === -1 ? "סקירה יזומה · לא בתור" : `פרויקטים לסקירה · ${position + 1} מתוך ${queue.length}`}
          </p>
          <ul>
            {queue.map((p, i) => (
              <li key={p.id}>
                <Link href={href("projects", p.id)} className={`queue-item${p.id === current.id ? " current" : ""}`} style={{ "--hue": projectHue(p.id) } as React.CSSProperties}>
                  <span className="project-dot" />
                  <span className="queue-name">{p.name}</span>
                  <span className="queue-tag">{p.id === current.id ? "עכשיו" : i === position + 1 ? "הבא" : p.isStalled ? "תקוע" : ""}</span>
                </Link>
              </li>
            ))}
            {reviewedToday.map((p) => (
              <li key={p.id}>
                <span className="queue-item reviewed" style={{ "--hue": projectHue(p.id) } as React.CSSProperties}>
                  <span className="project-dot" />
                  <span className="queue-name">{p.name}</span>
                  <span className="queue-tag">נסקר היום</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="progress queue-progress" aria-label={`${done} מתוך ${done + queue.length} נסקרו`}>
            <span style={{ width: `${Math.round((done / (done + queue.length)) * 100)}%` }} />
          </div>
        </aside>

        <main className="review-main">
          <p className="queue-caption mobile-only">{position === -1 ? "סקירה יזומה" : `פרויקט ${position + 1} מתוך ${queue.length}`}</p>
          <div className="review-project-head" style={{ "--hue": projectHue(current.id) } as React.CSSProperties}>
            <h1>
              <span className="project-dot" />
              <Link href={`/projects/${current.id}`}>{current.name}</Link>
            </h1>
            <p className="hint">
              {current.daysSinceReview === null ? "סקירה ראשונה" : `נסקר לפני ${current.daysSinceReview} ימים`} · {open.length} משימות פתוחות
            </p>
            <div className="review-head-meta">
              <ReviewMeta project={current} />
              <ProjectStatusForm project={current} />
            </div>
          </div>

          <OutcomeCheck key={current.id} projectId={current.id} outcome={current.outcome} />

          <section className="review-box">
            <h3>2. כל משימה במקום הנכון?</h3>
            {top.length === 0 ? (
              <p className="hint">אין משימות פתוחות בפרויקט.</p>
            ) : (
              <ul className="triage-list">
                {top.map((t, i) => (
                  <TriageItem key={t.id} task={t} from={from} today={today} index={i} total={top.length} blocked={blocked.has(t.id)} subtaskCount={subtaskCount(t)} />
                ))}
              </ul>
            )}
            {top.length > 1 && <p className="swipe-hint">החלק ימינה / שמאלה למשימה הבאה</p>}
          </section>

          {current.isStalled ? (
            <section className="review-box stalled">
              <h3>3. אין פעולה הבאה זמינה: הפרויקט תקוע.</h3>
              <p className="hint">מה הצעד הפיזי הבא? הוסף אותו כאן, או העבר את הפרויקט לאולי / הושלם / בוטל.</p>
              <Capture status="next" projectId={current.id} placeholder="הפעולה הבאה לפרויקט" />
            </section>
          ) : (
            <p className="review-box ok">
              <Check size={16} /> <strong>3. יש פעולה הבאה ברורה.</strong> {focus?.nextAction ? `"${focus.nextAction.title}"` : "הפרויקט לא תקוע."}
            </p>
          )}
        </main>
      </div>

      <StepFooter>
        <Link href={then} className="button skip">דלג</Link>
        <span className="footer-note">הסקירה הבאה: בעוד {current.reviewCadenceDays} ימים</span>
        <form action={markReviewed}>
          <input type="hidden" name="id" value={current.id} />
          <input type="hidden" name="returnTo" value={then} />
          <button className="primary">סמן כנסקר והמשך <ArrowLeft size={16} /></button>
        </form>
      </StepFooter>
    </>
  );
}

function ProjectStatusForm({ project }: { project: ProjectHealth }) {
  return (
    <form action={setProjectStatus} className="status-form">
      <input type="hidden" name="id" value={project.id} />
      <select name="status" defaultValue={project.status} aria-label="סטטוס הפרויקט">
        {projectStatus.enumValues.map((s) => (
          <option key={s} value={s}>{projectStatusLabels[s]}</option>
        ))}
      </select>
      <button>עדכון</button>
    </form>
  );
}
