/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import { T } from "./language";
import { MARK_DECOR, markFontOr, markStyleOr } from "@/lib/mark-styles";

const STAMPS = [
  "/assets/botanicals/combretum/flower-cluster.webp",
  "/assets/botanicals/syzygium/branch-short.webp",
  "/assets/botanicals/melastoma/full-stem.webp",
];

export type PostcardMark = {
  id: string;
  author_name: string;
  message: string | null;
  drawingUrl?: string | null;
  created_at?: string | null;
  index?: number;
  style?: string | null;
  font?: string | null;
};

function postmark(stamp?: string | null) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(stamp ?? "");
  return parts ? `${parts[3]}·${parts[2]}·${parts[1].slice(2)}` : "";
}

export function Postcard({ mark, className = "", note }: { mark: PostcardMark; className?: string; note?: ReactNode }) {
  const index = mark.index ?? 0;
  const drawing = mark.drawingUrl || null;
  const stamp = postmark(mark.created_at);
  const style = markStyleOr(mark.style);
  const font = markFontOr(mark.font);
  const decor = MARK_DECOR[style];
  return (
    <article className={`postcard pc--${style} pc-font-${font}${drawing ? " has-drawing" : ""}${mark.message ? " has-message" : ""} ${className}`.trim()}>
      {decor && <img className="pc-decor" src={decor} alt="" aria-hidden="true" loading="lazy" decoding="async" />}
      <span className="postcard-stamp" aria-hidden="true"><img src={STAMPS[index % STAMPS.length]} alt="" loading="lazy" decoding="async" /></span>
      {stamp && <span className="postcard-postmark" aria-hidden="true">{stamp}</span>}
      {drawing && <img className="postcard-ink" src={drawing} alt={mark.message ? "" : `${mark.author_name}'s drawing`} loading="lazy" decoding="async" />}
      <div className="postcard-body">
        {mark.message
          ? <p className="postcard-writing">{mark.message}</p>
          : <p className="postcard-writing is-drawn"><T>Drawn, not written.</T></p>}
      </div>
      {note && <p className="postcard-note">{note}</p>}
      <p className="postcard-from">{mark.author_name}</p>
    </article>
  );
}
