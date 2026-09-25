"use client";
import { T, useLanguage } from "./language";


import { PointerEvent, useEffect, useRef, useState } from "react";

type Tool = "pen" | "eraser";
type Mode = "write" | "draw";
type OwnMark = { id: string; author: string; message: string | null; drawing: string | null; visibility: string; status: string; createdAt: string };

const INKS = ["#2b2925", "#6f7d60", "#c89094", "#8b7158", "#f6f1e8"];
const STAMP = "/assets/botanicals/combretum/flower-cluster.webp";
const stampToday = () => {
  const now = new Date();
  return [now.getDate(), now.getMonth() + 1, now.getFullYear() % 100].map(value => String(value).padStart(2, "0")).join("·");
};

export function MarkEditor({ token, guestName }: { token: string; guestName: string }) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [mode, setMode] = useState<Mode>("write");
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(INKS[0]);
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [marks, setMarks] = useState<OwnMark[] | null>(null);
  const [editing, setEditing] = useState<OwnMark | null>(null);
  const touched = useRef(false);
  const postmarkRef = useRef<HTMLSpanElement>(null);
  const writingRef = useRef<HTMLTextAreaElement>(null);
  const focusPaper = () => { if (mode === "write") writingRef.current?.focus(); };

  const canvas = () => canvasRef.current;
  const context = () => canvas()?.getContext("2d", { willReadFrequently: true });
  const resize = () => {
    const element = canvas(); if (!element) return;
    const rect = element.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2, 2048 / Math.max(1, rect.width), 2048 / Math.max(1, rect.height));
    const snapshot = element.width ? element.toDataURL() : "";
    element.width = Math.round(rect.width * ratio); element.height = Math.round(rect.height * ratio);
    const ctx = context(); if (!ctx) return; ctx.scale(ratio, ratio); ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (snapshot) restore(snapshot);
  };
  const restore = (url: string) => { const ctx = context(); const element = canvas(); if (!ctx || !element) return; ctx.clearRect(0, 0, element.width, element.height); if (!url) return; const image = new Image(); image.onload = () => { ctx.save(); ctx.globalCompositeOperation = "source-over"; ctx.drawImage(image, 0, 0, element.clientWidth, element.clientHeight); ctx.restore(); }; image.src = url; };
  useEffect(() => { const node = postmarkRef.current; if (node) node.textContent = stampToday(); }, []);
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  useEffect(() => { resize(); const onResize = () => resize(); addEventListener("resize", onResize); return () => removeEventListener("resize", onResize); }, []);
  const loadMarks = async () => {
    try {
      const response = await fetch(`/api/invite/${encodeURIComponent(token)}/marks`);
      const result = await response.json() as { marks?: OwnMark[] };
      setMarks(result.marks ?? []);
    } catch { setMarks([]); }
  };
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  useEffect(() => { fetch(`/api/invite/${encodeURIComponent(token)}/marks`).then(response => response.json() as Promise<{ marks?: OwnMark[] }>).then(result => setMarks(result.marks ?? [])).catch(() => setMarks([])); }, []);
  const point = (event: PointerEvent<HTMLCanvasElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
  const start = (event: PointerEvent<HTMLCanvasElement>) => { const ctx = context(); if (!ctx) return; event.currentTarget.setPointerCapture(event.pointerId); const snapshot = event.currentTarget.toDataURL(); setHistory(items => [...items.slice(-19), snapshot]); setFuture([]); drawing.current = true; touched.current = true; const p = point(event); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (event: PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const ctx = context(); if (!ctx) return; const p = point(event); ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over"; ctx.strokeStyle = color; ctx.lineWidth = tool === "eraser" ? 22 : 3; ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const stop = () => { drawing.current = false; context()?.closePath(); };
  const undo = () => { const element = canvas(); if (!element || !history.length) return; const snapshot = element.toDataURL(); setFuture(items => [snapshot, ...items]); const previous = history[history.length - 1]; setHistory(items => items.slice(0, -1)); restore(previous); touched.current = true; };
  const redo = () => { const element = canvas(); if (!element || !future.length) return; const snapshot = element.toDataURL(); setHistory(items => [...items, snapshot]); restore(future[0]); setFuture(items => items.slice(1)); touched.current = true; };
  const clear = () => { const element = canvas(); const ctx = context(); if (!element || !ctx) return; const snapshot = element.toDataURL(); setHistory(items => [...items.slice(-19), snapshot]); setFuture([]); ctx.clearRect(0, 0, element.width, element.height); touched.current = true; };
  const resetEditor = () => { setEditing(null); setMessage(""); setVisibility("private"); clear(); setHistory([]); setFuture([]); touched.current = false; setMode("write"); };
  const beginEdit = (mark: OwnMark) => {
    setEditing(mark); setMessage(mark.message ?? ""); setVisibility(mark.visibility);
    setHistory([]); setFuture([]); touched.current = Boolean(mark.drawing);
    requestAnimationFrame(() => restore(mark.drawing ?? ""));
    setMode(mark.message ? "write" : "draw");
    setStatus(""); writingRef.current?.focus();
  };
  const submit = async () => {
    const element = canvas(); if (!element) return; setBusy(true); setStatus("Keeping your mark…");
    try {
      const body = editing
        ? { id: editing.id, message, visibility, drawing: touched.current ? element.toDataURL("image/png") : undefined }
        : { message, visibility, drawing: history.length || touched.current ? element.toDataURL("image/png") : "" };
      if (!body.message && body.drawing !== undefined && !body.drawing) { setStatus("Write or draw something first."); setBusy(false); return; }
      const response = await fetch(`/api/invite/${encodeURIComponent(token)}/marks`, { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Your mark could not be saved.");
      setStatus("Kept."); resetEditor(); await loadMarks();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Your mark could not be saved."); }
    finally { setBusy(false); }
  };
  return <div className="mark-studio">
    <div className="mark-composer">
      <div className="mark-modes" role="tablist" aria-label={t("Leave a mark")}>
        <button type="button" role="tab" aria-selected={mode === "write"} className={mode === "write" ? "is-active" : ""} onClick={() => setMode("write")}><T>Write</T></button>
        <button type="button" role="tab" aria-selected={mode === "draw"} className={mode === "draw" ? "is-active" : ""} onClick={() => setMode("draw")}><T>Draw</T></button>
        {editing && <button type="button" className="mark-new" onClick={resetEditor}><T>New card</T></button>}
      </div>
      {mode === "draw" && <div className="mark-toolbar" aria-label={t("Drawing tools")}><button type="button" className={tool === "pen" ? "is-active" : ""} onClick={() => setTool("pen")}><T>Pen</T></button><button type="button" className={tool === "eraser" ? "is-active" : ""} onClick={() => setTool("eraser")}><T>Eraser</T></button><button type="button" onClick={undo} disabled={!history.length}><T>Undo</T></button><button type="button" onClick={redo} disabled={!future.length}><T>Redo</T></button><button type="button" onClick={clear}><T>Clear</T></button></div>}
      {mode === "draw" && <div className="palette" aria-label={t("Ink colour")}>{INKS.map(value => <button type="button" key={value} className={color === value ? "is-active" : ""} onClick={() => { setColor(value); setTool("pen"); }} style={{ background: value }} aria-label={`Use ${value}`} />)}</div>}
      {editing && <p className="mark-editing-note"><T>You are editing a card you kept before. Saving sends it back for review.</T></p>}
      <div className={`postcard-canvas mode-${mode}`} onClick={focusPaper}>
        <span className="postcard-stamp" aria-hidden="true"><img src={STAMP} alt="" /></span>
        <span className="postcard-postmark" aria-hidden="true" ref={postmarkRef} />
        <label className="postcard-writing"><textarea ref={writingRef} aria-label={t("Your message")} value={message} onChange={event => setMessage(event.target.value.slice(0, 1200))} readOnly={mode === "draw"} rows={6} placeholder={mode === "write" ? t("Write something you want us to keep.") : ""} /></label>
        <canvas ref={canvasRef} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} aria-label={t("Postcard drawing area")} />
        <span className="postcard-from"><T>From </T>{guestName}</span>
      </div>
      <p className="mark-hint"><T>Click the paper and write — or switch to Draw and sketch over it.</T></p>
      <fieldset className="visibility-choice"><legend><T>Who may see it after review?</T></legend><label><input type="radio" checked={visibility === "public"} onChange={() => setVisibility("public")} /><T>Everyone</T></label><label><input type="radio" checked={visibility === "private"} onChange={() => setVisibility("private")} /><T>Just Bagas &amp; Iga</T></label></fieldset>
      <button type="button" className="paper-button" disabled={busy} onClick={submit}><T>{editing ? "Update this card" : "Keep this mark"}</T></button><p className="product-status" role="status">{t(status)}</p>
    </div>
    <aside className="mark-collection" aria-label={t("Your postcards")}>
      <h2><T>Your postcards</T></h2>
      {marks === null && <p className="mark-empty"><T>Loading your postcards…</T></p>}
      {marks?.length === 0 && <p className="mark-empty"><T>Nothing here yet — your card will appear beside this note once you keep it.</T></p>}
      <div className="mark-cards">
        {marks?.map(mark => <button type="button" key={mark.id} className={`mark-card${editing?.id === mark.id ? " is-editing" : ""}`} onClick={() => beginEdit(mark)}>
          <span className={`mark-card-status is-${mark.status}`}><T>{mark.status === "approved" ? "Approved" : "In review"}</T></span>
          <span className="mark-card-paper">
            {mark.drawing && <img src={mark.drawing} alt="" />}
            {mark.message && <span className="postcard-writing">{mark.message}</span>}
            {!mark.drawing && !mark.message && <span className="postcard-writing is-drawn"><T>Drawn, not written.</T></span>}
          </span>
          <span className="mark-card-meta"><T>Edit</T> · {new Date(mark.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short" })} · <T>{mark.visibility === "public" ? "Everyone" : "Just Bagas & Iga"}</T></span>
        </button>)}
      </div>
    </aside>
  </div>;
}
