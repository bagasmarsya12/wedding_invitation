export type ArchiveMaterial = "mark" | "photo" | "object" | "paper" | "audio";

export function archiveMaterial(type: string): ArchiveMaterial {
  if (type === "mark") return "mark";
  if (type === "photograph" || type === "photo" || type === "place") return "photo";
  if (type === "object") return "object";
  if (type === "audio") return "audio";
  return "paper";
}

// Public browsing coordinates only: never cache stories, media or guest identity.
export const ARCHIVE_POSITION_KEY = "bagas-iga:archive-position:v1";
export type ArchivePosition = { filter: string; selected: string | null; scroll: number; savedAt: number };

export function parseArchivePosition(raw: string | null, types: string[], slugs: string[], now = Date.now()): ArchivePosition | null {
  try {
    const value = JSON.parse(raw || "null");
    if (!value || !types.includes(value.filter) || (value.selected !== null && !slugs.includes(value.selected))) return null;
    if (!Number.isFinite(value.scroll) || value.scroll < 0 || value.scroll > 1_000_000) return null;
    if (!Number.isFinite(value.savedAt) || now - value.savedAt > 30 * 60_000 || value.savedAt > now + 60_000) return null;
    return { filter: value.filter, selected: value.selected, scroll: value.scroll, savedAt: value.savedAt };
  } catch { return null; }
}
