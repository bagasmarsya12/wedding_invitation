import { validateRsvp, validateSimpleRsvp } from "@/lib/production";
import { allowMutation, apiError, cleanText, db, featureEnabled, guestFromToken, logFailure, privateJson, randomId, readJsonBody, sameOriginMutation } from "@/lib/server";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const guest = await guestFromToken((await params).token);
    if (!guest) return apiError("Invitation not found.", 404);
    const [rsvp, enabled] = await Promise.all([
      db().prepare("SELECT attendance, party_size, guest_names, dietary, message, updated_at FROM rsvps WHERE guest_id = ? LIMIT 1").bind(guest.id).first(),
      featureEnabled("rsvp"),
    ]);
    return privateJson({ guest: { name: guest.display_name, partyLimit: guest.party_limit }, rsvp, enabled });
  } catch (error) { logFailure("rsvp_read", error); return apiError("RSVP is temporarily unavailable. Please try again.", 503); }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!sameOriginMutation(request)) return apiError("This request could not be verified.", 403);
  try {
    const guest = await guestFromToken((await params).token);
    if (!guest) return apiError("Invitation not found.", 404);
    if (!(await featureEnabled("rsvp"))) return apiError("RSVP is closed. Thank you for being part of our day.", 403);
    const payload = await readJsonBody(request);
    if (!payload) return apiError("Please check your answer and try again.");
    const previous = payload.partySize === undefined
      ? await db().prepare("SELECT attendance, party_size FROM rsvps WHERE guest_id = ? LIMIT 1").bind(guest.id).first<{ attendance: string; party_size: number }>()
      : null;
    const valid = payload.partySize === undefined
      ? validateSimpleRsvp(payload.attendance, guest.party_limit, previous)
      : validateRsvp(payload.attendance, payload.partySize, guest.party_limit);
    if (!valid) return apiError("Please choose attendance and a party size within your invitation.");
    for (const [key, max] of [["guestNames", 300], ["dietary", 300], ["message", 800]] as const) {
      const value = payload[key];
      if (value !== undefined && (typeof value !== "string" || value.length > max)) return apiError("One of your notes is too long or invalid.");
    }
    if (!(await allowMutation("rsvp", guest.id, 8, 60_000))) return apiError("Too many updates. Please try again shortly.", 429);
    const now = new Date().toISOString();
    await db().prepare(`
    INSERT INTO rsvps (id, guest_id, attendance, party_size, guest_names, dietary, message, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guest_id) DO UPDATE SET
      attendance = excluded.attendance,
      party_size = excluded.party_size,
      guest_names = CASE WHEN ? THEN excluded.guest_names ELSE rsvps.guest_names END,
      dietary = CASE WHEN ? THEN excluded.dietary ELSE rsvps.dietary END,
      message = CASE WHEN ? THEN excluded.message ELSE rsvps.message END,
      updated_at = excluded.updated_at
    `).bind(
      randomId("rsvp"), guest.id, valid.attendance, valid.partySize,
      valid.attendance === "yes" ? cleanText(payload.guestNames, 300) || null : null,
      valid.attendance === "yes" ? cleanText(payload.dietary, 300) || null : null,
      cleanText(payload.message, 800) || null, now, now,
      Number(payload.guestNames !== undefined), Number(payload.dietary !== undefined), Number(payload.message !== undefined),
    ).run();
    return privateJson({ ok: true, ...valid, partyLimit: guest.party_limit });
  } catch (error) { logFailure("rsvp_write", error); return apiError("Your answer could not be saved. Please try again.", 503); }
}
