import { requireAdmin } from "@/lib/server";
import { AdminLogin } from "../admin-login";
import { StaffScreen } from "@/app/staff/staff-screen";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };
export default async function CheckInPage() {
  const admin = await requireAdmin();
  if (!admin) return <AdminLogin returnTo="/admin/check-in" />;
  return <StaffScreen operator={{ userId: admin.userId, name: admin.displayName, auditName: admin.email, role: "admin" }} />;
}
