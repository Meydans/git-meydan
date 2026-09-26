"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
import type { Task } from "@/db/schema";
import { formatDate, todayInIsrael } from "@/lib/labels";
import { capture } from "@/lib/offline-queue";

type Props = { status: Task["status"]; projectId?: string; placeholder: string; autoFocus?: boolean };

// Captures go through the local queue, so they work the same with or without a network.
// An optional start date defers the new item; it then waits in "Deferred" instead of this list.
export function Capture({ status, projectId, placeholder, autoFocus }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [showDate, setShowDate] = useState(false);
  const [note, setNote] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    const deferredTo = startDate > todayInIsrael() ? startDate : "";
    setTitle("");
    setStartDate("");
    setShowDate(false);
    setNote(deferredTo ? `נשמר ב"נדחה להמשך" עד ${formatDate(deferredTo)}` : "");
    if ((await capture({ title: text, status, projectId, startDate: startDate || undefined })) > 0) router.refresh();
  }

  return (
    <div className="capture-wrap">
      <form onSubmit={submit} className="capture">
        <Plus size={20} className="capture-icon" aria-hidden />
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={placeholder}
          required
          autoComplete="off"
          autoFocus={autoFocus}
          enterKeyHint="done"
        />
        <button
          type="button"
          className={`icon-button capture-date-toggle${showDate || startDate ? " on" : ""}`}
          onClick={() => setShowDate((v) => !v)}
          aria-label="תאריך התחלה"
          aria-pressed={showDate}
        >
          <CalendarClock size={20} />
        </button>
        <button className="primary">הוספה</button>
      </form>
      {showDate && (
        <label className="capture-date">
          מתחיל ב:
          <input type="date" name="startDate" value={startDate} min={todayInIsrael()} onChange={(e) => setStartDate(e.target.value)} />
        </label>
      )}
      {note && <p className="capture-note" role="status">{note}</p>}
    </div>
  );
}
