import { allowMutation, apiError, db, featureEnabled, guestFromToken, logFailure, privateJson, randomId, readJsonBody, sameOriginMutation } from "@/lib/server";

type GiftRow = { id: string; title: string; description: string | null; recipient_category: string; image_url: string | null; price_label: string | null; purchase_url: string | null; status: string; reserved_by_guest_id: string | null; reserved_by_name: string | null; shipping_required: number };

async function listGifts(guestId: string) {
  const rows = await db().prepare(`SELECT f.id, f.title, f.description, f.recipient_category, f.image_url, f.price_label, f.purchase_url,
    f.status, f.reserved_by_guest_id, g.display_name AS reserved_by_name, f.shipping_required
    FROM gifts f LEFT JOIN guests g ON g.id = f.reserved_by_guest_id WHERE f.published = 1 ORDER BY f.sort_order, f.created_at, f.id`).all<GiftRow>();
  return rows.results.map(gift => ({
    id: gift.id, title: gift.title, description: gift.description, category: gift.recipient_category,
    imageUrl: gift.image_url, priceLabel: gift.price_label, status: gift.status,
    reservedByYou: gift.reserved_by_guest_id === guestId,
    reservedByName: gift.status !== "available" ? gift.reserved_by_name : null,
    purchaseUrl: gift.reserved_by_guest_id === guestId ? gift.purchase_url : null,
    shippingRequired: Boolean(gift.shipping_required),
  }));
}

async function shippingFor(guestId: string) {
  const reservation = await db().prepare("SELECT id FROM gifts WHERE reserved_by_guest_id = ? AND status IN ('reserved', 'purchased') AND shipping_required = 1 LIMIT 1").bind(guestId).first();
  if (!reservation) return null;
  const setting = await db().prepare("SELECT value FROM settings WHERE key = 'shipping_instructions' LIMIT 1").first<{ value: string }>();
  return setting?.value ?? null;
}

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const guest = await guestFromToken((await params).token);
    if (!guest) return apiError("Invitation not found.", 404);
    const [cash, gifts, shipping, enabled] = await Promise.all([
      db().prepare("SELECT value FROM settings WHERE key = 'cash_gift_details' LIMIT 1").first<{ value: string }>(),
      listGifts(guest.id), shippingFor(guest.id), featureEnabled("gifts"),
    ]);
    return privateJson({ gifts, guestName: guest.display_name, cashGiftDetails: cash?.value ?? null, shippingInstructions: shipping, enabled });
  } catch (error) { logFailure("gifts_read", error); return apiError("Gifts are temporarily unavailable. Please try again.", 503); }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!sameOriginMutation(request)) return apiError("This request could not be verified.", 403);
  try {
    const guest = await guestFromToken((await params).token);
    if (!guest) return apiError("Invitation not found.", 404);
    if (!(await featureEnabled("gifts"))) return apiError("Gift reservations are currently closed.", 403);
    const payload = await readJsonBody(request);
    if (!payload || typeof payload.giftId !== "string" || payload.giftId.length > 120) return apiError("Please choose a gift.");
    const giftId = payload.giftId;
    if (!giftId || !["reserve", "release", "purchased"].includes(String(payload.action))) return apiError("Unsupported gift action.");
    if (!(await allowMutation("gift", guest.id, 15, 60_000))) return apiError("Too many gift updates. Please try again shortly.", 429);
    const now = new Date().toISOString();
    const database = db();
    let results: D1Result[];
    if (payload.action === "reserve") {
      results = await database.batch([
        database.prepare("UPDATE gifts SET status = 'reserved', reserved_by_guest_id = ?, reserved_at = ?, updated_at = ? WHERE id = ? AND status = 'available' AND published = 1").bind(guest.id, now, now, giftId),
        database.prepare(`INSERT INTO gift_reservations (id, gift_id, guest_id, surprise, status, reserved_at)
          SELECT ?, id, ?, 0, 'reserved', ? FROM gifts WHERE id = ? AND status = 'reserved' AND reserved_by_guest_id = ? AND reserved_at = ?
          AND NOT EXISTS (SELECT 1 FROM gift_reservations WHERE gift_id = gifts.id AND status IN ('reserved', 'purchased'))`)
          .bind(randomId("reservation"), guest.id, now, giftId, guest.id, now),
      ]);
    } else if (payload.action === "release") {
      results = await database.batch([
        database.prepare(`UPDATE gifts SET status = 'available', reserved_by_guest_id = NULL, reserved_at = NULL, updated_at = ?
          WHERE id = ? AND status = 'reserved' AND reserved_by_guest_id = ?
          AND EXISTS (SELECT 1 FROM gift_reservations WHERE gift_id = gifts.id AND guest_id = ? AND status = 'reserved')`)
          .bind(now, giftId, guest.id, guest.id),
        database.prepare(`UPDATE gift_reservations SET status = 'released', released_at = ?
          WHERE gift_id = ? AND guest_id = ? AND status = 'reserved'
          AND EXISTS (SELECT 1 FROM gifts WHERE id = gift_id AND status = 'available' AND updated_at = ?)`)
          .bind(now, giftId, guest.id, now),
      ]);
    } else {
      results = await database.batch([
        database.prepare(`UPDATE gifts SET status = 'purchased', purchased_at = ?, updated_at = ?
          WHERE id = ? AND status = 'reserved' AND reserved_by_guest_id = ?
          AND EXISTS (SELECT 1 FROM gift_reservations WHERE gift_id = gifts.id AND guest_id = ? AND status = 'reserved')`)
          .bind(now, now, giftId, guest.id, guest.id),
        database.prepare(`UPDATE gift_reservations SET status = 'purchased', purchased_at = ?
          WHERE gift_id = ? AND guest_id = ? AND status = 'reserved'
          AND EXISTS (SELECT 1 FROM gifts WHERE id = gift_id AND status = 'purchased' AND updated_at = ?)`)
          .bind(now, giftId, guest.id, now),
      ]);
    }
    if (!results[0].meta.changes) return privateJson({ error: "This gift changed while you were viewing it. Its availability has been refreshed.", gifts: await listGifts(guest.id) }, 409);
    if (!results[1].meta.changes) {
      logFailure("gift_history_inconsistent", new Error("Missing reservation history transition"));
      return apiError("We could not confirm this gift update. Please contact us before retrying.", 503);
    }
    return privateJson({ gifts: await listGifts(guest.id), guestName: guest.display_name, shippingInstructions: await shippingFor(guest.id) });
  } catch (error) { logFailure("gift_write", error); return apiError("Gift could not be updated. Please try again.", 503); }
}
