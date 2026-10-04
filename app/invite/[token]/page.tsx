import { notFound } from "next/navigation";
import { WeddingExperience } from "@/app/wedding-experience";
import { guestFromToken } from "@/lib/server";
import type { Metadata } from "next";
import { loadHomepageContent } from "@/lib/homepage-content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [guest, content] = await Promise.all([guestFromToken(token), loadHomepageContent()]);
  if (!guest) notFound();
  return <WeddingExperience {...content} guestName={guest.display_name} token={token} partyLimit={guest.party_limit} />;
}
