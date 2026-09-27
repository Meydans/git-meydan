import { addDays, todayInIsrael } from "./labels";
import { listCounts, listTasks } from "./queries";
import { reviewQueue } from "./review";

// The weekly review walks five steps in this order. Each step's count is what still needs
// attention there; the first three are "clear" at zero.
export const REVIEW_STEPS = ["inbox", "waiting", "projects", "someday", "calendar"] as const;
export type ReviewStep = (typeof REVIEW_STEPS)[number];

export const stepLabels: Record<ReviewStep, string> = {
  inbox: "ריקון תיבת איסוף",
  waiting: "ממתין ל…",
  projects: "פרויקטים",
  someday: "אולי / מתישהו",
  calendar: "לוח שנה קדימה",
};

export const clearable = (step: ReviewStep) => step === "inbox" || step === "waiting" || step === "projects";

// How far the calendar step looks ahead, in days.
export const CALENDAR_DAYS = 14;

// Open tasks due by the end of the look-ahead, overdue ones included.
export async function calendarAhead(today = todayInIsrael()) {
  const end = addDays(today, CALENDAR_DAYS);
  return (await listTasks("scheduled", {}, today)).filter((t) => t.dueDate! <= end);
}

export async function stepCounts(today = todayInIsrael()): Promise<Record<ReviewStep, number>> {
  const [{ counts }, queue, calendar] = await Promise.all([listCounts(today), reviewQueue(), calendarAhead(today)]);
  return { inbox: counts.inbox, waiting: counts.waiting, projects: queue.length, someday: counts.someday, calendar: calendar.length };
}
