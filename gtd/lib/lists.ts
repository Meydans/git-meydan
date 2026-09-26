import type { Task } from "@/db/schema";

// The GTD lists shown in the sidebar. "scheduled" (due dates) and "deferred" (future start dates)
// are views, not statuses.
export const lists = ["inbox", "next", "waiting", "scheduled", "deferred", "someday", "done"] as const;
export type ListKey = (typeof lists)[number];

export const listLabels: Record<ListKey, string> = {
  inbox: "תיבת איסוף",
  next: "הפעולות הבאות",
  waiting: "ממתין ל…",
  scheduled: "מתוזמן",
  deferred: "נדחה להמשך",
  someday: "אולי / מתישהו",
  done: "הושלם",
};

export const listHints: Record<ListKey, string> = {
  inbox: "כל מה שעל הראש. עבור על הרשימה והחלט מה כל פריט.",
  next: "הפעולה הפיזית הבאה שאפשר לעשות עכשיו.",
  waiting: "דברים שמחכים למישהו אחר.",
  scheduled: "משימות פתוחות עם תאריך יעד.",
  deferred: "משימות עם תאריך התחלה עתידי. הן יחזרו לרשימה שלהן ביום ההתחלה.",
  someday: "רעיונות שאולי תחזור אליהם. לא עכשיו.",
  done: "מה שכבר נסגר.",
};

export const isList = (value: string): value is ListKey => (lists as readonly string[]).includes(value);

// The status a task captured from this list should get.
export function captureStatus(list: ListKey): Task["status"] {
  return list === "scheduled" || list === "deferred" || list === "done" ? "inbox" : list;
}
