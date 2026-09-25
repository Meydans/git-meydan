import { OfflineStatus } from "@/components/offline-status";
import { PendingCaptures } from "@/components/pending-captures";
import { Sidebar } from "@/components/sidebar";
import { todayInIsrael } from "@/lib/labels";
import { allProjects, listCounts } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const [{ counts, overdue }, projects] = await Promise.all([listCounts(todayInIsrael()), allProjects()]);
  const activeProjects = projects.filter((p) => p.status === "active").length;

  return (
    <div className="shell">
      <Sidebar counts={counts} overdue={overdue} activeProjects={activeProjects} />
      <main className="content">
        <OfflineStatus renderedAt={new Date().toISOString()} />
        <PendingCaptures />
        {children}
      </main>
    </div>
  );
}
