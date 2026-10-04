import { headers } from "next/headers";
import { cookieValue, db, requireAdmin, sha256 } from "./server";

export const STAFF_COOKIE = "wedding_staff";
export const STAFF_SESSION_SECONDS = 12 * 60 * 60;
export const STAFF_USERNAME = /^[a-z0-9][a-z0-9._-]{2,39}$/;
export type CheckInOperator = { userId: string; name: string; auditName: string; role: "admin" | "staff" };
export type StaffAccount = { id: string; username: string; display_name: string; enabled: number; updated_at: string };

export async function requireStaff(): Promise<CheckInOperator | null> {
  const token = cookieValue((await headers()).get("cookie"), STAFF_COOKIE);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await db().prepare(`SELECT u.id, u.username, u.display_name FROM staff_sessions s
    JOIN staff_users u ON u.id = s.staff_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.enabled = 1 LIMIT 1`)
    .bind(await sha256(token), Date.now()).first<{ id: string; username: string; display_name: string }>();
  return row ? { userId: `staff:${row.id}`, name: row.display_name, auditName: `${row.display_name} (@${row.username})`, role: "staff" } : null;
}

export async function requireCheckInOperator(): Promise<CheckInOperator | null> {
  const admin = await requireAdmin();
  if (admin) return { userId: admin.userId, name: admin.displayName, auditName: admin.email, role: "admin" };
  return requireStaff();
}

export function staffCookie(token: string, secure: boolean, maxAge = STAFF_SESSION_SECONDS): string {
  return `${STAFF_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
