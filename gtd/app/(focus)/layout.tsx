import { requireSession } from "@/lib/session";

// Focus mode: no sidebar or tab bar, only the task at hand (used by the weekly review).
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return <div className="focus-shell">{children}</div>;
}
