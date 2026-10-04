"use client";

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { Download, RotateCw } from "lucide-react";
import { KEEPSAKE_SCENE_CSS, keepsakeMarkup, keepsakeText, normalizeKeepsakeName, type KeepsakeFace, type KeepsakeCopy } from "@/lib/keepsake-design";
import { WEDDING_EVENTS, WEDDING_VENUE } from "@/lib/wedding-calendar";
import { T, useLanguage } from "./language";

type DownloadAsset = { key: string; url: string; failed: boolean };

export default function DigitalKeepsake({ guestName, edition }: { guestName: string; edition: number }) {
  const { language, t, tField,website } = useLanguage();
  const [name, setName] = useState(() => normalizeKeepsakeName(guestName));
  const [draft, setDraft] = useState(() => normalizeKeepsakeName(guestName));
  const [face, setFace] = useState<KeepsakeFace>("front");
  const [digitalAsset, setDigitalAsset] = useState<DownloadAsset | null>(null);
  const [imageAsset, setImageAsset] = useState<DownloadAsset | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [updated, setUpdated] = useState(false);
  const inputId = useId();
  const scene = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const data = useMemo(() => ({ language, name, edition,website,copy:Object.fromEntries((['forLabel', 'genericRecipient', 'note1', 'note2', 'love', 'editionLabel', 'turn', 'return', 'front', 'back', 'hint'] as const).map(key=>[key,tField(`keepsake.${key}`)])) as KeepsakeCopy }), [language, name, edition,website,tField]);
  const digitalKey = JSON.stringify([data, attempt]);
  const imageKey = JSON.stringify([data, face, attempt]);
  const digitalUrl = digitalAsset?.key === digitalKey ? digitalAsset.url : "";
  const imageUrl = imageAsset?.key === imageKey ? imageAsset.url : "";
  const digitalFailed = digitalAsset?.key === digitalKey && digitalAsset.failed;
  const imageFailed = imageAsset?.key === imageKey && imageAsset.failed;
  const copy = keepsakeText(data);
  const markup = useMemo(() => keepsakeMarkup(data), [data]);
  const innerMarkup = useMemo(() => ({ __html: markup }), [markup]);

  useEffect(() => {
    const root = scene.current;
    root?.querySelector(".k-front")?.setAttribute("aria-hidden", String(face !== "front"));
    root?.querySelector(".k-back")?.setAttribute("aria-hidden", String(face !== "back"));
  }, [face, markup]);

  useEffect(() => {
    let canceled = false, url = "";
    import("@/lib/digital-keepsake").then(module => module.createDigitalKeepsake(data)).then(blob => {
      if (canceled) return;
      url = URL.createObjectURL(blob);
      setDigitalAsset({ key: digitalKey, url, failed: false });
    }).catch(() => { if (!canceled) setDigitalAsset({ key: digitalKey, url: "", failed: true }); });
    return () => { canceled = true; if (url) URL.revokeObjectURL(url); };
  }, [data, digitalKey]);

  useEffect(() => {
    let canceled = false, url = "";
    const style = scene.current ? getComputedStyle(scene.current) : null;
    import("@/lib/wedding-keepsake").then(module => module.createWeddingKeepsake(data, face, {
      serif: style?.getPropertyValue("--k-serif").trim() || "",
      sans: style?.getPropertyValue("--k-sans").trim() || "",
    })).then(blob => {
      if (canceled) return;
      url = URL.createObjectURL(blob);
      setImageAsset({ key: imageKey, url, failed: false });
    }).catch(() => { if (!canceled) setImageAsset({ key: imageKey, url: "", failed: true }); });
    return () => { canceled = true; if (url) URL.revokeObjectURL(url); };
  }, [data, face, imageKey]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function resetTilt() {
    cancelAnimationFrame(frame.current);
    const root = scene.current;
    root?.style.setProperty("--k-tilt-x", "0deg"); root?.style.setProperty("--k-tilt-y", "0deg");
    root?.style.setProperty("--k-light-x", "25%"); root?.style.setProperty("--k-light-y", "20%");
  }
  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const root = scene.current;
      root?.style.setProperty("--k-tilt-x", `${((.5 - y) * 6).toFixed(2)}deg`);
      root?.style.setProperty("--k-tilt-y", `${((x - .5) * 9).toFixed(2)}deg`);
      root?.style.setProperty("--k-light-x", `${(x * 100).toFixed(1)}%`);
      root?.style.setProperty("--k-light-y", `${(y * 100).toFixed(1)}%`);
    });
  }

  return <div className="v2-keepsake-layout">
    <style>{KEEPSAKE_SCENE_CSS}</style>
    <div ref={scene} className="k-scene" data-face={face}>
      <div className="k-stage" onPointerMove={tilt} onPointerLeave={resetTilt} dangerouslySetInnerHTML={innerMarkup} />
      <div className="k-controls"><button type="button" aria-pressed={face === "back"} onClick={() => { resetTilt(); setFace(face === "front" ? "back" : "front"); }}><RotateCw size={15} strokeWidth={1.4} aria-hidden="true" />{face === "front" ? copy.turn : copy.return}</button></div>
      <p className="k-hint" role="status">{face === "front" ? copy.front : copy.back}</p>
    </div>
    <div className="v2-keepsake-personal">
      <h3><T>A little of the day,</T><br /><T>just for you.</T></h3>
      <p className="v2-keepsake-intro"><T>A garden on the front. A note for you on the back.</T></p>
      <form className="v2-keepsake-name-form" onSubmit={event => { event.preventDefault(); const next = normalizeKeepsakeName(draft); setName(next); setDraft(next); setUpdated(true); }}>
        <label htmlFor={inputId}><T>Name on your keepsake</T></label>
        <input id={inputId} name="keepsake-name" value={draft} onChange={event => { setDraft(event.target.value); setUpdated(false); }} autoComplete="off" maxLength={120} dir="auto" placeholder={t("Your name")} />
        <button type="submit" disabled={normalizeKeepsakeName(draft) === name}><T>Use this name</T></button>
        <small><T>Only used for this keepsake.</T></small>
        <span className="v2-keepsake-status" role="status">{updated && <T>Card updated.</T>}</span>
      </form>
      <div className="v2-keepsake-save-area">
        {digitalUrl ? <a className="v2-keepsake-save digital-save" href={digitalUrl} download={`bagas-iga-digital-keepsake-${language}.html`}><Download size={15} strokeWidth={1.4} aria-hidden="true" /><T>Save digital keepsake</T></a> : <p role="status"><T>{digitalFailed ? "The digital file could not be prepared." : "Preparing your digital keepsake…"}</T></p>}
        <p className="v2-keepsake-file-help"><T>Both sides, kept together. Open the file in a browser, even offline.</T></p>
        {imageUrl && <a className="v2-keepsake-save image-save" href={imageUrl} download={`bagas-iga-keepsake-${face}-${language}.png`}><Download size={14} strokeWidth={1.4} aria-hidden="true" /><T>{face === "front" ? "Save front as image" : "Save back as image"}</T></a>}
        {imageFailed && <p role="status"><T>The image could not be prepared.</T></p>}
        {(digitalFailed || imageFailed) && <button className="v2-keepsake-retry" type="button" onClick={() => setAttempt(value => value + 1)}><T>Try again</T></button>}
      </div>
      <p className="v2-keepsake-event-note">{copy.day}<br />{copy.venue}<br /><span>{WEDDING_EVENTS.akad.label[language]} {website.akadTime} · {WEDDING_EVENTS.reception.label[language]} {website.receptionTime}<T>WIB</T></span></p>
    </div>
  </div>;
}
