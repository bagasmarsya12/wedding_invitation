import { hashPassword } from "@/lib/admin-auth";
import { allowMutation, apiError, cleanText, db, logFailure, privateJson, randomId, readJsonBody, requireAdmin, sameOriginMutation } from "@/lib/server";
import { STAFF_USERNAME, type StaffAccount } from "@/lib/staff";

export async function GET() {
  if (!(await requireAdmin())) return apiError("Admin access required.", 403);
  try {
    const staff = await db().prepare("SELECT id, username, display_name, enabled, updated_at FROM staff_users ORDER BY display_name, id").all<StaffAccount>();
    return privateJson({ staff: staff.results });
  } catch (error) { logFailure("staff_list", error); return apiError("Daftar petugas belum tersedia.", 503); }
}
export async function POST(request: Request) {
  if (!sameOriginMutation(request)) return apiError("Permintaan tidak dapat diverifikasi.", 403);
  const admin = await requireAdmin();
  if (!admin) return apiError("Admin access required.", 403);
  try {
    if (!(await allowMutation("staff-manage", admin.userId, 30, 60_000))) return apiError("Tunggu sebentar sebelum menyimpan lagi.", 429);
    const body = await readJsonBody(request, 4096);
    const name = cleanText(body?.name, 80);
    const password = typeof body?.password === "string" ? body.password : "";
    if (!name) return apiError("Nama petugas wajib diisi.");
    if (password && (password.length < 12 || password.length > 128)) return apiError("Password harus 12–128 karakter.");
    if (body?.op === "create") {
      const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
      if (!STAFF_USERNAME.test(username)) return apiError("Username harus 3–40 karakter: huruf kecil, angka, titik, garis bawah, atau tanda minus.");
      if (!password) return apiError("Isi password untuk petugas baru.");
      const credential = JSON.stringify(await hashPassword(password));
      const result = await db().prepare(`INSERT INTO staff_users (id, username, display_name, credential) VALUES (?, ?, ?, ?)
        ON CONFLICT(username) DO NOTHING`).bind(randomId("staff"), username, name, credential).run();
      return result.meta.changes ? privateJson({ ok: true }, 201) : apiError("Username sudah digunakan.", 409);
    }
    if (body?.op === "save") {
      const id = cleanText(body.id, 100);
      if (typeof body.enabled !== "boolean" || !id) return apiError("Pilih akun petugas yang valid.");
      const account = await db().prepare("SELECT id FROM staff_users WHERE id = ?").bind(id).first();
      if (!account) return apiError("Akun petugas tidak ditemukan.", 404);
      const statements = [password
        ? db().prepare("UPDATE staff_users SET display_name = ?, enabled = ?, credential = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(name, Number(body.enabled), JSON.stringify(await hashPassword(password)), id)
        : db().prepare("UPDATE staff_users SET display_name = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(name, Number(body.enabled), id)];
      if (password || !body.enabled) statements.push(db().prepare("DELETE FROM staff_sessions WHERE staff_id = ?").bind(id));
      await db().batch(statements);
      return privateJson({ ok: true });
    }
    return apiError("Pilih tindakan petugas yang valid.");
  } catch (error) { logFailure("staff_manage", error); return apiError("Akun petugas belum bisa disimpan.", 503); }
}
