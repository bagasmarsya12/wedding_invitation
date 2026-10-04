import { KEEPSAKE_ART, KEEPSAKE_PLANTS, keepsakeText, type KeepsakeData, type KeepsakeFace } from "./keepsake-design";

export const KEEPSAKE_SIZE = { width: 900, height: 1200 };
type KeepsakeFonts = { serif: string; sans: string };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Keepsake artwork unavailable"));
    image.src = src;
  });
}

export async function createWeddingKeepsake(data: KeepsakeData, face: KeepsakeFace, fonts: KeepsakeFonts): Promise<Blob> {
  const entries = await Promise.all(Object.entries(KEEPSAKE_ART).map(async ([key, art]) => [key, await loadImage(art.src)] as const));
  await document.fonts.ready;
  const images = Object.fromEntries(entries);
  const canvas = document.createElement("canvas");
  canvas.width = KEEPSAKE_SIZE.width;
  canvas.height = KEEPSAKE_SIZE.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  const ctx = context;
  const serif = fonts.serif || 'Baskerville, "Iowan Old Style", Georgia, serif';
  const sans = fonts.sans || '"Avenir Next", Avenir, Arial, sans-serif';
  const copy = keepsakeText(data);

  function arch(inset: number) {
    const left = 63 + inset, right = 837 - inset, top = 60 + inset, bottom = 1152 - inset;
    ctx.beginPath();
    ctx.moveTo(left, bottom); ctx.lineTo(left, 405);
    ctx.bezierCurveTo(left, 215, 237, top, 450, top);
    ctx.bezierCurveTo(663, top, right, 215, right, 405);
    ctx.lineTo(right, bottom); ctx.closePath();
  }
  function text(value: string, x: number, y: number, size: number, family = serif, color = "#292721", italic = false) {
    ctx.fillStyle = color;
    ctx.font = `${italic ? "italic " : ""}${size}px ${family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(value, x, y);
  }
  function recipient(value: string, centerY: number, maxSize: number, color: string) {
    function wrap(size: number): string[] {
      ctx.font = `${size}px ${serif}`;
      const lines: string[] = [];
      let line = "";
      for (const word of value.split(" ")) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width <= 530) { line = next; continue; }
        if (line) lines.push(line);
        line = "";
        // Names wrap at spaces; only an oversized unbroken part splits by glyph.
        for (const character of Array.from(word)) {
          if (ctx.measureText(line + character).width > 530 && line) { lines.push(line); line = character; }
          else line += character;
        }
      }
      if (line) lines.push(line.trim());
      return lines;
    }
    let size = maxSize, lines = wrap(size);
    while (lines.length > 3 && size > 12) { size -= 2; lines = wrap(size); }
    const leading = size * 1.15;
    const first = centerY - (lines.length - 1) * leading / 2;
    ctx.direction = /[\u0590-\u08ff]/.test(value) ? "rtl" : "ltr";
    lines.forEach((line, index) => text(line, 450, first + index * leading, size, serif, color));
    ctx.direction = "ltr";
  }

  ctx.fillStyle = face === "front" ? "#21382c" : "#122b20";
  ctx.fillRect(0, 0, 900, 1200);
  ctx.strokeStyle = "#aab49677";
  ctx.strokeRect(.5, .5, 899, 1199);
  if (face === "front") {
    arch(-13); ctx.fillStyle = "#55674b"; ctx.fill();
    arch(0); ctx.fillStyle = "#f6f0e3"; ctx.fill();
    const pattern = ctx.createPattern(images.paper, "repeat");
    if (pattern) { ctx.save(); ctx.clip(); ctx.globalAlpha = .45; ctx.fillStyle = pattern; ctx.fillRect(0, 0, 900, 1200); ctx.restore(); }
    arch(0); ctx.strokeStyle = "#d3c5a6"; ctx.stroke();
    arch(18); ctx.strokeStyle = "#62734c55"; ctx.stroke();
    ctx.drawImage(images.mark, 390, 240, 120, 120);
    text(copy.firstName, 450, 489, 104); text("×", 450, 543, 40, sans, "#a96c78"); text(copy.secondName, 450, 642, 104);
    text(copy.stamp, 450, 753, 34, serif, "#49533d");
    text(copy.venue, 450, 803, 30, serif, "#49533d");
    text(copy.forLabel, 450, 885, 25, serif, "#49533d", true);
    recipient(data.name || copy.genericRecipient, 941, data.name.length > 90 ? 20 : data.name.length > 55 ? 23 : 32, "#49533d");
  } else {
    ctx.strokeStyle = "#aab49666"; ctx.strokeRect(45, 60, 810, 1080);
    ctx.strokeStyle = "#aab49633"; ctx.strokeRect(61, 82, 778, 1036);
    text(copy.forLabel, 450, 286, 33, serif, "#c5cba9", true);
    recipient(data.name || copy.genericRecipient, 416, data.name.length > 90 ? 27 : data.name.length > 55 ? 36 : data.name.length > 30 ? 45 : 63, "#f6f0e3");
    ctx.strokeStyle = "#aab49688"; ctx.beginPath(); ctx.moveTo(412, 584); ctx.lineTo(488, 584); ctx.stroke();
    text(copy.note[0], 450, 655, 43, serif, "#f6f0e3"); text(copy.note[1], 450, 710, 43, serif, "#f6f0e3");
    text(copy.love, 450, 803, 27, serif, "#c5cba9", true);
    text(copy.names, 450, 865, 52, serif, "#f6f0e3");
    text(copy.day, 450, 945, 22, sans, "#c5cba9"); text(copy.venue, 450, 978, 22, sans, "#c5cba9");
  }
  for (const plant of KEEPSAKE_PLANTS[face]) {
    const image = images[plant.art];
    const width = Math.min(plant.width, image.naturalWidth), height = width * image.naturalHeight / image.naturalWidth;
    ctx.save(); ctx.translate(plant.x + width / 2, plant.y + height / 2); ctx.rotate(plant.rotation * Math.PI / 180);
    ctx.drawImage(image, -width / 2, -height / 2, width, height); ctx.restore();
  }
  text(copy.edition, 450, 42, 16, sans, "#c5cba9");
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Keepsake export unavailable")), "image/png");
  });
}
