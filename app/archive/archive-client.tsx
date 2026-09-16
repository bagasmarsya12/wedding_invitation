"use client";

import { useMemo, useState } from "react";

export type ArchiveCard = { slug: string; type: string; title: string; excerpt: string | null; media_url: string | null; entry_date?: string | null; location?: string | null };

export function ArchiveCollection({ entries }: { entries: ArchiveCard[] }) {
  const [filter, setFilter] = useState("all");
  const types = ["all", ...Array.from(new Set(entries.map(entry => entry.type)))];
  const visible = useMemo(() => filter === "all" ? entries : entries.filter(entry => entry.type === filter), [entries, filter]);
  return (
    <>
      <nav className="filter-row" aria-label="Filter archive">
        {types.map(type => <button key={type} className={filter === type ? "is-active" : ""} onClick={() => setFilter(type)}>{type}</button>)}
      </nav>
      <div className="archive-index-grid">
        {visible.map((entry, index) => (
          <a className={`archive-index-card card-${index % 4}`} href={`/archive/${entry.slug}`} key={entry.slug}>
            <div className="archive-card-visual">
              {entry.media_url ? <img src={entry.media_url} alt="" /> : entry.slug === "the-mark" ? <img className="mark-asset" src="/assets/bagas-iga-mark.jpg" alt="Monogram Bagas dan Iga" /> : <span>Original material<br />to be added</span>}
            </div>
            <p>{String(index + 1).padStart(2, "0")} / {entry.type}</p>
            <h2>{entry.title}</h2>
            <span>{entry.excerpt || "Entry ready for original material."}</span>
          </a>
        ))}
      </div>
    </>
  );
}
