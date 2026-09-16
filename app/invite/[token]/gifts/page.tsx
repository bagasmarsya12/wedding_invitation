import { notFound } from "next/navigation";
import { guestFromToken } from "@/lib/server";
import { GiftCatalogue } from "./gift-client";

export const dynamic = "force-dynamic";

export default async function GiftPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const guest = await guestFromToken(token);
  if (!guest) notFound();
  return <main className="product-page gift-page"><header className="product-header"><a href={`/invite/${token}`}>Bagas <i>×</i> Iga</a><nav><a href={`/invite/${token}`}>Invitation</a><a href={`/invite/${token}/mark`}>Leave a Mark</a></nav></header><section className="catalogue-hero"><p>A few things we’re saving room for</p><h1>Gifts</h1><p>This is a quiet reservation list, not a shop. Your name stays private when you reserve.</p></section><section className="catalogue-body"><GiftCatalogue token={token} guestName={guest.display_name} /></section><footer className="product-footer"><img src="/assets/bagas-iga-mark.jpg" alt="" /><p>For {guest.display_name}</p><a href={`/invite/${token}`}>Return to invitation</a></footer></main>;
}
