"use client";

import { useEffect, useRef } from "react";

export function GardenBackground({ active }: { active: boolean }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !host.current) return;
    const element = host.current;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    // The invitation and opening do not wait for the rendering library.
    import("../lib/garden-scene").then(({ mountGarden }) => {
      if (!cancelled) dispose = mountGarden(element);
    }).catch(() => { /* The existing botanical composition remains the fallback. */ });
    return () => { cancelled = true; dispose?.(); };
  }, [active]);

  return <div ref={host} className="v2-garden-background" aria-hidden="true" />;
}
