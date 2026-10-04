import type { CSSProperties } from "react";

export type AtelierCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
const windows: Record<AtelierCorner,string> = {
  "top-left":"0 0 540 630", "top-right":"590 0 496 640",
  "bottom-left":"0 650 450 798", "bottom-right":"440 810 646 638",
};

/** Display windows into the approved illustration; the source pixels stay unchanged. */
export function AtelierFloralAccent({corner="top-left",className="",style}:{corner?:AtelierCorner;className?:string;style?:CSSProperties}) {
  return <svg className={`atelier-floral-sprig atelier-window-${corner} ${className}`} viewBox={windows[corner]} style={style} aria-hidden="true" focusable="false">
    <image href="/atelier/assets/keepsake-florals.png" width="1086" height="1448" />
  </svg>;
}

export function AtelierFloralFrame({className=""}:{className?:string}) {
  return <div className={`atelier-floral-frame ${className}`} aria-hidden="true">
    {(["top-left","top-right","bottom-left","bottom-right"] as const).map(corner=><AtelierFloralAccent key={corner} corner={corner} className={`atelier-corner-${corner}`} />)}
  </div>;
}
