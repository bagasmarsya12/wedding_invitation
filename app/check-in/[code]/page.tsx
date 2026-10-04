import { requireCheckInOperator } from "@/lib/staff";
import { PASS_CODE } from "@/lib/guest-pass";
import { StaffScreen } from "@/app/staff/staff-screen";
import { StaffLogin } from "@/app/staff/staff-login";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };
export default async function ScannedPass({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!PASS_CODE.test(code)) notFound();
  const operator = await requireCheckInOperator();
  if (!operator) return <StaffLogin returnTo={`/check-in/${code}`} />;
  return <StaffScreen operator={operator} initialCode={code} />;
}
