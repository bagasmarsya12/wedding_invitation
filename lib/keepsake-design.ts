import type { CalendarLanguage } from "./wedding-calendar";
import { WEBSITE_DEFAULTS, weddingDisplay, type WebsiteConfig } from "./website-content";

export type KeepsakeFace = "front" | "back";
export type KeepsakeCopy = {
  forLabel:string;genericRecipient:string;note1:string;note2:string;love:string;
  editionLabel:string;turn:string;return:string;front:string;back:string;hint:string;
};
export type KeepsakeData = { language: CalendarLanguage; name: string; edition: number; website?:WebsiteConfig; copy?:KeepsakeCopy };
type Artwork = { src: string; width: number; height: number };
export const KEEPSAKE_ART: Record<string, Artwork> = {
  paper: { src: "/assets/15-paper-fiber-texture.webp", width: 640, height: 640 },
  mark: { src: "/assets/bagas-iga-mark.webp", width: 400, height: 400 },
  orchid: { src: "/assets/botanicals/dendrobium/branch-short.webp", width: 251, height: 362 },
  fern: { src: "/assets/botanicals/nephrolepis/frond-arched-01.webp", width: 657, height: 246 },
  buds: { src: "/assets/botanicals/syzygium/branch-short.webp", width: 270, height: 305 },
  rose: { src: "/assets/botanicals/melastoma/branch-short.webp", width: 286, height: 361 },
  leaf: { src: "/assets/botanicals/syzygium/branch-long.webp", width: 496, height: 449 },
};
type Plant = { art: string; x: number; y: number; width: number; rotation: number };
export const KEEPSAKE_PLANTS: Record<KeepsakeFace, Plant[]> = {
  front: [
    { art: "buds", x: -113, y: 118, width: 270, rotation: -17 },
    { art: "rose", x: 694, y: -108, width: 286, rotation: 146 },
    { art: "orchid", x: -76, y: -88, width: 251, rotation: 108 },
    { art: "orchid", x: 90, y: -180, width: 231, rotation: 73 },
    { art: "orchid", x: 743, y: 33, width: 251, rotation: -18 },
    { art: "orchid", x: -132, y: 690, width: 251, rotation: 18 },
    { art: "fern", x: -170, y: 1120, width: 657, rotation: -24 },
    { art: "fern", x: 487, y: 1128, width: 590, rotation: 24 },
    { art: "rose", x: 5, y: 990, width: 286, rotation: -12 },
    { art: "buds", x: 755, y: 945, width: 270, rotation: 25 },
    { art: "leaf", x: 656, y: 1120, width: 350, rotation: -38 },
    { art: "fern", x: -196, y: 1170, width: 620, rotation: 164 },
  ],
  back: [
    { art: "buds", x: -105, y: -104, width: 270, rotation: 115 },
    { art: "orchid", x: 728, y: -50, width: 251, rotation: -16 },
    { art: "fern", x: -135, y: 1130, width: 657, rotation: -24 },
    { art: "rose", x: 729, y: 940, width: 286, rotation: 17 },
    { art: "leaf", x: 625, y: 1100, width: 350, rotation: -38 },
  ],
};

export function normalizeKeepsakeName(value: string): string {
  return Array.from(value.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()).slice(0, 120).join("");
}

export function keepsakeText(data: KeepsakeData) {
  const id = data.language === "id";
  const config=data.website??WEBSITE_DEFAULTS;
  const display=weddingDisplay(config,data.language);
  const defaults={
    forLabel: id ? "Untuk" : "For",
    genericRecipient: id ? "kamu" : "you",
    note: id ? ["Sedikit dari hari kami,", "untuk kamu simpan."] : ["A little of our day,", "kept for you."],
    love: id ? "Dengan sayang," : "With love,",
    edition: `${id ? "Edisi tamu" : "Guest edition"} ${String(data.edition + 1).padStart(2, "0")}`,
    turn: id ? "Balik kartunya" : "Turn it over",
    return: id ? "Kembali ke depan" : "Return to the front",
    front: id ? "Sisi depan kartu" : "Front of the card",
    back: id ? "Sisi belakang kartu" : "Back of the card",
    hint: id ? "Dua sisi dari hari yang sama." : "Two sides of the same day.",
    day: new Intl.DateTimeFormat(id ? "id-ID" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${config.weddingDate}T12:00:00+07:00`)),
    venue: display.venue,
  };
  return {...defaults,...data.copy,
    note:data.copy?[data.copy.note1,data.copy.note2]:defaults.note,
    edition:`${data.copy?.editionLabel??(id?"Edisi tamu":"Guest edition")} ${String(data.edition+1).padStart(2,"0")}`,
    names:display.names,firstName:config.firstName,secondName:config.secondName,
    stamp:display.stamp,date:config.weddingDate,
  };
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function plants(face: KeepsakeFace): string {
  return KEEPSAKE_PLANTS[face].map(plant => {
    const art = KEEPSAKE_ART[plant.art];
    return `<img class="k-plant" src="${art.src}" alt="" aria-hidden="true" draggable="false" width="${art.width}" height="${art.height}" style="left:${plant.x / 9}%;top:${plant.y / 12}%;width:min(${plant.width / 9}%,calc(${art.width}px / var(--botanical-dpr,1)));transform:rotate(${plant.rotation}deg)">`;
  }).join("");
}

// Authored markup is shared by the live card and the offline artifact. Every
// recipient value is escaped as text, never included in scripts or URLs.
export function keepsakeMarkup(data: KeepsakeData): string {
  const text = keepsakeText(data);
  const recipient = escapeHtml(data.name || text.genericRecipient);
  const long = data.name.length > 90 ? " k-very-long-name" : data.name.length > 55 ? " k-long-name" : data.name.length > 30 ? " k-medium-name" : "";
  return `<div class="k-tilt"><div class="k-turn">
    <article class="k-face k-front" aria-label="${escapeHtml(text.front)}">
      <div class="k-arch" aria-hidden="true"></div><div class="k-arch-rim" aria-hidden="true"></div>
      <img class="k-mark" src="${KEEPSAKE_ART.mark.src}" width="400" height="400" alt="${escapeHtml(text.names)}" draggable="false">
      <h3 class="k-names"><span>${escapeHtml(text.firstName)}</span><i aria-hidden="true">×</i><span>${escapeHtml(text.secondName)}</span></h3>
      <time class="k-date" datetime="${escapeHtml(text.date)}">${escapeHtml(text.stamp)}</time>
      <p class="k-venue">${escapeHtml(text.venue)}</p>
      <div class="k-recipient${long}"><span>${escapeHtml(text.forLabel)}</span><strong dir="auto">${recipient}</strong></div>
      <span class="k-edition">${escapeHtml(text.edition)}</span>${plants("front")}<div class="k-sheen" aria-hidden="true"></div>
    </article>
    <article class="k-face k-back" aria-label="${escapeHtml(text.back)}" aria-hidden="true">
      <div class="k-back-rim" aria-hidden="true"></div>
      <div class="k-letter${long}"><p class="k-for">${escapeHtml(text.forLabel)}</p><h3 class="k-guest" dir="auto">${recipient}</h3>
      <span class="k-letter-rule" aria-hidden="true"></span><p class="k-note">${text.note.map(escapeHtml).join("<br>")}</p>
      <p class="k-love">${escapeHtml(text.love)}</p><p class="k-signature">${escapeHtml(text.firstName)} <i aria-hidden="true">×</i> ${escapeHtml(text.secondName)}</p>
      <time class="k-back-date" datetime="${escapeHtml(text.date)}">${escapeHtml(text.day)}</time><p class="k-back-venue">${escapeHtml(text.venue)}</p></div>
      <span class="k-edition">${escapeHtml(text.edition)}</span>${plants("back")}<div class="k-sheen" aria-hidden="true"></div>
    </article></div></div>`;
}

export const KEEPSAKE_SCENE_CSS = `
.k-scene{--k-paper:#f6f0e3;--k-forest:#21382c;--k-ink:#292721;--k-rose:#a96c78;--k-serif:Baskerville,"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;--k-sans:"Avenir Next",Avenir,"Helvetica Neue",Arial,sans-serif;color:var(--k-paper);font-family:var(--k-sans);text-align:center}
.k-stage{position:relative;display:grid;place-items:center;perspective:1600px;padding:1.5rem 2rem 2rem;isolation:isolate;background:radial-gradient(ellipse at 50% 45%,#354d39 0,transparent 68%)}
.k-stage:after{content:"";position:absolute;z-index:-1;bottom:1.4rem;left:18%;width:64%;height:1.2rem;border-radius:50%;background:radial-gradient(ellipse,#080f0baa,transparent 70%)}
.k-stage{animation:k-reveal 650ms cubic-bezier(.2,.75,.25,1) both}@keyframes k-reveal{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.k-tilt{position:relative;width:min(26rem,100%);aspect-ratio:3/4;container-type:inline-size;transform:rotateX(var(--k-tilt-x,0deg)) rotateY(var(--k-tilt-y,0deg));transform-style:preserve-3d;transition:transform 180ms ease-out;will-change:auto}
.k-turn{position:absolute;inset:0;transform-style:preserve-3d;transition:transform 850ms cubic-bezier(.2,.75,.25,1)}
.k-scene[data-face=back] .k-turn{transform:rotateY(180deg)}
.k-face{box-sizing:border-box;position:absolute;inset:0;margin:0;overflow:hidden;border:1px solid #aab49677;border-radius:3px;backface-visibility:hidden;box-shadow:0 1px 0 #d3c5a6,4px 4px 0 #384837,0 1.5rem 3rem #080f0b88}
.k-front{color:var(--k-ink);background:#21382c;transform:translateZ(1px)}
.k-arch{position:absolute;inset:5% 7% 4%;border:1px solid #d3c5a6;background:var(--k-paper) url('/assets/15-paper-fiber-texture.webp') center/640px;border-radius:50% 50% 2px 2px / 32% 32% 2px 2px;box-shadow:0 0 0 1.1cqw #55674b,0 0 0 1.6cqw #9eac8555}
.k-arch-rim{position:absolute;inset:7% 9% 6%;border:1px solid #62734c55;border-radius:50% 50% 2px 2px / 31% 31% 2px 2px}
.k-mark{position:absolute;left:43.33%;top:20%;width:13.33%;height:auto;mix-blend-mode:multiply}
.k-face .k-names{position:absolute;z-index:1;top:33%;left:22%;width:56%;margin:0;font:400 11.56cqw/.97 var(--k-serif);letter-spacing:-.04em;text-align:center}
.k-names span{display:block}.k-names i{display:block;margin:.23em 0 .28em;font:400 4.4cqw/1 var(--k-sans);color:var(--k-rose)}
.k-date{position:absolute;z-index:1;top:60%;left:22%;width:56%;font:400 3.78cqw/1.4 var(--k-serif);color:#49533d}
.k-face .k-venue{position:absolute;z-index:1;top:65%;left:22%;width:56%;margin:0;font:400 3.33cqw/1.4 var(--k-serif);color:#49533d}
.k-recipient{position:absolute;z-index:1;top:72%;left:20%;width:60%;color:#49533d}.k-recipient>span{display:block;margin-bottom:.4em;font:italic 2.8cqw/1.3 var(--k-serif)}
.k-recipient strong{display:block;font:400 3.6cqw/1.3 var(--k-serif);overflow-wrap:anywhere}.k-recipient.k-long-name strong{font-size:2.6cqw}.k-recipient.k-very-long-name strong{font-size:2.2cqw}
.k-edition{position:absolute;z-index:4;left:30%;width:40%;top:2%;font:400 1.85cqw/1.5 var(--k-sans);letter-spacing:.04em;text-align:center}
.k-front .k-edition{color:#c5cba9}.k-plant{position:absolute;z-index:2;display:block;height:auto;max-width:none;pointer-events:none;user-select:none}
.k-sheen{position:absolute;z-index:3;inset:0;pointer-events:none;background:radial-gradient(ellipse at var(--k-light-x,25%) var(--k-light-y,20%),#fff8d713,transparent 60%)}
.k-back{color:var(--k-paper);background:#122b20;transform:rotateY(180deg) translateZ(1px)}
.k-back-rim{position:absolute;inset:5%;border:1px solid #aab49666}.k-back-rim:after{content:"";position:absolute;inset:2%;border:1px solid #aab49633}
.k-letter{position:absolute;z-index:1;top:18%;left:20%;width:60%;text-align:center}
.k-face .k-for{margin:0 0 1em;font:italic 3.6cqw/1.4 var(--k-serif);color:#c5cba9}
.k-face .k-guest{display:flex;align-items:center;justify-content:center;min-height:24cqw;margin:0;font:400 7cqw/1.12 var(--k-serif);letter-spacing:-.025em;overflow-wrap:anywhere}
.k-letter.k-medium-name .k-guest{font-size:5cqw}.k-letter.k-long-name .k-guest{font-size:4cqw;min-height:25cqw}.k-letter.k-very-long-name .k-guest{font-size:3cqw;min-height:25cqw}
.k-letter-rule{display:block;width:14%;height:1px;margin:5cqw auto;background:#aab49688}
.k-face .k-note{margin:0;font:400 4.8cqw/1.25 var(--k-serif);letter-spacing:-.02em}
.k-face .k-love{margin:7cqw 0 2cqw;font:italic 3cqw/1.5 var(--k-serif);color:#c5cba9}
.k-face .k-signature{margin:0;font:400 5.8cqw/1.2 var(--k-serif)}.k-signature i{font-style:normal;color:#c4878d}
.k-back-date{display:block;margin-top:6cqw;font:400 2.5cqw/1.5 var(--k-sans);color:#c5cba9}.k-face .k-back-venue{margin:.4em 0 0;font:400 2.5cqw/1.5 var(--k-sans);color:#c5cba9}.k-back .k-edition{color:#c5cba9}
.k-controls{display:flex;justify-content:center;align-items:center;gap:1rem}.k-controls button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:.6rem;min-height:44px;margin:0;padding:.5rem 1rem;border:1px solid #aab49677;background:transparent;color:#f6f0e3;font:400 .78rem/1.5 var(--k-sans);letter-spacing:0;cursor:pointer}.k-controls button:hover{background:#f6f0e30a;color:#f6f0e3}.k-controls button:focus-visible{outline:2px solid #c4878d;outline-offset:4px}
.k-hint{margin:.65rem 0 0;color:#b7bea3;font:400 .68rem/1.5 var(--k-sans)}
@media(max-width:720px){.k-stage{padding:1.25rem 2rem 1.75rem}.k-tilt{width:min(23rem,100%)}}
@media(prefers-reduced-motion:reduce){.k-stage,.k-tilt,.k-turn{transition:none!important;animation:none!important}.k-tilt{transform:none!important}}
`;
