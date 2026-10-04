import type { GuestPassData } from "./guest-pass";
import { WEBSITE_DEFAULTS, weddingDisplay, type WebsiteConfig } from "./website-content";

export async function createPassImage(pass: GuestPassData, language: "en" | "id",website:WebsiteConfig=WEBSITE_DEFAULTS,translate:(s:string)=>string=s=>s): Promise<Blob> {
  const display=weddingDisplay(website,language);
  await document.fonts.ready;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => { const qr = new Image(); qr.onload = () => resolve(qr); qr.onerror = () => reject(new Error("Pass image unavailable")); qr.src = pass.qrData; });
  const canvas = document.createElement("canvas"); canvas.width = 900; canvas.height = 1200;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#21382c"; ctx.fillRect(0, 0, 900, 1200);
  ctx.fillStyle = "#f6f0e3"; ctx.fillRect(45, 45, 810, 1110);
  ctx.strokeStyle = "#aab496"; ctx.strokeRect(63, 63, 774, 1074);
  ctx.textAlign = "center"; ctx.fillStyle = "#21382c";
  const text = (value: string, y: number, size: number, serif = false) => { ctx.font = `${size}px ${serif ? 'Baskerville,"Iowan Old Style",Georgia,serif' : '"Avenir Next",Arial,sans-serif'}`; ctx.fillText(value, 450, y, 700); };
  text(display.names, 160, 58, true); text(`${translate("Guest pass")} · ${display.stamp}`, 214, 26);
  let size = 42; ctx.font = `${size}px Georgia,serif`;
  while (ctx.measureText(pass.guestName).width > 700 && size > 16) { size -= 2; ctx.font = `${size}px Georgia,serif`; }
  ctx.direction = /[\u0590-\u08ff]/.test(pass.guestName) ? "rtl" : "ltr";
  text(pass.guestName, 320, size, true); ctx.direction = "ltr";
  text(language === "id" ? `Maksimal ${pass.partyLimit} tamu` : `Up to ${pass.partyLimit} ${pass.partyLimit === 1 ? "guest" : "guests"}`, 367, 26);
  ctx.drawImage(image, 210, 425, 480, 480);
  text(display.venue, 972, 30, true); text(translate("Show this QR at the entrance"), 1017, 25);
  text(pass.code, 1074, 18);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Pass image unavailable")), "image/png"));
}
