import type { Task } from "@/db/schema";

const SEGMENTS = [
  ["done", "הושלמו"],
  ["next", "הבאות"],
  ["waiting", "ממתינות"],
  ["someday", "אולי"],
] as const;

type Counts = Partial<Record<Task["status"], number>>;

const label = (status: (typeof SEGMENTS)[number][0], n: number, text: string) => (status === "waiting" && n === 1 ? "ממתינה" : text);

// A project's tasks as one bar: done / next / waiting / someday, each segment sized by its count.
export function StatusBar({ counts, legend = true }: { counts: Counts; legend?: boolean }) {
  const shown = SEGMENTS.filter(([s]) => (counts[s] ?? 0) > 0);
  const summary = shown.map(([s, text]) => `${counts[s]} ${label(s, counts[s]!, text)}`).join(" · ");
  return (
    <>
      <div className="status-bar" role="img" aria-label={summary || "אין משימות"}>
        {shown.map(([s]) => (
          <span key={s} className={`st-${s}`} style={{ flexGrow: counts[s] }} />
        ))}
      </div>
      {legend && shown.length > 0 && (
        <div className="status-legend">
          {shown.map(([s, text]) => (
            <span key={s}>
              <i className={`st-dot st-${s}`} aria-hidden /> {counts[s]} {label(s, counts[s]!, text)}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

const KEY = { done: "הושלם", next: "הבאה", waiting: "ממתין", someday: "אולי" } as const;

// The key for the colors, shown once under the project cards.
export function StatusKey() {
  return (
    <div className="status-key">
      <strong>מקרא</strong>
      <div className="status-legend">
        {SEGMENTS.map(([s]) => (
          <span key={s}>
            <i className={`st-dot st-${s}`} aria-hidden /> {KEY[s]}
          </span>
        ))}
      </div>
    </div>
  );
}
