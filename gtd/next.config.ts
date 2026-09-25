import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // The consent screen must never be framed (clickjacking on the approve button).
    return [
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
