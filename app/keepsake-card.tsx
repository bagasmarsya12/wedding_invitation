"use client";

import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { T, useLanguage } from "./language";

const DigitalKeepsake = lazy(() => import("./digital-keepsake"));

export function KeepsakeCard({ guestName = "", edition = 0, keepsakeNote }: { guestName?: string; edition?: number; keepsakeNote?: {note1:string;note2:string} }) {
  const { t } = useLanguage();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  return <>
    <button type="button" className="v2-keepsake-trigger" aria-haspopup="dialog" aria-controls={id} aria-expanded={open} onClick={() => { dialog.current?.showModal(); setOpen(true); }}><span className="v2-keepsake-trigger-copy"><span><T>Open your keepsake</T></span><small><T field="keepsake.openHint" /></small></span><ArrowUpRight size={20} strokeWidth={1.4} aria-hidden="true" /></button>
    <dialog ref={dialog} id={id} className="v2-keepsake-dialog" aria-labelledby={`${id}-title`} onClose={() => setOpen(false)}>
      <header className="v2-keepsake-header">
        <h2 id={`${id}-title`}><T>Your digital keepsake.</T></h2>
        <button type="button" className="v2-keepsake-close" aria-label={t("Close keepsake preview")} onClick={() => dialog.current?.close()} autoFocus><X size={18} strokeWidth={1.4} aria-hidden="true" /></button>
      </header>
      {open && <Suspense fallback={<p className="v2-keepsake-loading" role="status"><T>Preparing your card…</T></p>}><DigitalKeepsake keepsakeNote={keepsakeNote} guestName={guestName} edition={edition} /></Suspense>}
    </dialog>
  </>;
}
