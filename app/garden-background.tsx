"use client";

import { useEffect, useRef } from "react";
import { mountGardenJourney } from "../lib/garden-journey";

let gardenModule: Promise<typeof import("../lib/garden-scene")> | undefined;
function loadGarden() {
  return gardenModule ??= import("../lib/garden-scene").catch(error => {
    gardenModule = undefined;
    throw error;
  });
}

export function GardenBackground({ active }: { active: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Fetch and parse the module while the envelope is open, without starting another WebGL scene.
    const win = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const warm = () => { void loadGarden().catch(() => {}); };
    if (win.requestIdleCallback) {
      const handle = win.requestIdleCallback(warm, { timeout: 1800 });
      return () => win.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(warm, 600);
    return () => window.clearTimeout(handle);
  }, []);
  useEffect(() => {
    if (!active || !host.current?.parentElement) return;
    return mountGardenJourney(host.current.parentElement);
  }, [active]);

  useEffect(() => {
    if (!active || !host.current) return;
    const element = host.current;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    // The invitation and opening do not wait for the rendering library.
    loadGarden().then(({ mountGarden }) => {
      if (!cancelled) dispose = mountGarden(element);
    }).catch(() => { /* The existing botanical composition remains the fallback. */ });
    return () => { cancelled = true; dispose?.(); };
  }, [active]);

  return <div ref={host} className="v2-garden-background" aria-hidden="true" />;
}
