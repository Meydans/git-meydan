import { WifiOff } from "lucide-react";

// Precached by the service worker and shown when a page can't be loaded without a network.
export const dynamic = "force-static";
export const metadata = { title: "GTD · אין חיבור" };

export default function OfflinePage() {
  return (
    <main className="login offline">
      <WifiOff size={40} className="consent-icon" />
      <h1>אין חיבור</h1>
      <p className="hint">הדף הזה עוד לא נשמר במכשיר. כשהחיבור יחזור, נסה שוב.</p>
      {/* A full page load on purpose: it retries the network, which client-side navigation would not. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/inbox" className="button primary-link">ניסיון חוזר</a>
    </main>
  );
}
