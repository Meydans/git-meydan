"use client";

import { Check } from "lucide-react";
import { setTaskStatus } from "@/app/actions";

type Props = { id: string; done: boolean; openSubtasks?: number; small?: boolean };

// Completing a parent also completes its open subtasks (a DB trigger does it), so ask first.
export function DoneButton({ id, done, openSubtasks = 0, small }: Props) {
  return (
    <form
      action={setTaskStatus}
      onSubmit={(e) => {
        if (!done && openSubtasks > 0 && !confirm(`להשלים גם ${openSubtasks} תתי־משימות פתוחות?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={done ? "next" : "done"} />
      <button className={small ? "mini-check" + (done ? " is-checked" : "") : "checkbox"} aria-label={done ? "החזרה לפעולות הבאות" : "סימון כהושלם"}>
        <Check size={small ? 11 : 14} strokeWidth={3} />
      </button>
    </form>
  );
}
