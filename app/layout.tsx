import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bagas × Iga — 1 November 2026",
  description: "Undangan pernikahan Bagas Marsya Pratama Nugraha dan Iga Noviyanti Rohman di Pandiga, Cimahi.",
  icons: { icon: "/assets/bagas-iga-mark.jpg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
