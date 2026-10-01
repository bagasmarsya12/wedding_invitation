/** Screen-space scheduling only; it must never change a chapter's composition. */
export function gardenWindow(top: number, height: number, scroll: number, viewport: number) {
  return {
    prepare: top < scroll + viewport * 2.2 && top + height > scroll - viewport,
    retain: top < scroll + viewport * 3.2 && top + height > scroll - viewport * 2,
  };
}
