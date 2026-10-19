'use client';
import { useState } from 'react';
import { GIFT_COLLECTIONS } from '@/lib/gift-collections';
import { rowText as text, type AdminAction, type AdminRow } from './admin-types';
import {GiftBookingEditor} from './gift-booking-editor';

type Props = {gifts:AdminRow[];action:AdminAction;reload:()=>Promise<void>;notify:(message:string)=>void};
function GiftFields({gift}: {gift?:AdminRow}) {
  return <>
    <label>Nama barang<input name="title" defaultValue={text(gift?.title)} maxLength={160} required /></label>
    <label>Untuk siapa<select name="category" defaultValue={text(gift?.recipient_category) || 'bagas'}>{GIFT_COLLECTIONS.map(category=><option key={category.key} value={category.key}>{category.key === 'home' ? 'Iga & Bagas' : category.key === 'iga' ? 'Iga' : 'Bagas'}</option>)}</select></label>
    <label className="cms-full">Alasan / untuk apa<textarea name="description" defaultValue={text(gift?.description)} maxLength={500} placeholder="Ceritakan barang yang dibutuhkan dan akan dipakai untuk apa." /></label>
    <label>Perkiraan harga (opsional)<input name="priceLabel" defaultValue={text(gift?.price_label)} maxLength={80} placeholder="Misalnya Rp500.000" /></label>
    {/* Preserve existing media and purchase data when editing the text-only card. */}
    <input name="imageUrl" type="hidden" value={text(gift?.image_url)} />
    <input name="purchaseUrl" type="hidden" value={text(gift?.purchase_url)} />
    <label className="check"><input name="shippingRequired" type="checkbox" defaultChecked={Boolean(gift?.shipping_required)} /> Perlu pengiriman</label>
    <label className="check"><input name="published" type="checkbox" defaultChecked={Boolean(gift?.published)} /> Tampilkan di website</label>
    <small>Jika dimatikan, hadiah tersimpan privat dan belum dilihat tamu.</small>
  </>;
}

export function GiftManager({gifts,action,reload,notify}: Props) {
  const [busy,setBusy] = useState(false);
  const move = async (index:number,offset:number) => {
    setBusy(true);
    try {
      const ids = gifts.map(row=>text(row.id));
      [ids[index],ids[index+offset]] = [ids[index+offset],ids[index]];
      const result = await action('reorder_gifts',{ids});
      if (result) notify('Urutan hadiah sudah diperbarui.');
    } finally {setBusy(false);}
  };
  return <>
    <section className="admin-panel admin-wide">
      <header className="cms-section-heading"><div><h2>Tambah hadiah</h2><p>Nama barang, untuk siapa, dan alasan dibutuhkan. Tombol booking membuka draf WhatsApp ke Bagas (089681747474). Setelah dikonfirmasi lewat chat, buka Atur booking pada hadiah tersebut: isi nama pemesan atau pilih Teman terkasih. Kartunya tetap tampil dengan tombol booking nonaktif.</p></div><a className="cms-button" href="/admin/gifts/preview" target="_blank" rel="noopener noreferrer">Pratinjau hadiah</a></header>
      <form onSubmit={async event=> {
        event.preventDefault();
        const form=event.currentTarget;
        const data=new FormData(form);
        setBusy(true);
        try {
          const result = await action('create_gift',{...Object.fromEntries(data),shippingRequired:data.get('shippingRequired') === 'on',published:data.get('published') === 'on'});
          if (!result?.giftId) return;
          form.reset();
          await reload();
          notify(data.get('published') === 'on' ? 'Hadiah sudah tampil di website.' : 'Hadiah tersimpan privat. Aktifkan Tampilkan di website saat siap.');
        } finally {setBusy(false);}
      }}><GiftFields /><button disabled={busy}>{busy ? 'Menyimpan…' : 'Tambah hadiah'}</button></form>
    </section>
    <section className="admin-panel admin-wide">
      <header className="cms-section-heading"><div><h2>Daftar hadiah</h2><p>{gifts.length} hadiah. Ubah urutan atau buka detailnya untuk mengedit.</p></div></header>
      {!gifts.length && <p>Belum ada hadiah. Tambahkan nama barang dan alasan dibutuhkan, lalu aktifkan Tampilkan di website.</p>}
      <div className="cms-gift-list">{gifts.map((gift,index)=> <article className="cms-gift" key={text(gift.id)}>
        <div className="cms-gift-overview is-text-only">
          <div><h3>{text(gift.title)}</h3><p>{GIFT_COLLECTIONS.find(category=>category.key === gift.recipient_category)?.label} {gift.price_label ? `· ${text(gift.price_label)}` : ''}</p>{Boolean(gift.description) && <p>{text(gift.description)}</p>}<span className={`cms-badge is-${text(gift.status)}`}>{gift.status==='available'?'Tersedia':gift.status==='reserved'?'Sudah dibooking':'Sudah dibeli'}</span> <span className="cms-badge">{gift.published ? 'Tayang' : 'Privat / belum tayang'}</span>{gift.status!=='available'&&<p>Nama di website: <strong>{gift.booking_anonymous||!gift.booking_name?'Teman terkasih':text(gift.booking_name)}</strong>{Boolean(gift.booking_name)&&Boolean(gift.booking_anonymous)&&<small>Catatan privat: {text(gift.booking_name)}</small>}</p>}</div>
          <div className="cms-order-controls"><button type="button" disabled={busy || index === 0} onClick={()=>void move(index,-1)} aria-label={`Move ${text(gift.title)} up`}>↑ Naik</button><button type="button" disabled={busy || index === gifts.length-1} onClick={()=>void move(index,1)} aria-label={`Move ${text(gift.title)} down`}>↓ Turun</button></div>
        </div>
        <details className="cms-gift-booking"><summary>Atur booking</summary><GiftBookingEditor key={text(gift.updated_at)} gift={gift} busy={busy} setBusy={setBusy} action={action} reload={reload} notify={notify}/></details>
        <details><summary>Edit detail hadiah</summary><form onSubmit={async event=> {
          event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);
          try {await action('update_gift',{...Object.fromEntries(data),id:gift.id,shippingRequired:data.get('shippingRequired') === 'on',published:data.get('published') === 'on'});}
          finally {setBusy(false);}
        }}><GiftFields gift={gift} /><button disabled={busy}>Simpan hadiah</button></form></details>
      </article>)}</div>
    </section>
  </>;
}
