import { serviceWorkerSource } from "@/lib/sw-source";

// Headers (no-store, CSP) are set for /sw.js in next.config.ts.
export const dynamic = "force-static";

export function GET() {
  return new Response(serviceWorkerSource(process.env.SW_VERSION ?? "dev"), {
    headers: { "Content-Type": "application/javascript; charset=utf-8" },
  });
}
