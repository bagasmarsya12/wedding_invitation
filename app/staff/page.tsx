import { requireCheckInOperator } from "@/lib/staff";
import { StaffLogin } from "./staff-login";
import { StaffScreen } from "./staff-screen";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meja kedatangan · Bagas × Iga", robots: { index: false, follow: false, nocache: true } };
export default async function StaffPage() {
  const operator = await requireCheckInOperator();
  return operator ? <StaffScreen operator={operator} /> : <StaffLogin />;
}
