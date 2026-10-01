/** One bounded, reversible journey; never changes document scrolling. */
export function heroPassage(scroll: number, top: number, height: number, reduced = false): number {
  if (reduced || height <= 0) return 0;
  const t = Math.max(0, Math.min(1, (scroll - top) / (height * .82)));
  return t * t * (3 - 2 * t);
}

export function heroCameraDistance(height: number): number {
  return Math.max(1, height) / (2 * Math.tan(Math.PI / 8));
}
