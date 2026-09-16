/* eslint-disable @next/next/no-html-link-for-pages */
import { db } from "@/lib/server";

export const dynamic = "force-dynamic";

type Mark = { id: string; author_name: string; message: string | null; drawing_key: string | null; created_at: string };

export default async function MarksPage() {
  let marks: Mark[] = [];
  try {
    const result = await db().prepare("SELECT id, author_name, message, drawing_key, created_at FROM guest_marks WHERE moderation_status = 'approved' AND visibility = 'public' ORDER BY created_at DESC LIMIT 50").all<Mark>();
    marks = result.results;
  } catch { /* Empty wall while storage is unavailable. */ }
  return <main className="product-page marks-page"><header className="product-header"><a href="/">Bagas <i>×</i> Iga</a><nav><a href="/">Invitation</a><a href="/archive">Archive</a></nav></header><section className="wall-hero"><p>Things our guests left behind</p><h1>Guest<br /><em>Marks</em></h1><p>Approved postcards only. No likes, replies, rankings, or counters.</p></section><section className="marks-wall">{!marks.length && <div className="empty-wall"><p>The wall is quiet for now.</p><span>Approved guest postcards will appear here.</span></div>}{marks.map((mark, index) => <article className={`public-mark mark-${index % 3}`} key={mark.id}>{mark.drawing_key && <img src={`/api/marks/${mark.id}/image`} alt={`Drawing by ${mark.author_name}`} />}{mark.message && <blockquote>{mark.message}</blockquote>}<p>Guest mark / {String(index + 1).padStart(3, "0")}<br />{mark.author_name}</p></article>)}</section><footer className="product-footer"><img src="/assets/bagas-iga-mark.jpg" alt="" /><p>Bagas × Iga</p><a href="/">Return to invitation</a></footer></main>;
}
