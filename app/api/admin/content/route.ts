import { ACTIVE_CONTENT_KEYS } from '@/lib/content-usage';
import { allowMutation, cleanText, db, privateJson, readJsonBody, requireAdmin, sameOriginMutation } from "@/lib/server";
import { CONTENT_DEFAULTS, CONTENT_SECTIONS } from "@/lib/content-defaults";
import { knownContentKeys } from "@/lib/landing-content";

export const runtime = "nodejs";

/** GET: every known content key with its current stored-or-default value. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Admin access is required." }, 403);
  const values: Record<string, string> = { ...CONTENT_DEFAULTS };
  const rows = await db()
    .prepare("SELECT key, value, updated_at FROM settings WHERE key LIKE 'content.%' ORDER BY key")
    .all<{ key: string; value: string; updated_at: string }>();
  const overrides: Record<string, string> = {};
  for (const row of rows.results ?? []) {
    const key = row.key.startsWith("content.") ? row.key.slice("content.".length) : row.key;
    if (key in values) {
      values[key] = row.value;
      overrides[key] = row.updated_at;
    }
  }
  const active=new Set<string>(ACTIVE_CONTENT_KEYS);
  for(const key of ['hero.hero date','misc.di','beyond.arch t'])active.delete(key);
  const sections=CONTENT_SECTIONS.map(section=>({...section,fields:section.fields.filter(field=>section.id==='copy'||section.id==='keepsakeUi'||active.has(`${section.id}.${field.key}`))})).filter(section=>section.fields.length);
  return privateJson({ sections, values, overrides });
}

/**
 * PUT: upsert a batch of {key: value} overrides. Unknown keys are rejected,
 * empty values delete the override so the default copy shows through.
 */
export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Admin access is required." }, 403);
  if (!sameOriginMutation(request)) return privateJson({ error: "Cross-origin request rejected." }, 403);

  const body = await readJsonBody(request, 65_536);
  if (!body || typeof body.values !== "object" || body.values === null || Array.isArray(body.values)) {
    return privateJson({ error: "Body must be {values: {key: value}}." }, 400);
  }
  const known = new Set(knownContentKeys());
  const supplied=Object.entries(body.values as Record<string,unknown>);
  if(supplied.some(([key,value])=>!known.has(key) || typeof value!=='string' || value.length>(key.replace(/^id\./,'').startsWith('keepsake.')?120:key.replace(/^id\./,'').startsWith('keepsakeUi.')?500:2000))) return privateJson({error:'Unknown content field or text over 2000 characters.'},400);
  const entries = supplied
    .map(([key, value]) => [`content.${key}`, value] as [string, unknown]);
  if (!entries.length) return privateJson({ error: "No valid content keys supplied." }, 400);
  if (entries.length > 120) return privateJson({ error: "Too many keys in one request." }, 413);
  if (!(await allowMutation("admin-content", admin.userId, 120, 60_000))) {
    return privateJson({ error: "Too many saves in a minute. Wait a moment." }, 429);
  }

  const statements: D1PreparedStatement[] = [];
  for (const [key, raw] of entries) {
    const value = cleanText(raw, 2_000);
    if (value === "") {
      statements.push(db().prepare("DELETE FROM settings WHERE key = ?").bind(key));
    } else {
      statements.push(db().prepare(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
      ).bind(key, value));
    }
  }
  try {
    await db().batch(statements);
  } catch (error) {
    console.error(JSON.stringify({ action: "admin_content_put", error: error instanceof Error ? error.name : "Unknown" }));
    return privateJson({ error: "Could not save content. Try again." }, 500);
  }
  const saved = statements.length;
  const cleared = supplied.filter(([,value])=>value==='').length;
  return privateJson({ ok: true, saved, cleared, note: CONTENT_DEFAULTS ? "empty values fall back to defaults" : undefined });
}
