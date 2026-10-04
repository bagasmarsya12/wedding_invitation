
import { T } from "../../language";
import { notFound } from "next/navigation";
import { db } from "@/lib/server";
import { ArchiveStory } from "../archive-story";
import { ArchiveImage } from "../archive-media";
import { THE_MARK_PROCESS_MATERIALS, hasPublicContent } from "@/lib/public-content";

export const dynamic = "force-dynamic";

export default async function ArchiveEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "the-mark") {
    return (
      <ArchiveStory builtIn entry={{ title:"The Mark", type:"mark", excerpt:"The B, the bending I, and the joke that stayed.", media_url:"/assets/bagas-iga-mark.jpg" }}>
          <div className="collection-prose">
            <p><T>One of our first conversations was about Iga’s name. Bagas wondered why her parents chose it, then joked that perhaps she was his missing rib.</T></p>
            <p><T>Years later, the joke became the starting point for this mark. Drawing an actual rib felt too literal, so the idea was reduced: a B holding a bending I.</T></p>
            <p><T>That is all the symbol needs to say. The rest belongs to us.</T></p>
          </div>
          {THE_MARK_PROCESS_MATERIALS.length > 0 && <aside className="collection-process"><span><T>Process material</T></span>{THE_MARK_PROCESS_MATERIALS.map(material => <figure key={material.src}><ArchiveImage src={material.src} alt={material.alt} /><figcaption>{material.caption}</figcaption></figure>)}</aside>}
      </ArchiveStory>
    );
  }
  const entry = await db().prepare("SELECT slug, type, title, excerpt, story, media_url, entry_date, location FROM archive_entries WHERE slug = ? AND published = 1 AND visibility = 'public' LIMIT 1")
    .bind(slug).first<{ slug: string; type: string; title: string; excerpt: string | null; story: string | null; media_url: string | null; entry_date: string | null; location: string | null }>();
  if (!entry || !hasPublicContent(entry.title) || !(hasPublicContent(entry.story) || hasPublicContent(entry.excerpt))) notFound();
  return (
    <ArchiveStory entry={{ ...entry, excerpt: hasPublicContent(entry.excerpt) ? entry.excerpt : null }}>
      <div className="collection-prose">{entry.story?.trim()
        ? entry.story.split("\n").filter(hasPublicContent).map((paragraph, index) => <p key={index}>{paragraph}</p>)
        : null}</div>
    </ArchiveStory>
  );
}
