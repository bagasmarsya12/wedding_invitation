/** Move projected light, never the paper, map or event information. */
export function destinationLightShift(scroll: number, top: number, height: number, viewport: number, narrow = false, reduced = false): number {
  if (reduced || height <= 0 || viewport <= 0) return 0;
  const t = Math.max(0, Math.min(1, (scroll + viewport * .5 - top) / height));
  return (t * t * (3 - 2 * t) * 2 - 1) * (narrow ? 8 : 16);
}
