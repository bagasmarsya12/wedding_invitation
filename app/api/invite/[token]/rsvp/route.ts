import { apiError, cleanText, db, guestFromToken, randomId } from "@/lib/server";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const guest = await guestFromToken((await params).token);
  if (!guest) return apiError("Invitation not found.", 404);
  const rsvp = await db().prepare(
    "SELECT attendance, party_size, guest_names, dietary, message, updated_at FROM rsvps WHERE guest_id = ? LIMIT 1",
  ).bind(guest.id).first();
  return Response.json({ guest: { name: guest.display_name, partyLimit: guest.party_limit }, rsvp });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const guest = await guestFromToken((await params).token);
  if (!guest) return apiError("Invitation not found.", 404);
  const payload = await request.json() as Record<string, unknown>;
  const attendance = payload.attendance === "yes" ? "yes" : payload.attendance === "no" ? "no" : "";
  if (!attendance) return apiError("Choose an attendance response.");
  const requestedParty = Number(payload.partySize ?? 1);
  const partySize = attendance === "yes" ? Math.max(1, Math.min(guest.party_limit, Number.isFinite(requestedParty) ? Math.floor(requestedParty) : 1)) : 0;
  const now = new Date().toISOString();
  await db().prepare(`
    INSERT INTO rsvps (id, guest_id, attendance, party_size, guest_names, dietary, message, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guest_id) DO UPDATE SET
      attendance = excluded.attendance,
      party_size = excluded.party_size,
      guest_names = excluded.guest_names,
      dietary = excluded.dietary,
      message = excluded.message,
      updated_at = excluded.updated_at
  `).bind(
    randomId("rsvp"), guest.id, attendance, partySize,
    cleanText(payload.guestNames, 300) || null,
    cleanText(payload.dietary, 300) || null,
    cleanText(payload.message, 800) || null,
    now, now,
  ).run();
  return Response.json({ ok: true, attendance, partySize, partyLimit: guest.party_limit });
}
