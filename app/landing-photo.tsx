"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { T } from "./language";

export function LandingPhoto({ src, alt, initial = "", className = "" }: { src: string | null; alt: string; initial?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return <div className={`landing-photo ${className} ${src && !failed ? "has-photo" : "is-placeholder"}`}>
    {src && !failed ? <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} /> : <>
      {initial && <span className="v2-portrait-initial" aria-hidden="true">{initial}</span>}
      <span className="landing-photo-aperture" aria-hidden="true" />
      <span className="landing-photo-label"><T>{failed ? "Image unavailable." : "Photograph to come."}</T></span>
    </>}
  </div>;
}
