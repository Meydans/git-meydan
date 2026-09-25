import Link from "next/link";
import { logout } from "@/app/actions";

export function Nav({ current }: { current: "tasks" | "projects" }) {
  return (
    <header className="nav">
      <strong className="brand">GTD</strong>
      <nav>
        <Link href="/" aria-current={current === "tasks" ? "page" : undefined}>משימות</Link>
        <Link href="/projects" aria-current={current === "projects" ? "page" : undefined}>פרויקטים</Link>
      </nav>
      <form action={logout}>
        <button className="link">יציאה</button>
      </form>
    </header>
  );
}
