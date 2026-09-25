
import { T, LanguageSwitch } from "../language";
/* eslint-disable @next/next/no-html-link-for-pages */
import { ArchiveCollection, type ArchiveCard } from "./archive-client";
import { db } from "@/lib/server";

export const dynamic = "force-dynamic";

const mark: ArchiveCard = {
  slug: "the-mark",
  type: "mark",
  title: "The Mark",
  excerpt: "The B, the bending I, and the joke that stayed.",
  media_url: "/assets/bagas-iga-mark.jpg",
};

export default async function ArchivePage() {
  let custom: ArchiveCard[] = [];
  try {
    const result = await db().prepare("SELECT slug, type, title, excerpt, media_url, entry_date, location FROM archive_entries WHERE published = 1 AND visibility = 'public' ORDER BY COALESCE(featured_order, 999), created_at").all<ArchiveCard>();
    custom = result.results.filter(entry => entry.slug !== "the-mark");
  } catch { /* The built-in story remains available during an empty database state. */ }
  return (
    <main className="product-page archive-page">
      <header className="product-header"><a href="/">Bagas <i>×</i> Iga</a><nav><a href="/"><T>Invitation</T></a></nav><LanguageSwitch /></header>
      <section className="archive-hero">
        <div><p><T>Things worth keeping</T></p><h1><T>The</T><br /><em><T>Archive</T></em></h1></div>
        <p><T>A few things that stayed.</T><br /><T>Open one. Take your time.</T></p>
        <img src="/assets/botanicals/combretum/canopy-branch.webp" alt="" aria-hidden="true" />
      </section>
      <section className="archive-catalogue" aria-label="Archive collection">
        <ArchiveCollection entries={[mark, ...custom]} />
      </section>
      <footer className="product-footer"><img src="/assets/bagas-iga-mark.jpg" alt="" /><p>Bagas × Iga<br />1 November 2026</p><a href="/"><T>Return to invitation</T></a></footer>
    </main>
  );
}
