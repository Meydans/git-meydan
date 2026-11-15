import { WifiOff } from "lucide-react";
import { Capture } from "@/components/capture";
import { PendingCaptures } from "@/components/pending-captures";

// Precached by the service worker with its scripts, and shown whenever a page can't load
// without a network. Capturing still works here: items queue on the device and sync later.
export const dynamic = "force-static";
export const metadata = { title: "GTD · אין חיבור" };

export default function OfflinePage() {
  return (
    <main className="offline-screen">
      <header className="offline-head">
        <WifiOff size={28} className="consent-icon" />
        <div>
          <h1>אין חיבור</h1>
          <p className="hint">אפשר להמשיך ללכוד. מה שתכתוב יישמר במכשיר ויגיע לתיבת האיסוף כשהרשת תחזור.</p>
        </div>
      </header>
      <Capture status="inbox" placeholder="מה על הראש?" autoFocus />
      <PendingCaptures />
      {/* A full page load on purpose: it retries the network, which client-side navigation would not. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/inbox" className="button retry">ניסיון חוזר לטעון את האפליקציה</a>
    </main>
  );
}
