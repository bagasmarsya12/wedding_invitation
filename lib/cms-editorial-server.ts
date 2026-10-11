import { db, sha256 } from './server';
import { CONTENT_DEFAULTS } from './content-defaults';
import { resolveContentAliases,replacedContentAliases } from './content-aliases';
import { defaultWebsiteBlocks,WEBSITE_DEFAULTS,validateWebsiteBlocks,validateWebsiteConfig } from './website-content';
import { ARRIVAL_DEFAULTS,validateArrivalContent } from './arrival-content';
import { EDITOR_HISTORY_LIMIT,emptyEditorialDocument,sectionDefinition,sectionCopyKeys,sectionConfigKeys,sectionBlockKeys,sectionMediaSlots,validateSectionSnapshot,type SectionSnapshot,type EditorialDocument,type Revision } from './cms-editorial';

const PREFIX='cms.editor.';
const LOCK=PREFIX+'lock';
const documentKey=(id:string)=>PREFIX+'section.'+id;
const revisionKey=(id:string,version:string)=>PREFIX+'revision.'+id+'.'+version;
export class EditorialConflict extends Error{}
export class EditorialInputError extends Error{}
export async function editorialBase(){
  const rows=await db().prepare("SELECT key,value FROM settings WHERE key LIKE 'content.%' OR key LIKE 'media.%' OR key IN ('cms.website','cms.blocks','cms.arrival',?)").bind(LOCK).all<{key:string;value:string}>();
  const stored=Object.fromEntries(rows.results.map(r=>[r.key,r.value]));
  const copy:Record<string,string>={...CONTENT_DEFAULTS},overrides:Record<string,string>={};
  for(const [key,value]of Object.entries(stored))if(key.startsWith('content.')&&key.slice(8) in copy){copy[key.slice(8)]=value;overrides[key.slice(8)]=value;}
  resolveContentAliases(copy,overrides);
  const parse=(key:string)=>{try{return JSON.parse(stored[key]??'null');}catch{return null;}};
  return {stored,copy,config:validateWebsiteConfig(parse('cms.website'))??{...WEBSITE_DEFAULTS},blocks:validateWebsiteBlocks(parse('cms.blocks'))??defaultWebsiteBlocks(copy),arrival:validateArrivalContent(parse('cms.arrival'))??ARRIVAL_DEFAULTS,lock:stored[LOCK]??null};
}
export type EditorialBase=Awaited<ReturnType<typeof editorialBase>>;
export function liveSection(id:string,base:EditorialBase):SectionSnapshot {
  const blocks=Object.fromEntries(sectionBlockKeys(id).map(k=>[k,base.blocks[k]]));
  return {copy:Object.fromEntries(sectionCopyKeys(id).map(k=>[k,base.copy[k]??''])),config:Object.fromEntries(sectionConfigKeys(id).map(k=>[k,base.config[k]])),blocks,...(id==='details'?{arrival:base.arrival}:{}),media:Object.fromEntries(sectionMediaSlots(id,blocks).map(slot=>[slot,base.stored['media.'+slot]??null]))};
}
export async function editorialDocument(id:string):Promise<EditorialDocument>{
  const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(documentKey(id)).first<{value:string}>();
  if(!row)return emptyEditorialDocument();
  const value=JSON.parse(row.value) as EditorialDocument;
  if(typeof value.version!=='string'||!Array.isArray(value.history))throw new Error('Editorial document unavailable');
  return value;
}
export async function editorState(id:string){
  if(!sectionDefinition(id))throw new Error('Unknown section');
  const [base,document]=await Promise.all([editorialBase(),editorialDocument(id)]);
  const live=liveSection(id,base);
  return {section:id,label:sectionDefinition(id)!.label,live,liveHash:await sha256(JSON.stringify(live)),document};
}
export async function readEditorialRevision(id:string,version:string){
  if(!/^[a-z0-9-]{1,80}$/.test(version))return null;
  const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(revisionKey(id,version)).first<{value:string}>();
  return row?JSON.parse(row.value) as SectionSnapshot:null;
}
// The first compare-and-swap gates every following statement in the same D1 transaction.
// A competing save produces no partial changes, including when publishing several settings.
async function commit(base:EditorialBase,changes:Map<string,string|null>){
  const next=crypto.randomUUID(),database=db();
  const gate="EXISTS (SELECT 1 FROM settings WHERE key=? AND value=?)";
  const first=database.prepare('INSERT INTO settings(key,value,updated_at) SELECT ?,?,CURRENT_TIMESTAMP WHERE ? IS NULL OR EXISTS(SELECT 1 FROM settings WHERE key=? AND value=?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE settings.value=?').bind(LOCK,next,base.lock,LOCK,base.lock,base.lock);
  const statements=[first,...[...changes].map(([key,value])=>value===null?database.prepare(`DELETE FROM settings WHERE key=? AND ${gate}`).bind(key,LOCK,next):database.prepare(`INSERT INTO settings(key,value,updated_at) SELECT ?,?,CURRENT_TIMESTAMP WHERE ${gate} ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).bind(key,value,LOCK,next))];
  const results=await database.batch(statements);
  if(!results[0].meta.changes)throw new EditorialConflict('Konten berubah di sesi lain. Muat ulang sebelum menyimpan.');
}
function appendRevision(id:string,doc:EditorialDocument,snapshot:SectionSnapshot,kind:Revision['kind'],author:string,changes:Map<string,string|null>,at:string){
  const revision={id:crypto.randomUUID(),kind,author,at};
  doc.history=[revision,...doc.history];
  changes.set(revisionKey(id,revision.id),JSON.stringify(snapshot));
  while(doc.history.length>EDITOR_HISTORY_LIMIT){const index=doc.history.findLastIndex(r=>r.id!==doc.publishedId);const [old]=doc.history.splice(index,1);changes.set(revisionKey(id,old.id),null);}
  return revision;
}
function ensureBaseline(id:string,doc:EditorialDocument,live:SectionSnapshot,author:string,changes:Map<string,string|null>,at:string){if(!doc.history.length){const baseline=appendRevision(id,doc,live,'baseline',author,changes,at);doc.publishedId=baseline.id;}}
export function publicationSettings(snapshot:SectionSnapshot,base:EditorialBase){
  const changes=new Map<string,string|null>();
  for(const alias of replacedContentAliases(Object.keys(snapshot.copy)))changes.set('content.'+alias,null);
  for(const [key,value]of Object.entries(snapshot.copy))changes.set('content.'+key,value||null);
  if(Object.keys(snapshot.config).length)changes.set('cms.website',JSON.stringify({...base.config,...snapshot.config}));
  if(Object.keys(snapshot.blocks).length)changes.set('cms.blocks',JSON.stringify({...base.blocks,...snapshot.blocks}));
  if(snapshot.arrival)changes.set('cms.arrival',JSON.stringify(snapshot.arrival));
  for(const [slot,key]of Object.entries(snapshot.media))changes.set('media.'+slot,key);
  return changes;
}
export async function mutateEditorial(id:string,op:string,expectedVersion:unknown,input:unknown,author:string,revisionId?:unknown){
  const [base,doc]=await Promise.all([editorialBase(),editorialDocument(id)]);
  if(expectedVersion!==doc.version)throw new EditorialConflict('Draf berubah di sesi lain. Muat ulang untuk melihat versi terbaru.');
  const live=liveSection(id,base),liveHash=await sha256(JSON.stringify(live)),changes=new Map<string,string|null>(),at=new Date().toISOString();
  if(op==='save'||op==='restore'){
    const raw=op==='restore'&&typeof revisionId==='string'&&doc.history.some(r=>r.id===revisionId)?await readEditorialRevision(id,revisionId):input;
    if(op==='restore'&&!raw)throw new EditorialInputError('Versi ini sudah tidak tersedia.');
    const snapshot=validateSectionSnapshot(id,raw,base);if(!snapshot)throw new EditorialInputError('Periksa field, panjang teks, tanggal, dan tautan di section ini.');
    ensureBaseline(id,doc,live,author,changes,at);
    if(JSON.stringify(snapshot)!==JSON.stringify(doc.draft))appendRevision(id,doc,snapshot,op==='restore'?'restored':'draft',author,changes,at);
    doc.draft=snapshot;doc.draftAt=at;doc.draftAuthor=author;doc.draftBaseHash=liveHash;
  }else if(op==='publish'){
    if(!doc.draft)throw new EditorialInputError('Simpan draf terlebih dahulu.');
    if(doc.draftBaseHash!==liveHash)throw new EditorialConflict('Konten live berubah setelah draf dibuat. Muat ulang dan periksa perbedaannya sebelum publikasi.');
    const snapshot=validateSectionSnapshot(id,doc.draft,base);if(!snapshot)throw new EditorialInputError('Draf tidak valid.');
    ensureBaseline(id,doc,live,author,changes,at);
    const revision=appendRevision(id,doc,snapshot,'published',author,changes,at);doc.publishedId=revision.id;
    for(const [key,value]of publicationSettings(snapshot,base))changes.set(key,value);
    doc.draft=null;doc.draftAt=null;doc.draftAuthor=null;doc.draftBaseHash=null;
  }else if(op==='discard'){doc.draft=null;doc.draftAt=null;doc.draftAuthor=null;doc.draftBaseHash=null;}
  else throw new EditorialInputError('Aksi konten tidak tersedia.');
  doc.version=crypto.randomUUID();changes.set(documentKey(id),JSON.stringify(doc));await commit(base,changes);
  return editorState(id);
}

/** Keep older authoring endpoints compatible while recording their published changes. */
export async function publishLegacySettings(updates:Map<string,string|null>,author:string){
  const base=await editorialBase(),next={...base,stored:{...base.stored},copy:{...base.copy}};
  for(const [key,value]of updates){if(value===null)delete next.stored[key];else next.stored[key]=value;}
  next.copy={...CONTENT_DEFAULTS};const storedCopy:Record<string,string>={};
  for(const [key,value]of Object.entries(next.stored))if(key.startsWith('content.')&&key.slice(8) in next.copy){next.copy[key.slice(8)]=value;storedCopy[key.slice(8)]=value;}
  resolveContentAliases(next.copy,storedCopy);
  next.config=next.stored['cms.website']?validateWebsiteConfig(JSON.parse(next.stored['cms.website']))??base.config:base.config;
  next.blocks=next.stored['cms.blocks']?validateWebsiteBlocks(JSON.parse(next.stored['cms.blocks']))??base.blocks:defaultWebsiteBlocks(next.copy);
  next.arrival=next.stored['cms.arrival']?validateArrivalContent(JSON.parse(next.stored['cms.arrival']))??base.arrival:base.arrival;
  const changes=new Map(updates),at=new Date().toISOString();
  for(const section of (await import('./cms-editorial')).editorialSections){
    const live=liveSection(section.id,base),snapshot=liveSection(section.id,next);
    if(JSON.stringify(live)===JSON.stringify(snapshot))continue;
    const doc=await editorialDocument(section.id);ensureBaseline(section.id,doc,live,author,changes,at);
    const revision=appendRevision(section.id,doc,snapshot,'published',author,changes,at);doc.publishedId=revision.id;doc.version=crypto.randomUUID();
    changes.set(documentKey(section.id),JSON.stringify(doc));
  }
  await commit(base,changes);
}
