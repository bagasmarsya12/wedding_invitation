/* eslint-disable @next/next/no-img-element */
"use client";
import { T, useLanguage } from "./language";
import { markStyleOr, MARK_STYLES, DEFAULT_MARK_STYLE, type MarkStyle } from "@/lib/mark-styles";


import { PointerEvent, useEffect, useRef, useState } from "react";

type Tool = "pen" | "eraser";
type Mode = "write" | "draw";
type OwnMark = { id: string; author: string; message: string | null; drawing: string | null; style: string; status: string; createdAt: string };
type WallMark = { id: string; author_name: string; message: string | null; drawingUrl: string | null; style: string; created_at: string };

const INKS = ["#2b2925", "#6f7d60", "#c89094", "#8b7158", "#f6f1e8"];
const STAMPS = [
  "/assets/botanicals/combretum/flower-cluster.webp",
  "/assets/botanicals/combretum/flower-tip-pink.webp",
  "/assets/botanicals/syzygium/branch-short.webp",
];
const STYLE_LABELS: Record<MarkStyle, string> = { classic: "Classic", rose: "Rosé", sage: "Sage", airmail: "Airmail", midnight: "Midnight" };
const STYLE_SWATCH: Record<MarkStyle, string> = {
  classic: "#f9f5ed",
  rose: "#f7e7e4",
  sage: "#e9eddf",
  airmail: "repeating-linear-gradient(45deg,#c14b43 0 3px,#f7f3ec 3px 6px,#3f5d8f 6px 9px,#f7f3ec 9px 12px)",
  midnight: "#303c2d",
};
const DECOR: Record<MarkStyle, string | null> = {
  classic: "/assets/botanicals/combretum/leaf-sprig.webp",
  rose: "/assets/botanicals/combretum/flower-spray.webp",
  sage: "/assets/botanicals/nephrolepis/frond-short-02.webp",
  airmail: null,
  midnight: "/assets/botanicals/combretum/flower-cascade.webp",
};
const stampToday = () => {
  const now = new Date();
  return [now.getDate(), now.getMonth() + 1, now.getFullYear() % 100].map(value => String(value).padStart(2, "0")).join("·");
};

function MiniCard({ mark, index }: { mark: WallMark; index: number }) {
  const style = markStyleOr(mark.style);
  const decor = DECOR[style];
  return (
    <span className={`pc-mini pc--${style}`}>
      <span className="postcard-stamp" aria-hidden="true"><img src={STAMPS[index % STAMPS.length]} alt="" /></span>
      {mark.drawingUrl && <img className="postcard-ink" src={mark.drawingUrl} alt="" />}
      {mark.message
        ? <span className="postcard-writing">{mark.message}</span>
        : <span className="postcard-writing is-drawn"><T>Drawn, not written.</T></span>}
      {mark.author_name && <span className="postcard-from">{mark.author_name}</span>}
      {decor && <img className="pc-decor" src={decor} alt="" aria-hidden="true" />}
    </span>
  );
}

export function MarkEditor({ token, guestName, defaultStyle = DEFAULT_MARK_STYLE }: { token: string; guestName: string; defaultStyle?: MarkStyle }) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [mode, setMode] = useState<Mode>("write");
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(INKS[0]);
  const [message, setMessage] = useState("");
  const [style, setStyle] = useState<MarkStyle>(defaultStyle);
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [marks, setMarks] = useState<OwnMark[] | null>(null);
  const [wall, setWall] = useState<WallMark[] | null>(null);
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
  const loadWall = async () => {
    try {
      const response = await fetch("/api/marks");
      const result = await response.json() as { marks?: WallMark[] };
      setWall(result.marks ?? []);
    } catch { setWall([]); }
  };
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  useEffect(() => { fetch(`/api/invite/${encodeURIComponent(token)}/marks`).then(response => response.json() as Promise<{ marks?: OwnMark[] }>).then(result => setMarks(result.marks ?? [])).catch(() => setMarks([])); fetch("/api/marks").then(response => response.json() as Promise<{ marks?: WallMark[] }>).then(result => setWall(result.marks ?? [])).catch(() => setWall([])); }, []);
  const point = (event: PointerEvent<HTMLCanvasElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
  const start = (event: PointerEvent<HTMLCanvasElement>) => { const ctx = context(); if (!ctx) return; event.currentTarget.setPointerCapture(event.pointerId); const snapshot = event.currentTarget.toDataURL(); setHistory(items => [...items.slice(-19), snapshot]); setFuture([]); drawing.current = true; touched.current = true; const p = point(event); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (event: PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const ctx = context(); if (!ctx) return; const p = point(event); ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over"; ctx.strokeStyle = color; ctx.lineWidth = tool === "eraser" ? 22 : 3; ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const stop = () => { drawing.current = false; context()?.closePath(); };
  const undo = () => { const element = canvas(); if (!element || !history.length) return; const snapshot = element.toDataURL(); setFuture(items => [snapshot, ...items]); const previous = history[history.length - 1]; setHistory(items => items.slice(0, -1)); restore(previous); touched.current = true; };
  const redo = () => { const element = canvas(); if (!element || !future.length) return; const snapshot = element.toDataURL(); setHistory(items => [...items, snapshot]); restore(future[0]); setFuture(items => items.slice(1)); touched.current = true; };
  const clear = () => { const element = canvas(); const ctx = context(); if (!element || !ctx) return; const snapshot = element.toDataURL(); setHistory(items => [...items.slice(-19), snapshot]); setFuture([]); ctx.clearRect(0, 0, element.width, element.height); touched.current = true; };
  const resetEditor = () => { setEditing(null); setMessage(""); setStyle(defaultStyle); clear(); setHistory([]); setFuture([]); touched.current = false; setMode("write"); };
  const beginEdit = (mark: OwnMark) => {
    setEditing(mark); setMessage(mark.message ?? ""); setStyle(markStyleOr(mark.style));
    setHistory([]); setFuture([]); touched.current = Boolean(mark.drawing);
    requestAnimationFrame(() => restore(mark.drawing ?? ""));
    setMode(mark.message ? "write" : "draw");
    setStatus(""); writingRef.current?.focus();
  };
  const submit = async () => {
    const element = canvas(); if (!element) return; setBusy(true); setStatus("Keeping your mark…");
    try {
      const body = editing
        ? { id: editing.id, message, style, drawing: touched.current ? element.toDataURL("image/png") : undefined }
        : { message, style, drawing: history.length || touched.current ? element.toDataURL("image/png") : "" };
      if (!body.message && body.drawing !== undefined && !body.drawing) { setStatus("Write or draw something first."); setBusy(false); return; }
      const response = await fetch(`/api/invite/${encodeURIComponent(token)}/marks`, { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Your mark could not be saved.");
      setStatus("Kept."); resetEditor(); await loadMarks(); loadWall();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Your mark could not be saved."); }
    finally { setBusy(false); }
  };
  const ownIds = new Set((marks ?? []).map(mark => mark.id));
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
      <div className={`postcard-canvas pc--${style} mode-${mode}`} onClick={focusPaper}>
        <span className="postcard-stamp" aria-hidden="true"><img src={STAMPS[0]} alt="" /></span>
        <span className="postcard-postmark" aria-hidden="true" ref={postmarkRef} />
        <label className="postcard-writing"><textarea ref={writingRef} aria-label={t("Your message")} value={message} onChange={event => setMessage(event.target.value.slice(0, 1200))} readOnly={mode === "draw"} rows={6} placeholder={mode === "write" ? t("Write something you want us to keep.") : ""} /></label>
        <canvas ref={canvasRef} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} aria-label={t("Postcard drawing area")} />
        <span className="postcard-from"><T>From </T>{guestName}</span>
        {DECOR[style] && <img className="pc-decor" src={DECOR[style] as string} alt="" aria-hidden="true" />}
      </div>
      <p className="mark-hint"><T>Click the paper and write — or switch to Draw and sketch over it.</T></p>
      <div className="style-swatches" role="group" aria-label={t("Card style")}>
        {MARK_STYLES.map(value => <button type="button" key={value} className={style === value ? "is-on" : ""} onClick={() => setStyle(value)} title={t(STYLE_LABELS[value])} aria-label={t(STYLE_LABELS[value])} aria-pressed={style === value} style={{ background: STYLE_SWATCH[value] }} />)}
        <span className="caption"><T>Card style — click to try</T></span>
      </div>
      <button type="button" className="paper-button" disabled={busy} onClick={submit}><T>{editing ? "Update this card" : "Keep this mark"}</T></button><p className="product-status" role="status">{t(status)}</p>
      <div className="mystrip">
        <h3><T>Your postcards</T></h3>
        {marks === null && <p className="mark-empty"><T>Loading your postcards…</T></p>}
        {marks?.length === 0 && <p className="mark-empty"><T>Nothing here yet — your card will appear beside this note once you keep it.</T></p>}
        {marks && marks.length > 0 && <div className="strip-row">
          {marks.map(mark => <button type="button" key={mark.id} className={`strip-card${editing?.id === mark.id ? " is-editing" : ""}`} onClick={() => beginEdit(mark)}>
            <MiniCard mark={{ id: mark.id, author_name: "", message: mark.message, drawingUrl: mark.drawing, style: mark.style, created_at: mark.createdAt }} index={0} />
            <span className={`chip ${mark.status === "approved" ? "is-approved" : "is-pending"}`}><T>{mark.status === "approved" ? "On the wall" : "In review"}</T></span>
          </button>)}
          <button type="button" className="strip-add" onClick={resetEditor}><span aria-hidden="true">+</span><span><T>New card</T></span></button>
        </div>}
      </div>
    </div>
    <aside className="mark-wall" aria-label={t("The wall")}>
      <h2><T>The wall</T></h2>
      <p className="wall-caption"><T>Approved postcards from every guest.</T></p>
      {wall === null && <p className="mark-empty"><T>Loading the wall…</T></p>}
      {wall?.length === 0 && <p className="mark-empty"><T>Nothing here yet — approved postcards will fill the wall.</T></p>}
      {wall && wall.length > 0 && <div className="wall-grid">
        {wall.map((mark, index) => <div key={mark.id} className={`wall-card${ownIds.has(mark.id) ? " is-mine" : ""}`}>
          <span className="wall-pin" aria-hidden="true" />
          <MiniCard mark={mark} index={index} />
        </div>)}
      </div>}
    </aside>
  </div>;
}
