import { apiError, cookieValue, db, logFailure, privateJson, sameOriginMutation, sha256 } from "@/lib/server";
import { STAFF_COOKIE, staffCookie } from "@/lib/staff";
export async function POST(request: Request) {
  if (!sameOriginMutation(request)) return apiError("Permintaan tidak dapat diverifikasi.", 403);
  try {
    const token = cookieValue(request.headers.get("cookie"), STAFF_COOKIE);
    if (token && /^[a-f0-9]{64}$/.test(token)) await db().prepare("DELETE FROM staff_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    const response = privateJson({ ok: true });
    response.headers.set("set-cookie", staffCookie("", new URL(request.url).protocol === "https:", 0));
    return response;
  } catch (error) { logFailure("staff_logout", error); return apiError("Belum bisa keluar. Coba lagi.", 503); }
}
