import { WeddingExperience } from "./wedding-experience";
import { loadHomepageContent } from "@/lib/homepage-content";
import { redirect } from 'next/navigation';
import { sitePhase } from '@/lib/server';
import { weddingDayPath, weddingDayRedirect } from '@/lib/wedding-day-routing';

export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { view } = await searchParams;
  const destination = view === 'full' ? null : weddingDayRedirect(await sitePhase().catch(() => undefined), view);
  if (destination) redirect(destination);
  return <WeddingExperience {...await loadHomepageContent()} dayOfRedirect={view === 'full' ? undefined : weddingDayPath()} />;
}
