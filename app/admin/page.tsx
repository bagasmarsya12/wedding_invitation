/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { requireAdmin } from "@/lib/server";
import { AdminClient } from "./admin-client";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  if (!(await requireAdmin())) notFound();
  return <main className="product-page admin-page"><header className="product-header"><a href="/">Bagas <i>×</i> Iga</a><nav><span>{user.displayName}</span><a href="/signout-with-chatgpt?return_to=/">Sign out</a></nav></header><section className="admin-hero"><p>Private management surface</p><h1>Wedding<br /><em>Desk</em></h1><p>Guest access, RSVP, archive, gifts, moderation, and lifecycle in one place.</p></section><AdminClient /></main>;
}
