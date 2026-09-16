import { db } from "@/lib/server";

export async function GET(request: Request) {
  const featured = new URL(request.url).searchParams.get("featured") === "1";
  const query = featured
    ? "SELECT slug, type, title, entry_date, location, excerpt, media_url, metadata FROM archive_entries WHERE published = 1 AND visibility = 'public' AND featured = 1 ORDER BY featured_order, created_at LIMIT 5"
    : "SELECT slug, type, title, entry_date, location, excerpt, media_url, metadata FROM archive_entries WHERE published = 1 AND visibility = 'public' ORDER BY COALESCE(featured_order, 999), created_at";
  const entries = await db().prepare(query).all();
  return Response.json({ entries: entries.results });
}
