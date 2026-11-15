"use client";

import { Check } from "lucide-react";
import { completeTask, setTaskStatus } from "@/app/actions";
import { celebrate, confettiAt } from "@/components/celebrate";

type Props = { id: string; done: boolean; openSubtasks?: number; small?: boolean };

// Completing a parent also completes its open subtasks (a DB trigger does it), so ask first.
// Completing pops a little confetti and a toast; reopening is quiet.
export function DoneButton({ id, done, openSubtasks = 0, small }: Props) {
  return (
    <form
      action={async (formData) => {
        if (done) return setTaskStatus(formData);
        const { projectCleared } = await completeTask(id);
        celebrate(projectCleared);
      }}
      onSubmit={(e) => {
        if (!done && openSubtasks > 0 && !confirm(`להשלים גם ${openSubtasks} תתי־משימות פתוחות?`)) return e.preventDefault();
        if (!done) confettiAt(e.currentTarget.querySelector("button")!);
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
