"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { markStyleOr } from "@/lib/mark-styles";
import { T, useLanguage } from "./language";
import { Postcard, type PostcardMark } from "./postcard";

type Props = {
  marks: PostcardMark[];
  initialId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  hasMore: boolean;
  busy: boolean;
  error: boolean;
  onLoadMore: () => void;
  onClose: () => void;
};

/** A reader, not a voting UI: swipe only changes which guest's card is on top. */
export function PostcardReader({ marks, initialId, triggerRef, hasMore, busy, error, onLoadMore, onClose }: Props) {
  const { t } = useLanguage();
  const [activeId, setActiveId] = useState(initialId);
  const index = Math.max(0, marks.findIndex(mark => mark.id === activeId));
  const mark = marks[index];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const directionRef = useRef(0);
  const movingRef = useRef(false);
  const aliveRef = useRef(true);
  const dragRef = useRef<{ id: number; x: number; y: number; dx: number; start: number; dragging: boolean } | null>(null);
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    aliveRef.current = true;
    const trigger = triggerRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      aliveRef.current = false;
      animationRef.current?.cancel();
      dialog.close();
      document.body.style.overflow = overflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [triggerRef]);

  useEffect(() => {
    if (index >= marks.length - 3 && hasMore && !busy && !error) onLoadMore();
  }, [index, marks.length, hasMore, busy, error, onLoadMore]);

  useLayoutEffect(() => {
    const node = cardRef.current;
    animationRef.current?.cancel();
    if (!node) return;
    node.style.transform = "";
    if (!directionRef.current || reduced()) { movingRef.current = false; return; }
    const animation = node.animate([
      { transform: `translateX(${directionRef.current * 24}px) scale(.97)`, opacity: .4 },
      { transform: "translateX(0) scale(1)", opacity: 1 },
    ], { duration: 300, easing: "cubic-bezier(.16,1,.3,1)" });
    animationRef.current = animation;
    void animation.finished.then(() => { movingRef.current = false; }, () => {});
  }, [activeId]);

  function settle() {
    const node = cardRef.current;
    if (!node) return;
    const start = node.style.transform || "none";
    node.style.transform = "";
    animationRef.current?.cancel();
    if (reduced()) { movingRef.current = false; return; }
    movingRef.current = true;
    const animation = node.animate([{ transform: start }, { transform: "none" }], { duration: 350, easing: "cubic-bezier(.16,1,.3,1)" });
    animationRef.current = animation;
    void animation.finished.then(() => { movingRef.current = false; }, () => {});
  }

  function navigate(direction: number) {
    const next = marks[index + direction];
    const node = cardRef.current;
    if (movingRef.current || !node) return;
    if (!next) { settle(); if (direction > 0 && hasMore && !busy) onLoadMore(); return; }
    movingRef.current = true;
    directionRef.current = direction;
    if (reduced()) { setActiveId(next.id); return; }
    animationRef.current?.cancel();
    const start = node.style.transform || "none";
    const animation = node.animate([
      { transform: start, opacity: 1 },
      { transform: `translateX(${-direction * node.clientWidth * 1.1}px) rotate(${-direction * 9}deg)`, opacity: 0 },
    ], { duration: 260, easing: "cubic-bezier(.4,0,.7,.2)", fill: "forwards" });
    animationRef.current = animation;
    void animation.finished.then(() => { if (aliveRef.current) setActiveId(next.id); }, () => {});
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || movingRef.current) return;
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, start: performance.now(), dragging: false };
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.dragging) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { dragRef.current = null; return; }
      if (Math.abs(dx) < 10) return;
      drag.dragging = true;
      animationRef.current?.cancel();
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    drag.dx = dx;
    const blocked = (dx > 0 && index === 0) || (dx < 0 && index === marks.length - 1);
    const offset = blocked ? dx * .2 : dx;
    if (cardRef.current) cardRef.current.style.transform = `translateX(${offset}px) rotate(${offset / 40}deg)`;
  }
  function pointerEnd(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag.dragging) return;
    const velocity = Math.abs(drag.dx) / Math.max(1, performance.now() - drag.start);
    if (!cancelled && (Math.abs(drag.dx) > Math.min(100, event.currentTarget.clientWidth * .23) || (Math.abs(drag.dx) > 35 && velocity > .5))) navigate(drag.dx < 0 ? 1 : -1);
    else settle();
  }

  if (!mark) return null;
  return <dialog ref={dialogRef} className="postcard-reader" aria-label={t("Postcard")} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); navigate(event.key === "ArrowRight" ? 1 : -1); }
  }}>
    <div className="postcard-reader-shell">
      <header className="postcard-reader-header"><span><T>Postcards from our guests</T></span><button type="button" className="postcard-reader-close" onClick={onClose} autoFocus><T>Close</T> <span aria-hidden="true">×</span></button></header>
      <div className="postcard-reader-deck" role="group" aria-label={t("Card stack")}>
        {[2, 1].map(offset => marks[index + offset] && <div key={offset} aria-hidden="true" className={`postcard-reader-back pc--${markStyleOr(marks[index + offset].style)} back-${offset}`} />)}
        <div ref={cardRef} className="postcard-reader-active" data-card-id={mark.id} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={event => pointerEnd(event, true)}>
          <Postcard mark={{ ...mark, index }} />
        </div>
      </div>
      <footer className="postcard-reader-controls">
        <button type="button" className="postcard-reader-arrow" aria-label={t("Previous card")} disabled={index === 0} onClick={() => navigate(-1)}><span aria-hidden="true">←</span></button>
        <div><p className="postcard-reader-count" aria-live="polite" aria-atomic="true">{index + 1} / {marks.length}{hasMore ? "+" : ""}<span className="postcard-reader-announcement"> — {mark.author_name}</span></p><small><T>Swipe to read another postcard.</T></small></div>
        <button type="button" className="postcard-reader-arrow" aria-label={t("Next card")} disabled={index === marks.length - 1 && !hasMore} onClick={() => navigate(1)}><span aria-hidden="true">→</span></button>
      </footer>
      {busy && <p className="postcard-reader-status" role="status"><T>Loading more postcards…</T></p>}
      {error && hasMore && <button type="button" className="postcard-wall-retry" onClick={onLoadMore}><T>The wall could not be loaded. Try again.</T></button>}
    </div>
  </dialog>;
}
