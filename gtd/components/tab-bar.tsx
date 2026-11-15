"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ClipboardCheck, FolderKanban, Plus, X } from "lucide-react";
import { Capture } from "@/components/capture";
import { listIcons } from "@/components/icons";

const TABS = [
  { href: "/inbox", label: "איסוף", Icon: listIcons.inbox },
  { href: "/next", label: "הבאות", Icon: listIcons.next },
  null, // the capture button sits in the middle
  { href: "/projects", label: "פרויקטים", Icon: FolderKanban },
  { href: "/review", label: "סקירה", Icon: ClipboardCheck },
] as const;

// Phones: the main places as a bottom tab bar, with quick capture in the middle. The other
// lists stay in the drawer behind the top bar's menu button.
export function TabBar({ reviewDue }: { reviewDue: number }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      // showModal focuses the first button (close); typing should start right away.
      dialog.current?.querySelector<HTMLInputElement>("input[name=title]")?.focus();
    } else dialog.current?.close();
  }, [open]);

  return (
    <>
      <nav className="tab-bar" aria-label="ניווט מהיר">
        {TABS.map((tab) =>
          tab ? (
            <Link key={tab.href} href={tab.href} className="tab" aria-current={pathname.startsWith(tab.href) ? "page" : undefined}>
              <span className="tab-icon">
                <tab.Icon size={22} />
                {tab.href === "/review" && reviewDue > 0 && <span className="tab-badge">{reviewDue}</span>}
              </span>
              <span>{tab.label}</span>
            </Link>
          ) : (
            <button key="capture" className="tab-capture" onClick={() => setOpen(true)} aria-label="איסוף מהיר">
              <Plus size={28} />
            </button>
          ),
        )}
      </nav>

      <dialog ref={dialog} className="capture-sheet" onClose={() => setOpen(false)} onClick={(e) => e.target === dialog.current && setOpen(false)}>
        <div className="sheet-head">
          <strong>איסוף מהיר</strong>
          <button className="icon-button" onClick={() => setOpen(false)} aria-label="סגירה">
            <X size={20} />
          </button>
        </div>
        {open && <Capture status="inbox" placeholder="מה על הראש?" autoFocus />}
        <p className="hint">נכנס לתיבת האיסוף. אפשר להמשיך להוסיף.</p>
      </dialog>
    </>
  );
}
