import { db } from "@/lib/server";
import { cache } from 'react';
import { CONTENT_DEFAULTS, CONTENT_SECTIONS, type ContentMap } from "@/lib/content-defaults";

export type ResolvedContent = { values: ContentMap; overrides: ContentMap };

/**
 * Load landing copy from the `settings` table (keys "content.<section>.<field>").
 * Keys with no stored value fall back to the static defaults, so the landing
 * page never renders empty. Returns a flat ContentMap with every 96 keys filled.
 */
export const loadLandingContent = cache(async (): Promise<ResolvedContent> => {
  const values: ContentMap = { ...CONTENT_DEFAULTS };
  const overrides: ContentMap = {};
  try {
    const prefix = "content.";
    const rows = await db()
      .prepare("SELECT key, value FROM settings WHERE key LIKE ? ORDER BY key")
      .bind(`${prefix}%`)
      .all<{ key: string; value: string }>();
    for (const row of rows.results ?? []) {
      const key = row.key.startsWith(prefix) ? row.key.slice(prefix.length) : row.key;
      if (key in values) {
        values[key] = row.value;
        // Text-keyed mirror for the <T> override lookup (default literal → stored value).
        const fallback = CONTENT_DEFAULTS[key];
        if(key.startsWith('copy.')||key.startsWith('id.copy.')) overrides[`${key.startsWith('id.')?'id:':''}copy:${CONTENT_DEFAULTS[key.startsWith('id.')?key.slice(3):key]}`]=row.value;
        if (fallback !== undefined) overrides[key.startsWith('id.') ? `id:${CONTENT_DEFAULTS[key.slice(3)]}` : fallback] = row.value;
      }
    }
  } catch {
    // Database unavailable: serve the static defaults rather than breaking the page.
  }
  return { values, overrides };
});

export function knownContentKeys(): string[] {
  return Object.keys(CONTENT_DEFAULTS);
}
