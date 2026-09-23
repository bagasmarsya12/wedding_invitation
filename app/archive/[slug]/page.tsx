
import { T, LanguageSwitch } from "../../language";
/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { db } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function ArchiveEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "the-mark") {
    return (
      <main className="product-page story-page">
        <header className="product-header"><a href="/">Bagas <i>×</i> Iga</a><nav><a href="/archive"><T>Archive</T></a><a href="/"><T>Invitation</T></a></nav><LanguageSwitch /></header>
        <article className="mark-story">
          <header><p><T>Archive / Mark / 01</T></p><h1><T>The Mark</T></h1><p className="story-deck"><T>The B, the bending I, and the joke that stayed.</T></p></header>
          <figure><img src="/assets/bagas-iga-mark.jpg" alt="Monogram B yang memeluk I yang melengkung" /><figcaption><T>B embracing the bending I.</T></figcaption></figure>
          <div className="story-copy">
            <p><T>One of our first conversations was about Iga’s name. Bagas wondered why her parents chose it, then joked that perhaps she was his missing rib.</T></p>
            <p><T>Years later, the joke became the starting point for this mark. Drawing an actual rib felt too literal, so the idea was reduced: a B holding a bending I.</T></p>
            <p><T>That is all the symbol needs to say. The rest belongs to us.</T></p>
          </div>
          <aside className="process-slot"><span><T>Process material</T></span><p><T>Original sketches and iterations can be added here later.</T></p></aside>
        </article>
        <footer className="product-footer"><img src="/assets/bagas-iga-mark.jpg" alt="" /><p>Archive / 01</p><a href="/archive"><T>Back to Archive</T></a></footer>
      </main>
    );
  }
  const entry = await db().prepare("SELECT slug, type, title, excerpt, story, media_url, entry_date, location FROM archive_entries WHERE slug = ? AND published = 1 AND visibility = 'public' LIMIT 1")
    .bind(slug).first<{ slug: string; type: string; title: string; excerpt: string | null; story: string | null; media_url: string | null; entry_date: string | null; location: string | null }>();
  if (!entry) notFound();
  return (
    <main className="product-page story-page">
      <header className="product-header"><a href="/">Bagas <i>×</i> Iga</a><nav><a href="/archive"><T>Archive</T></a><a href="/"><T>Invitation</T></a></nav><LanguageSwitch /></header>
      <article className="standard-story">
        <header><p>Archive / {entry.type}</p><h1>{entry.title}</h1><p className="story-deck">{entry.excerpt}</p></header>
        {entry.media_url && <figure><img src={entry.media_url} alt="" /></figure>}
        <div className="story-copy">{entry.story?.split("\n").filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      </article>
      <footer className="product-footer"><img src="/assets/bagas-iga-mark.jpg" alt="" /><p>Bagas × Iga</p><a href="/archive"><T>Back to Archive</T></a></footer>
    </main>
  );
}
