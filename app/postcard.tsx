/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import { T } from "./language";

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
};

function postmark(stamp?: string | null) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(stamp ?? "");
  return parts ? `${parts[3]}·${parts[2]}·${parts[1].slice(2)}` : "";
}

export function Postcard({ mark, className = "", note }: { mark: PostcardMark; className?: string; note?: ReactNode }) {
  const index = mark.index ?? 0;
  const drawing = mark.drawingUrl || null;
  const stamp = postmark(mark.created_at);
  return (
    <article className={`postcard ${className}`.trim()}>
      <span className="postcard-stamp" aria-hidden="true"><img src={STAMPS[index % STAMPS.length]} alt="" /></span>
      {stamp && <span className="postcard-postmark" aria-hidden="true">{stamp}</span>}
      {drawing && <img className="postcard-ink" src={drawing} alt={mark.message ? "" : `${mark.author_name}'s drawing`} />}
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