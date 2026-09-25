import { credentialKey, hashPassword } from "@/lib/admin-auth";
import { allowMutation, db, privateJson, readJsonBody, requireAdmin, sameOriginMutation } from "@/lib/server";

export const runtime = "nodejs";

/**
 * Sets or rotates the password login for the signed-in admin's own email.
 * Works for ChatGPT allowlist admins (first password on a hosted Site) and for
 * existing password admins. Sessions already signed in stay valid.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Admin access is required." }, 403);
  if (!sameOriginMutation(request)) return privateJson({ error: "Cross-origin request rejected." }, 403);

  const body = await readJsonBody(request, 8_192);
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 12 || password.length > 512) {
    return privateJson({ error: "Password must be 12-512 characters." }, 400);
  }
  if (!(await allowMutation("admin-password", admin.userId, 10, 60_000))) {
    return privateJson({ error: "Too many changes. Wait a minute." }, 429);
  }

  const email = admin.email.trim().toLowerCase();
  const credential = await hashPassword(password);
  await db().prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) " +
    "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
  ).bind(credentialKey(email), JSON.stringify(credential)).run();
  return privateJson({ ok: true, email });
}
