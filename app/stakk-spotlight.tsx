"use client";

import { useEffect, useRef, useState } from 'react';
import { T } from './language';
import { AtelierFloralAccent } from './atelier-flowers';

function StakkPreview() {
  const video = useRef<HTMLVideoElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const element = video.current;
    if (!element || fallback) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false, disposed = false;
    const update = () => {
      if (!visible || document.hidden || reduced.matches) { element.pause(); return; }
      // The animation only downloads when its card reaches the viewport.
      if (!element.getAttribute('src')) element.src = '/assets/stakk-preview-v2.mp4';
      element.play().catch(error => {
        if (!disposed && visible && !document.hidden && !reduced.matches && error?.name !== 'AbortError' && error?.name !== 'NotAllowedError') setFallback(true);
      });
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: .05 });
    observer.observe(element);
    reduced.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      disposed = true; observer.disconnect(); element.pause();
      reduced.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [fallback]);

  return fallback ? <img src="/assets/stakk-preview-v2.webp" alt="" width="800" height="920" loading="lazy" decoding="async" />
    : <video ref={video} poster="/assets/stakk-preview-v2.webp" width="800" height="920" muted playsInline loop preload="none" onError={() => setFallback(true)} />;
}

/** A lightweight doorway to the separate camera experience. */
export function StakkSpotlight() {
  return <article className="stakk-spotlight" id="stakk" aria-labelledby="stakk-title">
    <div className="stakk-spotlight-art" aria-hidden="true">
      <StakkPreview />
      <AtelierFloralAccent corner="top-left" className="stakk-spotlight-flower-top" />
      <AtelierFloralAccent corner="bottom-right" className="stakk-spotlight-flower-bottom" />
    </div>
    <div className="stakk-spotlight-copy">
      <span className="stakk-spotlight-wordmark" aria-label="Stakk">stakk<span aria-hidden="true">.</span></span>
      <h3 id="stakk-title"><T field="footer.stakkTitle" /></h3>
      <p><T field="footer.stakkDescription" /></p>
      <a className="stakk-spotlight-cta" href="https://stakk.iganyabagas.com/" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
        <T field="footer.stakkCta" />
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 5h8l2 3h3v12H3V8h3l2-3Z" /><circle cx="12" cy="14" r="3.5" /></svg>
      </a>
    </div>
  </article>;
}
