import { apiError, bucket, cleanText, db, guestFromToken, randomId } from "@/lib/server";

function decodePng(dataUrl: string) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  const binary = atob(match[1]);
  if (binary.length > 1_500_000) return null;
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const guest = await guestFromToken((await params).token);
  if (!guest) return apiError("Invitation not found.", 404);
  const current = await db().prepare("SELECT COUNT(*) AS count FROM guest_marks WHERE guest_id = ? AND moderation_status IN ('pending', 'approved')")
    .bind(guest.id).first<{ count: number }>();
  if ((current?.count ?? 0) >= 3) return apiError("You already have three active marks.", 409);

  const payload = await request.json() as Record<string, unknown>;
  const message = cleanText(payload.message, 1200);
  const visibility = payload.visibility === "public" ? "public" : "private";
  const drawing = typeof payload.drawing === "string" && payload.drawing ? decodePng(payload.drawing) : null;
  if (!message && !drawing) return apiError("Write or draw something first.");
  if (typeof payload.drawing === "string" && payload.drawing && !drawing) return apiError("Drawing is invalid or too large.");

  const id = randomId("mark");
  const drawingKey = drawing ? `marks/${guest.id}/${id}.png` : null;
  if (drawing && drawingKey) await bucket().put(drawingKey, drawing, { httpMetadata: { contentType: "image/png" } });
  const now = new Date().toISOString();
  await db().prepare(`
    INSERT INTO guest_marks (id, guest_id, author_name, message, drawing_key, visibility, moderation_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).bind(id, guest.id, guest.display_name, message || null, drawingKey, visibility, now, now).run();
  return Response.json({ ok: true, state: "kept" }, { status: 201 });
}
