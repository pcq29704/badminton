import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Marcellus_SC } from "next/font/google";
import "./globals.css";
import "./design.css";

// Main app font (Emerald Crown theme) (used through --font-display in design.css).
const displayFont = Marcellus_SC({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Court Balancer 🏸",
  appleWebApp: { capable: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={displayFont.variable}>
      <body>{children}</body>
    </html>
  );
}
