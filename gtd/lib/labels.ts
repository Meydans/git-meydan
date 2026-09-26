import type { Project, Task } from "@/db/schema";

export const taskStatusLabels: Record<Task["status"], string> = {
  inbox: "תיבת איסוף",
  next: "הפעולות הבאות",
  waiting: "ממתין ל…",
  someday: "אולי / מתישהו",
  done: "הושלם",
};

export const contextLabels: Record<NonNullable<Task["context"]>, string> = {
  "@phone": "טלפון",
  "@computer": "מחשב",
  "@errand": "סידורים",
  "@home": "בית",
};

export const projectStatusLabels: Record<Project["status"], string> = {
  active: "פעיל",
  someday: "אולי / מתישהו",
  done: "הושלם",
};

const TZ = "Asia/Jerusalem";
const DAY = 24 * 60 * 60 * 1000;

// Due dates are calendar days in the user's timezone, not the server's (UTC).
export function todayInIsrael() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function addDays(isoDate: string, days: number) {
  return new Date(Date.parse(isoDate) + days * DAY).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY);
}

export function formatDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

const weekday = new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "UTC" });

// "היום", "מחר", "באיחור 3 ימים", "יום שלישי", or a plain date further out.
export function relativeDue(dueDate: string, today: string) {
  const diff = daysBetween(today, dueDate);
  if (diff === 0) return "היום";
  if (diff === 1) return "מחר";
  if (diff === -1) return "אתמול";
  if (diff < 0) return `באיחור ${-diff} ימים`;
  if (diff < 7) return weekday.format(new Date(dueDate));
  return formatDate(dueDate);
}

export type DueTone = "overdue" | "today" | "soon" | "later";

export function dueTone(dueDate: string, today: string): DueTone {
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff < 7) return "soon";
  return "later";
}

// A stable hue per project so its chip keeps the same color everywhere.
export function projectHue(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return hash;
}

// "מתחיל מחר", "מתחיל ביום שלישי", or "מתחיל ב-12/10/2026" for a future start date.
export function relativeStart(startDate: string, today: string) {
  const diff = daysBetween(today, startDate);
  if (diff === 1) return "מתחיל מחר";
  if (diff < 7) return `מתחיל ב${weekday.format(new Date(startDate))}`;
  return `מתחיל ב-${formatDate(startDate)}`;
}
