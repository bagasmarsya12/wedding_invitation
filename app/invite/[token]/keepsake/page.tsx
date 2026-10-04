import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {guestFromToken} from '@/lib/server';
import {guestKeepsakePayload} from '@/lib/guest-keepsake';
import {AtelierKeepsake} from '@/app/atelier-keepsake';

export const dynamic='force-dynamic';
export const metadata:Metadata={robots:{index:false,follow:false,nocache:true}};
export default async function GuestKeepsakePage({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;const guest=await guestFromToken(token);if(!guest)notFound();
  return <AtelierKeepsake content={await guestKeepsakePayload(guest)} />;
}
