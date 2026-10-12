'use client';
import { useState } from 'react';
import { GIFT_COLLECTIONS } from '@/lib/gift-collections';
import { T } from '../../../language';

type Gift = {id:string;title:string;description:string|null;recipient_category:string;price_label:string|null;status:string;published:number};
export function GiftPreview({gifts}: {gifts:Gift[]}) {
  const [collection,setCollection] = useState('all');
  const visible = collection === 'all' ? gifts : gifts.filter(gift=>gift.recipient_category === collection);
  return <section className="cms-preview-body">
    <nav className="cms-preview-filters" aria-label="Preview collections"><button type="button" aria-pressed={collection === 'all'} onClick={()=>setCollection('all')}>All gifts</button>{GIFT_COLLECTIONS.map(item=><button type="button" key={item.key} aria-pressed={collection === item.key} onClick={()=>setCollection(item.key)}>{item.label}</button>)}</nav>
    <p role="status">{visible.length} gift(s)</p>
    <div className="cms-preview-grid is-text-only">{visible.map(gift=><article key={gift.id}>
      <p><T>{GIFT_COLLECTIONS.find(item=>item.key === gift.recipient_category)?.label ?? 'For Iga & Bagas'}</T></p>
      <h2>{gift.title}</h2><p>{gift.description}</p>{gift.price_label && <p>{gift.price_label}</p>}
      <div><span className="cms-badge">{gift.status}</span> <span className="cms-badge">{gift.published ? 'Visible to guests' : 'Draft'}</span></div>
      <button className="paper-button" type="button" disabled><T>Book this gift</T></button>
    </article>)}</div>
    {!visible.length && <p>Add an item in CMS → Tanda kasih → Hadiah barang to fill this collection.</p>}
  </section>;
}
