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

// Due dates are calendar days in the user's timezone, not the server's (UTC).
export function todayInIsrael() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

export function formatDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}
