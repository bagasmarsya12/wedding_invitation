"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Keep navigation consistent with ArchiveTable. */

import { ArrowRight } from "lucide-react";
import { ArchiveTable, type ArchiveItem } from "./archive-table";
import { SelectedMoments } from "./selected-moments";
import { KeepsakeMonogram } from "./keepsake-botanicals";
import { T } from "./language";
import { AtelierFloralFrame } from "./atelier-flowers";

/** Photographs and collected stories share one invitation chapter. */
export function ArchiveCollection({ items, photos, active = true }: { items: ArchiveItem[]; photos: (string | null)[]; active?: boolean }) {
  return <section className="v2-archive v2-scene v2-archive-table-scene v2-memory-folio ks-album" id="archive" data-light="archive" aria-labelledby="archive-title">
    <div className="memory-book">
      <header className="v2-archive-heading">
        <KeepsakeMonogram />
        <h2 id="archive-title" tabIndex={-1}><T field="archive.head" /></h2>
        <p className="memory-intro"><T field="archive.desc" rich /></p>
      </header>
      <SelectedMoments photos={photos} active={active} />
      <footer className="memory-footer">
        <a className="v2-text-link" href="/archive"><T>Open the archive </T><ArrowRight size={19} aria-hidden="true" /></a>
      </footer>
      <AtelierFloralFrame className="memory-floral-frame" />
    </div>
  </section>;
}
