/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
import { KEEPSAKE_ART } from "@/lib/keepsake-design";

import { AtelierFloralAccent, type AtelierCorner } from "./atelier-flowers";
const arrangements:Record<string,AtelierCorner[]>={
  folio:["top-left","top-right","bottom-left","bottom-right"],
  portrait:["bottom-right","top-left"], reply:["top-right","bottom-left"],
  album:["bottom-left","top-right","bottom-right"],
};

export function KeepsakeBotanicals({arrangement="folio"}:{arrangement?:"folio"|"portrait"|"reply"|"album"}) {
  return <div className={`ks-botanicals ks-botanicals-${arrangement} atelier-botanicals`} aria-hidden="true">
    {arrangements[arrangement].map((corner,index)=><AtelierFloralAccent key={corner} corner={corner} className={`ks-plant ks-plant-${index+1}`} style={{"--ks-source-width":"1086px"} as CSSProperties} />)}
  </div>;
}

export function KeepsakeMonogram() {
  return <img className="ks-monogram" src={KEEPSAKE_ART.mark.src} width={KEEPSAKE_ART.mark.width} height={KEEPSAKE_ART.mark.height} alt="" aria-hidden="true" loading="lazy" decoding="async" draggable={false} />;
}
