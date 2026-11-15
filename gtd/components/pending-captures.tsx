"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { flush, onQueueChange, pendingCaptures, SyncError, type QueuedCapture } from "@/lib/offline-queue";

type SyncState = "idle" | "offline" | "signed-out" | "error";

// Shows captures still waiting on this device and syncs them whenever the network is back.
export function PendingCaptures() {
  const router = useRouter();
  const [items, setItems] = useState<QueuedCapture[]>([]);
  const [state, setState] = useState<SyncState>("idle");

  const reload = useCallback(() => {
    pendingCaptures().then(setItems).catch(() => setItems([]));
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return setState("offline");
    try {
      const synced = await flush();
      setState("idle");
      if (synced > 0) router.refresh();
    } catch (error) {
      setState(error instanceof SyncError && error.status === 401 ? "signed-out" : navigator.onLine ? "error" : "offline");
    }
    reload();
  }, [reload, router]);

  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && sync();
    const onOffline = () => setState("offline");
    const unsubscribe = onQueueChange(({ synced }) => {
      reload();
      // Items synced elsewhere (e.g. the service worker's Background Sync) should show up here too.
      if (synced > 0) router.refresh();
      // A new capture: sync (joins the capture's own attempt) so the status reflects the outcome.
      else sync();
    });
    // The phone can report "online" with no usable connection; keep retrying while the server is unreachable.
    const retry = setInterval(async () => {
      if (navigator.onLine && (await pendingCaptures()).length > 0) sync();
    }, 30_000);
    const first = setTimeout(sync, 0);
    window.addEventListener("online", sync);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(retry);
      unsubscribe();
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload, sync, router]);

  if (items.length === 0) return null;

  const message = {
    idle: "מסנכרן…",
    offline: "אין חיבור. הפריטים שמורים במכשיר ויסונכרנו כשהרשת תחזור.",
    "signed-out": "צריך להתחבר מחדש כדי לסנכרן.",
    error: "השרת לא זמין כרגע. הפריטים שמורים במכשיר, וננסה שוב אוטומטית.",
  }[state];

  return (
    <section className="pending" aria-live="polite">
      <div className="pending-head">
        <CloudOff size={18} />
        <strong>ממתינים לסנכרון ({items.length})</strong>
        {state === "signed-out" ? (
          <Link href="/login" className="pending-action">התחברות</Link>
        ) : (
          <button className="pending-action" onClick={sync} disabled={state === "offline"}>
            <RefreshCw size={14} /> סנכרון
          </button>
        )}
      </div>
      <p className="pending-note">{message}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
    </section>
  );
}
