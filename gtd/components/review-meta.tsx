import { AlertTriangle, CalendarClock, History } from "lucide-react";
import { setReviewCadence } from "@/app/actions";
import type { ProjectHealth } from "@/lib/review";

const CADENCES = [1, 3, 7, 14, 30, 60, 90];

export function reviewedLabel(days: number | null) {
  if (days === null) return "לא נסקר מעולם";
  if (days === 0) return "נסקר היום";
  if (days === 1) return "נסקר אתמול";
  return `נסקר לפני ${days} ימים`;
}

export function StalledWarning() {
  return (
    <p className="stalled-box">
      <AlertTriangle size={16} /> תקוע: אין פעולה הבאה זמינה. הוסף פעולה, או שנה סטטוס.
    </p>
  );
}

// Days since the last review, and the cadence (editable in place).
export function ReviewMeta({ project }: { project: ProjectHealth }) {
  const options = CADENCES.includes(project.reviewCadenceDays) ? CADENCES : [...CADENCES, project.reviewCadenceDays].sort((a, b) => a - b);
  return (
    <div className="review-meta">
      <span className={`chip${project.isDueForReview ? " due-overdue" : ""}`}>
        <History size={13} /> {reviewedLabel(project.daysSinceReview)}
      </span>
      <form action={setReviewCadence} className="cadence">
        <input type="hidden" name="id" value={project.id} />
        <CalendarClock size={13} />
        <label>
          סקירה כל
          <select name="reviewCadenceDays" defaultValue={project.reviewCadenceDays} aria-label="תדירות סקירה">
            {options.map((d) => (
              <option key={d} value={d}>{d === 1 ? "יום" : `${d} ימים`}</option>
            ))}
          </select>
        </label>
        <button className="link-button">עדכון</button>
      </form>
    </div>
  );
}
