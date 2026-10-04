"use client";

import { useState } from "react";
import { T } from "../language";

function capImage(image: HTMLImageElement) {
  if (image.naturalWidth) image.style.setProperty("--archive-native-width", `${image.naturalWidth / Math.max(1, devicePixelRatio || 1)}px`);
}

/** Preserve the original bitmap and stop at its actual device-density limit. */
export function ArchiveImage({ src, alt = "", decorative = false, className = "" }: { src: string; alt?: string; decorative?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return decorative ? null : <span className="collection-media-missing"><T>Image unavailable.</T></span>;
  return <img src={src} alt={alt} aria-hidden={decorative || undefined} className={`collection-image ${className}`} loading="lazy" decoding="async"
    ref={image => { if (image?.complete) { if (image.naturalWidth) capImage(image); else setFailed(true); } }}
    onError={() => setFailed(true)} onLoad={event => capImage(event.currentTarget)} />;
}

export function ArchiveMedia({ src, title, type }: { src: string | null; title: string; type: string }) {
  const [failed, setFailed] = useState(false);
  if (!src) return null;
  if (type === "audio") return failed ? <span className="collection-media-missing"><T>Audio unavailable.</T></span>
    : <div className="collection-audio"><span aria-hidden="true" className="collection-audio-groove" /><audio controls preload="none" aria-label={title} src={src} onError={() => setFailed(true)} /><small><T>Listen when you like.</T></small></div>;
  return <ArchiveImage key={src} src={src} alt={title} />;
}
