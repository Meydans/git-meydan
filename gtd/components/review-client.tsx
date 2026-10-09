"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { LinkedText } from "@/components/linked-text";
import { setProjectOutcome } from "@/app/actions";

// "Keep" changes nothing. In the phone carousel (one task per card) it moves on to the next card.
export function KeepButton() {
  return (
    <button
      type="button"
      className="triage-keep"
      aria-pressed="true"
      onClick={(e) => {
        const item = e.currentTarget.closest(".triage-item");
        const list = item?.parentElement;
        const next = item?.nextElementSibling;
        if (list && next && list.scrollWidth > list.clientWidth) next.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }}
    >
      להשאיר
    </button>
  );
}

// Step 1 of a project's review: is the desired outcome still right? Yes, or edit it in place.
export function OutcomeCheck({ projectId, outcome }: { projectId: string; outcome: string | null }) {
  const [state, setState] = useState<"ask" | "ok" | "edit">(outcome ? "ask" : "edit");
  if (state === "ok")
    return (
      <p className="outcome-ok">
        <Check size={16} /> התוצאה הרצויה אושרה{outcome ? `: ${outcome}` : ""}
      </p>
    );
  return (
    <section className="review-box">
      <div className="review-box-head">
        <h3>1. התוצאה הרצויה עדיין נכונה?</h3>
        {state === "ask" && (
          <div className="review-box-actions">
            <button className="yes" onClick={() => setState("ok")}>כן</button>
            <button onClick={() => setState("edit")}>לעדכן</button>
          </div>
        )}
      </div>
      {state === "ask" ? (
        <p className="outcome">{outcome && <LinkedText text={outcome} />}</p>
      ) : (
        <form action={async (fd) => { await setProjectOutcome(fd); setState("ok"); }} className="outcome-form">
          <input type="hidden" name="id" value={projectId} />
          <textarea name="outcome" rows={2} defaultValue={outcome ?? ""} placeholder="איך ייראה 'בוצע'?" autoFocus />
          <button className="primary">שמירה</button>
        </form>
      )}
    </section>
  );
}
