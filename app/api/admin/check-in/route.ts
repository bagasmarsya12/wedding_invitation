import { passCodeFromInput } from "@/lib/guest-pass";
import { loadCheckInGuest, loadCheckInGuestById, searchCheckInGuests } from "@/lib/check-in";
import { allowMutation, apiError, cleanText, db, logFailure, privateJson, readJsonBody, sameOriginMutation } from "@/lib/server";
import { requireCheckInOperator } from "@/lib/staff";
export async function GET(request: Request) {
  try {
    if (!(await requireCheckInOperator())) return apiError("Masuk sebagai petugas untuk melanjutkan.", 403);
    const url = new URL(request.url);
    if (url.searchParams.has("q")) {
      const query = (url.searchParams.get("q") || "").trim().slice(0, 80);
      if (query.length === 1) return apiError("Isi minimal dua huruf nama tamu.");
      return privateJson(await searchCheckInGuests(query, url.searchParams.get("filter") || "all"));
    }
    const guestId = cleanText(url.searchParams.get("guestId"), 100);
    const code = passCodeFromInput(url.searchParams.get("code") || "", url.origin);
    if (!guestId && !code) return apiError("Masukkan kode QR atau pilih nama tamu.");
    const guest = code ? await loadCheckInGuest(code) : await loadCheckInGuestById(guestId);
    return guest ? privateJson({ guest }) : apiError("Undangan tidak ditemukan atau sudah tidak aktif.", 404);
  } catch (error) { logFailure("check_in_read", error); return apiError("Pencarian tamu belum tersedia. Coba kembali.", 503); }
}
export async function POST(request: Request) {
  if (!sameOriginMutation(request)) return apiError("Permintaan tidak dapat diverifikasi.", 403);
  try {
    const operator = await requireCheckInOperator();
    if (!operator) return apiError("Masuk sebagai petugas untuk melanjutkan.", 403);
    const body = await readJsonBody(request);
    const code = body && typeof body.code === "string" ? passCodeFromInput(body.code, new URL(request.url).origin) : null;
    const guestId = cleanText(body?.guestId, 100);
    if (body?.code !== undefined && !code) return apiError("Kode QR tidak valid.");
    if (!code && !guestId) return apiError("Scan QR atau pilih nama tamu terlebih dahulu.");
    const partySize = Number(body?.partySize);
    const guest = code ? await loadCheckInGuest(code) : await loadCheckInGuestById(guestId);
    if (!guest) return apiError("Undangan tidak ditemukan atau sudah tidak aktif.", 404);
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > guest.partyLimit) return apiError("Jumlah yang datang harus sesuai batas undangan.");
    if (!(await allowMutation("check-in", operator.userId, 120, 60_000))) return apiError("Tunggu sebentar sebelum mencatat kedatangan lagi.", 429);
    const result = await db().prepare(`INSERT INTO guest_checkins (guest_id, pass_id, party_size, checked_in_at, checked_in_by, checkin_method)
      SELECT g.id, ?, ?, ?, ?, ? FROM guests g LEFT JOIN guest_passes p ON p.guest_id = g.id AND p.token_hash = g.token_hash
      WHERE g.id = ? AND g.status = 'active' AND g.party_limit >= ? AND (? IS NULL OR p.id = ?)
      ON CONFLICT(guest_id) DO NOTHING`)
      .bind(code || `manual:${guest.guestId}`, partySize, new Date().toISOString(), operator.auditName, code ? "qr" : "name", guest.guestId, partySize, code, code).run();
    const current = code ? await loadCheckInGuest(code) : await loadCheckInGuestById(guest.guestId);
    if (!current) return apiError("Undangan tidak ditemukan atau sudah tidak aktif.", 404);
    if (!result.meta.changes && !current.arrival) return privateJson({ guest: current, error: "Batas undangan berubah. Periksa kembali jumlah yang datang." }, 409);
    return privateJson({ guest: current, duplicate: !result.meta.changes }, result.meta.changes ? 201 : 409);
  } catch (error) { logFailure("check_in_write", error); return apiError("Kedatangan belum tercatat. Periksa koneksi lalu coba lagi.", 503); }
}
