
import { T, LanguageSwitch } from "../../../language";
import { notFound } from "next/navigation";
import { guestFromToken } from "@/lib/server";
import { MarkEditor } from "@/app/mark-editor";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

export default async function MarkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const guest = await guestFromToken(token); if (!guest) notFound();
  return <main className="product-page mark-page"><header className="product-header"><a href={`/invite/${token}`}><T>Bagas</T> <i>×</i><T>Iga</T></a><nav><a href={`/invite/${token}`}><T>Invitation</T></a></nav><LanguageSwitch /></header><section className="mark-hero"><p><T>A postcard from you</T></p><h1><T>Leave a</T><br /><em><T>Mark</T></em></h1><p><T>Write it. Draw it. Make it yours. Nothing appears publicly before we review it.</T></p></section><MarkEditor token={token} guestName={guest.display_name} /><footer className="product-footer"><img src="/assets/bagas-iga-mark.jpg" alt="" /><p><T>For </T>{guest.display_name}</p><a href={`/invite/${token}`}><T>Return to invitation</T></a></footer></main>;
}
