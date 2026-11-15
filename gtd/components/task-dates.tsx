"use client";

import { useState } from "react";
import { addDays } from "@/lib/labels";

type Props = { startDate: string | null; dueDate: string | null; today: string };

// Next Sunday: the start of the Israeli week.
function nextSunday(today: string) {
  const day = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDays(today, 7 - day);
}

function DateInput({ name, value, onChange, min, max, presets }: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  presets: { label: string; date: string }[];
}) {
  return (
    <div className="due-field">
      <input type="date" name={name} value={value} min={min || undefined} max={max || undefined} onChange={(e) => onChange(e.target.value)} />
      <div className="presets">
        {presets.map((p) => (
          <button type="button" key={p.label} className={`chip-toggle${value === p.date ? " on" : ""}`} onClick={() => onChange(p.date)}>
            {p.label}
          </button>
        ))}
        {value && (
          <button type="button" className="chip-toggle clear" onClick={() => onChange("")}>ללא</button>
        )}
      </div>
    </div>
  );
}

// Start and due dates, bounded by each other so the browser blocks start > due before submit.
export function TaskDates({ startDate, dueDate, today }: Props) {
  const [start, setStart] = useState(startDate ?? "");
  const [due, setDue] = useState(dueDate ?? "");
  const deferred = start !== "" && start > today;

  return (
    <>
      <div className="field">
        <span className="field-label">תאריך התחלה</span>
        <DateInput
          name="startDate"
          value={start}
          onChange={setStart}
          max={due}
          presets={[
            { label: "מחר", date: addDays(today, 1) },
            { label: "יום א׳ הבא", date: nextSunday(today) },
            { label: "בעוד שבוע", date: addDays(today, 7) },
            { label: "בעוד חודש", date: addDays(today, 30) },
          ]}
        />
        <span className="field-hint">
          {deferred ? "המשימה תוסתר מהרשימות עד תאריך ההתחלה." : "ללא תאריך: המשימה זמינה כבר עכשיו."}
        </span>
      </div>
      <div className="field">
        <span className="field-label">תאריך יעד</span>
        <DateInput
          name="dueDate"
          value={due}
          onChange={setDue}
          min={start}
          presets={[
            { label: "היום", date: today },
            { label: "מחר", date: addDays(today, 1) },
            { label: "בעוד שבוע", date: addDays(today, 7) },
          ]}
        />
      </div>
    </>
  );
}
