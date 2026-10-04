import { CONTENT_DEFAULTS, type ContentMap } from './content-defaults';
import { indonesian } from './invitation-copy';

export type Localized = { en: string; id: string };
export type WebsiteConfig = {
  firstName: string; secondName: string; weddingDate: string; akadTime: string; receptionTime: string;
  venueName: string; venueCity: string; venueAddress: string; mapsUrl: string; longitude: number; latitude: number;
  metaTitle: string; metaDescription: string; ogImage: string; profilesEnabled: boolean; trackingEnabled: boolean;
};
export type TextBlock = { id: string; title: Localized; body: Localized };
export type PhotoBlock = { id: string; slot: string; caption: Localized };
export type LinkBlock = TextBlock & { href: string };
export type WebsiteBlocks = { story: TextBlock[]; faq: TextBlock[]; photos: PhotoBlock[]; links: LinkBlock[] };
export const WEBSITE_DEFAULTS: WebsiteConfig = {
  firstName: 'Bagas', secondName: 'Iga', weddingDate: '2026-11-01', akadTime: '14:00', receptionTime: '18:00',
  venueName: 'Pandiga', venueCity: 'Cimahi', venueAddress: 'Jl. Sirnarasa No.11, Cibabat, Kec. Cimahi Utara, Kota Cimahi, Jawa Barat 40513',
  mapsUrl: 'https://maps.app.goo.gl/JFL3wrzj7qsBXbz56', longitude: 107.5554364, latitude: -6.8755807,
  metaTitle: 'Bagas × Iga — 1 November 2026', metaDescription: 'Undangan pernikahan Bagas Marsya Pratama Nugraha dan Iga Noviyanti Rohman di Pandiga, Cimahi.',
  ogImage: '/assets/og-image.jpg', profilesEnabled: true, trackingEnabled: true,
};
export function localize(value: string): Localized { return { en: value, id: indonesian[value.trim()] ?? value }; }
export function defaultWebsiteBlocks(values: ContentMap = CONTENT_DEFAULTS): WebsiteBlocks {
  const copy = (key: string) => ({ en: values[key] ?? CONTENT_DEFAULTS[key] ?? '', id: values[`id.${key}`] ?? indonesian[(values[key] ?? '').trim()] ?? values[key] ?? '' });
  return {
    story: [1,2,3].map(i => ({ id: `story-${i}`, title: copy(`story.title${i}`), body: copy(`story.body${i}`) })),
    faq: ['dress','alamat','parkir','anak','kontak'].map(key => ({ id: key, title: copy(`useful.${key} t`), body: copy(`useful.${key} d`) })),
    photos: Array.from({length:6},(_,i)=>({id:`photo-${i+1}`,slot:`gallery-${String(i+1).padStart(2,'0')}`,caption:copy(`gallery.caption${i+1}`)})),
    links: [{id:'archive',title:localize('The Archive'),body:localize('Things we kept.'),href:'/archive'}],
  };
}
export function weddingDisplay(config: WebsiteConfig, language: 'en'|'id') {
  const date = new Date(`${config.weddingDate}T12:00:00+07:00`);
  const locale = language === 'id' ? 'id-ID' : 'en-GB';
  return {
    names: `${config.firstName} × ${config.secondName}`,
    date: new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(date),
    day: new Intl.DateTimeFormat(locale,{weekday:'long',timeZone:'Asia/Jakarta'}).format(date),
    stamp: config.weddingDate.split('-').reverse().join(' · '), venue: `${config.venueName}, ${config.venueCity}`,
  };
}

export function validateWebsiteConfig(input: unknown): WebsiteConfig | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const c = input as Record<string,unknown>;
  const limits: Record<string,number> = {firstName:50,secondName:50,weddingDate:10,akadTime:5,receptionTime:5,venueName:120,venueCity:100,venueAddress:500,mapsUrl:500,metaTitle:180,metaDescription:500,ogImage:500};
  for (const [key,max] of Object.entries(limits)) if (typeof c[key] !== 'string' || !c[key].trim() || (c[key] as string).length>max) return null;
  const date = c.weddingDate as string;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date) return null;
  if (![c.akadTime,c.receptionTime].every(t=>typeof t==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t))) return null;
  if (typeof c.longitude!=='number' || !Number.isFinite(c.longitude) || Math.abs(c.longitude)>180 || typeof c.latitude!=='number' || !Number.isFinite(c.latitude) || Math.abs(c.latitude)>90) return null;
  if (typeof c.profilesEnabled!=='boolean' || typeof c.trackingEnabled!=='boolean') return null;
  const safeUrl=(s:string,relative=false)=>{ if(relative && /^\/(?!\/)[A-Za-z0-9_./?-]+$/.test(s) && !s.includes('..')) return true; try{return new URL(s).protocol==='https:';}catch{return false;} };
  if (!safeUrl(c.mapsUrl as string) || !safeUrl(c.ogImage as string,true)) return null;
  return Object.fromEntries([...Object.keys(limits).map(key=>[key,(c[key] as string).trim()]),...['longitude','latitude','profilesEnabled','trackingEnabled'].map(key=>[key,c[key]])]) as WebsiteConfig;
}
export function validateWebsiteBlocks(input: unknown): WebsiteBlocks | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const c=input as Record<string,unknown>;
  const localized=(v:unknown,max:number)=>Boolean(v && typeof v==='object' && !Array.isArray(v) && ['en','id'].every(k=>typeof (v as Record<string,unknown>)[k]==='string' && ((v as Record<string,string>)[k]).length<=max));
  const result: Record<string,unknown[]>={};
  for (const kind of ['story','faq','photos','links']) {
    if (!Array.isArray(c[kind]) || (c[kind] as unknown[]).length>24) return null;
    const seen=new Set<string>(); result[kind]=[];
    for(const raw of c[kind] as unknown[]) {
      if (!raw || typeof raw!=='object' || Array.isArray(raw)) return null;
      const row=raw as Record<string,unknown>;
      if(typeof row.id!=='string' || !/^[a-z0-9-]{1,60}$/.test(row.id) || seen.has(row.id)) return null;
      seen.add(row.id);
      if(kind==='photos') {
        if(typeof row.slot!=='string' || !/^[a-z0-9-]{1,60}$/.test(row.slot) || !localized(row.caption,500)) return null;
        result[kind].push({id:row.id,slot:row.slot,caption:row.caption});
      } else {
        if(!localized(row.title,200) || !localized(row.body,2000)) return null;
        if(kind==='links') {
          if(typeof row.href!=='string' || row.href.length>500) return null;
          let safe=/^\/(?!\/)[A-Za-z0-9_./?#=-]*$/.test(row.href) && !row.href.includes('..');
          try{safe ||= new URL(row.href).protocol==='https:';}catch{/* relative URLs handled above */}
          if(!safe) return null;
        }
        result[kind].push({id:row.id,title:row.title,body:row.body,...(kind==='links'?{href:row.href}:{})});
      }
    }
  }
  const slots=(result.photos as PhotoBlock[]).map(p=>p.slot);
  return new Set(slots).size===slots.length ? result as WebsiteBlocks : null;
}
