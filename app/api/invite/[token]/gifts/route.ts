import { apiError, db, guestFromToken, randomId } from "@/lib/server";

type GiftRow = { id: string; title: string; description: string | null; recipient_category: string; image_url: string | null; price_label: string | null; purchase_url: string | null; status: string; reserved_by_guest_id: string | null; shipping_required: number };

async function listGifts(guestId: string) {
  const rows = await db().prepare("SELECT id, title, description, recipient_category, image_url, price_label, purchase_url, status, reserved_by_guest_id, shipping_required FROM gifts ORDER BY recipient_category, created_at").all<GiftRow>();
  return rows.results.map(gift => ({
    id: gift.id,
    title: gift.title,
    description: gift.description,
    category: gift.recipient_category,
    imageUrl: gift.image_url,
    priceLabel: gift.price_label,
    status: gift.status,
    reservedByYou: gift.reserved_by_guest_id === guestId,
    purchaseUrl: gift.reserved_by_guest_id === guestId ? gift.purchase_url : null,
    shippingRequired: Boolean(gift.shipping_required),
  }));
}

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const guest = await guestFromToken((await params).token);
  if (!guest) return apiError("Invitation not found.", 404);
  const cash = await db().prepare("SELECT value FROM settings WHERE key = 'cash_gift_details' LIMIT 1").first<{ value: string }>();
  const hasShippingReservation = await db().prepare("SELECT id FROM gifts WHERE reserved_by_guest_id = ? AND status = 'reserved' AND shipping_required = 1 LIMIT 1").bind(guest.id).first();
  const shipping = hasShippingReservation ? await db().prepare("SELECT value FROM settings WHERE key = 'shipping_instructions' LIMIT 1").first<{ value: string }>() : null;
  return Response.json({ gifts: await listGifts(guest.id), cashGiftDetails: cash?.value ?? null, shippingInstructions: shipping?.value ?? null });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const guest = await guestFromToken((await params).token);
  if (!guest) return apiError("Invitation not found.", 404);
  const payload = await request.json() as { action?: string; giftId?: string; surprise?: boolean };
  const giftId = String(payload.giftId ?? "");
  const now = new Date().toISOString();
  if (!giftId) return apiError("Gift is required.");

  if (payload.action === "reserve") {
    const result = await db().prepare(
      "UPDATE gifts SET status = 'reserved', reserved_by_guest_id = ?, reserved_at = ?, updated_at = ? WHERE id = ? AND status = 'available'",
    ).bind(guest.id, now, now, giftId).run();
    if (!result.meta.changes) return apiError("This gift was just reserved by someone else.", 409);
    await db().prepare("INSERT INTO gift_reservations (id, gift_id, guest_id, surprise, status, reserved_at) VALUES (?, ?, ?, ?, 'reserved', ?)")
      .bind(randomId("reservation"), giftId, guest.id, payload.surprise === false ? 0 : 1, now).run();
  } else if (payload.action === "release") {
    const result = await db().prepare(
      "UPDATE gifts SET status = 'available', reserved_by_guest_id = NULL, reserved_at = NULL, updated_at = ? WHERE id = ? AND status = 'reserved' AND reserved_by_guest_id = ?",
    ).bind(now, giftId, guest.id).run();
    if (!result.meta.changes) return apiError("This reservation can no longer be released.", 409);
    await db().prepare("UPDATE gift_reservations SET status = 'released', released_at = ? WHERE gift_id = ? AND guest_id = ? AND status = 'reserved'")
      .bind(now, giftId, guest.id).run();
  } else if (payload.action === "purchased") {
    const result = await db().prepare(
      "UPDATE gifts SET status = 'purchased', purchased_at = ?, updated_at = ? WHERE id = ? AND status = 'reserved' AND reserved_by_guest_id = ?",
    ).bind(now, now, giftId, guest.id).run();
    if (!result.meta.changes) return apiError("Only your active reservation can be marked purchased.", 409);
    await db().prepare("UPDATE gift_reservations SET status = 'purchased', purchased_at = ? WHERE gift_id = ? AND guest_id = ? AND status = 'reserved'")
      .bind(now, giftId, guest.id).run();
  } else {
    return apiError("Unsupported gift action.");
  }

  const shipping = await db().prepare("SELECT value FROM settings WHERE key = 'shipping_instructions' LIMIT 1").first<{ value: string }>();
  return Response.json({ gifts: await listGifts(guest.id), shippingInstructions: payload.action === "reserve" ? shipping?.value ?? null : null });
}
