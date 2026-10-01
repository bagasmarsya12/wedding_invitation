"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Postcard, type PostcardMark } from "./postcard";
import { PostcardReader } from "./postcard-reader";
import { T, useLanguage } from "./language";

type Page = { marks: PostcardMark[]; nextCursor: string | null };

export function PostcardWall({ ownIds, refresh = 0 }: { ownIds?: Set<string>; refresh?: number }) {
  const { t } = useLanguage();
  const [marks, setMarks] = useState<PostcardMark[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<PostcardMark | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async (next: string | null, replace = false) => {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true); setError(false);
    try {
      const response = await fetch(`/api/marks?limit=48${next ? `&cursor=${encodeURIComponent(next)}` : ""}`, { signal: controller.signal });
      if (!response.ok) throw new Error("wall unavailable");
      const page = await response.json() as Page;
      setMarks(previous => {
        if (replace) return page.marks;
        const seen = new Set(previous.map(mark => mark.id));
        return [...previous, ...page.marks.filter(mark => !seen.has(mark.id))];
      });
      setCursor(page.nextCursor); setLoaded(true);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setBusy(false); }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void load(null, true); });
    return () => { cancelled = true; requestRef.current?.abort(); requestRef.current = null; };
  }, [load, refresh]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !cursor || busy || error) return;
    const nearEnd = () => {
      if (node.scrollWidth - node.clientWidth - node.scrollLeft < 160) void load(cursor);
    };
    node.addEventListener("scroll", nearEnd, { passive: true });
    nearEnd();
    return () => node.removeEventListener("scroll", nearEnd);
  }, [cursor, busy, error, load, marks.length]);

  const loadMore = useCallback(() => { if (cursor) void load(cursor); }, [cursor, load]);

  return <div className="postcard-wall-room">
    <div className="postcard-wall-heading"><span><T>Postcards from our guests</T></span><small><T>Scroll to explore. Tap a card to read.</T></small></div>
    {!loaded && !error && <p className="mark-empty" role="status"><T>Loading the wall…</T></p>}
    {loaded && marks.length === 0 && <p className="mark-empty"><T>Nothing here yet — approved postcards will fill the wall.</T></p>}
    {marks.length > 0 && <div ref={scrollRef} className="v2-postcard-wall" role="region" tabIndex={0} aria-label={t("Scrollable postcard wall")} aria-busy={busy}>
      <div className="v2-postcard-wall-grid">
        {marks.map((mark, index) => <button type="button" className={`postcard-wall-card${ownIds?.has(mark.id) ? " is-mine" : ""}`} key={mark.id} onClick={event => { triggerRef.current = event.currentTarget; setSelected({ ...mark, index }); }} aria-label={`${t("Open postcard from")} ${mark.author_name}`}>
          <Postcard className="v2-postcard-live" mark={{ ...mark, index }} />
        </button>)}
      </div>
    </div>}
    {error && <button className="postcard-wall-retry" type="button" onClick={() => void load(loaded ? cursor : null, !loaded)}><T>The wall could not be loaded. Try again.</T></button>}
    {busy && loaded && <p className="mark-empty" role="status"><T>Loading more postcards…</T></p>}
    {selected && <PostcardReader marks={marks} initialId={selected.id} triggerRef={triggerRef} hasMore={!!cursor} busy={busy} error={error} onLoadMore={loadMore} onClose={() => setSelected(null)} />}
  </div>;
}
