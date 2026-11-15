"use client";

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";

const WARM_EVERY_MS = 10 * 60 * 1000;

// Shows when a page is an offline snapshot, and makes it read-only (except capture, which queues).
// While online, asks the service worker to refresh the saved lists now and then.
export function OfflineStatus({ renderedAt }: { renderedAt: string }) {
  const [snapshot, setSnapshot] = useState(false);

  useEffect(() => {
    const fromCache = !!document.querySelector('meta[name="gtd-from-cache"]');
    const update = () => {
      const offline = fromCache || !navigator.onLine;
      setSnapshot(offline);
      document.documentElement.toggleAttribute("data-offline", offline);
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    if (!fromCache && navigator.onLine) {
      try {
        const last = Number(localStorage.getItem("gtd-warmed-at") ?? 0);
        if (Date.now() - last > WARM_EVERY_MS) {
          navigator.serviceWorker?.ready.then((reg) => reg.active?.postMessage("warm"));
          localStorage.setItem("gtd-warmed-at", String(Date.now()));
        }
      } catch {
        // Storage unavailable: skip the background refresh, pages still cache as they're visited.
      }
    }
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!snapshot) return null;
  const time = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(renderedAt));
  return (
    <div className="snapshot" role="status">
      <CloudOff size={16} />
      <span>
        תצוגה לא מקוונת, נכון ל{time}. אפשר ללכוד פריטים חדשים; עריכה תחזור כשהרשת תחזור.
      </span>
    </div>
  );
}

// Offline pages hold private data: remove them from the device on logout.
export async function clearOfflinePages() {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("gtd-pages-")).map((key) => caches.delete(key)));
    localStorage.removeItem("gtd-warmed-at");
  } catch {
    // No Cache Storage: nothing was saved.
  }
}
