
import { T, LanguageSwitch } from "../language";
/* eslint-disable @next/next/no-html-link-for-pages */
import { ArchiveCollection, type ArchiveCard } from "./archive-client";
import { db } from "@/lib/server";
import { ArchiveImage } from "./archive-media";
import { hasPublicContent } from "@/lib/public-content";
import { loadGalleryPhotos } from "@/lib/gallery-content";

export const dynamic = "force-dynamic";

const mark: ArchiveCard = {
  slug: "the-mark",
  type: "mark",
  title: "The Mark",
  excerpt: "The B, the bending I, and the joke that stayed.",
  media_url: "/assets/bagas-iga-mark.jpg",
};

export default async function ArchivePage() {
  const photosPromise = loadGalleryPhotos();
  let custom: ArchiveCard[] = [];
  try {
    const result = await db().prepare("SELECT id, slug, type, title, excerpt, story, media_url, entry_date, location FROM archive_entries WHERE published = 1 AND visibility = 'public' ORDER BY COALESCE(featured_order, 999), created_at").all<ArchiveCard & { story: string | null }>();
    custom = result.results.filter(entry => entry.slug !== "the-mark" && hasPublicContent(entry.title) && (hasPublicContent(entry.story) || hasPublicContent(entry.excerpt))).map(entry => ({ ...entry, excerpt: hasPublicContent(entry.excerpt) ? entry.excerpt : null }));
  } catch { /* The built-in story remains available during an empty database state. */ }
  const photos = await photosPromise;
  const entries:ArchiveCard[] = [...photos.map(photo=>({id:photo.id,slug:`photo-${photo.id}`,type:'photograph',title:photo.caption.en,excerpt:null,media_url:photo.src,gallery:photo.caption})),mark,...custom];
  return (
    <main className="product-page archive-page archive-room">
      <header className="product-header"><a href="/"><T>Iga & Bagas</T></a><nav><a href="/"><T>Invitation</T></a></nav><LanguageSwitch /></header>
      <section className="collection-hero" aria-labelledby="collection-title">
        <div className="collection-window-shadow" aria-hidden="true" />
        <div className="collection-hero-title"><p><T>Things worth keeping</T></p><h1 id="collection-title"><T>The Archive</T></h1></div>
        <div className="collection-hero-note"><p><T>A few things that stayed.</T><br /><T>Open one. Take your time.</T></p><a href="#collection"><T>Browse the collection</T><span aria-hidden="true">↓</span></a></div>
        <ArchiveImage src="/assets/botanicals/combretum/canopy-branch.webp" decorative className="collection-canopy" />
      </section>
      <section className="collection-catalogue" id="collection">
        <ArchiveCollection entries={entries} />
        <noscript>
          <style>{".archive-room .collection-workspace { display:none; }"}</style>
          <div className="collection-table">{photos.map(photo=><figure key={photo.id} className="collection-piece material-photo"><img src={photo.src} alt={photo.caption.id||photo.caption.en} loading="lazy"/><figcaption>{photo.caption.id||photo.caption.en}</figcaption></figure>)}</div>
          <nav className="collection-no-script" aria-label="Archive stories"><p><T>Choose a story to read.</T></p>
            {[mark, ...custom].map(entry => <a key={entry.slug} href={`/archive/${encodeURIComponent(entry.slug)}`}>{entry.slug === "the-mark" ? <T>{entry.title}</T> : entry.title}</a>)}
          </nav>
        </noscript>
      </section>
      <footer className="product-footer"><img src="/assets/bagas-iga-mark.jpg" alt="" /><p><T>Bagas × Iga</T><br /><T>1 November 2026</T></p><a href="/"><T>Return to invitation</T></a></footer>
    </main>
  );
}
