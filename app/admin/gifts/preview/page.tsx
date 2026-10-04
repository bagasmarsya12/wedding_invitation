import { redirect } from 'next/navigation';
import { db, requireAdmin } from '@/lib/server';
import { GiftPreview } from './preview-client';
import type { Metadata } from 'next';
export const dynamic = 'force-dynamic';
export const metadata:Metadata = {robots:{index:false,follow:false,nocache:true}};
export default async function GiftPreviewPage() {
  if (!(await requireAdmin())) redirect('/admin');
  const rows = await db().prepare('SELECT id, title, description, recipient_category, image_url, price_label, status, published FROM gifts ORDER BY sort_order, created_at, id').all<{id:string;title:string;description:string|null;recipient_category:string;image_url:string|null;price_label:string|null;status:string;published:number}>();
  return <main className="product-page cms-catalogue-preview"><header className="product-header"><a href="/admin">Bagas × Iga · Wedding Desk</a><a href="/admin">Return to CMS</a></header><section className="cms-preview-heading"><p>Catalogue preview</p><h1>A few things we’re saving room for.</h1><p>This preview shows your saved catalogue. Booking takes place through a guest’s private invitation.</p></section><GiftPreview gifts={rows.results} /></main>;
}
