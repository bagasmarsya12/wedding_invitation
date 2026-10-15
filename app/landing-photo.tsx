"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { T } from "./language";

export function LandingPhoto({ src, alt, initial = "", className = "", defer = false, active = true }: { src: string | null; alt: string; initial?: string; className?: string; defer?: boolean; active?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [requested, setRequested] = useState(!defer);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!defer || requested || !active || !host.current || !src) return;
    // Native lazy loading can fetch several megabytes of offscreen album GIFs.
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      setRequested(true);
      observer.disconnect();
    }, { rootMargin: "200px 0px" });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [active, defer, requested, src]);
  return <div ref={host} className={`landing-photo ${className} ${src && !failed ? "has-photo" : "is-placeholder"}`}>
    {src && !failed && requested ? <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} /> : <>
      {initial && <span className="v2-portrait-initial" aria-hidden="true">{initial}</span>}
      <span className="landing-photo-aperture" aria-hidden="true" />
      {failed && <span className="landing-photo-label"><T>Image unavailable.</T></span>}
    </>}
    {defer && src && <noscript><img src={src} alt={alt} loading="lazy" decoding="async" /></noscript>}
  </div>;
}
