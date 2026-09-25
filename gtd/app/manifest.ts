import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "GTD · ניהול משימות",
    short_name: "GTD",
    description: "ניהול משימות בשיטת GTD",
    lang: "he",
    dir: "rtl",
    start_url: "/inbox",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f6f4",
    theme_color: "#1f7a4d",
    categories: ["productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "לכידה מהירה", short_name: "לכידה", url: "/inbox?capture=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "הפעולות הבאות", short_name: "הבאות", url: "/next", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
