import { notFound } from "next/navigation";
import { WeddingExperience } from "@/app/wedding-experience";
import { guestFromToken } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const guest = await guestFromToken(token);
  if (!guest) notFound();
  return <WeddingExperience guestName={guest.display_name} token={token} partyLimit={guest.party_limit} />;
}
