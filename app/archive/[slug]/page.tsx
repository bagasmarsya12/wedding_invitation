
import { T } from "../../language";
import { notFound } from "next/navigation";
import { db } from "@/lib/server";
import { ArchiveStory } from "../archive-story";

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
          <aside className="collection-process"><span><T>Process material</T></span><p><T>Original sketches and iterations can be added here later.</T></p></aside>
      </ArchiveStory>
    );
  }
  const entry = await db().prepare("SELECT slug, type, title, excerpt, story, media_url, entry_date, location FROM archive_entries WHERE slug = ? AND published = 1 AND visibility = 'public' LIMIT 1")
    .bind(slug).first<{ slug: string; type: string; title: string; excerpt: string | null; story: string | null; media_url: string | null; entry_date: string | null; location: string | null }>();
  if (!entry) notFound();
  return (
    <ArchiveStory entry={entry}>
      <div className="collection-prose">{entry.story?.trim()
        ? entry.story.split("\n").filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)
        : <p><T>The real story is still to come.</T></p>}</div>
    </ArchiveStory>
  );
}
