import Link from "next/link";
import { Lock } from "lucide-react";
import { setFollowUp, setTaskStatus } from "@/app/actions";
import { contextIcons } from "@/components/icons";
import { KeepButton } from "@/components/review-client";
import type { Task } from "@/db/schema";
import { contextLabels, relativeDue } from "@/lib/labels";

const TARGETS = [
  ["done", "הושלם"],
  ["next", "להבאות"],
  ["waiting", "ממתין"],
  ["someday", "אולי"],
] as const;

const tagLabels: Record<Task["status"], string> = { inbox: "איסוף", next: "הבאה", waiting: "ממתין", someday: "אולי", done: "הושלם" };

// The "ממתין ל: …" line a waiting item carries in its notes, if any.
export function waitingFor(task: Task) {
  const line = task.notes?.split("\n").find((l) => l.trim().startsWith("ממתין ל"));
  return line?.trim() ?? null;
}

type Props = { task: Task; from: string; today: string; index: number; total: number; blocked?: boolean; subtaskCount?: number };

// One task in the weekly review: keep it where it is, or move it in one click. A waiting item
// with no follow-up date also asks when to check again.
export function TriageItem({ task, from, today, index, total, blocked, subtaskCount }: Props) {
  const ContextIcon = task.context ? contextIcons[task.context] : null;
  const wait = task.status === "waiting" ? waitingFor(task) : null;
  const needsFollowUp = task.status === "waiting" && !task.startDate;
  return (
    <li className={`triage-item is-${task.status}`}>
      <div className="triage-main">
        <span className="triage-count">משימה {index + 1} מתוך {total}</span>
        <div className="triage-head">
          <span className={`status-tag tag-${task.status}`}>{tagLabels[task.status]}</span>
          <Link href={`/tasks/${task.id}?from=${encodeURIComponent(from)}`} className="triage-title">
            {blocked && <Lock size={13} className="lock" aria-label="חסום" />}
            {task.title}
          </Link>
          {ContextIcon && task.context && (
            <span className={`chip ctx ctx-${task.context.slice(1)}`}>
              <ContextIcon size={13} />
              {contextLabels[task.context]}
            </span>
          )}
        </div>
        {(wait || subtaskCount || task.dueDate) && (
          <p className="triage-sub">
            {[wait, subtaskCount ? `${subtaskCount} תתי־משימות` : null, task.dueDate ? `יעד: ${relativeDue(task.dueDate, today)}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      <div className="triage-buttons">
        <KeepButton />
        {TARGETS.filter(([s]) => s !== task.status).map(([status, label]) => (
          <form key={status} action={setTaskStatus}>
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="status" value={status} />
            <button className={`triage-${status}`}>{label}</button>
          </form>
        ))}
      </div>

      {needsFollowUp && (
        <div className="follow-up">
          <span>אין תאריך מעקב. מתי לבדוק שוב?</span>
          <FollowUpChips id={task.id} today={today} />
        </div>
      )}
    </li>
  );
}

// When to check a waiting item again: tomorrow, in a week, or a date (becomes its start date).
export function FollowUpChips({ id, today }: { id: string; today: string }) {
  return (
    <div className="follow-up-chips">
      {([[1, "מחר"], [7, "בעוד שבוע"]] as const).map(([days, label]) => (
        <form key={days} action={setFollowUp}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="days" value={days} />
          <button className={days === 7 ? "chip-amber on" : "chip-amber"}>{label}</button>
        </form>
      ))}
      <form action={setFollowUp} className="follow-up-date">
        <input type="hidden" name="id" value={id} />
        <input type="date" name="date" min={today} aria-label="תאריך מעקב" required />
        <button className="chip-amber">קבע</button>
      </form>
    </div>
  );
}
