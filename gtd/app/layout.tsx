import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/pwa";
import "./globals.css";

export const metadata: Metadata = {
  title: "GTD",
  description: "ניהול משימות בשיטת GTD",
  applicationName: "GTD",
  appleWebApp: { capable: true, title: "GTD", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#161a18" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl">
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
