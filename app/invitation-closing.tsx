/* eslint-disable @next/next/no-img-element */
"use client";

import type { CSSProperties } from "react";
import { weddingDisplay } from "@/lib/website-content";
import { T, useLanguage } from "./language";
import { KeepsakeCard } from "./keepsake-card";

/** The colophon is a still object. Only its projected light follows the journey. */
export function InvitationClosing({ entered, edition, past, token = "", onReopen }: {
  entered: boolean; edition: number; past: boolean; guestName?: string; token?:string; onReopen: () => void;
}) {
  const {website,language}=useLanguage(); const display=weddingDisplay(website,language);
  return <footer className="v2-footer v2-closing" data-light="closing" aria-hidden={!entered} aria-labelledby="closing-title">
    <div className="v2-closing-paper">
      <div className="v2-closing-light" aria-hidden="true" />
      <img className="v2-closing-botanical closing-orchid" src="/assets/botanicals/dendrobium/branch-short.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" style={{ "--native-pixels": 251 } as CSSProperties} />
      <img className="v2-closing-botanical closing-leaf" src="/assets/botanicals/combretum/leaf-sprig.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" style={{ "--native-pixels": 153 } as CSSProperties} />
      <img className="v2-closing-botanical closing-fern" src="/assets/botanicals/nephrolepis/frond-arched-01.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" style={{ "--native-pixels": 657 } as CSSProperties} />
      <img className="v2-closing-botanical closing-cluster" src="/assets/botanicals/combretum/flower-cluster.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" style={{ "--native-pixels": 323 } as CSSProperties} />
      <div className="v2-closing-folio"><span>{display.names}</span><time dateTime={website.weddingDate}>{display.stamp}</time></div>
      <div className="v2-closing-note">
        <img className="v2-closing-mark" src="/assets/bagas-iga-mark.webp" alt="" width="400" height="400" loading="lazy" decoding="async" />
        <p><T>With love,</T></p>
        <h2 id="closing-title"><T>{past ? "Thank you for being part of our day." : "See you in Cimahi."}</T></h2>
        <span className="v2-closing-signature">{website.firstName} <i aria-hidden="true">×</i>{website.secondName}</span>
          <div className="v2-closing-actions">
            <button type="button" onClick={onReopen}><T>View the envelope again</T><span aria-hidden="true"> ↗</span></button>
            <KeepsakeCard token={token} />
          </div>
      </div>
      <div className="v2-closing-colophon">
        <div className={`v2-footer-edition edition-${edition}`}><span><T>Guest edition </T>{String(edition + 1).padStart(2, "0")}</span></div>
        <span>{website.weddingDate.slice(0,4)}</span>
        <small><T>Made with unreasonable attention to detail</T><br /><T>and approximately 1 billion tokens.</T></small>
      </div>
    </div>
  </footer>;
}
