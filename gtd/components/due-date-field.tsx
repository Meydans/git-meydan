"use client";

import { useState } from "react";
import { addDays } from "@/lib/labels";

type Props = { defaultValue: string | null; today: string };

export function DueDateField({ defaultValue, today }: Props) {
  const [value, setValue] = useState(defaultValue ?? "");
  const presets = [
    { label: "היום", date: today },
    { label: "מחר", date: addDays(today, 1) },
    { label: "בעוד שבוע", date: addDays(today, 7) },
  ];
  return (
    <div className="due-field">
      <input type="date" name="dueDate" value={value} onChange={(e) => setValue(e.target.value)} />
      <div className="presets">
        {presets.map((p) => (
          <button type="button" key={p.label} className={`chip-toggle${value === p.date ? " on" : ""}`} onClick={() => setValue(p.date)}>
            {p.label}
          </button>
        ))}
        {value && (
          <button type="button" className="chip-toggle clear" onClick={() => setValue("")}>ללא</button>
        )}
      </div>
    </div>
  );
}
