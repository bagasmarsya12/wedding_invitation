import { db } from "@/lib/server";

export async function GET() {
  const marks = await db().prepare(
    "SELECT id, author_name, message, drawing_key, created_at FROM guest_marks WHERE moderation_status = 'approved' AND visibility = 'public' ORDER BY created_at DESC LIMIT 50",
  ).all();
  return Response.json({ marks: marks.results.map((mark: Record<string, unknown>) => ({ ...mark, drawingUrl: mark.drawing_key ? `/api/marks/${mark.id}/image` : null, drawing_key: undefined })) });
}
