import Link from "next/link";
import { CheckCircle2, ClipboardCheck, Lock } from "lucide-react";
import { markReviewed, setProjectStatus } from "@/app/actions";
import { Capture } from "@/components/capture";
import { DoneButton } from "@/components/done-button";
import { ReviewMeta, StalledWarning } from "@/components/review-meta";
import { projectStatus, type Task } from "@/db/schema";
import { projectHue, projectStatusLabels, taskStatusLabels } from "@/lib/labels";
import { projectTasksOrdered } from "@/lib/queries";
import { projectHealth, queueOf } from "@/lib/review";
import { blockedIds } from "@/lib/sequence";
import { requireSession } from "@/lib/session";

export const metadata = { title: "GTD · סקירה" };

// The review queue: only projects that need attention (due for review, or newly stalled).
export default async function ReviewPage() {
  await requireSession();
  const health = await projectHealth();
  const queue = queueOf(health);
  const healthy = health.filter((p) => p.status === "active" && !p.needsReview).length;
  const tasksByProject = new Map<string, Task[]>(
    await Promise.all(queue.map(async (p) => [p.id, (await projectTasksOrdered(p.id)).filter((t) => !t.parentId && t.status !== "done")] as const)),
  );

  return (
    <>
      <header className="page-head">
        <ClipboardCheck size={26} className="page-icon" />
        <div>
          <h1>
            סקירת פרויקטים <span className="head-count">{queue.length}</span>
          </h1>
          <p className="hint">פרויקטים שהגיע זמן לסקור, או שנתקעו בלי פעולה הבאה. לכל אחד: ודא שיש צעד הבא, עדכן סטטוס, וסמן שנסקר.</p>
        </div>
      </header>

      {queue.length === 0 ? (
        <div className="empty-state">
          <CheckCircle2 size={40} strokeWidth={1.5} />
          <p>כל הפרויקטים הפעילים מעודכנים{healthy ? ` (${healthy})` : ""}. אין מה לסקור כרגע.</p>
        </div>
      ) : (
        <ul className="review-queue">
          {queue.map((p) => {
            const open = tasksByProject.get(p.id) ?? [];
            const blocked = blockedIds(open, p.sequential);
            return (
              <li key={p.id} className={`review-card${p.isStalled ? " is-stalled" : ""}`} style={{ "--hue": projectHue(p.id) } as React.CSSProperties}>
                <div className="project-card-head">
                  <span className="project-dot" />
                  <h2><Link href={`/projects/${p.id}`}>{p.name}</Link></h2>
                </div>
                {p.outcome && <p className="outcome">🎯 {p.outcome}</p>}
                <ReviewMeta project={p} />
                {p.isStalled && <StalledWarning />}

                {open.length > 0 ? (
                  <ul className="review-tasks">
                    {open.map((t) => (
                      <li key={t.id} className={blocked.has(t.id) ? "is-blocked" : undefined}>
                        <DoneButton id={t.id} done={false} small />
                        <Link href={`/tasks/${t.id}?from=%2Freview`}>
                          {blocked.has(t.id) && <Lock size={12} className="lock" />}
                          {t.title}
                        </Link>
                        <span className={`chip status status-${t.status}`}>{taskStatusLabels[t.status]}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="hint">אין משימות פתוחות בפרויקט.</p>
                )}

                <Capture status="next" projectId={p.id} placeholder="פעולה הבאה לפרויקט הזה" />

                <div className="review-actions">
                  <form action={setProjectStatus} className="status-form">
                    <input type="hidden" name="id" value={p.id} />
                    <select name="status" defaultValue={p.status} aria-label="סטטוס הפרויקט">
                      {projectStatus.enumValues.map((s) => (
                        <option key={s} value={s}>{projectStatusLabels[s]}</option>
                      ))}
                    </select>
                    <button>עדכון סטטוס</button>
                  </form>
                  <form action={markReviewed}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="primary">
                      <ClipboardCheck size={16} /> סומן כנסקר
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
