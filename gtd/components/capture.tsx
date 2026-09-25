"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import type { Task } from "@/db/schema";
import { capture } from "@/lib/offline-queue";

type Props = { status: Task["status"]; projectId?: string; placeholder: string; autoFocus?: boolean };

// Captures go through the local queue, so they work the same with or without a network.
export function Capture({ status, projectId, placeholder, autoFocus }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    setTitle("");
    if ((await capture({ title: text, status, projectId })) > 0) router.refresh();
  }

  return (
    <form onSubmit={submit} className="capture">
      <Plus size={20} className="capture-icon" aria-hidden />
      <input
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        required
        autoComplete="off"
        autoFocus={autoFocus}
        enterKeyHint="done"
      />
      <button className="primary">הוספה</button>
    </form>
  );
}
