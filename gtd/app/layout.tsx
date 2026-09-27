import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { ServiceWorker } from "@/components/pwa";
import "./globals.css";

// Self-hosted at build time, so the font also works offline in the installed app.
const rubik = Rubik({ subsets: ["hebrew", "latin"], variable: "--font-rubik", display: "swap" });

export const metadata: Metadata = {
  title: "GTD",
  description: "ניהול משימות בשיטת GTD",
  applicationName: "GTD",
  appleWebApp: { capable: true, title: "GTD", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#181a1a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={rubik.variable}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
