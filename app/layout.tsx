import type { Metadata } from "next";
import "./globals.css";
import "./world-surfaces.css";
import "./wedding-v2.css";
import "./grand-garden.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { LanguageProvider } from "./language";

export const metadata: Metadata = {
  title: "Bagas × Iga — 1 November 2026",
  description: "Undangan pernikahan Bagas Marsya Pratama Nugraha dan Iga Noviyanti Rohman di Pandiga, Cimahi.",
  icons: { icon: "/assets/bagas-iga-mark.jpg" },
  referrer: "same-origin",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
