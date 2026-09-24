import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { phaseForDate, sha256, type SitePhase } from "@/lib/production";
export { randomInviteToken, sha256 } from "@/lib/production";

export type GuestRecord = {
  id: string;
  display_name: string;
  email: string | null;
  party_limit: number;
  status: string;
};

export function db(): D1Database {
  if (!env.DB) throw new Error("Wedding database is unavailable.");
  return env.DB;
}

export function bucket(): R2Bucket {
  if (!env.BUCKET) throw new Error("Wedding artwork storage is unavailable.");
  return env.BUCKET;
}

export async function guestFromToken(token: string): Promise<GuestRecord | null> {
  if (!token || token.length < 24 || token.length > 160 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const hash = await sha256(token);
  return db().prepare(
    "SELECT id, display_name, email, party_limit, status FROM guests WHERE token_hash = ? AND status = 'active' LIMIT 1",
  ).bind(hash).first<GuestRecord>();
}

export async function requireAdmin() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const ids = (env.ADMIN_USER_IDS ?? "").split(",").map(value => value.trim()).filter(Boolean);
  const emails = (env.ADMIN_EMAILS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!ids.includes(user.userId) && !emails.includes(user.email.toLowerCase())) return null;
  return user;
}

export function cleanText(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function apiError(message: string, status = 400) {
  return privateJson({ error: message }, status);
}

export const privateHeaders = {
  "cache-control": "private, no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow, noarchive",
  "referrer-policy": "no-referrer",
};

export function privateJson(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: privateHeaders });
}

export function sameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

export async function readJsonBody(request: Request, maxBytes = 16_384): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { void reader.cancel(); return null; }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
  finally { reader.releaseLock(); }
}

export async function allowMutation(kind: string, subjectId: string, limit: number, intervalMs: number): Promise<boolean> {
  const now = Date.now();
  const staleBefore = now - intervalMs;
  const result = await db().prepare(`INSERT INTO mutation_limits (key, window_start, count) VALUES (?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN mutation_limits.window_start <= ? THEN 1 ELSE mutation_limits.count + 1 END,
      window_start = CASE WHEN mutation_limits.window_start <= ? THEN ? ELSE mutation_limits.window_start END
    WHERE mutation_limits.window_start <= ? OR mutation_limits.count < ?`)
    .bind(`${kind}:${subjectId}`, now, staleBefore, staleBefore, now, staleBefore, limit).run();
  return Boolean(result.meta.changes);
}

export async function sitePhase(): Promise<SitePhase> {
  const setting = await db().prepare("SELECT value FROM settings WHERE key = 'site_phase' LIMIT 1").first<{ value: string }>();
  return phaseForDate(new Date(), setting?.value);
}

export async function featureEnabled(feature: "rsvp" | "gifts" | "marks"): Promise<boolean> {
  const setting = await db().prepare("SELECT value FROM settings WHERE key = ? LIMIT 1").bind(`${feature}_enabled`).first<{ value: string }>();
  if (setting?.value === "on") return true;
  if (setting?.value === "off") return false;
  return feature === "rsvp" ? (await sitePhase()) !== "post-wedding" : true;
}

export function logFailure(action: string, error: unknown): string {
  const incident = crypto.randomUUID();
  console.error(JSON.stringify({ incident, action, errorType: error instanceof Error ? error.name : "UnknownError" }));
  return incident;
}
