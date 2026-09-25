import { ADMIN_SESSION_COOKIE, privateJson, sameOriginMutation } from "@/lib/server";

export const runtime = "nodejs";

/** Clears the password admin session cookie. Idempotent, never reveals state. */
export async function POST(request: Request) {
  if (!sameOriginMutation(request)) return privateJson({ error: "Cross-origin request rejected." }, 403);
  const secure = new URL(request.url).protocol === "https:";
  const response = privateJson({ ok: true });
  response.headers.set("set-cookie",
    `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`);
  return response;
}
