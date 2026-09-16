import { apiError, bucket, db, requireAdmin } from "@/lib/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mark = await db().prepare("SELECT drawing_key, visibility, moderation_status FROM guest_marks WHERE id = ? LIMIT 1")
    .bind(id).first<{ drawing_key: string | null; visibility: string; moderation_status: string }>();
  if (!mark?.drawing_key) return apiError("Drawing not found.", 404);
  const canView = mark.visibility === "public" && mark.moderation_status === "approved";
  if (!canView && !(await requireAdmin())) return apiError("Drawing not found.", 404);
  const object = await bucket().get(mark.drawing_key);
  if (!object) return apiError("Drawing not found.", 404);
  return new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType ?? "image/png", "cache-control": canView ? "public, max-age=3600" : "private, no-store" } });
}
