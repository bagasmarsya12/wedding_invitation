import { isRichTextField, richTextPlain, validRichText, validPlainText } from './rich-text';
import { isCmsPhotoKey } from './cms-photo-upload';
import { upgradeProfileLabelCopy } from './profile-labels';
import { contentEditorSections } from './content-editor-sections';
import { CONTENT_DEFAULTS } from './content-defaults';
import { validateWebsiteBlocks, validateWebsiteConfig, type WebsiteBlocks, type WebsiteConfig } from './website-content';
import { validateArrivalContent, type ArrivalContent } from './arrival-content';
import { DAY_OF_KEYS } from './day-of-content';
import { GIFT_BOOKING_KEYS } from './gift-booking';

export type SectionSnapshot = { copy:Record<string,string>; config:Partial<WebsiteConfig>; blocks:Partial<WebsiteBlocks>; arrival?:ArrivalContent; media:Record<string,string|null> };
export type Revision = { id:string; kind:'baseline'|'draft'|'published'|'restored'; at:string; author:string };
export type EditorialDocument = { version:string; draft:SectionSnapshot|null; draftAt:string|null; draftAuthor:string|null; draftBaseHash:string|null; publishedId:string|null; history:Revision[] };
export type EditorialResponse = { section:string; label:string; live:SectionSnapshot; liveHash:string; document:EditorialDocument; revision?:SectionSnapshot; error?:string };
export const EDITOR_HISTORY_LIMIT=30;
export const editorialSections=contentEditorSections();
export const sectionDefinition=(id:string)=>editorialSections.find(s=>s.id===id);
const eventKeys=['firstName','secondName','weddingDate','akadTime','receptionTime','venueName','venueCity','venueAddress','mapsUrl','longitude','latitude','profilesEnabled','trackingEnabled'] as const;
const seoKeys=['metaTitle','metaDescription','ogImage'] as const;
export function sectionConfigKeys(id:string):readonly (keyof WebsiteConfig)[] { return id==='details'?eventKeys:id==='seo'?seoKeys:[]; }
export function sectionBlockKeys(id:string):readonly (keyof WebsiteBlocks)[] { return id==='details'?['faq']:id==='story'?['story']:id==='archive'?['photos']:id==='footer'?['links']:[]; }
export function sectionCopyKeys(id:string){return sectionDefinition(id)?.fields.flatMap(f=>[f.key,`id.${f.key}`])??[];}
export function sectionMediaSlots(id:string,blocks:Partial<WebsiteBlocks>):string[] {return id==='profil'?['bagas','iga']:id==='details'?['arrival-map','arrival-parking','arrival-entrance']:id==='archive'?(blocks.photos??[]).map(p=>p.slot):[];}
function record(input:unknown):input is Record<string,unknown>{return Boolean(input&&typeof input==='object'&&!Array.isArray(input));}
export function validateSectionSnapshot(id:string,input:unknown,base:{config:WebsiteConfig;blocks:WebsiteBlocks}):SectionSnapshot|null {
  if(!sectionDefinition(id)||!record(input)||Object.keys(input).some(k=>!['copy','config','blocks','arrival','media'].includes(k))||!record(input.copy)||!record(input.config)||!record(input.blocks)||!record(input.media))return null;
  const copyKeys=sectionCopyKeys(id),configKeys=sectionConfigKeys(id),blockKeys=sectionBlockKeys(id);
  const copy={...(id==='profil'?upgradeProfileLabelCopy(input.copy):input.copy)},configInput=input.config,blocksInput=input.blocks;
  // Restoring a pre-feature arrival draft must preserve its authored content.
  if(id==='details')for(const field of DAY_OF_KEYS)for(const key of [field,`id.${field}`])if(!(key in copy))copy[key]='';
  if(id==='gift')for(const field of GIFT_BOOKING_KEYS)for(const key of [field,`id.${field}`])if(!(key in copy))copy[key]='';
  // Backfill only this newly introduced control when restoring an older keepsake revision.
  if(id==='keepsake')for(const key of ['keepsake.openHint','id.keepsake.openHint'])if(!(key in copy))copy[key]='';
  // Older footer drafts and revisions keep their content when Stakk controls are added.
  if(id==='footer')for(const field of ['stakkTitle','stakkDescription','stakkCta','stakkHint'])for(const key of [`footer.${field}`,`id.footer.${field}`])if(!(key in copy))copy[key]='';
  if(Object.keys(copy).length!==copyKeys.length||copyKeys.some(k=>typeof copy[k]!=='string')||Object.keys(copy).some(k=>!copyKeys.includes(k)))return null;
  for(const field of sectionDefinition(id)!.fields)for(const key of [field.key,`id.${field.key}`])if(!(isRichTextField(field.key)?validRichText(copy[key],field.limit):validPlainText(copy[key],field.limit)))return null;
  if(Object.keys(configInput).some(k=>!configKeys.includes(k as keyof WebsiteConfig))||configKeys.some(k=>!(k in configInput)))return null;
  if(Object.keys(blocksInput).some(k=>!blockKeys.includes(k as keyof WebsiteBlocks))||blockKeys.some(k=>!(k in blocksInput)))return null;
  const config=validateWebsiteConfig({...base.config,...input.config}),blocks=validateWebsiteBlocks({...base.blocks,...input.blocks});
  if(!config||!blocks)return null;
  const arrival=id==='details'?validateArrivalContent(input.arrival):undefined;
  if(id==='details'&&!arrival||id!=='details'&&input.arrival!==undefined)return null;
  const media:Record<string,string|null>={},slots=new Set(sectionMediaSlots(id,blocks));
  for(const [slot,value]of Object.entries(input.media)) {
    if(!slots.has(slot)||value!==null&&(typeof value!=='string'||!isCmsPhotoKey(slot,value)))return null;
    media[slot]=value as string|null;
  }
  for(const slot of slots)if(!(slot in media))media[slot]=null;
  return {copy:Object.fromEntries(copyKeys.map(k=>[k,(copy as Record<string,string>)[k].trim()])),config:Object.fromEntries(configKeys.map(k=>[k,config[k]])),blocks:Object.fromEntries(blockKeys.map(k=>[k,blocks[k]])),...(arrival?{arrival}:{}),media};
}
export function snapshotChanges(a:SectionSnapshot,b:SectionSnapshot){return [
  ...Object.keys(b.copy).filter(k=>a.copy[k]!==b.copy[k]).map(k=>({key:k,label:`${k.startsWith('id.')?'Indonesia':'English'} · ${sectionDefinitionForKey(k)}`,before:a.copy[k]??'',after:b.copy[k]})),
  ...(['config','blocks','arrival','media'] as const).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])).map(k=>({key:k,label:{config:'Jadwal / identitas / share',blocks:'Susunan & isi',arrival:'Panduan kedatangan',media:'Foto'}[k],before:JSON.stringify(a[k]??{},(_key,value)=>typeof value==='string'?richTextPlain(value):value),after:JSON.stringify(b[k]??{},(_key,value)=>typeof value==='string'?richTextPlain(value):value)})),
];}
function sectionDefinitionForKey(key:string){const base=key.replace(/^id\./,'');return editorialSections.flatMap(s=>s.fields).find(f=>f.key===base)?.label??base;}
export const emptyEditorialDocument=():EditorialDocument=>({version:'initial',draft:null,draftAt:null,draftAuthor:null,draftBaseHash:null,publishedId:null,history:[]});
export function resolvedSnapshotCopy(snapshot:SectionSnapshot){return Object.fromEntries(Object.entries(snapshot.copy).map(([k,v])=>[k,v||CONTENT_DEFAULTS[k]||'']));}
