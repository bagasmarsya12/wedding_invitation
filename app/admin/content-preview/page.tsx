import type { Metadata } from 'next';
import { redirect,notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/server';
import { editorState,editorialBase,readEditorialRevision } from '@/lib/cms-editorial-server';
import { sectionDefinition } from '@/lib/cms-editorial';
import { resolveLandingContent } from '@/lib/landing-content';
import { replacedContentAliases } from '@/lib/content-aliases';
import { loadHomepageContent } from '@/lib/homepage-content';
import { PreviewInvitation } from './preview-invitation';
import './preview.css';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Pratinjau privat · Iga & Bagas',robots:{index:false,follow:false,nocache:true}};
export default async function ContentPreview({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  if(!await requireAdmin())redirect('/admin');
  const query=await searchParams,id=query.section??'hero';if(!sectionDefinition(id))notFound();
  const [state,base,homepage]=await Promise.all([editorState(id),editorialBase(),loadHomepageContent()]);
  let snapshot=state.document.draft??state.live;
  if(query.revision){if(!state.document.history.some(r=>r.id===query.revision))notFound();const revision=await readEditorialRevision(id,query.revision);if(!revision)notFound();snapshot=revision;}
  const stored=Object.fromEntries(Object.entries(base.stored).filter(([k])=>k.startsWith('content.')).map(([k,v])=>[k.slice(8),v]));
  for(const key of replacedContentAliases(Object.keys(snapshot.copy)))delete stored[key];
  for(const [key,value]of Object.entries(snapshot.copy)){if(value)stored[key]=value;else delete stored[key];}
  const content=resolveLandingContent(stored),blocks={...base.blocks,...snapshot.blocks},media={...base.stored};
  for(const [slot,key]of Object.entries(snapshot.media)){if(key)media['media.'+slot]=key;else delete media['media.'+slot];}
  const photo=(slot:string)=>media['media.'+slot]?`/api/admin/editor/media/${slot}?key=${encodeURIComponent(media['media.'+slot])}${/\.gif$/i.test(media['media.'+slot])?'&motion=1':''}`:null;
  if (id === 'stakk') {
    const prefix = query.lang === 'en' ? '' : 'id.';
    const text = (key: string) => content.values[prefix + 'stakk.' + key];
    return <main style={{ minHeight: '100vh', background: '#f3eee5', color: '#21382c', padding: '32px 24px', textAlign: 'center' }}>
      <p>Pratinjau privat · Stakk · {state.document.draft || query.revision ? 'Draf' : 'Konten live'}</p>
      <img src="/assets/stakk-preview.jpg" alt="Contoh tumpukan foto Stakk" style={{ width: 'min(260px, 70vw)', margin: '24px auto', display: 'block' }} />
      <p>{text('eyebrow')}</p><h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 40, maxWidth: 440, margin: '20px auto' }}>{text('title')}</h1>
      <p style={{ maxWidth: 440, margin: '20px auto', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{text('description')}</p>
      <button type="button" disabled style={{ padding: '16px 36px', background: '#21382c', color: '#f3eee5', border: 0 }}>{text('cta')}</button>
      <p>{text('hint')}</p><small>Pratinjau wording. Kamera tidak diaktifkan di CMS.</small>
    </main>;
  }
  return <PreviewInvitation weddingDay={query.phase==='wedding-day'} section={id} language={query.lang==='en'?'en':'id'} title={state.label} draft={Boolean(state.document.draft)||Boolean(query.revision)} content={content} website={{...base.config,...snapshot.config}} blocks={blocks} arrival={snapshot.arrival??base.arrival} homepage={{...homepage,photos:{bagas:photo('bagas'),iga:photo('iga'),gallery:blocks.photos.map(p=>photo(p.slot))},arrivalPhotos:{map:photo('arrival-map'),parking:photo('arrival-parking'),entrance:photo('arrival-entrance')}}}/>;
}
