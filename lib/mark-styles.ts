// The five postcard looks locked in sketches/leave-a-mark-v2.
// A style changes paper, stamp, corner botanicals and frame; content stays free.

export const MARK_STYLES = ["classic", "rose", "sage", "airmail", "midnight"] as const;
export type MarkStyle = (typeof MARK_STYLES)[number];

export const DEFAULT_MARK_STYLE: MarkStyle = "classic";

/** Hybrid default: the invitation edition picks the first style; guests can change it. */
export function defaultStyleForEdition(edition: number): MarkStyle {
  const byEdition: MarkStyle[] = ["classic", "rose", "sage"];
  return byEdition[edition % byEdition.length] ?? DEFAULT_MARK_STYLE;
}

export function isMarkStyle(value: unknown): value is MarkStyle {
  return typeof value === "string" && (MARK_STYLES as readonly string[]).includes(value);
}

export function markStyleOr(value: unknown, fallback: MarkStyle = DEFAULT_MARK_STYLE): MarkStyle {
  return isMarkStyle(value) ? value : fallback;
}

/** Corner botanical each style shows (matches the v2 mockup; airmail has none). */
export const MARK_DECOR: Record<MarkStyle, string | null> = {
  classic: "/assets/botanicals/combretum/leaf-sprig.webp",
  rose: "/assets/botanicals/combretum/flower-spray.webp",
  sage: "/assets/botanicals/nephrolepis/frond-short-02.webp",
  airmail: null,
  midnight: "/assets/botanicals/combretum/flower-cascade.webp",
};
