/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { adminMethod, requireAdmin } from "@/lib/server";
import { AdminClient } from "./admin-client";
import { AdminLogin } from "./admin-login";
import { LogoutButton } from "./logout-button";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) {
    // Signed in on the hosting platform but not on the admin allowlist: stay hidden.
    if (await getChatGPTUser()) notFound();
    return <AdminLogin />;
  }
  return (
    <main className="product-page admin-page"><header className="product-header"><a href="/">Iga &amp; Bagas</a><nav><span>{admin.displayName}</span>{adminMethod(admin) === "password" ? <LogoutButton /> : <a href="/signout-with-chatgpt?return_to=/">Keluar</a>}</nav></header><section className="admin-hero"><p>Ruang pengelolaan pribadi</p><h1>Wedding <em>Desk</em></h1><p>Tamu, konten per section, RSVP, hadiah, dan kenangan dalam satu tempat.</p></section><AdminClient /></main>
  );
}
