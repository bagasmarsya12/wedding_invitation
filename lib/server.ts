import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { phaseForDate, sha256, type SitePhase } from "@/lib/production";
import {
  credentialKey, newSecret, parseCredential, readSessionToken, secretFromText, secretToText,
  type StoredCredential,
} from "@/lib/admin-auth";
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

export type PasswordAdmin = { userId: string; email: string; displayName: string; fullName: string | null };

export function adminMethod(admin: { userId: string }): "password" | "chatgpt" {
  return admin.userId.startsWith("pw:") ? "password" : "chatgpt";
}

export const ADMIN_SESSION_COOKIE = "wedding_admin";
const ADMIN_SESSION_SECRET_KEY = "admin.session_secret";

export function cookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

export async function getAdminCredential(email: string): Promise<StoredCredential | null> {
  const row = await db().prepare("SELECT value FROM settings WHERE key = ? LIMIT 1").bind(credentialKey(email)).first<{ value: string }>();
  return parseCredential(row?.value);
}

// Session signing key: ADMIN_SESSION_SECRET when configured, otherwise a
// generated secret that lives in the settings table so login works on any host.
export async function adminSessionSecret(): Promise<Uint8Array> {
  const configured = env.ADMIN_SESSION_SECRET?.trim();
  if (configured && configured.length >= 32) return new TextEncoder().encode(configured);
  const read = async () => (await db().prepare("SELECT value FROM settings WHERE key = ? LIMIT 1").bind(ADMIN_SESSION_SECRET_KEY).first<{ value: string }>())?.value;
  const existing = await read();
  const parsed = existing ? secretFromText(existing) : null;
  if (parsed) return parsed;
  await db().prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO NOTHING")
    .bind(ADMIN_SESSION_SECRET_KEY, secretToText(newSecret())).run();
  const stored = await read();
  const secret = stored ? secretFromText(stored) : null;
  if (!secret) throw new Error("Admin session secret is unavailable.");
  return secret;
}

async function passwordAdminSession(): Promise<PasswordAdmin | null> {
  try {
    const token = cookieValue((await headers()).get("cookie"), ADMIN_SESSION_COOKIE);
    if (!token) return null;
    const email = await readSessionToken(token, await adminSessionSecret());
    if (!email) return null;
    // Removing the credential revokes every outstanding session for that email.
    if (!(await getAdminCredential(email))) return null;
    return { userId: `pw:${email}`, email, displayName: email, fullName: null };
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<ChatGPTUser | PasswordAdmin | null> {
  const user = await getChatGPTUser();
  if (user) {
    const ids = (env.ADMIN_USER_IDS ?? "").split(",").map(value => value.trim()).filter(Boolean);
    const emails = (env.ADMIN_EMAILS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
    if (ids.includes(user.userId) || emails.includes(user.email.toLowerCase())) return user;
  }
  return passwordAdminSession();
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
