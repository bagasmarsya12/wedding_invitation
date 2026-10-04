"use client";
/* eslint-disable @next/next/no-img-element */
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { LandingPhoto } from "./landing-photo";
import { T, useLanguage } from "./language";

export function SelectedMoments({ photos, children }: { photos: (string | null)[]; children?: ReactNode }) {
  const { t, tField, blocks, language } = useLanguage();
  const caption=(index:number)=>blocks.photos[index]?.caption[language] ?? tField(`gallery.caption${index+1}`);
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const open = selected !== null;
  const available = photos.map((src, index) => src ? index : -1).filter(index => index >= 0);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const previous = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previous; };
  }, [open]);
  function step(offset: number) {
    if (selected === null) return;
    setSelected(available[(available.indexOf(selected) + offset + available.length) % available.length]);
  }
  return <div className="v2-selected-moments memory-photographs" id="gallery" tabIndex={-1} role="group" aria-label={t("The Archive")}>
    <div className="moments-album">{photos.map((src, index) => <Fragment key={index}><figure className={`moment moment-${index + 1}`}>
      {src ? <button className="moment-open" type="button" aria-label={`${t("Open photograph")} ${index + 1}`} onClick={() => setSelected(index)}><LandingPhoto key={src} src={src} alt={caption(index)} /><span><T>Take a closer look</T></span></button>
        : <LandingPhoto src={null} alt="" />}
      <figcaption>{caption(index)}</figcaption>
    </figure>{index === Math.min(2, photos.length - 1) ? children : null}</Fragment>)}{photos.length === 0 ? children : null}</div>
    <dialog ref={dialog} className="moment-viewer" aria-label={t("Photograph viewer")} onCancel={() => setSelected(null)} onClose={() => setSelected(null)} onKeyDown={event => { if (event.key === "ArrowRight") step(1); if (event.key === "ArrowLeft") step(-1); }}>
      <header><span>{selected !== null && caption(selected)}</span><button type="button" autoFocus onClick={() => setSelected(null)}><T>Close</T></button></header>
      {selected !== null && photos[selected] && <img src={photos[selected]!} alt={caption(selected)} />}
      {available.length > 1 && <nav aria-label={t("Photographs")}><button type="button" onClick={() => step(-1)}><T>Previous photograph</T></button><button type="button" onClick={() => step(1)}><T>Next photograph</T></button></nav>}
    </dialog>
  </div>;
}
