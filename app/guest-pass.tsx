"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { Download, Maximize2, QrCode } from "lucide-react";
import { T, useLanguage } from "./language";
import type { GuestPassData } from "@/lib/guest-pass";
import { weddingDisplay } from "@/lib/website-content";
import { AtelierFloralAccent } from "./atelier-flowers";

function PassFlowers() {
  return <div className="pass-garden" aria-hidden="true"><AtelierFloralAccent corner="top-left" className="pass-flower-top" /><AtelierFloralAccent corner="bottom-right" className="pass-flower-bottom" /></div>;
}

export function GuestPass({ token }: { token: string }) {
  const { t, language,website } = useLanguage();
  const display=weddingDisplay(website,language);
  const [pass, setPass] = useState<GuestPassData | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const previous = document.body.style.overflow;
    if (element && !element.open) element.showModal();
    document.body.style.overflow = "hidden";
    return () => { if (element?.open) element.close(); document.body.style.overflow = previous; };
  }, [open]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/invite/${encodeURIComponent(token)}/pass`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json() as GuestPassData & { error?: string }; if (!response.ok) throw new Error(data.error || "Guest pass is temporarily unavailable. Please try again."); return data;
    }).then(data => { if (!controller.signal.aborted) setPass(data); }).catch(() => { if (!controller.signal.aborted) setError("Guest pass is temporarily unavailable. Please try again."); });
    return () => controller.abort();
  }, [token, revision]);
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
  const actions = pass && <><button className="guest-pass-save" type="button" disabled={saving} onClick={save}><Download size={15} aria-hidden="true" /><T>{saving ? "Preparing image…" : "Save guest pass"}</T></button><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(pass.code); setCopied(true); } catch { setError("Copy unavailable. Select the code above to copy it."); } }}><T>{copied ? "Copied." : "Copy pass code"}</T></button></>;
  return <><section className="guest-pass-inline" aria-labelledby="guest-pass-title">
    <div className="guest-pass-paper" aria-busy={!pass && !error}>
      <div className="guest-pass-copy">
        <h3 id="guest-pass-title"><QrCode size={17} aria-hidden="true" /><T>Your guest pass</T></h3>
        {pass ? <><h4 dir="auto">{pass.guestName}</h4><p><T>Up to</T> {pass.partyLimit} <T>{pass.partyLimit === 1 ? "guest" : "guests"}</T></p><p className="guest-pass-help"><T>Show this QR at the entrance. Save the image before you leave.</T></p></> : !error && <p role="status"><T>Preparing your guest pass…</T></p>}
      </div>
      <div className="guest-pass-qr-wrap">
        {pass ? <><button className="guest-pass-qr-open" type="button" aria-label={t("Enlarge QR")} aria-haspopup="dialog" aria-controls="guest-pass-dialog" onClick={() => setOpen(true)}><PassFlowers /><span className="pass-preview-name">{display.names}</span><img className="pass-qr" src={pass.qrData} width="512" height="512" alt={t("Guest check-in QR code")} /><span className="pass-preview-date">{display.stamp}</span><span className="pass-preview-open"><Maximize2 size={12} aria-hidden="true" /><T>Enlarge QR</T></span></button><code>{pass.code}</code></> : <span className="guest-pass-qr-placeholder" aria-hidden="true" />}
      </div>
      {pass && <div className="guest-pass-actions">{actions}</div>}
      {error && <p className="guest-pass-status" role="status"><T>{error}</T></p>}
      {!pass && error && <div className="guest-pass-actions"><button type="button" onClick={() => { setError(""); setRevision(value => value + 1); }}><T>Try again</T></button></div>}
    </div>
  </section>
    {pass && <dialog ref={dialog} id="guest-pass-dialog" className="guest-pass-dialog guest-pass-floral-dialog" aria-labelledby="guest-pass-dialog-title" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <header><h2 id="guest-pass-dialog-title"><T>Your guest pass</T></h2><button type="button" autoFocus aria-label={t("Close guest pass")} onClick={() => setOpen(false)}>×</button></header>
      <div className="guest-pass-paper"><PassFlowers /><p className="pass-couple">{display.names}</p><p className="pass-date">{display.stamp}</p><h3 dir="auto">{pass.guestName}</h3><p><T>Up to</T> {pass.partyLimit} <T>{pass.partyLimit === 1 ? "guest" : "guests"}</T></p><img className="pass-qr" src={pass.qrData} width="512" height="512" alt={t("Guest check-in QR code")} /><p className="pass-venue">{display.venue}</p><code>{pass.code}</code></div>
      <p className="guest-pass-help"><T>Show this QR at the entrance. Save the image before you leave.</T></p><div className="guest-pass-actions">{actions}</div>
      {error && <p className="guest-pass-status" role="status"><T>{error}</T></p>}
    </dialog>}
  </>;
}
