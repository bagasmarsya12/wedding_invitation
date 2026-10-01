import { apiError, db, logFailure } from "@/lib/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requested = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(requested) && requested > 0 ? Math.min(Math.floor(requested), 200) : 48;
    const cursor = url.searchParams.get("cursor");
    const parts = cursor?.split("|");
    if (cursor && (!parts || parts.length !== 2 || parts[0].length > 40 || !/^mark_[a-zA-Z0-9_-]+$/.test(parts[1]))) {
      return apiError("Invalid postcard cursor.", 400);
    }
    const query = db().prepare(
      `SELECT id, author_name, message, drawing_key, style, font, created_at FROM guest_marks
       WHERE moderation_status = 'approved' AND visibility = 'public'
       ${parts ? "AND (created_at < ? OR (created_at = ? AND id < ?))" : ""}
       ORDER BY created_at DESC, id DESC LIMIT ?`,
    );
    const result = await (parts ? query.bind(parts[0], parts[0], parts[1], limit + 1) : query.bind(limit + 1)).all();
    const page = result.results.slice(0, limit);
    const last = page.at(-1);
    return Response.json({
      marks: page.map((mark: Record<string, unknown>) => ({
        id: mark.id, author_name: mark.author_name, message: mark.message,
        style: mark.style, font: mark.font, created_at: mark.created_at,
        drawingUrl: mark.drawing_key ? `/api/marks/${encodeURIComponent(String(mark.id))}/image` : null,
      })),
      nextCursor: result.results.length > limit && last ? `${last.created_at}|${last.id}` : null,
    }, { headers: { "cache-control": "public, max-age=30" } });
  } catch (error) {
    logFailure("public_mark_list", error);
    return apiError("The wall could not be loaded. Please try again.", 503);
  }
}
