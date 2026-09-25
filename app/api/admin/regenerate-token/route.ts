import { db, requireAdmin, sha256 } from "@/lib/server";
import { randomInviteToken } from "@/lib/production";

export const runtime = "nodejs";

/**
 * Transactionally rotate a guest's invitation token: new random token, new
 * stored hash, one-time readback of the raw token (it is never persisted).
 * The previous link dies the moment this commits.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Admin access is required." }, { status: 403 });

  let body: { id?: unknown };
  try {
    body = (await request.json()) as { id?: unknown };
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return Response.json({ error: "Guest id is required." }, { status: 400 });

  try {
    const token = await randomInviteToken();
    const hash = await sha256(token);
    const result = await db()
      .prepare("UPDATE guests SET token_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active' RETURNING display_name")
      .bind(hash, id)
      .first<{ display_name: string }>();
    if (!result) return Response.json({ error: "Guest not found or access revoked." }, { status: 404 });
    return Response.json({ ok: true, displayName: result.display_name, token });
  } catch (error) {
    console.error(JSON.stringify({ action: "admin_regenerate_token", error: error instanceof Error ? error.name : "Unknown" }));
    return Response.json({ error: "Could not regenerate the link. Try again." }, { status: 500 });
  }
}
