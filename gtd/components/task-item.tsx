import { deleteTask, setTaskStatus, updateTask } from "@/app/actions";
import type { Project, Task } from "@/db/schema";
import { taskContext, taskStatus } from "@/db/schema";
import { contextLabels, formatDate, taskStatusLabels } from "@/lib/labels";

type Props = { task: Task; projects: Project[]; today: string };

export function TaskItem({ task, projects, today }: Props) {
  const done = task.status === "done";
  const project = projects.find((p) => p.id === task.projectId);
  const overdue = !done && task.dueDate !== null && task.dueDate < today;

  return (
    <li className={`task${done ? " task-done" : ""}`}>
      <form action={setTaskStatus}>
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="status" value={done ? "next" : "done"} />
        <button className="check" aria-label={done ? "החזרה לפעולות הבאות" : "סימון כהושלם"}>
          {done ? "✓" : ""}
        </button>
      </form>

      <details className="task-body">
        <summary>
          <span className="task-title">{task.title}</span>
          <span className="meta">
            {task.context && <span className="chip">{contextLabels[task.context]}</span>}
            {project && <span className="chip chip-project">{project.name}</span>}
            {task.dueDate && (
              <span className={`chip${overdue ? " chip-overdue" : ""}`}>{formatDate(task.dueDate)}</span>
            )}
            {task.notes && <span className="chip" title="יש הערות">📝</span>}
          </span>
        </summary>

        <form action={updateTask} className="edit-form">
          <input type="hidden" name="id" value={task.id} />
          <label className="wide">
            כותרת
            <input name="title" defaultValue={task.title} required />
          </label>
          <label>
            סטטוס
            <select name="status" defaultValue={task.status}>
              {taskStatus.enumValues.map((s) => (
                <option key={s} value={s}>{taskStatusLabels[s]}</option>
              ))}
            </select>
          </label>
          <label>
            הקשר
            <select name="context" defaultValue={task.context ?? ""}>
              <option value="">—</option>
              {taskContext.enumValues.map((c) => (
                <option key={c} value={c}>{contextLabels[c]}</option>
              ))}
            </select>
          </label>
          <label>
            פרויקט
            <select name="projectId" defaultValue={task.projectId ?? ""}>
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label>
            תאריך יעד
            <input type="date" name="dueDate" defaultValue={task.dueDate ?? ""} />
          </label>
          <label className="wide">
            הערות
            <textarea name="notes" rows={3} defaultValue={task.notes ?? ""} />
          </label>
          <div className="actions wide">
            <button className="primary">שמירה</button>
          </div>
        </form>
        <form action={deleteTask} className="delete-form">
          <input type="hidden" name="id" value={task.id} />
          <button className="danger">מחיקת משימה</button>
        </form>
      </details>
    </li>
  );
}
