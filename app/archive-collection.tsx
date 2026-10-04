"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Keep navigation consistent with ArchiveTable. */

import { ArrowRight } from "lucide-react";
import { ArchiveTable, type ArchiveItem } from "./archive-table";
import { SelectedMoments } from "./selected-moments";
import { KeepsakeBotanicals, KeepsakeMonogram } from "./keepsake-botanicals";
import { T } from "./language";

/** Photographs and collected stories share one invitation chapter. */
export function ArchiveCollection({ items, photos }: { items: ArchiveItem[]; photos: (string | null)[] }) {
  return <section className="v2-archive v2-scene v2-archive-table-scene v2-memory-folio ks-album" id="archive" data-light="archive" aria-labelledby="archive-title">
    <div className="memory-book">
      <header className="v2-archive-heading">
        <KeepsakeMonogram />
        <h2 id="archive-title" tabIndex={-1}><T field="archive.head" /></h2>
        <p className="memory-intro"><T field="archive.desc" /></p>
      </header>
      <SelectedMoments photos={photos} />
      <footer className="memory-footer">
        <a className="v2-text-link" href="/archive"><T>Open the archive </T><ArrowRight size={19} aria-hidden="true" /></a>
      </footer>
      <KeepsakeBotanicals />
    </div>
  </section>;
}
