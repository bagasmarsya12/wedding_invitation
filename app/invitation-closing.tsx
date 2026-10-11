/* eslint-disable @next/next/no-img-element */
"use client";

import { AtelierFloralFrame } from "./atelier-flowers";
import { weddingDisplay } from "@/lib/website-content";
import { T, useLanguage } from "./language";
import { KeepsakeCard } from "./keepsake-card";

/** The colophon is a still object. Only its projected light follows the journey. */
export function InvitationClosing({ entered, edition, past, guestName = "", keepsakeNote }: {
  keepsakeNote?:{note1:string;note2:string}; entered: boolean; edition: number; past: boolean; guestName?: string;
}) {
  const {website,language}=useLanguage(); const display=weddingDisplay(website,language);
  return <footer className="v2-footer v2-closing" data-light="closing" aria-hidden={!entered} aria-labelledby="closing-title">
    <div className="v2-closing-paper">
      <div className="v2-closing-light" aria-hidden="true" />
      <AtelierFloralFrame className="atelier-closing-garden" />
      <div className="v2-closing-folio"><span>{display.names}</span><time dateTime={website.weddingDate}>{display.stamp}</time></div>
      <div className="v2-closing-note">
        <img className="v2-closing-mark" src="/assets/bagas-iga-mark.webp" alt="" width="400" height="400" loading="lazy" decoding="async" />
        <p><T>With love,</T></p>
        <h2 id="closing-title"><T>{past ? "Thank you for being part of our day." : "See you in Cimahi."}</T></h2>
        <span className="v2-closing-signature">{display.names}</span>
          <div className="v2-closing-actions">
            <KeepsakeCard keepsakeNote={keepsakeNote} guestName={guestName} edition={edition} />
          </div>
      </div>
      <div className="v2-closing-colophon">
        <span className="v2-closing-hashtag"><T field="keepsake.hashtag" /></span>
        <small><T>Made with unreasonable attention to detail</T><br /><T>and approximately 1 billion tokens.</T></small>
      </div>
    </div>
  </footer>;
}
