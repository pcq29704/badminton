import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Be_Vietnam_Pro, Cormorant_SC, Marcellus_SC } from "next/font/google";
import Providers from "@/lib/query/Providers";
import "./globals.css";
import "./design.css";
import "./ui.css";

// Old display font, still used by screens that are not on the new system yet (see DESIGN.md, migration status).
const displayFont = Marcellus_SC({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--font-display" });
// New system (ui.css). Both fonts include Vietnamese, so rank names and player names render in one font.
const cbDisplay = Cormorant_SC({ weight: ["500", "600", "700"], subsets: ["latin", "latin-ext", "vietnamese"], variable: "--font-cb-display" });
const cbBody = Be_Vietnam_Pro({ weight: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext", "vietnamese"], variable: "--font-cb-body" });

export const metadata: Metadata = {
  title: "Court Balancer",
  appleWebApp: { capable: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${cbDisplay.variable} ${cbBody.variable}`}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
