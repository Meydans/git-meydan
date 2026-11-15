import Link from "next/link";
import { ArrowDown, ArrowUp, CalendarClock, CalendarDays, Check, CornerDownLeft, ListTree, Lock } from "lucide-react";
import { moveTask, setTaskContext, toggleChecklistItem } from "@/app/actions";
import { DoneButton } from "@/components/done-button";
import { contextIcons } from "@/components/icons";
import { taskContext, type Project, type Task } from "@/db/schema";
import { contextLabels, dueTone, projectHue, relativeDue, relativeStart, taskStatusLabels } from "@/lib/labels";
import { parseNotes } from "@/lib/notes";
import { LinkedText } from "@/components/linked-text";
import { blockedIds, readySubtasks } from "@/lib/sequence";

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
  pickContext?: boolean; // Next list: one-tap context for a task that has none
};

const MAX_NOTE_LINES = 6;

// A task's notes: text lines, and "- [ ] item" lines as checkboxes that can be ticked in place.
function Notes({ task, href }: { task: Task; href: string }) {
  const lines = task.notes ? parseNotes(task.notes).filter((l) => l.kind === "check" || l.text.trim()) : [];
  if (lines.length === 0) return null;
  const shown = lines.slice(0, MAX_NOTE_LINES);
  return (
    <div className="notes">
      {shown.map((line, i) =>
        line.kind === "check" ? (
          <form key={i} action={toggleChecklistItem} className="check-line">
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="line" value={line.index} />
            <button className={`mini-check${line.checked ? " is-checked" : ""}`} aria-label={line.checked ? "ביטול סימון" : "סימון"}>
              <Check size={11} strokeWidth={3} />
            </button>
            <span className={line.checked ? "struck" : undefined}><LinkedText text={line.text} /></span>
          </form>
        ) : (
          <p key={i}><LinkedText text={line.text} /></p>
        ),
      )}
      {lines.length > shown.length && <Link href={href} className="more">עוד…</Link>}
    </div>
  );
}

function ContextChip({ task }: { task: Task }) {
  if (!task.context) return null;
  const Icon = contextIcons[task.context];
  return (
    <span className={`chip ctx ctx-${task.context.slice(1)}`}>
      <Icon size={13} />
      {contextLabels[task.context]}
    </span>
  );
}

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

// Next actions are found by context, so a task without one gets a one-tap picker.
function ContextPicker({ id }: { id: string }) {
  return (
    <div className="ctx-picker">
      <span className="ctx-picker-label">איפה עושים את זה?</span>
      {taskContext.enumValues.map((c) => {
        const Icon = contextIcons[c];
        return (
          <form key={c} action={setTaskContext}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="context" value={c} />
            <button className={`chip ctx ctx-${c.slice(1)}`} aria-label={`הקשר: ${contextLabels[c]}`}>
              <Icon size={13} />
              {contextLabels[c]}
            </button>
          </form>
        );
      })}
    </div>
  );
}

export function TaskCard({ task, project, today, from, hideProject, subtasks = [], blocked, parentTitle, showStatus, movable, pickContext }: Props) {
  const done = task.status === "done";
  const lines = task.notes ? parseNotes(task.notes).filter((l) => l.kind === "check" || l.text.trim()) : [];
  const checks = lines.filter((l) => l.kind === "check");
  const checked = checks.filter((l) => l.kind === "check" && l.checked).length;
  const ContextIcon = task.context ? contextIcons[task.context] : null;
  const href = `/tasks/${task.id}?from=${encodeURIComponent(from)}`;
  const deferred = !done && task.startDate !== null && task.startDate > today;
  const subDone = subtasks.filter((s) => s.status === "done").length;
  const openSubtasks = subtasks.length - subDone;
  const subBlocked = blockedIds(subtasks, task.sequential);
  // The subtasks to do now: in Next, not deferred, not waiting their turn in a sequence.
  const ready = readySubtasks(task, subtasks, "next", today);
  const isParent = subtasks.length > 0;

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

        {lines.length > 0 &&
          (isParent ? (
            // A parent only groups the work: its description stays folded, the next steps show.
            <details className="notes-toggle">
              <summary>תיאור</summary>
              <Notes task={task} href={href} />
            </details>
          ) : (
            <Notes task={task} href={href} />
          ))}

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

        {pickContext && !done && <ContextPicker id={task.id} />}

        {ready.length > 0 && (
          <ul className="ready-subtasks" aria-label="הבאות לביצוע">
            {ready.map((sub) => {
              const subHref = `/tasks/${sub.id}?from=${encodeURIComponent(from)}`;
              return (
                <li key={sub.id} className="ready-subtask">
                  <DoneButton id={sub.id} done={false} />
                  <div className="ready-body">
                    <div className="ready-head">
                      <Link href={subHref} className="ready-title">{sub.title}</Link>
                      <ContextChip task={sub} />
                      {sub.dueDate && <span className={`chip due due-${dueTone(sub.dueDate, today)}`}>{relativeDue(sub.dueDate, today)}</span>}
                    </div>
                    <Notes task={sub} href={subHref} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {subtasks.length > 0 && (
          <details className="subtasks">
            <summary>
              <ListTree size={14} />
              <span>{ready.length > 0 ? "כל תתי־המשימות" : "תתי־משימות"} {subDone}/{subtasks.length}{task.sequential ? " · ברצף" : ""}</span>
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
