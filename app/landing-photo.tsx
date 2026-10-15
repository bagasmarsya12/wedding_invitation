"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { T } from "./language";
import { archiveMediaUrls } from '@/lib/archive-media';

function ArchiveMotion({ src, poster, alt }: { src: string; poster: string; alt: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = video.current; if (!element || failed) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false, disposed = false;
    const update = () => {
      if (!visible || document.hidden || reduced.matches) { element.pause(); return; }
      if (!element.getAttribute('src')) element.src = src;
      void element.play().then(() => {
        if (disposed || !visible || document.hidden || reduced.matches) element.pause();
      }).catch(() => { /* Poster remains usable when autoplay is unavailable. */ });
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(element); document.addEventListener('visibilitychange', update); reduced.addEventListener('change', update);
    return () => { disposed = true; observer.disconnect(); element.pause(); document.removeEventListener('visibilitychange', update); reduced.removeEventListener('change', update); };
  }, [src, failed]);
  return failed ? <img src={poster} alt={alt} decoding="async" />
    : <video ref={video} poster={poster} muted playsInline loop preload="none" disablePictureInPicture role="img" aria-label={alt} onError={() => setFailed(true)} />;
}

export function LandingPhoto({ src, alt, initial = "", className = "", defer = false, active = true }: { src: string | null; alt: string; initial?: string; className?: string; defer?: boolean; active?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [requested, setRequested] = useState(!defer);
  const host = useRef<HTMLDivElement>(null);
  const preview = src ? archiveMediaUrls(src) : null;
  useEffect(() => {
    if (!defer || requested || !active || !host.current || !src) return;
    // Small previews can start early enough to be ready before their cards appear.
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      setRequested(true);
      observer.disconnect();
    }, { rootMargin: "700px 0px" });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [active, defer, requested, src]);
  return <div ref={host} className={`landing-photo ${className} ${src && !failed ? "has-photo" : "is-placeholder"}`}>
    {src && !failed && requested ? preview?.motion
      ? <ArchiveMotion src={preview.motion} poster={preview.card} alt={alt} />
      : <img src={preview?.card ?? src} srcSet={preview ? `${preview.card} 640w, ${preview.large} 1280w` : undefined} sizes={preview ? '(max-width: 720px) calc(100vw - 3rem), (max-width: 1200px) 45vw, 560px' : undefined} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} /> : <>
      {initial && <span className="v2-portrait-initial" aria-hidden="true">{initial}</span>}
      <span className="landing-photo-aperture" aria-hidden="true" />
      {failed && <span className="landing-photo-label"><T>Image unavailable.</T></span>}
    </>}
    {defer && src && <noscript><img src={src} alt={alt} loading="lazy" decoding="async" /></noscript>}
  </div>;
}
