import Link from "next/link";
import { ArrowDown, ArrowUp, CalendarClock, CalendarDays, Check, CornerDownLeft, ListTree, Lock } from "lucide-react";
import { moveTask, toggleChecklistItem } from "@/app/actions";
import { DoneButton } from "@/components/done-button";
import { contextIcons } from "@/components/icons";
import type { Project, Task } from "@/db/schema";
import { contextLabels, dueTone, projectHue, relativeDue, relativeStart, taskStatusLabels } from "@/lib/labels";
import { parseNotes } from "@/lib/notes";
import { blockedIds } from "@/lib/sequence";

type Props = {
  task: Task;
  project?: Project;
  today: string;
  from: string;
  hideProject?: boolean;
  subtasks?: Task[]; // children of this task, in manual order
  blocked?: boolean; // held back by a sequential project or parent
  parentTitle?: string; // for subtasks shown on their own (date views)
  showStatus?: boolean; // project page: one list across statuses
  movable?: boolean; // project page: manual order arrows
};

const MAX_NOTE_LINES = 6;

export function MoveButtons({ id }: { id: string }) {
  return (
    <div className="move">
      {(["up", "down"] as const).map((direction) => (
        <form key={direction} action={moveTask}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="direction" value={direction} />
          <button className="icon-button" aria-label={direction === "up" ? "הזזה למעלה" : "הזזה למטה"}>
            {direction === "up" ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          </button>
        </form>
      ))}
    </div>
  );
}

export function TaskCard({ task, project, today, from, hideProject, subtasks = [], blocked, parentTitle, showStatus, movable }: Props) {
  const done = task.status === "done";
  const lines = task.notes ? parseNotes(task.notes).filter((l) => l.kind === "check" || l.text.trim()) : [];
  const shown = lines.slice(0, MAX_NOTE_LINES);
  const checks = lines.filter((l) => l.kind === "check");
  const checked = checks.filter((l) => l.kind === "check" && l.checked).length;
  const ContextIcon = task.context ? contextIcons[task.context] : null;
  const href = `/tasks/${task.id}?from=${encodeURIComponent(from)}`;
  const deferred = !done && task.startDate !== null && task.startDate > today;
  const subDone = subtasks.filter((s) => s.status === "done").length;
  const openSubtasks = subtasks.length - subDone;
  const subBlocked = blockedIds(subtasks, task.sequential);

  return (
    <li className={`card${done ? " card-done" : ""}${deferred ? " card-deferred" : ""}${blocked ? " card-blocked" : ""}`}>
      <DoneButton id={task.id} done={done} openSubtasks={openSubtasks} />

      <div className="card-body">
        {parentTitle && task.parentId && (
          <Link href={`/tasks/${task.parentId}?from=${encodeURIComponent(from)}`} className="parent-link">
            <CornerDownLeft size={12} /> {parentTitle}
          </Link>
        )}
        <Link href={href} className="card-title">
          {blocked && <Lock size={14} className="lock" aria-label="חסום" />}
          {task.title}
        </Link>

        {project && !hideProject && (
          <Link href={`/projects/${project.id}`} className="project-link" style={{ "--hue": projectHue(project.id) } as React.CSSProperties}>
            {project.name}
          </Link>
        )}

        {shown.length > 0 && (
          <div className="notes">
            {shown.map((line, i) =>
              line.kind === "check" ? (
                <form key={i} action={toggleChecklistItem} className="check-line">
                  <input type="hidden" name="id" value={task.id} />
                  <input type="hidden" name="line" value={line.index} />
                  <button className={`mini-check${line.checked ? " is-checked" : ""}`} aria-label={line.checked ? "ביטול סימון" : "סימון"}>
                    <Check size={11} strokeWidth={3} />
                  </button>
                  <span className={line.checked ? "struck" : undefined}>{line.text}</span>
                </form>
              ) : (
                <p key={i}>{line.text}</p>
              ),
            )}
            {lines.length > shown.length && <Link href={href} className="more">עוד…</Link>}
          </div>
        )}

        {(ContextIcon || task.dueDate || deferred || checks.length > 0 || showStatus || blocked) && (
          <div className="chips">
            {showStatus && !done && <span className={`chip status status-${task.status}`}>{taskStatusLabels[task.status]}</span>}
            {blocked && (
              <span className="chip blocked">
                <Lock size={12} /> אחרי הקודמת
              </span>
            )}
            {ContextIcon && task.context && (
              <span className={`chip ctx ctx-${task.context.slice(1)}`}>
                <ContextIcon size={13} />
                {contextLabels[task.context]}
              </span>
            )}
            {deferred && (
              <span className="chip deferred">
                <CalendarClock size={13} />
                {relativeStart(task.startDate!, today)}
              </span>
            )}
            {task.dueDate && (
              <span className={`chip due due-${done ? "later" : dueTone(task.dueDate, today)}`}>
                <CalendarDays size={13} />
                {relativeDue(task.dueDate, today)}
              </span>
            )}
            {checks.length > 0 && (
              <span className="chip">
                <Check size={13} />
                {checked}/{checks.length}
              </span>
            )}
          </div>
        )}

        {subtasks.length > 0 && (
          <details className="subtasks">
            <summary>
              <ListTree size={14} />
              <span>{subDone}/{subtasks.length} תתי־משימות{task.sequential ? " · ברצף" : ""}</span>
              <span className="subtask-progress" aria-hidden>
                <span style={{ width: `${Math.round((subDone / subtasks.length) * 100)}%` }} />
              </span>
            </summary>
            <ul>
              {subtasks.map((sub) => (
                <li key={sub.id} className={`subtask${sub.status === "done" ? " is-done" : ""}${subBlocked.has(sub.id) ? " is-blocked" : ""}`}>
                  <DoneButton id={sub.id} done={sub.status === "done"} small />
                  <Link href={`/tasks/${sub.id}?from=${encodeURIComponent(from)}`}>
                    {subBlocked.has(sub.id) && <Lock size={12} className="lock" aria-label="חסום" />}
                    {sub.title}
                  </Link>
                  {sub.dueDate && sub.status !== "done" && (
                    <span className={`chip due due-${dueTone(sub.dueDate, today)}`}>{relativeDue(sub.dueDate, today)}</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {movable && !done && <MoveButtons id={task.id} />}
    </li>
  );
}
