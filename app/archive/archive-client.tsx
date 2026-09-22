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
        {types.map(type => <button key={type} aria-pressed={filter === type} className={filter === type ? "is-active" : ""} onClick={() => setFilter(type)}>{type}</button>)}
      </nav>
      <p className="cabinet-label">The collection <span>{String(visible.length).padStart(2, "0")} {visible.length === 1 ? "entry" : "entries"}</span></p>
      <div className="archive-cabinet">
        {visible.map((entry, index) => (
          <details className="archive-drawer" key={entry.slug} open={index === 0 ? true : undefined}>
            <summary>
              <span className="drawer-number">{String(entries.indexOf(entry) + 1).padStart(2, "0")}</span>
              <h2>{entry.title}</h2>
              <span className="drawer-type">{entry.type}</span>
              <span className="drawer-toggle" aria-hidden="true">+</span>
            </summary>
            <div className="drawer-interior">
              <figure className={`drawer-object ${entry.slug === "the-mark" ? "drawer-mark" : ""}`}>
                {entry.media_url ? <img src={entry.media_url} alt={entry.title} loading="lazy" /> : <span>Original material<br />to be added</span>}
              </figure>
              <div className="drawer-story">
                <p className="drawer-metadata">{[entry.entry_date, entry.location].filter(Boolean).join(" · ") || "Bagas × Iga"}</p>
                <p>{entry.excerpt || "Entry ready for original material."}</p>
                <a href={`/archive/${entry.slug}`}>Open this story <span aria-hidden="true">↗</span></a>
              </div>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
