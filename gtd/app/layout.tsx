import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GTD",
  description: "ניהול משימות בשיטת GTD",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
