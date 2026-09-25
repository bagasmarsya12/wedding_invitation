import { createSessionToken, DUMMY_CREDENTIAL, verifyPassword } from "@/lib/admin-auth";
import {
  ADMIN_SESSION_COOKIE, adminSessionSecret, allowMutation, cleanText, db, getAdminCredential,
  privateJson, readJsonBody, sameOriginMutation,
} from "@/lib/server";

export const runtime = "nodejs";

/**
 * Password admin sign-in. Rate-limited per account and per IP; unknown emails
 * still pay one PBKDF2 verification so timing cannot enumerate accounts.
 */
export async function POST(request: Request) {
  if (!sameOriginMutation(request)) return privateJson({ error: "Cross-origin request rejected." }, 403);

  const body = await readJsonBody(request, 4_096);
  const email = cleanText(body?.email, 200).toLowerCase();
  const password = typeof body?.password === "string" ? body.password.slice(0, 512) : "";
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || password.length === 0) {
    return privateJson({ error: "Email and password are required." }, 400);
  }

  const ip = (request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local").trim();
  if (!(await allowMutation("admin-login-ip", ip, 30, 10 * 60_000))) {
    return privateJson({ error: "Too many attempts. Try again in a few minutes." }, 429);
  }
  if (!(await allowMutation("admin-login-account", email, 10, 10 * 60_000))) {
    return privateJson({ error: "Too many attempts. Try again in a few minutes." }, 429);
  }

  const credential = await getAdminCredential(email);
  const verified = await verifyPassword(password, credential ?? DUMMY_CREDENTIAL);
  if (!credential || !verified) return privateJson({ error: "Email or password is incorrect." }, 401);

  await db().prepare("DELETE FROM mutation_limits WHERE key IN (?, ?)")
    .bind(`admin-login-ip:${ip}`, `admin-login-account:${email}`).run();

  const token = await createSessionToken(email, await adminSessionSecret());
  const secure = new URL(request.url).protocol === "https:";
  const response = privateJson({ ok: true, email });
  response.headers.set("set-cookie",
    `${ADMIN_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${secure ? "; Secure" : ""}`);
  return response;
}
