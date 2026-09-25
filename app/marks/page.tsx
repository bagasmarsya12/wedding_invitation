
import { T, LanguageSwitch } from "../language";
/* eslint-disable @next/next/no-html-link-for-pages */
import { db } from "@/lib/server";
import { Postcard } from "../postcard";

export const dynamic = "force-dynamic";

type Mark = { id: string; author_name: string; message: string | null; drawing_key: string | null; created_at: string };

export default async function MarksPage() {
  let marks: Mark[] = [];
  try {
    const result = await db().prepare("SELECT id, author_name, message, drawing_key, created_at FROM guest_marks WHERE moderation_status = 'approved' AND visibility = 'public' ORDER BY created_at DESC LIMIT 50").all<Mark>();
    marks = result.results;
  } catch { /* Empty wall while storage is unavailable. */ }
  return <main className="product-page marks-page"><header className="product-header"><a href="/">Bagas <i>×</i> Iga</a><nav><a href="/"><T>Invitation</T></a><a href="/archive"><T>Archive</T></a></nav><LanguageSwitch /></header><section className="wall-hero"><p><T>Things our guests left behind</T></p><h1><T>Guest</T><br /><em><T>Marks</T></em></h1><p><T>Approved postcards only. No likes, replies, rankings, or counters.</T></p></section><section className="marks-wall">{!marks.length && <div className="empty-wall"><p><T>The wall is quiet for now.</T></p><span><T>Approved guest postcards will appear here.</T></span></div>}{marks.map((mark, index) => <Postcard key={mark.id} className={`public-mark mark-${index % 3}`} mark={{ id: mark.id, author_name: mark.author_name, message: mark.message, drawingUrl: mark.drawing_key ? `/api/marks/${mark.id}/image` : null, created_at: mark.created_at, index }} note={<><T>Guest mark / </T>{String(index + 1).padStart(3, "0")}</>} />)}</section><footer className="product-footer"><img src="/assets/bagas-iga-mark.jpg" alt="" /><p>Bagas × Iga</p><a href="/"><T>Return to invitation</T></a></footer></main>;
}
