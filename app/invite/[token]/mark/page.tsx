import { notFound } from "next/navigation";
import { guestFromToken } from "@/lib/server";
import { MarkEditor } from "./mark-editor";

export const dynamic = "force-dynamic";

export default async function MarkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const guest = await guestFromToken(token); if (!guest) notFound();
  return <main className="product-page mark-page"><header className="product-header"><a href={`/invite/${token}`}>Bagas <i>×</i> Iga</a><nav><a href={`/invite/${token}`}>Invitation</a><a href="/marks">Guest marks</a></nav></header><section className="mark-hero"><p>A postcard from you</p><h1>Leave a<br /><em>Mark</em></h1><p>Write it. Draw it. Make it yours. Nothing appears publicly before we review it.</p></section><MarkEditor token={token} guestName={guest.display_name} /><footer className="product-footer"><img src="/assets/bagas-iga-mark.jpg" alt="" /><p>For {guest.display_name}</p><a href={`/invite/${token}`}>Return to invitation</a></footer></main>;
}
