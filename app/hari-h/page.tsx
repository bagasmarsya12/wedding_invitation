import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { sitePhase } from '@/lib/server';
import { fullInvitationPath } from '@/lib/wedding-day-routing';
import { WeddingDayView } from '../wedding-day';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

export default async function WeddingDayPage() {
  if (await sitePhase().catch(() => undefined) !== 'wedding-day') redirect(fullInvitationPath());
  return <WeddingDayView />;
}
