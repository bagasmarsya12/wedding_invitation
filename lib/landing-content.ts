import { db } from "@/lib/server";
import { CONTENT_DEFAULTS, CONTENT_SECTIONS, type ContentMap } from "@/lib/content-defaults";

export type ResolvedContent = { values: ContentMap; overrides: ContentMap };

/**
 * Load landing copy from the `settings` table (keys "content.<section>.<field>").
 * Keys with no stored value fall back to the static defaults, so the landing
 * page never renders empty. Returns a flat ContentMap with every 96 keys filled.
 */
export async function loadLandingContent(): Promise<ResolvedContent> {
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
        if (fallback !== undefined) overrides[fallback] = row.value;
      }
    }
  } catch {
    // Database unavailable: serve the static defaults rather than breaking the page.
  }
  return { values, overrides };
}

export function knownContentKeys(): string[] {
  return CONTENT_SECTIONS.flatMap(section => section.fields.map(field => `${section.id}.${field.key}`));
}
