import type { ReactNode } from "react";
/* eslint-disable @next/next/no-html-link-for-pages -- Full-document return links remount the collection to restore its reading position. */
import { T, LanguageSwitch } from "../language";
import { ArchiveMedia } from "./archive-media";
import { archiveMaterial } from "@/lib/archive-collection";

type Story = { title: string; type: string; excerpt: string | null; media_url: string | null; entry_date?: string | null; location?: string | null };

export function ArchiveStory({ entry, builtIn = false, children }: { entry: Story; builtIn?: boolean; children: ReactNode }) {
  return <main className={`product-page archive-story-room story-material-${archiveMaterial(entry.type)}`}>
    <header className="product-header"><a href="/"><T>Bagas</T> <i>×</i><T>Iga</T></a><nav><a href="/archive"><T>Archive</T></a><a href="/"><T>Invitation</T></a></nav><LanguageSwitch /></header>
    <article className="collection-story">
      <header className="collection-story-header">
        <a className="collection-return" href="/archive"><span aria-hidden="true">←</span><T>Back to Archive</T></a>
        <div className="collection-story-label"><T>{entry.type}</T>{(entry.entry_date || entry.location) && <span>{[entry.entry_date, entry.location].filter(Boolean).join(" / ")}</span>}</div>
        <h1>{builtIn ? <T>{entry.title}</T> : entry.title}</h1>
        {entry.excerpt && <p className="collection-story-deck">{builtIn ? <T>{entry.excerpt}</T> : entry.excerpt}</p>}
      </header>
      <figure className={`collection-story-object material-${archiveMaterial(entry.type)}`}>
        <div className="collection-story-mount"><ArchiveMedia key={entry.media_url || "empty"} src={entry.media_url} type={entry.type} title={entry.title} /></div>
        {builtIn && <figcaption><T>B embracing the bending I.</T></figcaption>}
      </figure>
      <div className="collection-story-body">{children}</div>
      <nav className="collection-story-end" aria-label="Archive"><a href="/archive"><T>Return to the collection</T><span aria-hidden="true">↗</span></a><p><T>Only what we really kept.</T></p></nav>
    </article>
    <footer className="product-footer"><img src="/assets/bagas-iga-mark.webp" alt="" /><p><T>Bagas × Iga</T><br />2026</p><a href="/"><T>Return to invitation</T></a></footer>
  </main>;
}
