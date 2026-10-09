import Link from "next/link";
import { CalendarClock, CalendarDays, Lock } from "lucide-react";
import { DoneButton } from "@/components/done-button";
import { contextIcons } from "@/components/icons";
import { MoveButtons } from "@/components/task-card";
import { FollowUpChips, waitingFor } from "@/components/triage";
import type { Task } from "@/db/schema";
import { contextLabels, dueTone, formatDate, relativeDue, relativeStart } from "@/lib/labels";
import { LinkedText } from "@/components/linked-text";
import { blockedIds } from "@/lib/sequence";

type RowProps = {
  task: Task;
  today: string;
  from: string;
  current?: boolean; // the project's next action right now
  blocked?: boolean; // waiting for an earlier task in a sequence
  movable?: boolean;
  openSubtasks?: number;
};

// One task on the project page: a compact row with checkbox, title and its chips.
export function ProjectTaskRow({ task, today, from, current, blocked, movable, openSubtasks }: RowProps) {
  const done = task.status === "done";
  const ContextIcon = task.context ? contextIcons[task.context] : null;
  const deferred = !done && task.startDate !== null && task.startDate > today;
  const wait = task.status === "waiting" ? waitingFor(task) : null;
  return (
    <li className={`ptask${current ? " is-current" : ""}${blocked ? " is-blocked" : ""}${done ? " is-done" : ""}`}>
      <DoneButton id={task.id} done={done} openSubtasks={openSubtasks} />
      <div className="ptask-body">
        <Link href={`/tasks/${task.id}?from=${encodeURIComponent(from)}`} className="ptask-title">
          {blocked && <Lock size={13} className="lock" aria-label="חסום" />}
          {task.title}
        </Link>
        {wait && <span className="ptask-sub"><LinkedText text={wait} /></span>}
      </div>
      <div className="ptask-meta">
        {current && <span className="now-tag">עכשיו</span>}
        {task.status === "inbox" && <span className="status-tag tag-inbox">איסוף</span>}
        {deferred && task.status !== "waiting" && (
          <span className="chip deferred">
            <CalendarClock size={12} /> {relativeStart(task.startDate!, today)}
          </span>
        )}
        {task.dueDate && !done && (
          <span className={`chip due due-${dueTone(task.dueDate, today)}`}>
            <CalendarDays size={12} /> {relativeDue(task.dueDate, today)}
          </span>
        )}
        {ContextIcon && task.context && (
          <span className={`chip ctx ctx-${task.context.slice(1)}`}>
            <ContextIcon size={12} />
            {contextLabels[task.context]}
          </span>
        )}
      </div>
      {task.status === "waiting" && (
        <div className="ptask-follow">
          <span className="follow-date">מעקב: {task.startDate ? formatDate(task.startDate) : "—"}</span>
          <details className="follow-pop">
            <summary className="chip-amber">{task.startDate ? "שינוי מעקב" : "קבע מעקב"}</summary>
            <FollowUpChips id={task.id} today={today} />
          </details>
        </div>
      )}
      {movable && !done && <MoveButtons id={task.id} />}
    </li>
  );
}

type GroupProps = { parent: Task; subtasks: Task[]; today: string; from: string; currentId?: string; blocked?: boolean; movable?: boolean };

// A parent with its subtasks, as one box. In a sequential parent only the first open step is
// actionable; the rest are shown locked.
export function ProjectTaskGroup({ parent, subtasks, today, from, currentId, blocked, movable }: GroupProps) {
  const done = subtasks.filter((s) => s.status === "done").length;
  const subBlocked = blockedIds(subtasks, parent.sequential);
  return (
    <li className={`ptask-group${blocked ? " is-blocked" : ""}`}>
      <div className="group-head">
        <span className="group-kind">{parent.sequential ? "רצף" : "תתי־משימות"}</span>
        <Link href={`/tasks/${parent.id}?from=${encodeURIComponent(from)}`} className="group-title">
          {blocked && <Lock size={13} className="lock" aria-label="חסום" />}
          {parent.title}
        </Link>
        <span className="group-count">{done}/{subtasks.length}</span>
        {movable && parent.status !== "done" && <MoveButtons id={parent.id} />}
      </div>
      <ul className="ptask-list">
        {subtasks.map((s) => (
          <ProjectTaskRow key={s.id} task={s} today={today} from={from} current={s.id === currentId} blocked={blocked || subBlocked.has(s.id)} />
        ))}
      </ul>
    </li>
  );
}
