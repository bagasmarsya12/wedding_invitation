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
    <main className="product-page admin-page"><header className="product-header"><a href="/">Bagas <i>×</i> Iga</a><nav><span>{admin.displayName}</span>{adminMethod(admin) === "password" ? <LogoutButton /> : <a href="/signout-with-chatgpt?return_to=/">Sign out</a>}</nav></header><section className="admin-hero"><p>Private management surface</p><h1>Wedding <em>Desk</em></h1><p>Guest access, RSVP, archive, gifts, moderation, and lifecycle in one place.</p></section><AdminClient /></main>
  );
}
