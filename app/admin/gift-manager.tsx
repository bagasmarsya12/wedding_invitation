'use client';
import { useState } from 'react';
import { prepareCmsPhoto, validatePhotoSource, PHOTO_UPLOAD_HELP } from '@/lib/cms-photo-upload';
import { GIFT_COLLECTIONS } from '@/lib/gift-collections';
import { rowText as text, type AdminAction, type AdminRow } from './admin-types';

type Props = {gifts:AdminRow[];action:AdminAction;reload:()=>Promise<void>;notify:(message:string)=>void};
function GiftFields({gift}: {gift?:AdminRow}) {
  return <><label>Judul<input name="title" defaultValue={text(gift?.title)} maxLength={160} required /></label><label>Untuk siapa<select name="category" defaultValue={text(gift?.recipient_category) || 'bagas'}>{GIFT_COLLECTIONS.map(category=><option key={category.key} value={category.key}>{category.key === "home" ? "Iga & Bagas" : category.key === "iga" ? "Iga" : "Bagas"}</option>)}</select></label><label>Alasan / untuk apa<textarea name="description" defaultValue={text(gift?.description)} maxLength={500} placeholder="Ceritakan mengapa barang ini berarti bagi kalian atau akan dipakai untuk apa." /></label><label>Label harga<input name="priceLabel" defaultValue={text(gift?.price_label)} maxLength={80} placeholder="e.g. Rp500.000" /></label><label>Link pembelian<input name="purchaseUrl" type="url" defaultValue={text(gift?.purchase_url)} placeholder="https://…" /></label><label>URL foto (opsional)<input name="imageUrl" defaultValue={text(gift?.image_url)} placeholder="Unggah foto atau tempel URL HTTPS" /></label><label className="check"><input name="shippingRequired" type="checkbox" defaultChecked={Boolean(gift?.shipping_required)} /> Perlu pengiriman</label><label className="check"><input name="published" type="checkbox" defaultChecked={Boolean(gift?.published)} /> Tampil kepada tamu</label></>;
}
export function GiftManager({gifts,action,reload,notify}: Props) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const upload = async (id:string,file:File) => {
    const prepared = await prepareCmsPhoto(file);
    const body = new FormData();body.set('file',prepared);
    const response = await fetch(`/api/admin/gifts/${encodeURIComponent(id)}/image`,{method:'POST',body});
    const result = await response.json() as {error?:string};
    if (!response.ok) throw new Error(result.error || 'Image could not be uploaded.');
  };
  const move = async (index:number,offset:number) => {
    setBusy(true);setError('');
    try {
      const ids = gifts.map(row=>text(row.id));[ids[index],ids[index+offset]] = [ids[index+offset],ids[index]];
      const result = await action('reorder_gifts',{ids});
      if (result) notify('Urutan katalog saved.');
    } finally {setBusy(false);}
  };
  return <>
    <section className="admin-panel admin-wide"><header className="cms-section-heading"><div><h2>Tambah hadiah</h2><p>Judul, foto, link Shopee atau toko, dan urutan hadiah.</p></div><a className="cms-button" href="/admin/gifts/preview" target="_blank" rel="noopener noreferrer">Pratinjau katalog</a></header>
      <form onSubmit={async event=> {
        event.preventDefault();const form=event.currentTarget;const data=new FormData(form);const file=data.get('photo');
        if (file instanceof File && file.size) {try {validatePhotoSource(file);} catch(error) {setError(error instanceof Error ? error.message : 'Foto tidak valid.');return;}}
        const values = Object.fromEntries(data);delete values.photo;setBusy(true);setError('');
        const result = await action('create_gift',{...values,shippingRequired:data.get('shippingRequired') === 'on',published:data.get('published') === 'on'});
        if (!result?.giftId) {setBusy(false);return;}
        form.reset();
        try {if (file instanceof File && file.size) await upload(result.giftId,file);await reload();notify('Gift saved. Preview it before making it visible to guests.');}
        catch(error) {setError(`Gift saved. ${error instanceof Error ? error.message : 'Photo upload failed.'} Retry from its card below.`);}
        finally {setBusy(false);}
      }}><GiftFields /><label className="cms-full">Foto<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /><span className="cms-muted">{PHOTO_UPLOAD_HELP}. Foto upload dipakai lebih dahulu daripada URL foto.</span></label><button disabled={busy}>{busy ? 'Menyimpan…' : 'Tambah hadiah'}</button></form>
    </section>
    <section className="admin-panel admin-wide"><header className="cms-section-heading"><div><h2>Urutan katalog</h2><p>{gifts.length} gifts. Ubah urutan yang ditampilkan kepada tamu.</p></div></header>{error && <p role="alert">{error}</p>}
      {!gifts.length && <p>Katalog masih kosong. Tambahkan hadiah lalu lihat pratinjaunya.</p>}
      <div className="cms-gift-list">{gifts.map((gift,index)=> <article className="cms-gift" key={text(gift.id)}>
        <div className="cms-gift-overview">{gift.image_url ? <img className="cms-gift-image" src={text(gift.image_url)} alt={text(gift.title)} loading="lazy" /> : <div className="cms-gift-image is-empty">Tambahkan foto</div>}<div><h3>{text(gift.title)}</h3><p>{GIFT_COLLECTIONS.find(category=>category.key === gift.recipient_category)?.label} {gift.price_label ? `· ${text(gift.price_label)}` : ''}</p><span className={`cms-badge is-${text(gift.status)}`}>{text(gift.status)}</span> <span className="cms-badge">{gift.published ? 'Tampil kepada tamu' : 'Draf'}</span>{Boolean(gift.reserved_by_name) && <p>Dipilih oleh <strong>{text(gift.reserved_by_name)}</strong></p>}</div><div className="cms-order-controls"><button type="button" disabled={busy || index === 0} onClick={()=>void move(index,-1)} aria-label={`Move ${text(gift.title)} up`}>↑ Naik</button><button type="button" disabled={busy || index === gifts.length-1} onClick={()=>void move(index,1)} aria-label={`Move ${text(gift.title)} down`}>↓ Turun</button></div></div>
        <label className="cms-upload">{gift.image_url ? 'Ganti foto' : 'Unggah foto'}<input type="file" aria-label={`Upload photo for ${text(gift.title)}`} accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={async event=> {const file=event.target.files?.[0];event.target.value='';if (!file) return;setBusy(true);setError('');try{await upload(text(gift.id),file);await reload();notify('Gift photograph uploaded.');}catch(error){setError(error instanceof Error ? error.message : 'Upload failed.');}finally{setBusy(false);}}} /></label>
        <details><summary>Edit detail hadiah</summary><form onSubmit={async event=> {event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);try{await action('update_gift',{...Object.fromEntries(data),id:gift.id,shippingRequired:data.get('shippingRequired') === 'on',published:data.get('published') === 'on'});}finally{setBusy(false);}}}><GiftFields key={text(gift.image_url)} gift={gift} /><button disabled={busy}>Simpan hadiah</button></form>{gift.status === 'reserved' && <button type="button" disabled={busy} onClick={async()=> {setBusy(true);try{await action('admin_release_gift',{id:gift.id});}finally{setBusy(false);}}}>Lepaskan pilihan</button>}</details>
      </article>)}</div>
    </section>
  </>;
}
