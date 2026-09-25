import { adminMethod, privateJson, requireAdmin } from "@/lib/server";

export const runtime = "nodejs";

/**
 * Auth gate for the admin surface: ChatGPT sign-in allowlist or password session.
 * Never exposes which env values matched; reports only the caller's own method.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ authenticated: false, error: "Admin access is required." }, 403);
  return privateJson({ authenticated: true, method: adminMethod(admin), email: admin.email });
}
