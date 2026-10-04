import { loadWebsite } from "@/lib/website-server";
import { readGuestImport } from '@/lib/guest-import';
import { sealInvitationToken, invitationVault } from '@/lib/invitation-vault';
import { parseCsv, safeExternalUrl, safeMediaUrl, toCsv } from "@/lib/production";
import { DEFAULT_INVITATION_MESSAGE, invitationMessage, invitationToken, validGuestGroup, validInvitationTemplate } from '@/lib/invitation-message';
import { allowMutation, apiError, cleanText, db, logFailure, privateHeaders, privateJson, randomId, randomInviteToken, readJsonBody, requireAdmin, sameOriginMutation, sha256 } from "@/lib/server";

async function guard() {
  return await requireAdmin();
}

export async function GET(request: Request) {
  if (!(await guard())) return apiError("Not authorized.", 403);
  try {
    const kind = new URL(request.url).searchParams.get("export");
    if (kind === 'guests') {
      const result = await db().prepare(`SELECT g.display_name, g.email, g.party_limit, g.guest_group, g.status, g.invitation_sent_at, r.attendance FROM guests g LEFT JOIN rsvps r ON r.guest_id = g.id ORDER BY g.display_name`).all<Record<string,unknown>>();
      return new Response(toCsv([['Guest','Email','Party limit','Group','Access','Sent manually at','RSVP'], ...result.results.map(row=>[row.display_name,row.email,row.party_limit,row.guest_group,row.status,row.invitation_sent_at,row.attendance ?? 'pending'])]),{headers:{...privateHeaders,'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename=bagas-iga-guests.csv'}});
    }
    if (kind === "rsvps") {
      const result = await db().prepare(`SELECT g.display_name, g.email, g.party_limit, r.attendance, r.party_size, r.guest_names, r.dietary, r.message, r.updated_at
        FROM guests g LEFT JOIN rsvps r ON r.guest_id = g.id ORDER BY g.display_name`).all<Record<string, unknown>>();
      const rows = [["Guest", "Email", "Party limit", "Attendance", "Party size", "Guest names", "Dietary", "Message", "Last updated"],
        ...result.results.map(row => [row.display_name, row.email, row.party_limit, row.attendance ?? "pending", row.party_size, row.guest_names, row.dietary, row.message, row.updated_at])];
      return new Response(toCsv(rows), { headers: { ...privateHeaders, "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=bagas-iga-rsvps.csv" } });
    }
    if (kind === "backup") {
      const [guests, rsvps, gifts, reservations, marks, archive, settings, passes, checkins, giftMedia, visits] = await Promise.all([
        db().prepare("SELECT * FROM guests").all(), db().prepare("SELECT * FROM rsvps").all(),
        db().prepare("SELECT * FROM gifts").all(), db().prepare("SELECT * FROM gift_reservations").all(),
        db().prepare("SELECT * FROM guest_marks").all(), db().prepare("SELECT * FROM archive_entries").all(), db().prepare("SELECT * FROM settings").all(),
        db().prepare("SELECT * FROM guest_passes").all(), db().prepare("SELECT * FROM guest_checkins").all(),
        db().prepare("SELECT * FROM gift_media").all(), db().prepare("SELECT * FROM page_visits").all(),
      ]);
      const data = { exportedAt: new Date().toISOString(), guests: guests.results, rsvps: rsvps.results, gifts: gifts.results, reservations: reservations.results, marks: marks.results, archive: archive.results, settings: settings.results, passes: passes.results, checkins: checkins.results, giftMedia: giftMedia.results, pageVisits: visits.results };
      return new Response(JSON.stringify(data), { headers: { ...privateHeaders, "content-type": "application/json; charset=utf-8", "content-disposition": "attachment; filename=bagas-iga-data-backup.json" } });
    }
    if (kind === "checkins") {
      const rows = await db().prepare("SELECT g.display_name, c.party_size, c.checked_in_at, c.checked_in_by, c.checkin_method FROM guest_checkins c JOIN guests g ON g.id = c.guest_id ORDER BY c.checked_in_at DESC").all<Record<string, unknown>>();
      return new Response(toCsv([["Guest", "Arriving guests", "Checked in at", "Recorded by", "Method"], ...rows.results.map(row => [row.display_name, row.party_size, row.checked_in_at, row.checked_in_by, row.checkin_method])]), { headers: { ...privateHeaders, "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=bagas-iga-checkins.csv" } });
    }
    if (kind) return apiError("Unsupported export.");
    const [guests, rsvps, gifts, reservations, marks, archive, settings, checkins] = await Promise.all([
    db().prepare("SELECT id, display_name, email, party_limit, status, guest_group, invitation_sent_at, invitation_token_enc IS NOT NULL AS has_saved_link, created_at FROM guests ORDER BY created_at DESC").all(),
    db().prepare("SELECT r.*, g.display_name FROM rsvps r JOIN guests g ON g.id = r.guest_id ORDER BY r.updated_at DESC").all(),
    db().prepare("SELECT f.id, f.title, f.description, f.recipient_category, f.image_url, f.purchase_url, f.price_label, f.status, f.reserved_by_guest_id, g.display_name AS reserved_by_name, f.reserved_at, f.purchased_at, f.shipping_required, f.sort_order, f.published, f.created_at FROM gifts f LEFT JOIN guests g ON g.id = f.reserved_by_guest_id ORDER BY f.sort_order, f.created_at, f.id").all(),
    db().prepare("SELECT r.id, r.gift_id, r.guest_id, r.status, r.reserved_at, r.released_at, r.purchased_at, g.display_name AS guest_name, f.title AS gift_title FROM gift_reservations r JOIN guests g ON g.id = r.guest_id JOIN gifts f ON f.id = r.gift_id ORDER BY r.reserved_at DESC").all(),
    db().prepare("SELECT m.id, m.guest_id, m.author_name, m.message, m.drawing_key, m.visibility, m.moderation_status, m.created_at, g.display_name AS guest_name FROM guest_marks m JOIN guests g ON g.id=m.guest_id ORDER BY m.created_at DESC").all(),
    db().prepare("SELECT id, slug, type, title, excerpt, story, media_url, featured, featured_order, visibility, published, created_at FROM archive_entries ORDER BY created_at DESC").all(),
    db().prepare("SELECT key, value, updated_at FROM settings WHERE key NOT LIKE 'admin.%' ORDER BY key").all(),
    db().prepare("SELECT c.*, g.display_name FROM guest_checkins c JOIN guests g ON g.id = c.guest_id ORDER BY c.checked_in_at DESC").all(),
  ]);
    return privateJson({ guests: guests.results, rsvps: rsvps.results, gifts: gifts.results, reservations: reservations.results, marks: marks.results, archive: archive.results, settings: settings.results, checkins: checkins.results });
  } catch (error) { logFailure("admin_read", error); return apiError("Admin data is temporarily unavailable.", 503); }
}

export async function POST(request: Request) {
  if (!sameOriginMutation(request)) return apiError("This request could not be verified.", 403);
  const admin = await guard();
  if (!admin) return apiError("Not authorized.", 403);
  try {
    const payload = await readJsonBody(request, 300_000);
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
    const group = payload.guestGroup ?? 'unassigned';
    if (!validGuestGroup(group)) return apiError('Choose a valid guest group.');
    const id = randomId('guest');
    await db().prepare("INSERT INTO guests (id, token_hash, display_name, email, party_limit, guest_group, status, created_at, updated_at, invitation_token_enc) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)")
      .bind(id, await sha256(token), displayName, email || null, partyLimit, group, now, now, await sealInvitationToken(token)).run();
    return privateJson({ ok: true, guestId:id, inviteUrl: `/invite/${token}` }, 201);
  }

  if (op === "import_guests") {
    if (typeof payload.csv !== "string") return apiError("Paste a CSV file first.");
    const parsed=readGuestImport(payload.csv);
    if(parsed.issues.length) return apiError(parsed.issues.map(issue=>`Row ${issue.row}: ${issue.message}`).join(' '));
    if(parsed.records.length>25)return apiError('Maximum 25 guests per request. The CMS splits larger files automatically.');
    const records=await Promise.all(parsed.records.map(async row=>({...row,email:row.email||null,importKey:await sha256(`guest-import:${row.reference.toLowerCase() || `${row.displayName.toLowerCase()}|${row.email.toLowerCase()}`}`)})));
    const existing=await db().prepare("SELECT display_name,email,import_key FROM guests").all<{display_name:string;email:string|null;import_key:string|null}>();
    const existingKeys=new Set(existing.results.map(row=>row.import_key).filter(Boolean));
    const existingNames=new Set(existing.results.map(row=>`${row.display_name.trim().toLowerCase()}|${(row.email??'').trim().toLowerCase()}`));
    const novel=records.filter(row=>!existingKeys.has(row.importKey)&&(row.reference||!existingNames.has(`${row.displayName.toLowerCase()}|${(row.email??'').toLowerCase()}`)));
    const prepared = novel.map(row => ({ ...row, id:randomId('guest'), token: randomInviteToken() }));
    const vault=await invitationVault();
    const statements = await Promise.all(prepared.map(async row => db().prepare(
      "INSERT INTO guests (id, token_hash, import_key, display_name, email, party_limit, guest_group, status, created_at, updated_at, invitation_token_enc) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?) ON CONFLICT(import_key) DO NOTHING",
    ).bind(row.id, await sha256(row.token), row.importKey, row.displayName, row.email, row.partyLimit, row.group, now, now, await vault.seal(row.token))));
    const results = statements.length ? await db().batch(statements) : [];
    const links = prepared.filter((_, index) => results[index].meta.changes).map(row => ({ guestId:row.id, guest: row.displayName, invitationUrl: new URL(`/invite/${row.token}`, request.url).toString() }));
    return privateJson({ ok: true, links, skipped: records.length - links.length, warning: "Invitation links are encrypted and available to authorized CMS admins." }, 201);
  }

  if (op === "create_gift") {
    const title = cleanText(payload.title, 160);
    const category = cleanText(payload.category, 40);
    if (!title || !["bagas", "iga", "home"].includes(category)) return apiError("Gift title and category are required.");
    const imageUrl = payload.imageUrl ? safeMediaUrl(payload.imageUrl) : null;
    const purchaseUrl = payload.purchaseUrl ? safeExternalUrl(payload.purchaseUrl) : null;
    if ((payload.imageUrl && !imageUrl) || (payload.purchaseUrl && !purchaseUrl)) return apiError("Gift links must be valid HTTPS URLs.");
    const id = randomId('gift');
    await db().prepare(`INSERT INTO gifts (id, title, description, recipient_category, image_url, purchase_url, price_label, status, shipping_required, sort_order, published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM gifts), ?, ?, ?)`)
      .bind(id, title, cleanText(payload.description, 500) || null, category, imageUrl, purchaseUrl, cleanText(payload.priceLabel, 80) || null, payload.shippingRequired ? 1 : 0, payload.published === true ? 1 : 0, now, now).run();
    return privateJson({ ok: true, giftId:id }, 201);
  }

  if (op === 'reorder_gifts') {
    const ids = payload.ids;
    if (!Array.isArray(ids) || ids.length > 1000 || ids.some(id=>typeof id !== 'string' || id.length > 120) || new Set(ids).size !== ids.length) return apiError('Invalid catalogue order.');
    const current = await db().prepare('SELECT id FROM gifts').all<{id:string}>();
    if (current.results.length !== ids.length || current.results.some(row=>!ids.includes(row.id))) return apiError('The catalogue changed. Refresh it before reordering.',409);
    if (ids.length) await db().batch(ids.map((id,index)=>db().prepare('UPDATE gifts SET sort_order = ?, updated_at = ? WHERE id = ?').bind(index,now,id)));
    return privateJson({ok:true});
  }

  if (op === 'prepare_invitation') {
    const id = cleanText(payload.id,120);
    const guest = await db().prepare("SELECT display_name, token_hash FROM guests WHERE id = ? AND status = 'active'").bind(id).first<{display_name:string;token_hash:string}>();
    if (!guest) return apiError('Guest not found or access revoked.',404);
    const token = invitationToken(cleanText(payload.inviteUrl,600),new URL(request.url).origin);
    if (!token || await sha256(token) !== guest.token_hash) return apiError('This invitation link does not belong to this active guest. Paste the saved link for this guest.');
    const template = (await db().prepare("SELECT value FROM settings WHERE key = 'invitation_message_template'").first<{value:string}>())?.value || DEFAULT_INVITATION_MESSAGE;
    const link = new URL(`/invite/${token}`,request.url).toString();
    // A pasted older invitation can be saved after its hash is verified.
    await db().prepare('UPDATE guests SET invitation_token_enc=? WHERE id=? AND token_hash=?').bind(await sealInvitationToken(token),id,guest.token_hash).run();
    return privateJson({ok:true, message:invitationMessage(template,guest.display_name,link,(await loadWebsite()).config), inviteUrl:link});
  }

  if (op === 'mark_invitation_sent') {
    if (typeof payload.sent !== 'boolean') return apiError('Choose sent or not sent.');
    const result = await db().prepare('UPDATE guests SET invitation_sent_at = ?, updated_at = ? WHERE id = ?').bind(payload.sent ? now : null,now,cleanText(payload.id,120)).run();
    return result.meta.changes ? privateJson({ok:true}) : apiError('Guest not found.',404);
  }

  if (op === 'regenerate_token') {
    const token = randomInviteToken();
    const id = cleanText(payload.id,120);
    const result = await db().prepare("UPDATE guests SET token_hash = ?, invitation_token_enc = ?, invitation_sent_at = NULL, updated_at = ? WHERE id = ? AND status = 'active'").bind(await sha256(token),await sealInvitationToken(token),now,id).run();
    return result.meta.changes ? privateJson({ok:true,guestId:id,inviteUrl:`/invite/${token}`}) : apiError('Guest not found or access revoked.',404);
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
    const group = payload.guestGroup ?? 'unassigned';
    if (!validGuestGroup(group)) return apiError('Choose a valid guest group.');
    if (!name || !["active", "revoked"].includes(status) || !Number.isInteger(partyLimit) || partyLimit < 1 || partyLimit > 20)
      return apiError("Guest name, status, or party limit is invalid.");
    const result = await db().prepare("UPDATE guests SET display_name = ?, party_limit = ?, status = ?, guest_group = ?, updated_at = ? WHERE id = ?")
      .bind(name, partyLimit, status, group, now, cleanText(payload.id, 120)).run();
    return result.meta.changes ? privateJson({ ok: true }) : apiError("Guest not found.", 404);
  }

  if (op === "update_gift") {
    const title = cleanText(payload.title, 160);
    const category = cleanText(payload.category, 40);
    const imageUrl = payload.imageUrl ? safeMediaUrl(payload.imageUrl) : null;
    const purchaseUrl = payload.purchaseUrl ? safeExternalUrl(payload.purchaseUrl) : null;
    if (!title || !["bagas", "iga", "home"].includes(category) || (payload.imageUrl && !imageUrl) || (payload.purchaseUrl && !purchaseUrl))
      return apiError("Gift details are invalid. Links must use HTTPS.");
    const id = cleanText(payload.id,120);
    const current = await db().prepare('SELECT published, status FROM gifts WHERE id = ?').bind(id).first<{published:number;status:string}>();
    if (!current) return apiError('Gift not found.',404);
    const published = typeof payload.published === 'boolean' ? (payload.published ? 1 : 0) : current.published;
    if (!published && current.status !== 'available') return apiError('Booked or purchased gifts must stay visible. Release an unpurchased booking before moving it to draft.',409);
    const result = await db().prepare(`UPDATE gifts SET title = ?, description = ?, recipient_category = ?, image_url = ?, purchase_url = ?, price_label = ?, shipping_required = ?, published = ?, updated_at = ? WHERE id = ? AND (? = 1 OR status = 'available')`)
      .bind(title, cleanText(payload.description, 500) || null, category, imageUrl, purchaseUrl, cleanText(payload.priceLabel, 80) || null, payload.shippingRequired ? 1 : 0, published, now, id, published).run();
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
    if (!["site_phase", "shipping_instructions", "cash_gift_details", "rsvp_enabled", "gifts_enabled", "marks_enabled", "invitation_message_template"].includes(key)) return apiError("Unsupported setting.");
    const value = cleanText(payload.value, 2000);
    if (key === 'invitation_message_template' && (typeof payload.value !== 'string' || payload.value.trim().length > 2000)) return apiError('Message template must be at most 2000 characters.');
    if (key === 'invitation_message_template' && !validInvitationTemplate(value)) return apiError('Include {{nama}} and {{link}}. Optional placeholders: {{tanggal}} and {{lokasi}}. Maximum 2000 characters.');
    if (key === "site_phase" && !["auto", "pre-wedding", "wedding-day", "post-wedding"].includes(value)) return apiError("Site phase must be auto, pre-wedding, wedding-day, or post-wedding.");
    if (key.endsWith("_enabled") && !["auto", "on", "off"].includes(value)) return apiError("Feature setting must be auto, on, or off.");
    await db().prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
      .bind(key, value, now).run();
    return privateJson({ ok: true });
  }

  return apiError("Unsupported admin operation.");
  } catch (error) { logFailure("admin_write", error); return apiError("Could not save this change. Please try again.", 503); }
}
