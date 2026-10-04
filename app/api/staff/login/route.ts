import { DUMMY_CREDENTIAL, parseCredential, verifyPassword } from "@/lib/admin-auth";
import { allowMutation, apiError, db, logFailure, privateJson, readJsonBody, sameOriginMutation, sha256 } from "@/lib/server";
import { STAFF_SESSION_SECONDS, STAFF_USERNAME, staffCookie } from "@/lib/staff";

export async function POST(request: Request) {
  if (!sameOriginMutation(request)) return apiError("Permintaan tidak dapat diverifikasi.", 403);
  try {
    const body = await readJsonBody(request, 4096);
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!STAFF_USERNAME.test(username) || !password || password.length > 128) return apiError("Isi username dan password petugas.");
    const ip = (request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "local").trim();
    if (!(await allowMutation("staff-login-ip", ip, 30, 15 * 60_000)) || !(await allowMutation("staff-login-account", username, 10, 15 * 60_000))) return apiError("Terlalu banyak percobaan. Coba lagi dalam 15 menit.", 429);
    const account = await db().prepare("SELECT id, credential, enabled FROM staff_users WHERE username = ? LIMIT 1")
      .bind(username).first<{ id: string; credential: string; enabled: number }>();
    const credential = parseCredential(account?.credential);
    const verified = await verifyPassword(password, credential || DUMMY_CREDENTIAL);
    if (!account?.enabled || !credential || !verified) return apiError("Username atau password tidak sesuai.", 401);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
    const result = await db().prepare(`INSERT INTO staff_sessions (token_hash, staff_id, expires_at)
      SELECT ?, id, ? FROM staff_users WHERE id = ? AND enabled = 1 AND credential = ?`)
      .bind(await sha256(token), Date.now() + STAFF_SESSION_SECONDS * 1000, account.id, account.credential).run();
    if (!result.meta.changes) return apiError("Akses berubah. Silakan masuk kembali.", 401);
    await db().prepare("DELETE FROM staff_sessions WHERE expires_at <= ?").bind(Date.now()).run();
    const response = privateJson({ ok: true });
    response.headers.set("set-cookie", staffCookie(token, new URL(request.url).protocol === "https:"));
    return response;
  } catch (error) { logFailure("staff_login", error); return apiError("Belum bisa masuk. Coba kembali sebentar lagi.", 503); }
}
