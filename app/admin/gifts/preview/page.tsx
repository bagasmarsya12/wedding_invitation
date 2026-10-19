import { redirect } from 'next/navigation';
import { db, requireAdmin } from '@/lib/server';
import { GiftPreview } from './preview-client';
import type { Metadata } from 'next';
import { publicGiftBooking } from '@/lib/gift-booking';
export const dynamic = 'force-dynamic';
export const metadata:Metadata = {robots:{index:false,follow:false,nocache:true}};
export default async function GiftPreviewPage() {
  if (!(await requireAdmin())) redirect('/admin');
  const rows = await db().prepare('SELECT id, title, description, recipient_category, price_label, status, published,booking_name,booking_anonymous FROM gifts ORDER BY sort_order, created_at, id').all<{id:string;title:string;description:string|null;recipient_category:string;price_label:string|null;status:string;published:number;booking_name:string|null;booking_anonymous:number}>();
  const gifts=rows.results.map(({booking_name,booking_anonymous,...gift})=>({...gift,...publicGiftBooking({...gift,booking_name,booking_anonymous})}));
  return <main className="product-page cms-catalogue-preview"><header className="product-header"><a href="/admin">Iga & Bagas · Wedding Desk</a><a href="/admin">Return to CMS</a></header><section className="cms-preview-heading"><p>Catalogue preview</p><h1>A few things we’re saving room for.</h1><p>This preview shows your saved gifts. Guests can open a prefilled WhatsApp message to Bagas; the preview button is disabled.</p></section><GiftPreview gifts={gifts} /></main>;
}
