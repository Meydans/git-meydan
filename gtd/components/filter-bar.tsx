"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { contextIcons } from "@/components/icons";
import type { Project, Task } from "@/db/schema";
import { taskContext } from "@/db/schema";
import { contextLabels } from "@/lib/labels";

type Props = { projects: Pick<Project, "id" | "name">[]; contextCounts: Partial<Record<NonNullable<Task["context"]>, number>> };

// Filters live in the URL so a filtered list can be bookmarked and survives a refresh.
export function FilterBar({ projects, contextCounts }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const timer = setTimeout(() => update("q", q.trim() || null), 250);
    return () => clearTimeout(timer);
  });

  const context = params.get("context");
  const projectId = params.get("project");
  const active = !!(context || projectId || q);

  return (
    <div className="filters">
      <label className="search">
        <Search size={16} aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש" aria-label="חיפוש" />
      </label>
      <div className="filter-chips">
        {taskContext.enumValues.map((c) => {
          const Icon = contextIcons[c];
          const on = context === c;
          return (
            <button key={c} className={`chip-toggle ctx-${c.slice(1)}${on ? " on" : ""}`} aria-pressed={on} onClick={() => update("context", on ? null : c)}>
              <Icon size={14} />
              {contextLabels[c]}
              {contextCounts[c] ? <span className="chip-count">{contextCounts[c]}</span> : null}
            </button>
          );
        })}
        {projects.length > 0 && (
          <select className="chip-select" value={projectId ?? ""} onChange={(e) => update("project", e.target.value || null)} aria-label="פרויקט">
            <option value="">כל הפרויקטים</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {active && (
          <button className="chip-toggle clear" onClick={() => { setQ(""); router.replace(pathname, { scroll: false }); }}>
            <X size={14} />
            ניקוי
          </button>
        )}
      </div>
    </div>
  );
}
