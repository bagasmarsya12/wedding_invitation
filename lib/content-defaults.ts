// AUTO-GENERATED from sketches/admin-cms-v2 mockup (12 sections / 96 fields).
// Defaults are the current landing literals; empty DB override = fallback.

import { indonesian } from './invitation-copy';
import { copyKey, PUBLIC_COPY } from './copy-registry';
import { KEEPSAKE_UI_EN, KEEPSAKE_UI_ID } from './keepsake-copy';
export type ContentField = { key: string; label: string; value: string };
export type ContentSection = { id: string; label: string; photo?: boolean; fields: ContentField[] };
export type ContentMap = Record<string, string>;

const BASE_CONTENT_SECTIONS: ContentSection[] = [
  {id:"keepsake",label:"Keepsake & ucapan personal",fields:[
    {"key": "forLabel", "label": "Sapaan penerima", "value": "For"},
    {"key": "genericRecipient", "label": "Penerima umum", "value": "you"},
    {"key": "note1", "label": "Ucapan baris pertama", "value": "A little of our day,"},
    {"key": "note2", "label": "Ucapan baris kedua", "value": "kept for you."},
    {"key": "love", "label": "Penutup ucapan", "value": "With love,"},
    {"key": "signatureNames", "label": "Nama pada tanda tangan", "value": "Iga dan Bagas"},
    {"key": "editionLabel", "label": "Label edisi", "value": "Guest edition"},
    {"key": "turn", "label": "Tombol balik", "value": "Turn it over"},
    {"key": "return", "label": "Tombol depan", "value": "Return to the front"},
    {"key": "front", "label": "Label depan", "value": "Front of the card"},
    {"key": "back", "label": "Label belakang", "value": "Back of the card"},
    {"key": "hint", "label": "Petunjuk", "value": "Two sides of the same day."}
  ]},
  { id: "hero", label: "Opening & Envelope", fields: [
    { key: "env greet", label: "Sapaan amplop", value: "For our very special guest" },
    { key: "env skip", label: "Tombol skip opening", value: "Skip opening" },
    { key: "env date", label: "Baris tanggal amplop", value: "1 November 2026 · Pandiga, Cimahi" },
    { key: "env time", label: "Baris jam amplop", value: "Akad 14:00 · Reception 18:00 WIB" },
    { key: "env flip", label: "Tombol buka amplop", value: "Turn it over" },
    { key: "env back", label: "Tombol kembali ke depan", value: "Return to the front" },
    { key: "hero head", label: "Heading besar", value: "We’re getting married." },
    { key: "hero sub", label: "Sub-heading", value: "Our favourite people. One very good reason to gather." },
    { key: "hero day", label: "Label hari", value: "Sunday" },
    { key: "hero date", label: "Tanggal besar", value: "1 November 2026" },
    { key: "hero venue", label: "Venue", value: "Pandiga, Cimahi" },
    { key: "hero time", label: "Jam WIB", value: "18:00 WIB" },
    { key: "hero cta", label: "Tombol lanjut", value: "Wedding details" },
  ] },
  { id: "details", label: "Detail hari-H", fields: [
    { key: "kicker", label: "Kicker", value: "The details" },
    { key: "head", label: "Heading", value: "Same place, a very special day." },
    { key: "sub", label: "Sub-heading", value: "Here’s when and where to find us. We can’t wait to see you there." },
    { key: "akad", label: "Label Akad", value: "The official part." },
    { key: "resepsi", label: "Label Resepsi", value: "The louder part." },
    { key: "jam1", label: "Jam Akad", value: "14:00" },
    { key: "jam2", label: "Jam Resepsi", value: "18:00" },
    { key: "venue nama", label: "Nama venue", value: "Pandiga" },
    { key: "venue kota", label: "Kota", value: "Cimahi" },
    { key: "venue alamat", label: "Alamat", value: "Jl. Sirnarasa No.11, Cibabat, Kec. Cimahi Utara, Kota Cimahi, Jawa Barat 40513" },
    { key: "arah", label: "Label tombol arah", value: "Open directions" },
  ] },
  { id: "profil", label: "Profil (foto + kata-kata)", photo: true, fields: [
    { key: "kicker", label: "Kicker", value: "For those who know one of us better." },
    { key: "head", label: "Heading", value: "The two of us, as observed by the other." },
    { key: "nama1", label: "Nama Bagas", value: "Bagas Marsya Pratama Nugraha" },
    { key: "b_known", label: "Bagas — Known for", value: "A small detail about Bagas, from Iga." },
    { key: "b_found", label: "Bagas — Usually found", value: "A favourite place or everyday ritual." },
    { key: "b_family", label: "Keluarga Bagas", value: "Family details will be added." },
    { key: "b_cap", label: "Bagas — caption foto", value: "Bagas, as himself." },
    { key: "i_nama", label: "Nama Iga", value: "Iga Noviyanti Rohman" },
    { key: "i_known", label: "Iga — Known for", value: "A small detail about Iga, from Bagas." },
    { key: "i_found", label: "Iga — Usually found", value: "A place, a habit, a little thing she loves." },
    { key: "i_family", label: "Keluarga Iga", value: "Family details will be added." },
    { key: "i_cap", label: "Iga — caption foto", value: "Iga, as herself." },
    { key: "quote label", label: "Label kutipan Iga", value: "According to Iga" },
    { key: "quote1", label: "Kutipan Iga tentang Bagas", value: "“A few words from Iga will live here.”" },
    { key: "quote label2", label: "Label kutipan Bagas", value: "According to Bagas" },
    { key: "quote2", label: "Kutipan Bagas tentang Iga", value: "“A few words from Bagas will live here.”" },
  ] },
  { id: "story", label: "Our Story (template singkat)", fields: [
    { key: "head", label: "Heading cerita", value: "How we got here." },
    { key: "title1", label: "Judul bagian 1", value: "The beginning" },
    { key: "body1", label: "Cerita bagian 1", value: "A short note about how we first met will live here." },
    { key: "title2", label: "Judul bagian 2", value: "Along the way" },
    { key: "body2", label: "Cerita bagian 2", value: "A small moment from our time together will be added here." },
    { key: "title3", label: "Judul bagian 3", value: "The day ahead" },
    { key: "body3", label: "Cerita bagian 3", value: "A few words about this next chapter will live here." },
  ] },
  { id: "gallery", label: "Selected Moments (6 foto)", fields: [
    { key: "head", label: "Heading galeri", value: "Selected moments." },
    { key: "sub", label: "Pengantar galeri", value: "A few frames from our life together." },
    ...Array.from({ length: 6 }, (_, index) => ({ key: `caption${index + 1}`, label: `Caption foto ${index + 1}`, value: `Photograph ${String(index + 1).padStart(2, "0")} — caption to be added.` })),
  ] },
  { id: "archive", label: "Archive", fields: [
    { key: "head", label: "Heading", value: "The Archive" },
    { key: "sub", label: "Sub", value: "Some things were worth keeping." },
    { key: "desc", label: "Deskripsi", value: "Photographs, objects, and little things that became our things." },
    { key: "cta", label: "Tombol", value: "Open the archive ↗" },
    { key: "kosong", label: "Teks saat kosong", value: "Curated memories will be added here." },
  ] },
  { id: "rsvp", label: "RSVP", fields: [
    { key: "head", label: "Heading", value: "Will you be there?" },
    { key: "sub", label: "Sub", value: "We’re doing a headcount." },
    { key: "desc", label: "Deskripsi", value: "Apparently venues care about these things." },
    { key: "hadir", label: "Tombol hadir", value: "I’ll be there." },
    { key: "maaf", label: "Tombol tidak hadir", value: "I’ll miss this one." },
    { key: "jml", label: "Label jumlah tamu", value: "Number of guests" },
    { key: "nama", label: "Label nama tamu", value: "Guest names (optional)" },
    { key: "diet", label: "Label dietary", value: "Dietary notes" },
    { key: "pesan", label: "Label pesan", value: "A note for us" },
  ] },
  { id: "useful", label: "Useful bits", fields: [
    { key: "head", label: "Heading", value: "The useful bits" },
    { key: "sub", label: "Sub", value: "The questions someone was going to ask anyway." },
    { key: "dress t", label: "Dress code — judul", value: "Dress code" },
    { key: "dress d", label: "Dress code — isi", value: "Details to follow" },
    { key: "alamat t", label: "Alamat — judul", value: "Address and entrance" },
    { key: "alamat d", label: "Alamat — isi", value: "Jl. Sirnarasa No.11, Cibabat, Kec. Cimahi Utara, Kota Cimahi, Jawa Barat 40513." },
    { key: "parkir t", label: "Parkir — judul", value: "Parking and accessibility" },
    { key: "parkir d", label: "Parkir — isi", value: "Parking, entrance, and accessibility guidance will be added after venue confirmation." },
    { key: "anak t", label: "Anak — judul", value: "Children and plus-ones" },
    { key: "anak d", label: "Anak — isi", value: "Guest-specific guidance will remain attached to each private invitation." },
    { key: "kontak t", label: "Kontak — judul", value: "Contact person" },
    { key: "kontak d", label: "Kontak — isi", value: "A contact person will be added closer to the date." },
  ] },
  { id: "gift", label: "Gifts (heading & deskripsi)", fields: [
    { key: "head", label: "Heading", value: "A few things" },
    { key: "sub", label: "Sub", value: "We’re saving room for." },
    { key: "desc", label: "Deskripsi", value: "The catalogue opens from your private invitation. Each booking is saved under your name." },
    { key: "kosong", label: "Teks saat katalog kosong", value: "Curated objects will be added here." },
    { key: "cta", label: "Tombol", value: "Open the gift catalogue" },
  ] },
  { id: "mark", label: "Leave a mark", fields: [
    { key: "head", label: "Heading", value: "Your reply" },
    { key: "sub", label: "Sub", value: "A little word from you." },
    { key: "desc", label: "Deskripsi", value: "Tell us if you’re coming. Leave a little love, if you like." },
    { key: "kosong", label: "Teks saat belum ada kartu", value: "Something from you will live here." },
    { key: "lihat", label: "Tombol lihat semua", value: "See every postcard" },
  ] },
  { id: "beyond", label: "Beyond the invitation", fields: [
    { key: "head", label: "Heading", value: "Beyond the invitation" },
    { key: "sub", label: "Sub", value: "The invitation ends here. The rest stays open." },
    { key: "arch t", label: "The Archive — judul", value: "The Archive" },
    { key: "arch d", label: "The Archive — isi", value: "Things we kept." },
    { key: "mark t", label: "The Marks — judul", value: "The Marks" },
    { key: "mark d", label: "The Marks — isi", value: "Things you left." },
    { key: "gal t", label: "The Gallery — judul", value: "The Gallery" },
    { key: "gal d", label: "The Gallery — isi", value: "Then and now. Coming later." },
  ] },
  { id: "footer", label: "Footer", fields: [
    { key: "edisi", label: "Label edisi", value: "Guest edition" },
    { key: "tahun", label: "Tahun", value: "2026" },
    { key: "made", label: "Baris made-with", value: "Made with unreasonable attention to detail and approximately 1 billion tokens." },
    { key: "amplop", label: "Tombol amplop", value: "View the envelope again" },
  ] },
  { id: "peta", label: "Peta & alat", fields: [
    { key: "load", label: "Teks loading", value: "Loading the actual roads around Pandiga…" },
    { key: "err", label: "Teks error", value: "Live map unavailable right now." },
    { key: "gmaps", label: "Tombol Google Maps", value: "OPEN IN GOOGLE MAPS" },
    { key: "hint", label: "Hint kontrol", value: "Use the controls, drag, or arrow keys to explore the actual roads around the venue." },
    { key: "still", label: "Label mode diam", value: "Map shown in a still state." },
  ] },
  { id: "misc", label: "Stempel & tanggal kecil", fields: [
    { key: "monogram", label: "Alt monogram", value: "Monogram Bagas dan Iga" },
    { key: "seal", label: "Stempel amplop", value: "B × I" },
    { key: "tanggal seal", label: "Tanggal stempel", value: "01 · 11 · 26" },
    { key: "besar", label: "Tanggal besar amplop", value: "01 · 11 · 2026" },
    { key: "di", label: "Label di atas nama", value: "Bagas × Iga" },
  ] },
];

export const CONTENT_SECTIONS: ContentSection[] = [...BASE_CONTENT_SECTIONS, {id:'keepsakeUi',label:'Keepsake — semua tombol & status',fields:Object.entries(KEEPSAKE_UI_EN).map(([key,value])=>({key,label:key,value}))}, {id:'copy',label:'Semua kata-kata & interface',fields:PUBLIC_COPY.map(value=>({key:copyKey(value).slice(5),label:value,value}))}];
const english: ContentMap = Object.fromEntries(CONTENT_SECTIONS.flatMap(section => section.fields.map(field => [section.id + '.' + field.key, field.value])));
export const CONTENT_DEFAULTS: ContentMap = {...english,...Object.fromEntries(Object.entries(english).map(([key,value])=>['id.'+key,indonesian[value.trim()] ?? value])),...Object.fromEntries(Object.entries(KEEPSAKE_UI_ID).map(([key,value])=>['id.keepsakeUi.'+key,value])),...{'id.keepsake.forLabel': 'Untuk', 'id.keepsake.genericRecipient': 'kamu', 'id.keepsake.note1': 'Sedikit dari hari kami,', 'id.keepsake.note2': 'untuk kamu simpan.', 'id.keepsake.love': 'Dengan sayang,', 'id.keepsake.editionLabel': 'Edisi tamu', 'id.keepsake.turn': 'Balik kartunya', 'id.keepsake.return': 'Kembali ke depan', 'id.keepsake.front': 'Sisi depan kartu', 'id.keepsake.back': 'Sisi belakang kartu', 'id.keepsake.hint': 'Dua sisi dari hari yang sama.'}};

export function contentKey(sectionId: string, fieldKey: string): string {
  return sectionId + "." + fieldKey;
}
