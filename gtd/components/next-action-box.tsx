import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { contextIcons } from "@/components/icons";
import type { Task } from "@/db/schema";
import { contextLabels } from "@/lib/labels";
import { LinkedText } from "@/components/linked-text";
import type { ProjectFocus } from "@/lib/next-action";

// Folded, a few actions show; the rest appear when the box is opened.
const FOLDED = 3;

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

// A project card's "next action": one line per action, cut with an ellipsis. Tapping the box
// opens it to show the full titles, their notes, and a link to each task.
export function NextActionBox({ focus, from }: { focus: ProjectFocus; from: string }) {
  const { actions, parent } = focus;
  const extra = actions.length - FOLDED;
  return (
    <details className="next-inset">
      <summary>
        <span className="inset-label">
          הפעולה הבאה{parent ? ` · ${parent.title}` : ""}
          {actions.length > 1 ? ` · ${actions.length} במקביל` : ""}
        </span>
        {actions.map((t, i) => (
          <span key={t.id} className={`next-row${i >= FOLDED ? " folded-extra" : ""}`}>
            <span className="next-title">{t.title}</span>
            <ContextChip task={t} />
          </span>
        ))}
        <span className="inset-more">
          {extra > 0 && <span className="more-count">ועוד {extra}</span>}
          <ChevronDown size={16} aria-hidden />
          <span className="sr-only">פרטים</span>
        </span>
      </summary>
      <div className="inset-details">
        {actions.map((t) => (
          <div key={t.id} className="inset-detail">
            {t.notes && <p className="inset-notes"><LinkedText text={t.notes} /></p>}
            <Link href={`/tasks/${t.id}?from=${encodeURIComponent(from)}`} className="inset-link">
              {actions.length > 1 ? `לפתוח את "${t.title}"` : "לפתוח את המשימה"} ←
            </Link>
          </div>
        ))}
      </div>
    </details>
  );
}
