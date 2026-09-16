import { apiError, cleanText, db, randomId, randomInviteToken, requireAdmin, sha256 } from "@/lib/server";

async function guard() {
  return await requireAdmin();
}

export async function GET() {
  if (!(await guard())) return apiError("Not authorized.", 403);
  const [guests, rsvps, gifts, marks, archive, settings] = await Promise.all([
    db().prepare("SELECT id, display_name, email, party_limit, status, created_at FROM guests ORDER BY created_at DESC").all(),
    db().prepare("SELECT r.*, g.display_name FROM rsvps r JOIN guests g ON g.id = r.guest_id ORDER BY r.updated_at DESC").all(),
    db().prepare("SELECT id, title, recipient_category, status, reserved_by_guest_id, shipping_required, created_at FROM gifts ORDER BY created_at DESC").all(),
    db().prepare("SELECT id, author_name, message, drawing_key, visibility, moderation_status, created_at FROM guest_marks ORDER BY created_at DESC").all(),
    db().prepare("SELECT id, slug, type, title, featured, visibility, published, created_at FROM archive_entries ORDER BY created_at DESC").all(),
    db().prepare("SELECT key, value, updated_at FROM settings ORDER BY key").all(),
  ]);
  return Response.json({ guests: guests.results, rsvps: rsvps.results, gifts: gifts.results, marks: marks.results, archive: archive.results, settings: settings.results });
}

export async function POST(request: Request) {
  if (!(await guard())) return apiError("Not authorized.", 403);
  const payload = await request.json() as Record<string, unknown>;
  const op = cleanText(payload.op, 50);
  const now = new Date().toISOString();

  if (op === "create_guest") {
    const displayName = cleanText(payload.displayName, 120);
    if (!displayName) return apiError("Guest name is required.");
    const partyLimit = Math.max(1, Math.min(20, Number(payload.partyLimit) || 1));
    const token = randomInviteToken();
    await db().prepare("INSERT INTO guests (id, token_hash, display_name, email, party_limit, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)")
      .bind(randomId("guest"), await sha256(token), displayName, cleanText(payload.email, 180) || null, partyLimit, now, now).run();
    return Response.json({ ok: true, inviteUrl: `/invite/${token}` }, { status: 201 });
  }

  if (op === "create_gift") {
    const title = cleanText(payload.title, 160);
    const category = cleanText(payload.category, 40);
    if (!title || !["bagas", "iga", "home"].includes(category)) return apiError("Gift title and category are required.");
    await db().prepare(`INSERT INTO gifts (id, title, description, recipient_category, image_url, purchase_url, price_label, status, shipping_required, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?)`)
      .bind(randomId("gift"), title, cleanText(payload.description, 500) || null, category, cleanText(payload.imageUrl, 500) || null, cleanText(payload.purchaseUrl, 500) || null, cleanText(payload.priceLabel, 80) || null, payload.shippingRequired ? 1 : 0, now, now).run();
    return Response.json({ ok: true }, { status: 201 });
  }

  if (op === "create_archive") {
    const title = cleanText(payload.title, 180);
    const slug = cleanText(payload.slug, 120).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    if (!title || !slug) return apiError("Archive title and slug are required.");
    await db().prepare(`INSERT INTO archive_entries (id, slug, type, title, excerpt, story, media_url, featured, featured_order, visibility, published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(randomId("archive"), slug, cleanText(payload.type, 40) || "other", title, cleanText(payload.excerpt, 400) || null, cleanText(payload.story, 6000) || null, cleanText(payload.mediaUrl, 500) || null, payload.featured ? 1 : 0, Number(payload.featuredOrder) || null, payload.visibility === "public" ? "public" : "guests", payload.published ? 1 : 0, now, now).run();
    return Response.json({ ok: true }, { status: 201 });
  }

  if (op === "moderate_mark") {
    const status = payload.status === "approved" ? "approved" : payload.status === "rejected" ? "rejected" : "pending";
    await db().prepare("UPDATE guest_marks SET moderation_status = ?, updated_at = ? WHERE id = ?")
      .bind(status, now, cleanText(payload.id, 120)).run();
    return Response.json({ ok: true });
  }

  if (op === "set_setting") {
    const key = cleanText(payload.key, 80);
    if (!["site_phase", "shipping_instructions", "cash_gift_details"].includes(key)) return apiError("Unsupported setting.");
    const value = cleanText(payload.value, 2000);
    if (key === "site_phase" && !["pre-wedding", "wedding-day", "post-wedding"].includes(value)) return apiError("Site phase must be pre-wedding, wedding-day, or post-wedding.");
    await db().prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
      .bind(key, value, now).run();
    return Response.json({ ok: true });
  }

  return apiError("Unsupported admin operation.");
}
