import { parseCsv, safeExternalUrl, safeMediaUrl, toCsv } from "@/lib/production";
import { allowMutation, apiError, cleanText, db, logFailure, privateHeaders, privateJson, randomId, randomInviteToken, readJsonBody, requireAdmin, sameOriginMutation, sha256 } from "@/lib/server";

async function guard() {
  return await requireAdmin();
}

export async function GET(request: Request) {
  if (!(await guard())) return apiError("Not authorized.", 403);
  try {
    const kind = new URL(request.url).searchParams.get("export");
    if (kind === "rsvps") {
      const result = await db().prepare(`SELECT g.display_name, g.email, g.party_limit, r.attendance, r.party_size, r.guest_names, r.dietary, r.message, r.updated_at
        FROM guests g LEFT JOIN rsvps r ON r.guest_id = g.id ORDER BY g.display_name`).all<Record<string, unknown>>();
      const rows = [["Guest", "Email", "Party limit", "Attendance", "Party size", "Guest names", "Dietary", "Message", "Last updated"],
        ...result.results.map(row => [row.display_name, row.email, row.party_limit, row.attendance ?? "pending", row.party_size, row.guest_names, row.dietary, row.message, row.updated_at])];
      return new Response(toCsv(rows), { headers: { ...privateHeaders, "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=bagas-iga-rsvps.csv" } });
    }
    if (kind === "backup") {
      const [guests, rsvps, gifts, reservations, marks, archive, settings] = await Promise.all([
        db().prepare("SELECT * FROM guests").all(), db().prepare("SELECT * FROM rsvps").all(),
        db().prepare("SELECT * FROM gifts").all(), db().prepare("SELECT * FROM gift_reservations").all(),
        db().prepare("SELECT * FROM guest_marks").all(), db().prepare("SELECT * FROM archive_entries").all(), db().prepare("SELECT * FROM settings").all(),
      ]);
      const data = { exportedAt: new Date().toISOString(), guests: guests.results, rsvps: rsvps.results, gifts: gifts.results, reservations: reservations.results, marks: marks.results, archive: archive.results, settings: settings.results };
      return new Response(JSON.stringify(data), { headers: { ...privateHeaders, "content-type": "application/json; charset=utf-8", "content-disposition": "attachment; filename=bagas-iga-data-backup.json" } });
    }
    if (kind) return apiError("Unsupported export.");
    const [guests, rsvps, gifts, reservations, marks, archive, settings] = await Promise.all([
    db().prepare("SELECT id, display_name, email, party_limit, status, created_at FROM guests ORDER BY created_at DESC").all(),
    db().prepare("SELECT r.*, g.display_name FROM rsvps r JOIN guests g ON g.id = r.guest_id ORDER BY r.updated_at DESC").all(),
    db().prepare("SELECT id, title, description, recipient_category, image_url, purchase_url, price_label, status, reserved_by_guest_id, shipping_required, created_at FROM gifts ORDER BY created_at DESC").all(),
    db().prepare("SELECT r.id, r.gift_id, r.guest_id, r.status, r.reserved_at, r.released_at, r.purchased_at, g.display_name AS guest_name, f.title AS gift_title FROM gift_reservations r JOIN guests g ON g.id = r.guest_id JOIN gifts f ON f.id = r.gift_id ORDER BY r.reserved_at DESC").all(),
    db().prepare("SELECT id, guest_id, author_name, message, drawing_key, visibility, moderation_status, created_at FROM guest_marks ORDER BY created_at DESC").all(),
    db().prepare("SELECT id, slug, type, title, excerpt, story, media_url, featured, featured_order, visibility, published, created_at FROM archive_entries ORDER BY created_at DESC").all(),
    db().prepare("SELECT key, value, updated_at FROM settings ORDER BY key").all(),
  ]);
    return privateJson({ guests: guests.results, rsvps: rsvps.results, gifts: gifts.results, reservations: reservations.results, marks: marks.results, archive: archive.results, settings: settings.results });
  } catch (error) { logFailure("admin_read", error); return apiError("Admin data is temporarily unavailable.", 503); }
}

export async function POST(request: Request) {
  if (!sameOriginMutation(request)) return apiError("This request could not be verified.", 403);
  const admin = await guard();
  if (!admin) return apiError("Not authorized.", 403);
  try {
    const payload = await readJsonBody(request, 80_000);
    if (!payload) return apiError("Invalid request or file too large.");
    const op = cleanText(payload.op, 50);
    if (!(await allowMutation("admin", admin.userId, 120, 60_000))) return apiError("Please slow down and try again shortly.", 429);
    const now = new Date().toISOString();

  if (op === "create_guest") {
    const displayName = cleanText(payload.displayName, 120);
    if (!displayName) return apiError("Guest name is required.");
    const partyLimit = Number(payload.partyLimit ?? 1);
    if (!Number.isInteger(partyLimit) || partyLimit < 1 || partyLimit > 20) return apiError("Party limit must be between 1 and 20.");
    const email = cleanText(payload.email, 180);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return apiError("Email address is invalid.");
    const token = randomInviteToken();
    await db().prepare("INSERT INTO guests (id, token_hash, display_name, email, party_limit, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)")
      .bind(randomId("guest"), await sha256(token), displayName, email || null, partyLimit, now, now).run();
    return privateJson({ ok: true, inviteUrl: `/invite/${token}` }, 201);
  }

  if (op === "import_guests") {
    if (typeof payload.csv !== "string") return apiError("Paste a CSV file first.");
    const rows = parseCsv(payload.csv.replace(/^\uFEFF/, ""));
    if (!rows || rows.length < 2) return apiError("CSV must have a header and at least one guest (maximum 100 guests).");
    const headers = rows[0].map(value => value.trim().toLowerCase());
    const nameColumn = headers.indexOf("displayname");
    const partyColumn = headers.indexOf("partylimit");
    const emailColumn = headers.indexOf("email");
    const referenceColumn = headers.indexOf("reference");
    if (nameColumn < 0 || partyColumn < 0) return apiError("CSV requires displayName and partyLimit columns.");
    const records: { displayName: string; partyLimit: number; email: string | null; importKey: string }[] = [];
    const seen = new Set<string>();
    for (const [index, row] of rows.slice(1).entries()) {
      const displayName = row[nameColumn]?.trim() ?? "";
      const partyLimit = Number(row[partyColumn]);
      const email = emailColumn >= 0 ? (row[emailColumn]?.trim() ?? "") : "";
      const reference = referenceColumn >= 0 ? (row[referenceColumn]?.trim() ?? "") : "";
      if (!displayName || displayName.length > 120 || !Number.isInteger(partyLimit) || partyLimit < 1 || partyLimit > 20 ||
        email.length > 180 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || reference.length > 120)
        return apiError(`Invalid guest CSV row ${index + 2}.`);
      const importKey = await sha256(`guest-import:${reference || `${displayName.toLowerCase()}|${email.toLowerCase()}`}`);
      if (seen.has(importKey)) return apiError(`Duplicate guest CSV row ${index + 2}. Add unique reference values.`);
      seen.add(importKey);
      records.push({ displayName, partyLimit, email: email || null, importKey });
    }
    const existing = await db().prepare("SELECT display_name, email, import_key FROM guests").all<{ display_name: string; email: string | null; import_key: string | null }>();
    const existingKeys = new Set(existing.results.map(row => row.import_key).filter(Boolean));
    const existingNames = new Set(existing.results.map(row => `${row.display_name.trim().toLowerCase()}|${(row.email ?? "").trim().toLowerCase()}`));
    const novel = records.filter(row => !existingKeys.has(row.importKey) && !existingNames.has(`${row.displayName.toLowerCase()}|${(row.email ?? "").toLowerCase()}`));
    const prepared = await Promise.all(novel.map(async row => ({ ...row, token: randomInviteToken() })));
    const statements = await Promise.all(prepared.map(async row => db().prepare(
      "INSERT INTO guests (id, token_hash, import_key, display_name, email, party_limit, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?) ON CONFLICT(import_key) DO NOTHING",
    ).bind(randomId("guest"), await sha256(row.token), row.importKey, row.displayName, row.email, row.partyLimit, now, now)));
    const results = statements.length ? await db().batch(statements) : [];
    const links = prepared.filter((_, index) => results[index].meta.changes).map(row => ({ guest: row.displayName, invitationUrl: new URL(`/invite/${row.token}`, request.url).toString() }));
    return privateJson({ ok: true, links, skipped: records.length - links.length, warning: "Download these new links now. Raw tokens are not stored and cannot be re-exported." }, 201);
  }

  if (op === "create_gift") {
    const title = cleanText(payload.title, 160);
    const category = cleanText(payload.category, 40);
    if (!title || !["bagas", "iga", "home"].includes(category)) return apiError("Gift title and category are required.");
    const imageUrl = payload.imageUrl ? safeMediaUrl(payload.imageUrl) : null;
    const purchaseUrl = payload.purchaseUrl ? safeExternalUrl(payload.purchaseUrl) : null;
    if ((payload.imageUrl && !imageUrl) || (payload.purchaseUrl && !purchaseUrl)) return apiError("Gift links must be valid HTTPS URLs.");
    await db().prepare(`INSERT INTO gifts (id, title, description, recipient_category, image_url, purchase_url, price_label, status, shipping_required, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?)`)
      .bind(randomId("gift"), title, cleanText(payload.description, 500) || null, category, imageUrl, purchaseUrl, cleanText(payload.priceLabel, 80) || null, payload.shippingRequired ? 1 : 0, now, now).run();
    return privateJson({ ok: true }, 201);
  }

  if (op === "create_archive") {
    const title = cleanText(payload.title, 180);
    const slug = cleanText(payload.slug, 120).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    if (!title || !slug) return apiError("Archive title and slug are required.");
    const mediaUrl = payload.mediaUrl ? safeMediaUrl(payload.mediaUrl) : null;
    if (payload.mediaUrl && !mediaUrl) return apiError("Archive media must be a valid HTTPS URL.");
    await db().prepare(`INSERT INTO archive_entries (id, slug, type, title, excerpt, story, media_url, featured, featured_order, visibility, published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(randomId("archive"), slug, cleanText(payload.type, 40) || "other", title, cleanText(payload.excerpt, 400) || null, cleanText(payload.story, 6000) || null, mediaUrl, payload.featured ? 1 : 0, Number(payload.featuredOrder) || null, payload.visibility === "public" ? "public" : "guests", payload.published ? 1 : 0, now, now).run();
    return privateJson({ ok: true }, 201);
  }

  if (op === "update_guest") {
    const name = cleanText(payload.displayName, 120);
    const status = cleanText(payload.status, 20);
    const partyLimit = Number(payload.partyLimit);
    if (!name || !["active", "revoked"].includes(status) || !Number.isInteger(partyLimit) || partyLimit < 1 || partyLimit > 20)
      return apiError("Guest name, status, or party limit is invalid.");
    const result = await db().prepare("UPDATE guests SET display_name = ?, party_limit = ?, status = ?, updated_at = ? WHERE id = ?")
      .bind(name, partyLimit, status, now, cleanText(payload.id, 120)).run();
    return result.meta.changes ? privateJson({ ok: true }) : apiError("Guest not found.", 404);
  }

  if (op === "update_gift") {
    const title = cleanText(payload.title, 160);
    const category = cleanText(payload.category, 40);
    const imageUrl = payload.imageUrl ? safeMediaUrl(payload.imageUrl) : null;
    const purchaseUrl = payload.purchaseUrl ? safeExternalUrl(payload.purchaseUrl) : null;
    if (!title || !["bagas", "iga", "home"].includes(category) || (payload.imageUrl && !imageUrl) || (payload.purchaseUrl && !purchaseUrl))
      return apiError("Gift details are invalid. Links must use HTTPS.");
    const result = await db().prepare(`UPDATE gifts SET title = ?, description = ?, recipient_category = ?, image_url = ?, purchase_url = ?, price_label = ?, shipping_required = ?, updated_at = ? WHERE id = ?`)
      .bind(title, cleanText(payload.description, 500) || null, category, imageUrl, purchaseUrl, cleanText(payload.priceLabel, 80) || null, payload.shippingRequired ? 1 : 0, now, cleanText(payload.id, 120)).run();
    return result.meta.changes ? privateJson({ ok: true }) : apiError("Gift not found.", 404);
  }

  if (op === "admin_release_gift") {
    const giftId = cleanText(payload.id, 120);
    const database = db();
    const results = await database.batch([
      database.prepare(`UPDATE gifts SET status = 'available', reserved_by_guest_id = NULL, reserved_at = NULL, updated_at = ?
        WHERE id = ? AND status = 'reserved'
        AND EXISTS (SELECT 1 FROM gift_reservations WHERE gift_id = gifts.id AND status = 'reserved')`).bind(now, giftId),
      database.prepare(`UPDATE gift_reservations SET status = 'released', released_at = ? WHERE gift_id = ? AND status = 'reserved'
        AND EXISTS (SELECT 1 FROM gifts WHERE id = gift_id AND status = 'available' AND updated_at = ?)`)
        .bind(now, giftId, now),
    ]);
    return results[0].meta.changes && results[1].meta.changes ? privateJson({ ok: true }) : apiError("No active reservation found.", 409);
  }

  if (op === "update_archive") {
    const title = cleanText(payload.title, 180);
    const slug = cleanText(payload.slug, 120).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    const mediaUrl = payload.mediaUrl ? safeMediaUrl(payload.mediaUrl) : null;
    if (!title || !slug || (payload.mediaUrl && !mediaUrl)) return apiError("Archive details are invalid. Media must use HTTPS.");
    const order = Number(payload.featuredOrder);
    const result = await db().prepare(`UPDATE archive_entries SET slug = ?, type = ?, title = ?, excerpt = ?, story = ?, media_url = ?,
      featured = ?, featured_order = ?, visibility = ?, published = ?, updated_at = ? WHERE id = ?`)
      .bind(slug, cleanText(payload.type, 40) || "other", title, cleanText(payload.excerpt, 400) || null, cleanText(payload.story, 6000) || null,
        mediaUrl, payload.featured ? 1 : 0, Number.isInteger(order) && order >= 0 ? order : null,
        payload.visibility === "public" ? "public" : "guests", payload.published ? 1 : 0, now, cleanText(payload.id, 120)).run();
    return result.meta.changes ? privateJson({ ok: true }) : apiError("Archive entry not found.", 404);
  }

  if (op === "archive_entry") {
    const result = await db().prepare("UPDATE archive_entries SET published = 0, featured = 0, updated_at = ? WHERE id = ?")
      .bind(now, cleanText(payload.id, 120)).run();
    return result.meta.changes ? privateJson({ ok: true }) : apiError("Archive entry not found.", 404);
  }

  if (op === "moderate_mark") {
    if (!["approved", "rejected", "pending"].includes(String(payload.status))) return apiError("Invalid moderation status.");
    const result = await db().prepare("UPDATE guest_marks SET moderation_status = ?, updated_at = ? WHERE id = ?")
      .bind(payload.status, now, cleanText(payload.id, 120)).run();
    if (!result.meta.changes) return apiError("Mark not found.", 404);
    return privateJson({ ok: true });
  }

  if (op === "set_setting") {
    const key = cleanText(payload.key, 80);
    if (!["site_phase", "shipping_instructions", "cash_gift_details", "rsvp_enabled", "gifts_enabled", "marks_enabled"].includes(key)) return apiError("Unsupported setting.");
    const value = cleanText(payload.value, 2000);
    if (key === "site_phase" && !["auto", "pre-wedding", "wedding-day", "post-wedding"].includes(value)) return apiError("Site phase must be auto, pre-wedding, wedding-day, or post-wedding.");
    if (key.endsWith("_enabled") && !["auto", "on", "off"].includes(value)) return apiError("Feature setting must be auto, on, or off.");
    await db().prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
      .bind(key, value, now).run();
    return privateJson({ ok: true });
  }

  return apiError("Unsupported admin operation.");
  } catch (error) { logFailure("admin_write", error); return apiError("Could not save this change. Please try again.", 503); }
}
