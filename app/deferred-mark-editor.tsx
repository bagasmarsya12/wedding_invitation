"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import type { MarkEditor } from "./mark-editor";
import { T } from "./language";

type Editor = typeof MarkEditor;
type Props = React.ComponentProps<Editor>;

/** Load once near the reply room; leaving it never discards an unsaved draft. */
export function DeferredMarkEditor(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [Editor, setEditor] = useState<ComponentType<Props> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (Editor || !host.current) return;
    let cancelled = false;
    let started = false;
    const load = () => {
      if (started) return;
      started = true;
      observer?.disconnect();
      import("./mark-editor").then(module => {
        if (!cancelled) setEditor(() => module.MarkEditor);
      }).catch(() => { if (!cancelled) setFailed(true); });
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) load();
    }, { rootMargin: "800px 0px" });
    if (observer) observer.observe(host.current);
    else load();
    return () => { cancelled = true; observer?.disconnect(); };
  }, [Editor]);

  return <div ref={host} className={`reply-editor-slot ${Editor ? "is-ready" : "is-pending"}`}>
    {Editor ? <Editor {...props} /> : <div className="reply-editor-loading" aria-busy={!failed}>
      <p role="status"><T>{failed ? "The reply paper could not be loaded." : "Preparing your reply paper…"}</T></p>
      {/* Browsers can cache a rejected module load. Repeating the same import
          may fail immediately even after connectivity returns. No editor/draft
          exists yet, so offer an explicit document reload, not a false retry. */}
      {failed && <button type="button" onClick={() => window.location.reload()}><T>Reload the invitation</T></button>}
    </div>}
  </div>;
}
