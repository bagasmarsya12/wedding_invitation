/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
import { KEEPSAKE_ART } from "@/lib/keepsake-design";

const arrangements = {
  folio: ["leaf", "orchid", "buds", "rose", "fern", "fern", "rose", "orchid"],
  portrait: ["fern", "buds", "orchid"],
  reply: ["leaf", "orchid", "rose", "fern"],
  album: ["fern", "buds", "rose"],
} as const;

/** Static cutouts from the same approved masters as the digital keepsake. */
export function KeepsakeBotanicals({ arrangement = "folio" }: { arrangement?: keyof typeof arrangements }) {
  return <div className={`ks-botanicals ks-botanicals-${arrangement}`} aria-hidden="true">
    {arrangements[arrangement].map((name, index) => {
      const art = KEEPSAKE_ART[name];
      return <img key={`${name}-${index}`} className={`ks-plant ks-plant-${index + 1}`} src={art.src} alt="" width={art.width} height={art.height} loading="lazy" decoding="async" draggable={false} style={{ "--ks-source-width": `${art.width}px` } as CSSProperties} />;
    })}
  </div>;
}

export function KeepsakeMonogram() {
  return <img className="ks-monogram" src={KEEPSAKE_ART.mark.src} width={KEEPSAKE_ART.mark.width} height={KEEPSAKE_ART.mark.height} alt="" aria-hidden="true" loading="lazy" decoding="async" draggable={false} />;
}
