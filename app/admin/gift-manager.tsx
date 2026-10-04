'use client';
import { useState } from 'react';
import { GIFT_COLLECTIONS } from '@/lib/gift-collections';
import { rowText as text, type AdminAction, type AdminRow } from './admin-types';

type Props = {gifts:AdminRow[];action:AdminAction;reload:()=>Promise<void>;notify:(message:string)=>void};
function GiftFields({gift}: {gift?:AdminRow}) {
  return <><label>Title<input name="title" defaultValue={text(gift?.title)} maxLength={160} required /></label><label>Collection<select name="category" defaultValue={text(gift?.recipient_category) || 'bagas'}>{GIFT_COLLECTIONS.map(category=><option key={category.key} value={category.key}>{category.label}</option>)}</select></label><label>Description<textarea name="description" defaultValue={text(gift?.description)} maxLength={500} /></label><label>Price label<input name="priceLabel" defaultValue={text(gift?.price_label)} maxLength={80} placeholder="e.g. Rp500.000" /></label><label>Purchase link<input name="purchaseUrl" type="url" defaultValue={text(gift?.purchase_url)} placeholder="https://…" /></label><label>Image URL, optional<input name="imageUrl" defaultValue={text(gift?.image_url)} placeholder="Upload below or paste an HTTPS URL" /></label><label className="check"><input name="shippingRequired" type="checkbox" defaultChecked={Boolean(gift?.shipping_required)} /> Requires shipping</label><label className="check"><input name="published" type="checkbox" defaultChecked={Boolean(gift?.published)} /> Visible to guests</label></>;
}
export function GiftManager({gifts,action,reload,notify}: Props) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const upload = async (id:string,file:File) => {
    if (!file.size || file.size > 5*1024*1024 || !['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)) throw new Error('Choose JPEG, PNG, WebP, or AVIF up to 5 MB.');
    const body = new FormData();body.set('file',file);
    const response = await fetch(`/api/admin/gifts/${encodeURIComponent(id)}/image`,{method:'POST',body});
    const result = await response.json() as {error?:string};
    if (!response.ok) throw new Error(result.error || 'Image could not be uploaded.');
  };
  const move = async (index:number,offset:number) => {
    setBusy(true);setError('');
    try {
      const ids = gifts.map(row=>text(row.id));[ids[index],ids[index+offset]] = [ids[index+offset],ids[index]];
      const result = await action('reorder_gifts',{ids});
      if (result) notify('Catalogue order saved.');
    } finally {setBusy(false);}
  };
  return <>
    <section className="admin-panel admin-wide"><header className="cms-section-heading"><div><h2>Add a gift</h2><p>Three collections. Photographs upload directly to your catalogue.</p></div><a className="cms-button" href="/admin/gifts/preview" target="_blank" rel="noopener noreferrer">Preview catalogue</a></header>
      <form onSubmit={async event=> {
        event.preventDefault();const form=event.currentTarget;const data=new FormData(form);const file=data.get('photo');
        if (file instanceof File && file.size && (file.size > 5*1024*1024 || !['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))) {setError('Choose JPEG, PNG, WebP, or AVIF up to 5 MB.');return;}
        const values = Object.fromEntries(data);delete values.photo;setBusy(true);setError('');
        const result = await action('create_gift',{...values,shippingRequired:data.get('shippingRequired') === 'on',published:data.get('published') === 'on'});
        if (!result?.giftId) {setBusy(false);return;}
        form.reset();
        try {if (file instanceof File && file.size) await upload(result.giftId,file);await reload();notify('Gift saved. Preview it before making it visible to guests.');}
        catch(error) {setError(`Gift saved. ${error instanceof Error ? error.message : 'Photo upload failed.'} Retry from its card below.`);}
        finally {setBusy(false);}
      }}><GiftFields /><label className="cms-full">Photograph<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /><span className="cms-muted">JPEG, PNG, WebP, or AVIF · up to 5 MB. Upload takes priority over Image URL.</span></label><button disabled={busy}>{busy ? 'Saving…' : 'Add gift'}</button></form>
    </section>
    <section className="admin-panel admin-wide"><header className="cms-section-heading"><div><h2>Catalogue order</h2><p>{gifts.length} gifts. Move up or down to change the order shown to guests.</p></div></header>{error && <p role="alert">{error}</p>}
      {!gifts.length && <p>Your catalogue is empty. Add the first gift above, then preview it.</p>}
      <div className="cms-gift-list">{gifts.map((gift,index)=> <article className="cms-gift" key={text(gift.id)}>
        <div className="cms-gift-overview">{gift.image_url ? <img className="cms-gift-image" src={text(gift.image_url)} alt={text(gift.title)} loading="lazy" /> : <div className="cms-gift-image is-empty">Add a photograph</div>}<div><h3>{text(gift.title)}</h3><p>{GIFT_COLLECTIONS.find(category=>category.key === gift.recipient_category)?.label} {gift.price_label ? `· ${text(gift.price_label)}` : ''}</p><span className={`cms-badge is-${text(gift.status)}`}>{text(gift.status)}</span> <span className="cms-badge">{gift.published ? 'Visible to guests' : 'Draft'}</span>{Boolean(gift.reserved_by_name) && <p>Booked by <strong>{text(gift.reserved_by_name)}</strong></p>}</div><div className="cms-order-controls"><button type="button" disabled={busy || index === 0} onClick={()=>void move(index,-1)} aria-label={`Move ${text(gift.title)} up`}>↑ Up</button><button type="button" disabled={busy || index === gifts.length-1} onClick={()=>void move(index,1)} aria-label={`Move ${text(gift.title)} down`}>↓ Down</button></div></div>
        <label className="cms-upload">{gift.image_url ? 'Replace photograph' : 'Upload photograph'}<input type="file" aria-label={`Upload photo for ${text(gift.title)}`} accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={async event=> {const file=event.target.files?.[0];event.target.value='';if (!file) return;setBusy(true);setError('');try{await upload(text(gift.id),file);await reload();notify('Gift photograph uploaded.');}catch(error){setError(error instanceof Error ? error.message : 'Upload failed.');}finally{setBusy(false);}}} /></label>
        <details><summary>Edit gift details</summary><form onSubmit={async event=> {event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);try{await action('update_gift',{...Object.fromEntries(data),id:gift.id,shippingRequired:data.get('shippingRequired') === 'on',published:data.get('published') === 'on'});}finally{setBusy(false);}}}><GiftFields key={text(gift.image_url)} gift={gift} /><button disabled={busy}>Save gift</button></form>{gift.status === 'reserved' && <button type="button" disabled={busy} onClick={async()=> {setBusy(true);try{await action('admin_release_gift',{id:gift.id});}finally{setBusy(false);}}}>Release reservation</button>}</details>
      </article>)}</div>
    </section>
  </>;
}
