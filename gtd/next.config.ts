import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // One service-worker version per build, so every deploy re-caches the offline screen.
  env: { SW_VERSION: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? `local-${Date.now()}` },
  async headers() {
    // The consent screen must never be framed (clickjacking on the approve button).
    return [
      {
        // The service worker must never be served stale, or updates won't reach installed apps.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        source: "/oauth/authorize",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
