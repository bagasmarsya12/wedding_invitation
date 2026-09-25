import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./world-surfaces.css";
import "./wedding-v2.css";
import "./grand-garden.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { LanguageProvider } from "./language";
import { loadLandingContent } from "@/lib/landing-content";

const title = "Bagas × Iga — 1 November 2026";

// Share crawlers (WhatsApp, Instagram) require an absolute og:image URL.
// Resolve against the configured site URL, falling back to the live request host
// so the deployed domain is always correct without hardcoding it.
async function absoluteUrl(path: string): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(path, configured).toString();
  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host");
    if (host) {
      const protocol = requestHeaders.get("x-forwarded-proto") === "http" ? "http" : "https";
      return new URL(path, `${protocol}://${host}`).toString();
    }
  } catch { /* No request context: keep the relative path. */ }
  return path;
}

export async function generateMetadata(): Promise<Metadata> {
  const ogImage = await absoluteUrl("/assets/og-image.jpg");
  return {
    title,
    description: "Undangan pernikahan Bagas Marsya Pratama Nugraha dan Iga Noviyanti Rohman di Pandiga, Cimahi.",
    icons: {
      icon: [{ url: "/assets/favicon.png", sizes: "64x64", type: "image/png" }],
      apple: [{ url: "/assets/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    referrer: "no-referrer",
    openGraph: {
      type: "website",
      title,
      description: "Bagas & Iga are getting married at Pandiga, Cimahi, on 1 November 2026.",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // CMS overrides for landing copy: stored values win, empty DB falls back to
  // the authored literals inside <T>. Fails soft when the DB is unavailable.
  const { values } = await loadLandingContent();
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Without JavaScript the envelope cannot be opened, so reveal the invitation itself. */}
        <noscript>
          <style>{".v2-opening { display: none !important; } .v2-world.is-locked .v2-main, .v2-world.is-locked .v2-footer { visibility: visible !important; opacity: 1 !important; }"}</style>
        </noscript>
        <LanguageProvider content={values}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
