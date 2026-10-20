import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({ subsets: ["hebrew", "latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-heebo", display: "swap" });

export const metadata: Metadata = {
  title: "לב הבניין",
  description: "מערכת ניהול בניינים",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#1B2A4A", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body>{children}</body>
    </html>
  );
}
