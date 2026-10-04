import type { CheckInOperator } from "@/lib/staff";
import { CheckInClient } from "@/app/admin/check-in/check-in-client";
import { StaffLogout } from "./staff-logout";
export function StaffScreen({ operator, initialCode = "" }: { operator: CheckInOperator; initialCode?: string }) {
  return <main className="product-page check-in-page staff-page"><header className="staff-header"><a href="/staff">Bagas <i>×</i> Iga</a>
    <nav><span>{operator.name}</span>{operator.role === "staff" ? <StaffLogout /> : <a href="/admin">Kembali ke CMS</a>}</nav></header>
    <div className="staff-intro"><h1>Meja kedatangan</h1><p>1 November 2026 · Pandiga, Cimahi</p></div><CheckInClient initialCode={initialCode} /></main>;
}
