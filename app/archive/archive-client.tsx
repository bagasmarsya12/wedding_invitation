"use client";

import { useEffect, useRef, useState } from "react";
import { T, useLanguage } from "../language";
import { ArchiveMedia } from "./archive-media";
import { archiveMaterial, ARCHIVE_POSITION_KEY, parseArchivePosition } from "@/lib/archive-collection";

export type ArchiveCard = { slug: string; type: string; title: string; excerpt: string | null; media_url: string | null; entry_date?: string | null; location?: string | null };

export function ArchiveCollection({ entries }: { entries: ArchiveCard[] }) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const controls = useRef(new Map<string, HTMLButtonElement>());
  const workspace = useRef<HTMLDivElement>(null);
  const types = ["all", ...Array.from(new Set(entries.map(entry => entry.type)))];
  const visible = filter === "all" ? entries : entries.filter(entry => entry.type === filter);

  useEffect(() => {
    let frame = 0, cancelled = false;
    try {
      const saved = parseArchivePosition(sessionStorage.getItem(ARCHIVE_POSITION_KEY), ["all", ...new Set(entries.map(entry => entry.type))], entries.map(entry => entry.slug));
      if (saved) {
        workspace.current?.setAttribute("data-restoring", "true");
        queueMicrotask(() => {
          if (cancelled) return;
          setFilter(saved.filter); setSelected(saved.selected);
          frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
            if (cancelled) return;
            window.scrollTo({ top: saved.scroll, behavior: "instant" });
            if (saved.selected) controls.current.get(saved.selected)?.focus({ preventScroll: true });
            workspace.current?.removeAttribute("data-restoring");
          }); });
        });
      }
    } catch { /* Storage is optional. The collection remains fully usable. */ }
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [entries]);

  function remember() {
    try { sessionStorage.setItem(ARCHIVE_POSITION_KEY, JSON.stringify({ filter, selected, scroll: scrollY, savedAt: Date.now() })); }
    catch { /* Native browser Back still works without session storage. */ }
  }
  function close(slug: string) { setSelected(null); controls.current.get(slug)?.focus({ preventScroll: true }); }

  return <div className="collection-workspace" ref={workspace}>
    <nav className="collection-filters" aria-label={t("Filter archive")}>
      {types.map(type => <button type="button" key={type} aria-pressed={filter === type} onClick={() => { setFilter(type); setSelected(null); }}>{t(type)}</button>)}
    </nav>
    <div className="collection-caption"><p><T>The collection</T></p><p role="status" aria-live="polite">{visible.length} <T>{visible.length === 1 ? "entry" : "entries"}</T></p></div>
    <div className={`collection-table${visible.length === 1 ? " is-single" : ""}`}>
      {visible.map(entry => {
        const open = selected === entry.slug;
        const title = entry.slug === "the-mark" ? t(entry.title) : entry.title;
        const kind = archiveMaterial(entry.type);
        const id = `collection-${encodeURIComponent(entry.slug)}`;
        return <article className={`collection-piece material-${kind}${open ? " is-open" : ""}`} key={entry.slug} data-slug={entry.slug}
          onKeyDown={event => { if (event.key === "Escape" && open) { event.stopPropagation(); close(entry.slug); } }}>
          <div className="collection-sheet">
            <header><span>{t(entry.type)}</span><span aria-hidden="true"><T>B × I</T></span></header>
            <div className="collection-mount"><ArchiveMedia key={entry.media_url || "empty"} src={entry.media_url} title={title} type={entry.type} /></div>
            <h2 id={`${id}-title`}>{title}</h2>
            <button type="button" className="collection-open" aria-expanded={open} aria-controls={`${id}-context`} aria-label={`${t(open ? "Put it back" : "Take a closer look")}: ${title}`}
              ref={node => { if (node) controls.current.set(entry.slug, node); else controls.current.delete(entry.slug); }}
              onClick={() => setSelected(open ? null : entry.slug)}>
              <T>{open ? "Put it back" : "Take a closer look"}</T><span aria-hidden="true">{open ? "−" : "+"}</span>
            </button>
            <div className="collection-context" id={`${id}-context`} role="region" aria-labelledby={`${id}-title`} aria-hidden={!open} inert={!open}>
              <div><div className="collection-context-content">
                {(entry.entry_date || entry.location) && <p className="collection-metadata">{[entry.entry_date, entry.location].filter(Boolean).join(" / ")}</p>}
                {entry.excerpt && <div className="collection-excerpt" tabIndex={open ? 0 : -1}><p>{entry.slug === "the-mark" ? <T>{entry.excerpt}</T> : entry.excerpt}</p></div>}
                <a className="collection-story-link" href={`/archive/${encodeURIComponent(entry.slug)}`} onClick={remember}><T>Open this story</T><span aria-hidden="true">↗</span></a>
              </div></div>
            </div>
          </div>
        </article>;
      })}
    </div>
    {visible.length === 0 && <p className="collection-empty"><T>Nothing in this collection yet.</T></p>}
    <p className="collection-colophon"><T>Only what we really kept.</T></p>
  </div>;
}
