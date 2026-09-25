import { Plus } from "lucide-react";
import { createTask } from "@/app/actions";
import type { Task } from "@/db/schema";

type Props = { status: Task["status"]; projectId?: string; placeholder: string; autoFocus?: boolean };

export function Capture({ status, projectId, placeholder, autoFocus }: Props) {
  return (
    <form action={createTask} className="capture">
      <input type="hidden" name="status" value={status} />
      {projectId && <input type="hidden" name="projectId" value={projectId} />}
      <Plus size={20} className="capture-icon" aria-hidden />
      <input name="title" placeholder={placeholder} required autoComplete="off" autoFocus={autoFocus} />
      <button className="primary">הוספה</button>
    </form>
  );
}
