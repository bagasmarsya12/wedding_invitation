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
  const photo=(slot:string)=>media['media.'+slot]?`/api/admin/editor/media/${slot}?key=${encodeURIComponent(media['media.'+slot])}`:null;
  return <PreviewInvitation section={id} language={query.lang==='en'?'en':'id'} title={state.label} draft={Boolean(state.document.draft)||Boolean(query.revision)} content={content} website={{...base.config,...snapshot.config}} blocks={blocks} arrival={snapshot.arrival??base.arrival} homepage={{...homepage,photos:{bagas:photo('bagas'),iga:photo('iga'),gallery:blocks.photos.map(p=>photo(p.slot))},arrivalPhotos:{map:photo('arrival-map'),parking:photo('arrival-parking'),entrance:photo('arrival-entrance')}}}/>;
}
