"use client";

import { Pencil } from "lucide-react";

// Phone ⋯ menu: open the project's edit form (a <details>) and bring it into view.
export function OpenEditButton() {
  return (
    <button
      type="button"
      className="menu-item"
      onClick={(e) => {
        e.currentTarget.closest("details")?.removeAttribute("open");
        const edit = document.getElementById("edit-project") as HTMLDetailsElement | null;
        if (!edit) return;
        edit.open = true;
        edit.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      <Pencil size={15} /> עריכה
    </button>
  );
}
