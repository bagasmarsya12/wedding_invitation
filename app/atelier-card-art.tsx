"use client";

import { useEffect, useRef, useState } from "react";
import type { KeepsakeData, KeepsakeFace } from "@/lib/keepsake-design";

type Renderer = {
  canvas: HTMLCanvasElement;
  resize: (width: number, height: number) => void;
  draw: (pose: { flip: number; x: number; y: number; sweep: number }) => void;
  dispose: () => void;
};

/** The current card content and controls keep their existing contract.
 * The restored renderer only adds the original metallic surface and motion. */
export function AtelierCardArt({ data, face }: { data: KeepsakeData; face: KeepsakeFace }) {
  const host = useRef<HTMLDivElement>(null);
  const target = useRef(face === "back" ? 1 : 0);
  const wake = useRef(() => {});
  const [ready, setReady] = useState(false);

  useEffect(() => { target.current = face === "back" ? 1 : 0; wake.current(); }, [face]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let stopped = false, renderer: Renderer | undefined, frame = 0, last = 0, flip = target.current, idle = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: 0, y: 0 };
    setReady(false);
    const render = (now: number) => {
      frame = 0;
      if (stopped || document.hidden) return;
      const dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60;
      last = now;
      flip = reduced.matches ? target.current : flip + (target.current - flip) * (1 - Math.exp(-5 * dt));
      if (Math.abs(flip - target.current) < .0001) flip = target.current;
      renderer?.draw({ flip, x: reduced.matches ? 0 : -pointer.y * .095, y: reduced.matches ? 0 : pointer.x * .20, sweep: reduced.matches ? .14 : pointer.x * .85 + .14 });
      if (flip !== target.current || idle++ < 3) frame = requestAnimationFrame(render);
      else last = 0;
    };
    const schedule = () => { idle = 0; if (renderer && !frame && !stopped && !document.hidden) frame = requestAnimationFrame(render); };
    wake.current = schedule;
    const move = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      pointer.x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      pointer.y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
      schedule();
    };
    const leave = () => { pointer.x = pointer.y = 0; schedule(); };
    const visibility = () => { cancelAnimationFrame(frame); frame = 0; last = 0; schedule(); };
    const resize = new ResizeObserver(() => { const rect = element.getBoundingClientRect(); renderer?.resize(rect.width, rect.height); schedule(); });
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", leave);
    resize.observe(element);

    const prepare = async () => {
      const modulePath = "/atelier/keepsake-renderer.js?v=9";
      const [art, graphics] = await Promise.all([import("@/lib/atelier-keepsake"), import(/* @vite-ignore */ modulePath)]);
      const design = await art.prepareAtelierKeepsake(data);
      if (stopped) return;
      renderer = new graphics.CardRenderer(design);
      renderer!.canvas.setAttribute("aria-hidden", "true");
      renderer!.canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); renderer?.dispose(); renderer = undefined; setReady(false); });
      element.appendChild(renderer!.canvas);
      const rect = element.getBoundingClientRect(); renderer!.resize(rect.width, rect.height);
      setReady(true); schedule();
    };
    void prepare().catch(() => { if (!stopped) setReady(false); });
    return () => {
      stopped = true; wake.current = () => {}; cancelAnimationFrame(frame); resize.disconnect();
      element.removeEventListener("pointermove", move); element.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", visibility); reduced.removeEventListener("change", leave); renderer?.dispose();
    };
  }, [data]);
  return <div ref={host} className={`atelier-card-surface ${ready ? "is-ready" : ""}`} aria-hidden="true" />;
}
