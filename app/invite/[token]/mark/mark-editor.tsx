"use client";
import { T, useLanguage } from "../../../language";


import { PointerEvent, useEffect, useRef, useState } from "react";

type Tool = "pen" | "eraser";

export function MarkEditor({ token, guestName }: { token: string; guestName: string }) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#2b2925");
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const canvas = () => canvasRef.current;
  const context = () => canvas()?.getContext("2d", { willReadFrequently: true });
  const resize = () => {
    const element = canvas(); if (!element) return;
    const rect = element.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const snapshot = element.width ? element.toDataURL() : "";
    element.width = Math.round(rect.width * ratio); element.height = Math.round(rect.height * ratio);
    const ctx = context(); if (!ctx) return; ctx.scale(ratio, ratio); ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (snapshot) restore(snapshot);
  };
  const restore = (url: string) => { const ctx = context(); const element = canvas(); if (!ctx || !element) return; ctx.clearRect(0, 0, element.width, element.height); if (!url) return; const image = new Image(); image.onload = () => { ctx.save(); ctx.globalCompositeOperation = "source-over"; ctx.drawImage(image, 0, 0, element.clientWidth, element.clientHeight); ctx.restore(); }; image.src = url; };
  useEffect(() => { resize(); const onResize = () => resize(); addEventListener("resize", onResize); return () => removeEventListener("resize", onResize); }, []);
  const point = (event: PointerEvent<HTMLCanvasElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
  const start = (event: PointerEvent<HTMLCanvasElement>) => { const ctx = context(); if (!ctx) return; event.currentTarget.setPointerCapture(event.pointerId); const snapshot = event.currentTarget.toDataURL(); setHistory(items => [...items.slice(-19), snapshot]); setFuture([]); drawing.current = true; const p = point(event); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (event: PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const ctx = context(); if (!ctx) return; const p = point(event); ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over"; ctx.strokeStyle = color; ctx.lineWidth = tool === "eraser" ? 22 : 3; ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const stop = () => { drawing.current = false; context()?.closePath(); };
  const undo = () => { const element = canvas(); if (!element || !history.length) return; const snapshot = element.toDataURL(); setFuture(items => [snapshot, ...items]); const previous = history[history.length - 1]; setHistory(items => items.slice(0, -1)); restore(previous); };
  const redo = () => { const element = canvas(); if (!element || !future.length) return; const snapshot = element.toDataURL(); setHistory(items => [...items, snapshot]); restore(future[0]); setFuture(items => items.slice(1)); };
  const clear = () => { const element = canvas(); const ctx = context(); if (!element || !ctx) return; const snapshot = element.toDataURL(); setHistory(items => [...items.slice(-19), snapshot]); setFuture([]); ctx.clearRect(0, 0, element.width, element.height); };
  const submit = async () => {
    const element = canvas(); if (!element) return; setBusy(true); setStatus("Keeping your mark…");
    try {
      const response = await fetch(`/api/invite/${encodeURIComponent(token)}/marks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, visibility, drawing: history.length ? element.toDataURL("image/png") : "" }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Your mark could not be saved.");
      setStatus("Kept."); setMessage(""); clear(); setHistory([]); setFuture([]);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Your mark could not be saved."); }
    finally { setBusy(false); }
  };
  return <div className="mark-studio">
    <div className="mark-toolbar" aria-label={t("Drawing tools")}><button className={tool === "pen" ? "is-active" : ""} onClick={() => setTool("pen")}><T>Pen</T></button><button className={tool === "eraser" ? "is-active" : ""} onClick={() => setTool("eraser")}><T>Eraser</T></button><button onClick={undo} disabled={!history.length}><T>Undo</T></button><button onClick={redo} disabled={!future.length}><T>Redo</T></button><button onClick={clear}><T>Clear</T></button></div>
    <div className="palette" aria-label={t("Ink colour")}>{["#2b2925", "#6f7d60", "#c89094", "#8b7158", "#f6f1e8"].map(value => <button key={value} className={color === value ? "is-active" : ""} onClick={() => { setColor(value); setTool("pen"); }} style={{ background: value }} aria-label={`Use ${value}`} />)}</div>
    <div className="postcard-canvas"><span><T>From </T>{guestName}</span><canvas ref={canvasRef} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} aria-label={t("Postcard drawing area")} /></div>
    <label className="mark-message"><T>Add words</T><textarea value={message} onChange={event => setMessage(event.target.value.slice(0, 1200))} rows={5} placeholder={t("Write something you want us to keep.")} /></label>
    <fieldset className="visibility-choice"><legend><T>Who may see it after review?</T></legend><label><input type="radio" checked={visibility === "public"} onChange={() => setVisibility("public")} /><T>Everyone</T></label><label><input type="radio" checked={visibility === "private"} onChange={() => setVisibility("private")} /><T>Just Bagas & Iga</T></label></fieldset>
    <button className="paper-button" disabled={busy} onClick={submit}><T>Keep this mark</T></button><p className="product-status" role="status">{t(status)}</p>
  </div>;
}
