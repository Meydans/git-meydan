"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

// Shares the task's canonical link (the phone's share sheet when available, otherwise the clipboard),
// e.g. to paste into a calendar event by hand.
export function CopyLink({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed or clipboard blocked: nothing to do.
    }
  }

  return (
    <button type="button" className="link-button" onClick={share}>
      {copied ? <Check size={16} /> : <Link2 size={16} />}
      {copied ? "הקישור הועתק" : "העתקת קישור"}
    </button>
  );
}
