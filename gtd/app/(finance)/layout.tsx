import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/app/actions";
import { canUseGtd } from "@/lib/auth/access";
import { requireFinanceSession } from "@/lib/session";

// The finance module has its own shell, apart from the GTD one: it must not load GTD data (counts,
// projects), because finance-only accounts can see this layout but not GTD.
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const email = await requireFinanceSession();
  return (
    <div className="finance-shell">
      <header className="finance-bar">
        {canUseGtd(email) && (
          <Link href="/inbox" className="finance-back">
            ← GTD
          </Link>
        )}
        <form action={logout}>
          <button className="finance-logout">
            <LogOut size={18} />
            <span>יציאה</span>
          </button>
        </form>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
