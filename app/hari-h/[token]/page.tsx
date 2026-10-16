import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { guestFromToken, sitePhase } from '@/lib/server';
import { fullInvitationPath } from '@/lib/wedding-day-routing';
import { WeddingDayView } from '../../wedding-day';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

export default async function PersonalWeddingDay({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [guest, phase] = await Promise.all([guestFromToken(token), sitePhase().catch(() => undefined)]);
  if (!guest) notFound();
  if (phase !== 'wedding-day') redirect(fullInvitationPath(token));
  return <WeddingDayView token={token} guestName={guest.display_name} />;
}
