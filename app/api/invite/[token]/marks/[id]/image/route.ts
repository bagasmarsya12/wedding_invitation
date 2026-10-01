import { apiError, bucket, db, guestFromToken, logFailure } from "@/lib/server";

export async function GET(_: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  try {
    const { token, id } = await params;
    const guest = await guestFromToken(token);
    if (!guest) return apiError("Invitation not found.", 404);
    const mark = await db().prepare(
      "SELECT drawing_key FROM guest_marks WHERE id = ? AND guest_id = ? AND moderation_status != 'rejected' LIMIT 1",
    ).bind(id, guest.id).first<{ drawing_key: string | null }>();
    if (!mark?.drawing_key) return apiError("Drawing not found.", 404);
    const object = await bucket().get(mark.drawing_key);
    if (!object) return apiError("Drawing not found.", 404);
    return new Response(object.body, {
      headers: {
        "content-type": "image/png",
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex",
      },
    });
  } catch (error) {
    logFailure("mark_image", error);
    return apiError("Drawing not found.", 404);
  }
}
