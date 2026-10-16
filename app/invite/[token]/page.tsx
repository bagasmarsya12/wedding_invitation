import { guestKeepsakeNote } from '@/lib/guest-keepsake';
import { notFound, redirect } from "next/navigation";
import { WeddingExperience } from "@/app/wedding-experience";
import { guestFromToken, sitePhase } from "@/lib/server";
import type { Metadata } from "next";
import { loadHomepageContent } from "@/lib/homepage-content";
import { weddingDayPath, weddingDayRedirect } from '@/lib/wedding-day-routing';

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const { view } = await searchParams;
  const guest = await guestFromToken(token);
  if (!guest) notFound();
  const destination = view === 'full' ? null : weddingDayRedirect(await sitePhase().catch(() => undefined), view, token);
  if (destination) redirect(destination);
  const [content, keepsakeNote] = await Promise.all([loadHomepageContent(), guestKeepsakeNote(guest.id)]);
  return <WeddingExperience keepsakeNote={keepsakeNote} {...content} guestName={guest.display_name} token={token} partyLimit={guest.party_limit} dayOfRedirect={view === 'full' ? undefined : weddingDayPath(token)} />;
}
