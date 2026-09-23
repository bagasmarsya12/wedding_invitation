
import { T, LanguageSwitch } from "../../../language";
import { notFound } from "next/navigation";
import { guestFromToken } from "@/lib/server";
import { GiftCatalogue } from "./gift-client";

export const dynamic = "force-dynamic";

export default async function GiftPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const guest = await guestFromToken(token);
  if (!guest) notFound();
  return <main className="product-page gift-page"><header className="product-header"><a href={`/invite/${token}`}>Bagas <i>×</i> Iga</a><nav><a href={`/invite/${token}`}><T>Invitation</T></a><a href={`/invite/${token}/mark`}><T>Leave a Mark</T></a></nav><LanguageSwitch /></header><section className="catalogue-hero"><p><T>A few things we’re saving room for</T></p><h1><T>Gifts</T></h1><p><T>This is a quiet reservation list, not a shop. Your name stays private when you reserve.</T></p></section><section className="catalogue-body"><GiftCatalogue token={token} guestName={guest.display_name} /></section><footer className="product-footer"><img src="/assets/bagas-iga-mark.jpg" alt="" /><p><T>For </T>{guest.display_name}</p><a href={`/invite/${token}`}><T>Return to invitation</T></a></footer></main>;
}
