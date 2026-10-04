'use client';
import {useState} from 'react';
import {GIFT_COLLECTIONS} from '@/lib/gift-collections';
type Gift={id:string;title:string;description:string|null;recipient_category:string;image_url:string|null;price_label:string|null;status:string;published:number};
export function GiftPreview({gifts}:{gifts:Gift[]}) {
  const [collection,setCollection] = useState('all');
  const visible=gifts.filter(gift=>collection === 'all' || gift.recipient_category === collection);
  return <section className="cms-preview-body"><nav className="cms-preview-filters" aria-label="Preview collections"><button type="button" aria-pressed={collection === 'all'} onClick={()=>setCollection('all')}>All gifts</button>{GIFT_COLLECTIONS.map(item=><button type="button" key={item.key} aria-pressed={collection === item.key} onClick={()=>setCollection(item.key)}>{item.label}</button>)}</nav><p role="status">{visible.length} gift(s)</p><div className="cms-preview-grid">{visible.map(gift=><article key={gift.id}>{gift.image_url ? <img src={gift.image_url} alt={gift.title} loading="lazy" /> : <div className="cms-preview-placeholder">Photograph to come.</div>}<div><p>{GIFT_COLLECTIONS.find(item=>item.key === gift.recipient_category)?.label}</p><h2>{gift.title}</h2><p>{gift.description}</p><p>{gift.price_label}</p><span className="cms-badge">{gift.status}</span> <span className="cms-badge">{gift.published ? 'Visible to guests' : 'Draft'}</span></div></article>)}</div>{!visible.length && <p>Add an item in CMS → Hadiah to fill this collection.</p>}</section>;
}
