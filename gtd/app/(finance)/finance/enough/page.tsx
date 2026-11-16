import Link from "next/link";
import { EnoughClient } from "@/components/finance/enough-client";
import { financeConfigured } from "@/db/finance";
import { inventoryBase } from "@/lib/finance/inventory";
import { getAssumptions, listItems } from "@/lib/finance/store";
import { requireFinanceSession } from "@/lib/session";

export const metadata = { title: "כמה זה מספיק" };
// Private data: never cache or prerender.
export const dynamic = "force-dynamic";

export default async function EnoughPage() {
  await requireFinanceSession();
  if (!financeConfigured()) {
    return (
      <div className="fin-setup">
        <h1>כמה זה מספיק</h1>
        <p className="muted">מודול הכספים עוד לא מחובר למסד נתונים.</p>
      </div>
    );
  }
  const [rows, assumptions] = await Promise.all([listItems(), getAssumptions()]);
  const base = inventoryBase(rows);
  return (
    <>
      <p className="fin-crumb">
        <Link href="/finance">← איפה אנחנו עומדים</Link>
      </p>
      <EnoughClient base={base} initial={assumptions} />
    </>
  );
}
