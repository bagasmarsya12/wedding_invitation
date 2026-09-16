import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";

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

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function guestFromToken(token: string): Promise<GuestRecord | null> {
  if (!token || token.length < 24 || token.length > 160) return null;
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

export function randomInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function apiError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
