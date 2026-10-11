import { KEEPSAKE_ART, keepsakeText, type KeepsakeData } from './keepsake-design';
import { createWeddingKeepsake } from './wedding-keepsake';

export type AtelierSurface = { art: HTMLCanvasElement; fx: HTMLCanvasElement; lines?: string[] };
export type AtelierDesign = { front: AtelierSurface; backs: AtelierSurface[]; accents: HTMLCanvasElement[] };

/** Preview and Story export use the same current card content and gold mask. */
export async function prepareAtelierKeepsake(data: KeepsakeData, { storyAccents = false } = {}): Promise<AtelierDesign> {
  const surfaces = await Promise.all((['front', 'back'] as const).map(async side => {
    const blob = await createWeddingKeepsake(data, side, { serif: 'Newsreader, Georgia, serif', sans: '"Instrument Sans", Arial, sans-serif' });
    const bitmap = await createImageBitmap(blob);
    const art = document.createElement('canvas'); art.width = 900; art.height = 1200;
    const ctx = art.getContext('2d');
    if (!ctx) { bitmap.close(); throw new Error('Canvas unavailable'); }
    ctx.drawImage(bitmap, 0, 0); bitmap.close();
    const fx = document.createElement('canvas'); fx.width = 900; fx.height = 1200;
    const mask = fx.getContext('2d');
    if (!mask) throw new Error('Canvas unavailable');
    const image = ctx.getImageData(0, 0, 900, 1200);
    for (let p = 0; p < image.data.length; p += 4) {
      const r = image.data[p], g = image.data[p + 1], b = image.data[p + 2];
      const gold = r > 110 && g > 75 && r > g * 1.06 && g > b * 1.24 && r - g < 110;
      image.data[p] = gold ? 220 : 0; image.data[p + 1] = 0; image.data[p + 2] = gold ? 150 : 0; image.data[p + 3] = 255;
    }
    mask.putImageData(image, 0, 0);
    return { art, fx };
  }));
  const accents: HTMLCanvasElement[] = [];
  if (storyAccents) {
    const flowers = new Image(); flowers.src = KEEPSAKE_ART.florals.src; await flowers.decode();
    // Runtime crops of the approved floral master; no new or regenerated artwork.
    for (const [x, y, width, height] of [[0, 0, 615, 540], [470, 948, 616, 500]]) {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
      ctx.drawImage(flowers, x, y, width, height, 0, 0, width, height);
      // Only internal crop boundaries blend into the Story garden. The master
      // and all card pixels stay intact; printed petals keep their own edges.
      const pixels = ctx.getImageData(0, 0, width, height);
      for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
        const edge = Math.min(1, x > 0 ? px / 68 : 1, y > 0 ? py / 68 : 1,
          x + width < flowers.naturalWidth ? (width - 1 - px) / 68 : 1,
          y + height < flowers.naturalHeight ? (height - 1 - py) / 68 : 1);
        pixels.data[(py * width + px) * 4 + 3] *= edge * edge * (3 - 2 * edge);
      }
      ctx.putImageData(pixels, 0, 0); accents.push(canvas);
    }
  }
  return { front: surfaces[0], backs: [{ ...surfaces[1], lines: keepsakeText(data).note }], accents };
}
