import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "משק הבית",
  description: "משימות וכספי המשפחה",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
