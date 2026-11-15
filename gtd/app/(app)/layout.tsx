import { OfflineStatus } from "@/components/offline-status";
import { PendingCaptures } from "@/components/pending-captures";
import { Sidebar } from "@/components/sidebar";
import { TabBar } from "@/components/tab-bar";
import { Celebrations } from "@/components/celebrate";
import { todayInIsrael } from "@/lib/labels";
import { allProjects, completionWeek, listCounts } from "@/lib/queries";
import { reviewCount } from "@/lib/review";
import { requireSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const today = todayInIsrael();
  const [{ counts, overdue }, projects, reviewDue, done] = await Promise.all([listCounts(today), allProjects(), reviewCount(), completionWeek(today)]);
  const activeProjects = projects.filter((p) => p.status === "active").length;

  return (
    <div className="shell">
      <Sidebar counts={counts} overdue={overdue} activeProjects={activeProjects} reviewDue={reviewDue} done={done} />
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
