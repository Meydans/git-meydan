import { OfflineStatus } from "@/components/offline-status";
import { PendingCaptures } from "@/components/pending-captures";
import { Sidebar } from "@/components/sidebar";
import { TabBar } from "@/components/tab-bar";
import { Celebrations } from "@/components/celebrate";
import { financeConfigured } from "@/db/finance";
import { lastSnapshotAt } from "@/lib/finance/store";
import { todayInIsrael } from "@/lib/labels";
import { allProjects, completionWeek, listCounts } from "@/lib/queries";
import { reviewCount } from "@/lib/review";
import { requireSession } from "@/lib/session";

// The quarterly finance update is due when there has been no snapshot for 90 days. The finance
// database is optional and separate, so a problem there must never break the GTD pages.
async function financeUpdateDue() {
  if (!financeConfigured()) return false;
  try {
    const last = await lastSnapshotAt();
    return !last || Date.now() - last.getTime() > 90 * 864e5;
  } catch {
    return false;
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const today = todayInIsrael();
  const [{ counts, overdue }, projects, reviewDue, done, financeDue] = await Promise.all([listCounts(today), allProjects(), reviewCount(), completionWeek(today), financeUpdateDue()]);
  const activeProjects = projects.filter((p) => p.status === "active").length;

  return (
    <div className="shell">
      <Sidebar counts={counts} overdue={overdue} activeProjects={activeProjects} reviewDue={reviewDue} financeDue={financeDue} done={done} />
      <main className="content">
        <OfflineStatus renderedAt={new Date().toISOString()} />
        <PendingCaptures />
        {children}
      </main>
      <TabBar reviewDue={reviewDue} />
      <Celebrations />
    </div>
  );
}
