import Link from "next/link";
import { SearchX } from "lucide-react";

// Links to a task can outlive it (e.g. in an old calendar event).
export default function TaskNotFound() {
  return (
    <div className="empty-state">
      <SearchX size={40} strokeWidth={1.5} />
      <p>המשימה לא נמצאה. ייתכן שנמחקה.</p>
      <p>
        <Link href="/inbox" className="button">לתיבת האיסוף</Link>
      </p>
    </div>
  );
}
