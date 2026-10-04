"use client";
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @next/next/no-html-link-for-pages -- Keep story navigation consistent with the standalone Archive. */

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Minus, Plus } from "lucide-react";
import { T, useLanguage } from "./language";

export type ArchiveItem = {
  type: string; title: string; note: string; image?: string; alt?: string; slug?: string;
};

function ArchiveVisual({ item }: { item: ArchiveItem }) {
  const [failed, setFailed] = useState(false);
  if (item.image && !failed) return <img src={item.image} alt={item.alt || item.title} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
  return failed ? <span><T>Image unavailable.</T></span> : null;
}

/** A stable surface: only the chosen sheet lifts, never the table or its contents on scroll. */
export function ArchiveTable({ items, embedded = false }: { items: ArchiveItem[]; embedded?: boolean }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<number | null>(null);
  const field = useRef<HTMLDivElement>(null);
  const controls = useRef<(HTMLButtonElement | null)[]>([]);

  function moveTo(index: number) {
    const button = controls.current[index];
    const table = field.current;
    if (!button || !table) return;
    button.focus({ preventScroll: true });
    const card = button.closest<HTMLElement>("article");
    if (!card) return;
    // Move only the horizontal collection, never the document's reading position.
    const offset = card.getBoundingClientRect().left - table.getBoundingClientRect().left;
    table.scrollTo({ left: table.scrollLeft + offset - 20, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  function moveAdjacent(direction: number) {
    const table = field.current;
    if (!table) return;
    const origin = table.getBoundingClientRect().left + 20;
    let nearest = 0;
    let distance = Infinity;
    controls.current.forEach((node, index) => {
      const left = node?.closest("article")?.getBoundingClientRect().left;
      if (left === undefined || Math.abs(left - origin) >= distance) return;
      nearest = index;
      distance = Math.abs(left - origin);
    });
    moveTo((nearest + direction + items.length) % items.length);
  }

  return <div className={`archive-table${items.length === 1 ? " is-single" : ""}`}>
    {!embedded && <div className="archive-table-meta">
      <span><T>A few things from our collection.</T></span>
      <span><T>Choose a piece. Stay a little.</T></span>
    </div>}
    <div className="v2-evidence-field archive-table-field" ref={field}>
      {items.map((item, index) => {
        const open = selected === index;
        const kind = ["the mark", "mark"].includes(item.type.toLowerCase()) ? "mark" : item.image || item.type.toLowerCase() === "photograph" || item.type.toLowerCase() === "photo" ? "photo" : "object";
        const titleId = `archive-piece-title-${index}`;
        const noteId = `archive-piece-note-${index}`;
        return <article key={item.slug || `${item.type}-${index}`} className={`v2-artifact archive-piece archive-piece-${kind} artifact-${index + 1}${open ? " is-open" : ""}`}>
          <div className="archive-paper" onKeyDown={event => {
            if (event.key === "Escape" && open) {
              setSelected(null);
              controls.current[index]?.focus({ preventScroll: true });
              event.stopPropagation();
            }
          }}>
            <header>
              <p><T>{item.type}</T><span aria-hidden="true"><T>B × I</T></span></p>
              <h3 id={titleId} title={t(item.title)}><T>{item.title}</T></h3>
            </header>
            <div className="archive-piece-body">
            <button className="archive-piece-toggle" type="button" ref={node => { controls.current[index] = node; }}
              aria-expanded={open} aria-controls={noteId} aria-label={`${t(open ? "Put it back" : "Take a closer look")}: ${t(item.title)}`}
              onClick={() => setSelected(open ? null : index)} onKeyDown={event => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                event.preventDefault();
                moveTo((index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length);
              }}>
              <span className="archive-piece-visual">
                <ArchiveVisual key={item.image || "empty"} item={item} />
              </span>
              <span className="archive-piece-action"><T>{open ? "Put it back" : "Take a closer look"}</T>{open ? <Minus size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}</span>
            </button>
            <div className="archive-piece-note" id={noteId} role="region" aria-labelledby={titleId} aria-hidden={!open} inert={!open}>
              <span className="archive-note-label"><T>A little context</T></span>
              <div className="archive-note-scroll" tabIndex={open ? 0 : -1}><p><T>{item.note}</T></p></div>
              {item.slug && <a href={`/archive/${encodeURIComponent(item.slug)}`}><T>Open this story </T><ArrowRight size={17} aria-hidden="true" /></a>}
            </div>
            </div>
          </div>
        </article>;
      })}
    </div>
    {(!embedded || items.length > 1) && <div className="archive-table-footer">
      {!embedded && <a className="v2-text-link" href="/archive"><T>Open the archive </T><ArrowRight size={19} aria-hidden="true" /></a>}
      {items.length > 1 && <div className="archive-table-navigation" role="group" aria-label={t("Browse the collection")}>
        <button type="button" aria-label={t("Previous piece")} onClick={() => moveAdjacent(-1)}><ArrowLeft size={19} aria-hidden="true" /></button>
        <button type="button" aria-label={t("Next piece")} onClick={() => moveAdjacent(1)}><ArrowRight size={19} aria-hidden="true" /></button>
      </div>}
    </div>}
  </div>;
}
