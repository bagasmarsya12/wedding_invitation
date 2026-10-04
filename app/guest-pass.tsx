"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { QrCode } from "lucide-react";
import { T, useLanguage } from "./language";
import type { GuestPassData } from "@/lib/guest-pass";
import { weddingDisplay } from "@/lib/website-content";

export function GuestPass({ token }: { token: string }) {
  const { t, language,website } = useLanguage();
  const display=weddingDisplay(website,language);
  const [open, setOpen] = useState(false);
  const [pass, setPass] = useState<GuestPassData | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const previous = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previous; };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/invite/${encodeURIComponent(token)}/pass`, { cache: "no-store" }).then(async response => {
      const data = await response.json() as GuestPassData & { error?: string }; if (!response.ok) throw new Error(data.error || "Guest pass is temporarily unavailable. Please try again."); return data;
    }).then(data => { if (!cancelled) setPass(data); }).catch(() => { if (!cancelled) setError("Guest pass is temporarily unavailable. Please try again."); });
    return () => { cancelled = true; };
  }, [open, token, revision]);
  async function save() {
    if (!pass || saving) return;
    setSaving(true); setError("");
    try {
      const { createPassImage } = await import("@/lib/pass-image");
      const url = URL.createObjectURL(await createPassImage(pass, language,website,t));
      const link = document.createElement("a"); link.href = url; link.download = "bagas-iga-guest-pass.png"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { setError("The image could not be prepared."); }
    finally { setSaving(false); }
  }
  return <><button className="guest-pass-trigger" type="button" aria-haspopup="dialog" onClick={() => { setPass(null); setError(""); setCopied(false); setOpen(true); }}><QrCode size={17} aria-hidden="true" /><T>Your guest pass</T></button>
    <dialog ref={dialog} className="guest-pass-dialog" aria-labelledby="guest-pass-title" onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
      <header><h2 id="guest-pass-title"><T>Your guest pass</T></h2><button type="button" autoFocus aria-label={t("Close guest pass")} onClick={() => setOpen(false)}>×</button></header>
      {!pass && !error && <p role="status"><T>Preparing your guest pass…</T></p>}
      {pass && <><div className="guest-pass-paper"><img className="pass-botanical" src="/assets/botanicals/dendrobium/branch-short.webp" alt="" aria-hidden="true" /><p>{display.names} · {display.stamp}</p><h3 dir="auto">{pass.guestName}</h3><p><T>Up to</T> {pass.partyLimit} <T>{pass.partyLimit === 1 ? "guest" : "guests"}</T></p><img className="pass-qr" src={pass.qrData} width="512" height="512" alt={t("Guest check-in QR code")} /><p>{display.venue}</p><code>{pass.code}</code></div>
      <p className="guest-pass-help"><T>Show this QR at the entrance. Save the image before you leave.</T></p><div className="guest-pass-actions"><button type="button" disabled={saving} onClick={save}><T>{saving ? "Preparing image…" : "Save guest pass"}</T></button><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(pass.code); setCopied(true); } catch { setError("Copy unavailable. Select the code above to copy it."); } }}><T>{copied ? "Copied." : "Copy pass code"}</T></button></div></>}
      {error && <p role="status"><T>{error}</T></p>}{!pass && error && <button type="button" onClick={() => { setError(""); setRevision(value => value + 1); }}><T>Try again</T></button>}
    </dialog></>;
}
