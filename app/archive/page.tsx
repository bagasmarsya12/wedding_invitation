
import { T, LanguageSwitch } from "../language";
/* eslint-disable @next/next/no-html-link-for-pages */
import { ArchiveCollection, type ArchiveCard } from "./archive-client";
import { db } from "@/lib/server";
import { ArchiveImage } from "./archive-media";

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
    <main className="product-page archive-page archive-room">
      <header className="product-header"><a href="/">Bagas <i>×</i> Iga</a><nav><a href="/"><T>Invitation</T></a></nav><LanguageSwitch /></header>
      <section className="collection-hero" aria-labelledby="collection-title">
        <div className="collection-window-shadow" aria-hidden="true" />
        <div className="collection-hero-title"><p><T>Things worth keeping</T></p><h1 id="collection-title"><T>The Archive</T></h1></div>
        <div className="collection-hero-note"><p><T>A few things that stayed.</T><br /><T>Open one. Take your time.</T></p><a href="#collection"><T>Browse the collection</T><span aria-hidden="true">↓</span></a></div>
        <ArchiveImage src="/assets/botanicals/combretum/canopy-branch.webp" decorative className="collection-canopy" />
      </section>
      <section className="collection-catalogue" id="collection">
        <ArchiveCollection entries={[mark, ...custom]} />
        <noscript>
          <style>{".archive-room .collection-workspace { display:none; }"}</style>
          <nav className="collection-no-script" aria-label="Archive stories"><p><T>Choose a story to read.</T></p>
            {[mark, ...custom].map(entry => <a key={entry.slug} href={`/archive/${encodeURIComponent(entry.slug)}`}>{entry.slug === "the-mark" ? <T>{entry.title}</T> : entry.title}</a>)}
          </nav>
        </noscript>
      </section>
      <footer className="product-footer"><img src="/assets/bagas-iga-mark.jpg" alt="" /><p>Bagas × Iga<br />1 November 2026</p><a href="/"><T>Return to invitation</T></a></footer>
    </main>
  );
}
