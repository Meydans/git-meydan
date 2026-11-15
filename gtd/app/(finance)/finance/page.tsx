import { FinanceClient } from "@/components/finance/finance-client";
import { financeConfigured } from "@/db/finance";
import { listItems, listSnapshots } from "@/lib/finance/store";
import { requireFinanceSession } from "@/lib/session";

export const metadata = { title: "איפה אנחנו עומדים" };
// Private data: never cache or prerender.
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  await requireFinanceSession();
  if (!financeConfigured()) {
    return (
      <div className="fin-setup">
        <h1>איפה אנחנו עומדים</h1>
        <p className="muted">מודול הכספים עוד לא מחובר למסד נתונים. הגדירו DATABASE_URL_FINANCE והריצו את <code>npm run db:finance:migrate</code>.</p>
      </div>
    );
  }
  const [rows, snapshots] = await Promise.all([listItems(), listSnapshots()]);
  return <FinanceClient rows={rows} snapshots={snapshots} />;
}
