import { CONTENT_SECTIONS, CONTENT_DEFAULTS } from './content-defaults';
import { ACTIVE_CONTENT_KEYS } from './content-usage';
import { COPY_SECTION_MAP } from './content-editor-manifest';

export type EditorField = { key:string; label:string; value:string; limit:number; kind:'text'|'cta'|'status' };
export type EditorSection = { id:string; label:string; description:string; fields:EditorField[]; tools:string[] };
const definitions = [
  ['hero','Amplop & pembuka','Sapaan, pembukaan, pengantar dan hitung mundur.',[]],
  ['details','Hari, kedatangan & FAQ','Jadwal, lokasi, panduan datang, kartu masuk dan pertanyaan tamu.',['event','arrival','faq']],
  ['profil','Tentang kami','Profil, keluarga, kutipan dan foto mempelai.',['portraits']],
  ['story','Cerita kami','Judul, isi cerita dan urutan bab.',['story']],
  ['archive','Arsip & foto','Galeri, caption, arsip, komentar foto dan cara membukanya.',['photos','entries','comments']],
  ['rsvp','Kehadiran & ucapan','Form RSVP, kartu ucapan, mading dan seluruh statusnya.',[]],
  ['gift','Tanda kasih','Pengantar hadiah, tombol pilihan, rekening dan tautan.',['gifts']],
  ['keepsake','Kartu kenangan','Pesan, penutup, hashtag serta semua tombol gambar dan video.',[]],
  ['jukebox','Jukebox & musik','Playlist, audio, catatan personal dan seluruh tombol jukebox.',['jukebox']],
  ['footer','Penutup','Ucapan akhir dan tautan setelah undangan.',['links']],
  ['navigation','Menu & interface','Menu, aksesibilitas dan label umum.',[]],
  ['seo','Judul & share','Judul website, deskripsi dan gambar saat link dibagikan.',['event']],
  ['interface','Teks tambahan','Label cadangan untuk halaman dan kondisi lain.',[]],
] as const;
const arrivalKeys=new Set(['arrivalNav','guide','dress','access','transport','help','contact','contactPending','route','directions','arrival','faq','practical']);
export function contentEditorSections(): EditorSection[] {
  const result:EditorSection[]=definitions.map(([id,label,description,tools])=>({id,label,description,tools:[...tools],fields:[]}));
  const active=new Set<string>(ACTIVE_CONTENT_KEYS);
  const semanticLiterals=new Set(CONTENT_SECTIONS.filter(section=>section.id!=='copy').flatMap(section=>section.fields.filter(field=>active.has(`${section.id}.${field.key}`)).map(field=>field.value)));
  for(const section of CONTENT_SECTIONS) for(const field of section.fields){
    const key=`${section.id}.${field.key}`;
    if(['guest.landmarks','guest.photoPending'].includes(key))continue;
    if(!['copy','guest','storyDownload','countdown'].includes(section.id)&&!active.has(key)&&key!=='keepsake.hashtag')continue;
    if(['hero.hero date','misc.di','beyond.arch t'].includes(key))continue;
    let group=section.id;
    if(group==='guest')group=arrivalKeys.has(field.key)?'arrival':'rsvp';
    if(group==='storyDownload')group='keepsake';
    if(group==='countdown'||group==='misc')group='hero';
    if(group==='peta')group='details';
    if(group==='mark')group='rsvp';
    if(group==='beyond')group='footer';
    if(group==='gallery')group='archive';
    if(group==='photoComments')group='archive';
    if(group==='copy'){if(!COPY_SECTION_MAP[field.value]||semanticLiterals.has(field.value))continue;group=COPY_SECTION_MAP[field.value];}
    if(group==='arrival'||group==='useful')group='details';
    const target=result.find(s=>s.id===group)??result.find(s=>s.id==='interface')!;
    const kind=/tombol|CTA|^(Open|Save|Download|Copy|Close|Confirm|Cancel|Try|View|Browse|Book|Use|Next|Previous|Refresh|Add|Edit|Send|Return|Keep|Read|Continue|Put|Release|Write|Draw|Clear|Undo|Redo|Skip|Take|Zoom|Reset|Filter|Reload)/i.test(field.label)?'cta':/status|loading|error|gagal|memuat|unavailable|could not|preparing|loading|saving/i.test(field.label)?'status':'text';
    target.fields.push({key,label:section.id==='copy'?(CONTENT_DEFAULTS[`id.${key}`]||field.label):field.label,value:field.value,limit:key.startsWith('keepsake.')?120:2000,kind});
  }
  return result.filter(section=>section.fields.length||section.tools.length);
}
