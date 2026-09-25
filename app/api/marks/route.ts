import { db } from "@/lib/server";

export async function GET(request: Request) {
  const requested = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(requested) && requested > 0 ? Math.min(Math.floor(requested), 50) : 50;
  const marks = await db().prepare(
    "SELECT id, author_name, message, drawing_key, style, created_at FROM guest_marks WHERE moderation_status = 'approved' AND visibility = 'public' ORDER BY created_at DESC LIMIT ?",
  ).bind(limit).all();
  return Response.json(
    {
      marks: marks.results.map((mark: Record<string, unknown>) => ({
        ...mark,
        drawingUrl: mark.drawing_key ? `/api/marks/${mark.id}/image` : null,
        drawing_key: undefined,
      })),
    },
    { headers: { "cache-control": "public, max-age=30" } },
  );
}