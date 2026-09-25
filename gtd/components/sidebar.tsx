"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FolderKanban, LogOut, Menu, X } from "lucide-react";
import { logout } from "@/app/actions";
import { listIcons } from "@/components/icons";
import { listLabels, lists, type ListKey } from "@/lib/lists";

type Props = { counts: Record<ListKey, number>; overdue: number; activeProjects: number };

// Hidden lists (done) don't need a count badge; open lists do.
const showCount = (list: ListKey) => list !== "done";

export function Sidebar({ counts, overdue, activeProjects }: Props) {
  const pathname = usePathname();
  // Remember which page the drawer was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);

  const current = lists.find((l) => pathname === `/${l}`);
  const title = current ? listLabels[current] : pathname.startsWith("/projects") ? "פרויקטים" : "GTD";

  return (
    <>
      <header className="topbar">
        <button className="icon-button" onClick={() => setOpen(true)} aria-label="תפריט">
          <Menu size={22} />
        </button>
        <span className="topbar-title">{title}</span>
      </header>

      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <aside className={`sidebar${open ? " sidebar-open" : ""}`}>
        <div className="sidebar-head">
          <span className="brand">GTD</span>
          <button className="icon-button sidebar-close" onClick={() => setOpen(false)} aria-label="סגירה">
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {lists.map((list) => {
            const Icon = listIcons[list];
            const active = pathname === `/${list}`;
            return (
              <Link key={list} href={`/${list}`} className={`nav-item nav-${list}`} aria-current={active ? "page" : undefined}>
                <Icon size={20} />
                <span>{listLabels[list]}</span>
                {list === "scheduled" && overdue > 0 ? (
                  <span className="badge badge-alert" title="באיחור">{overdue}</span>
                ) : (
                  showCount(list) && counts[list] > 0 && <span className="badge">{counts[list]}</span>
                )}
              </Link>
            );
          })}
          <div className="nav-sep" />
          <Link href="/projects" className="nav-item" aria-current={pathname.startsWith("/projects") ? "page" : undefined}>
            <FolderKanban size={20} />
            <span>פרויקטים</span>
            {activeProjects > 0 && <span className="badge">{activeProjects}</span>}
          </Link>
        </nav>

        <form action={logout} className="sidebar-foot">
          <button className="nav-item">
            <LogOut size={20} />
            <span>יציאה</span>
          </button>
        </form>
      </aside>
    </>
  );
}
