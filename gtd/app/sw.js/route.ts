import { serviceWorkerSource } from "@/lib/sw-source";

// Headers (no-store, CSP) are set for /sw.js in next.config.ts.
export const dynamic = "force-static";

export function GET() {
  const source = serviceWorkerSource(process.env.SW_VERSION ?? "dev");
  // This runs at build time (static route): a syntax error in the worker fails the build
  // instead of silently disabling offline support on every device. Parses, doesn't execute.
  new Function(source);
  return new Response(source, {
    headers: { "Content-Type": "application/javascript; charset=utf-8" },
  });
}
