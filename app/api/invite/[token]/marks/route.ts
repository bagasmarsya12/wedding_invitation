import { pngDimensions } from "@/lib/production";
import { allowMutation, apiError, bucket, cleanText, db, featureEnabled, guestFromToken, logFailure, privateJson, randomId, readJsonBody, sameOriginMutation } from "@/lib/server";

function decodePng(dataUrl: string) {
  if (dataUrl.length > 2_000_050) return null;
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  if (match[1].length > 2_000_000) return null;
  let binary: string;
  try { binary = atob(match[1]); } catch { return null; }
  if (binary.length > 1_500_000) return null;
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return pngDimensions(bytes) ? bytes : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!sameOriginMutation(request)) return apiError("This request could not be verified.", 403);
  try {
    const guest = await guestFromToken((await params).token);
    if (!guest) return apiError("Invitation not found.", 404);
    if (!(await featureEnabled("marks"))) return apiError("Leave a Mark is currently closed.", 403);
    const payload = await readJsonBody(request, 2_100_000);
    if (!payload || (payload.message !== undefined && (typeof payload.message !== "string" || payload.message.length > 1200)) ||
      (payload.drawing !== undefined && typeof payload.drawing !== "string") || ![undefined, "private", "public"].includes(payload.visibility as string | undefined))
      return apiError("Your mark is invalid or too large.");
    const message = cleanText(payload.message, 1200);
    const drawing = payload.drawing ? decodePng(payload.drawing as string) : null;
    if (!message && !drawing) return apiError("Write or draw something first.");
    if (payload.drawing && !drawing) return apiError("Drawing must be a PNG under 1.5 MB and 2048 pixels per side.");
    const current = await db().prepare("SELECT COUNT(*) AS count FROM guest_marks WHERE guest_id = ? AND moderation_status IN ('pending', 'approved')")
      .bind(guest.id).first<{ count: number }>();
    if ((current?.count ?? 0) >= 3) return apiError("You already have three active marks.", 409);
    if (!(await allowMutation("mark", guest.id, 4, 3_600_000))) return apiError("Please wait before sending another mark.", 429);
    const id = randomId("mark");
    const drawingKey = drawing ? `marks/${guest.id}/${id}.png` : null;
    if (drawing && drawingKey) await bucket().put(drawingKey, drawing, { httpMetadata: { contentType: "image/png" } });
    try {
      const now = new Date().toISOString();
      await db().prepare(`INSERT INTO guest_marks (id, guest_id, author_name, message, drawing_key, visibility, moderation_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
        .bind(id, guest.id, guest.display_name, message || null, drawingKey, payload.visibility === "public" ? "public" : "private", now, now).run();
    } catch (error) {
      if (drawingKey) await bucket().delete(drawingKey).catch(cleanupError => { logFailure("mark_cleanup", cleanupError); });
      if (error instanceof Error && error.message.includes("active mark limit")) return apiError("You already have three active marks.", 409);
      throw error;
    }
    return privateJson({ ok: true, state: "kept" }, 201);
  } catch (error) { logFailure("mark_write", error); return apiError("Your mark could not be saved. Please try again.", 503); }
}
