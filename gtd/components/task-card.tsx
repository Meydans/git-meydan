import Link from "next/link";
import { CalendarDays, Check } from "lucide-react";
import { setTaskStatus, toggleChecklistItem } from "@/app/actions";
import { contextIcons } from "@/components/icons";
import type { Project, Task } from "@/db/schema";
import { contextLabels, dueTone, projectHue, relativeDue } from "@/lib/labels";
import { parseNotes } from "@/lib/notes";

type Props = { task: Task; project?: Project; today: string; from: string; hideProject?: boolean };

const MAX_NOTE_LINES = 6;

export function TaskCard({ task, project, today, from, hideProject }: Props) {
  const done = task.status === "done";
  const lines = task.notes ? parseNotes(task.notes).filter((l) => l.kind === "check" || l.text.trim()) : [];
  const shown = lines.slice(0, MAX_NOTE_LINES);
  const checks = lines.filter((l) => l.kind === "check");
  const checked = checks.filter((l) => l.kind === "check" && l.checked).length;
  const ContextIcon = task.context ? contextIcons[task.context] : null;
  const href = `/tasks/${task.id}?from=${encodeURIComponent(from)}`;

  return (
    <li className={`card${done ? " card-done" : ""}`}>
      <form action={setTaskStatus}>
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="status" value={done ? "next" : "done"} />
        <button className="checkbox" aria-label={done ? "החזרה לפעולות הבאות" : "סימון כהושלם"}>
          <Check size={14} strokeWidth={3} />
        </button>
      </form>

      <div className="card-body">
        <Link href={href} className="card-title">{task.title}</Link>

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

        {(ContextIcon || task.dueDate || checks.length > 0) && (
          <div className="chips">
            {ContextIcon && task.context && (
              <span className={`chip ctx ctx-${task.context.slice(1)}`}>
                <ContextIcon size={13} />
                {contextLabels[task.context]}
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
      </div>
    </li>
  );
}
