
import { T, LanguageSwitch } from "../../../language";
import { notFound } from "next/navigation";
import { guestFromToken } from "@/lib/server";
import { GiftCatalogue } from "./gift-client";
import type { Metadata } from "next";
import { giftCollection } from "@/lib/gift-collections";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

export default async function GiftPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ collection?: string | string[] }> }) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const guest = await guestFromToken(token);
  if (!guest) notFound();
  return <main className="product-page gift-page gift-gallery-page">
    <header className="product-header"><a href={`/invite/${token}`}><T>Bagas</T> <i>×</i><T>Iga</T></a><nav><a href={`/invite/${token}`}><T>Invitation</T></a><a href={`/invite/${token}/mark`}><T>Leave a Mark</T></a></nav><LanguageSwitch /></header>
    <section className="catalogue-hero" aria-labelledby="gift-page-title">
      <div className="gift-hero-light" aria-hidden="true" />
      <div className="gift-hero-copy"><p><T>A few things we’re saving room for</T></p><h1 id="gift-page-title"><T>Gifts</T></h1></div>
      <div className="gift-hero-aside"><p><T>Choose a gift to book. Other invited guests will see your name beside it.</T></p><a href="#gift-catalogue"><T>Browse the collections</T><span aria-hidden="true">↓</span></a></div>
    </section>
    <section className="catalogue-body" id="gift-catalogue"><GiftCatalogue key={token} token={token} guestName={guest.display_name} initialCategory={giftCollection(query?.collection)} /></section>
    <footer className="product-footer"><img src="/assets/bagas-iga-mark.jpg" alt="" /><p><T>For </T>{guest.display_name}</p><a href={`/invite/${token}`}><T>Return to invitation</T></a></footer>
  </main>;
}
