import { requireAdmin } from "@/lib/server";

export const runtime = "nodejs";

/**
 * Auth gate for the admin surface: ChatGPT sign-in + server-side allowlist.
 * Never expose which env values matched — a 403 leaks nothing.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Admin access is required." }, { status: 403 });
  return Response.json({ ok: true });
}
