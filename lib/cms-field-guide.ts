import type { EditorField, EditorSection } from './content-editor-sections';
import { copyKey } from './copy-registry';

// Keep these keys in snapshots and history, but never offer controls for removed UI.
const retiredControls = new Set([
  'profil.kicker', 'profil.b_cap', 'profil.i_cap', 'footer.edisi',
  'footer.amplop', 'guest.party',
  'footer.stakkHint',
  ...['A reply from', 'our favourite people', 'Reply received', 'View the envelope again', 'Open purchase link', 'Object photograph', 'to be added'].map(copyKey),
  'useful.head', 'useful.sub', 'guest.dress', 'guest.guide', 'guest.help', 'guest.contactPending',
  ...['For those who know one of us better.', 'Bagas, as himself.', 'Iga, as herself.', 'As observed by Iga', 'As observed by Bagas'].map(copyKey),
]);
export function visibleEditorFields(section: EditorSection): EditorField[] {
  return section.fields.filter(field => !retiredControls.has(field.key));
}

type GroupDefinition = { title: string; keys: string[] };
export type EditorFieldGroup = { title: string; fields: EditorField[]; advanced: boolean };
const literal = (...values: string[]) => values.map(copyKey);
const groups: Record<string, GroupDefinition[]> = {
  hero: [
    { title: 'Amplop & sapaan', keys: ['hero.env greet', 'hero.env skip', ...literal('Open the invitation')] },
    { title: 'Pembuka undangan', keys: ['hero.hero head', 'hero.hero sub', ...literal('Continue')] },
    { title: 'Hitung mundur', keys: ['countdown.days', 'countdown.today', 'countdown.past', ...literal('The day we’ve been dreaming of is', 'And just like that,')] },
  ],
  details: [
    { title: 'Pengantar acara', keys: ['details.kicker', 'details.head', 'details.sub'] },
    { title: 'Akad & resepsi', keys: ['details.akad', 'details.resepsi', 'details.arah', ...literal('Akad', 'Reception', 'Save the date')] },
    { title: 'Panduan & QR', keys: ['guest.arrival', 'guest.faq', 'guest.access', 'guest.transport', 'guest.contact', ...literal('Save guest pass', 'Enlarge QR')] },
  ],
  profil: [
    { title: 'Judul section', keys: ['profil.head'] },
    { title: 'Bagas', keys: ['profil.nama1', 'profil.b_family', 'profil.b_known', 'profil.quote1'] },
    { title: 'Iga', keys: ['profil.i_nama', 'profil.i_family', 'profil.i_known', 'profil.quote2'] },
  ],
  story: [{ title: 'Pengantar cerita', keys: [...literal('Our story'), 'story.head'] }],
  archive: [{ title: 'Pengantar album', keys: ['archive.head', 'archive.desc', ...literal('Open our archive', 'Look closer', 'Read more')] }],
  rsvp: [
    { title: 'Pengantar kartu ucapan', keys: ['mark.head', 'mark.sub', 'mark.desc'] },
    { title: 'Kehadiran & kirim kartu', keys: ['rsvp.head', 'rsvp.hadir', ...literal('I can’t make it.', 'Send card', 'Preview my reply')] },
  ],
  gift: [{ title: 'Pengantar tanda kasih', keys: ['gift.head', 'gift.desc', 'gift.kosong', ...literal('Gift an object', 'Cash gift', 'Open DANA', 'Copy phone number', 'Copy account number')] }],
  keepsake: [
    { title: 'Tombol pembuka kartu', keys: [...literal('Open your keepsake'), 'keepsake.openHint'] },
    { title: 'Pesan pada kartu', keys: ['keepsake.note1', 'keepsake.note2', 'keepsake.love', 'keepsake.hashtag'] },
    { title: 'Penerima kartu', keys: ['keepsake.forLabel', 'keepsake.genericRecipient'] },
    { title: 'Unduhan gambar & video', keys: ['storyDownload.title', 'storyDownload.video', 'storyDownload.front', 'storyDownload.back'] },
  ],
  footer: [
    { title: 'Stakk · kamera kenangan tamu', keys: ['footer.stakkTitle', 'footer.stakkDescription', 'footer.stakkCta'] },
    { title: 'Penutup undangan', keys: ['beyond.head', ...literal('The invitation ends here.', 'The rest stays open.', 'See you in Cimahi.', 'Thank you for being part of our day.'), ...literal('Made with unreasonable attention to detail', 'and approximately 1 billion tokens.')] },
  ],
};
export function groupEditorFields(section: EditorSection, query = '', values: Record<string, string> = {}): EditorFieldGroup[] {
  const search = query.trim().toLocaleLowerCase('id');
  const fields = visibleEditorFields(section).filter(field => !search || [field.label, values[field.key], values[`id.${field.key}`]].some(value => value?.toLocaleLowerCase('id').includes(search)));
  const byKey = new Map(fields.map(field => [field.key, field]));
  const definitions = groups[section.id] ?? [{ title: 'Teks yang tampil', keys: fields.filter(field => field.kind !== 'status').map(field => field.key) }];
  const result: EditorFieldGroup[] = definitions.flatMap(group => {
    const ordered = group.keys.flatMap(key => { const field = byKey.get(key); byKey.delete(key); return field ? [field] : []; });
    return ordered.length ? [{ title: group.title, fields: ordered, advanced: false }] : [];
  });
  if (byKey.size) result.push({ title: section.id === 'profil' ? 'Label pada profil' : 'Tombol, petunjuk & kondisi khusus', fields: [...byKey.values()], advanced: true });
  return result;
}

const labels: Record<string, string> = {
  'hero.hero head': 'Kalimat sebelum nama pasangan', 'hero.hero sub': 'Pengantar undangan',
  'details.kicker': 'Label sebelum judul', 'details.head': 'Judul acara', 'details.sub': 'Pengantar acara',
  'details.akad': 'Kalimat di bawah akad', 'details.resepsi': 'Kalimat di bawah resepsi',
  'profil.head': 'Judul section', 'profil.nama1': 'Nama lengkap Bagas', 'profil.i_nama': 'Nama lengkap Iga',
  'profil.b_family': 'Di Balik Nama', 'profil.i_family': 'Di Balik Nama',
  'profil.b_known': 'Hal Spesial Menurut Iga', 'profil.i_known': 'Hal Spesial Menurut Bagas',
  'profil.quote1': 'Di Mata Iga', 'profil.quote2': 'Di Mata Bagas',
  'archive.head': 'Judul album', 'archive.desc': 'Pengantar album',
  'mark.head': 'Label sebelum judul', 'mark.sub': 'Judul kartu ucapan', 'mark.desc': 'Pengantar kartu ucapan',
  'gift.head': 'Judul tanda kasih', 'gift.desc': 'Pengantar tanda kasih', 'gift.kosong': 'Pesan jika belum ada hadiah',
  'beyond.head': 'Label sebelum penutup', 'story.head': 'Judul cerita',
};
export const editorFieldLabel = (field: EditorField) => labels[field.key] ?? field.label;
export const defaultEditorMode = (section: string) => ({ details: 'event', story: 'story', archive: 'photos', gift: 'gifts', jukebox: 'jukebox', seo: 'event' }[section] ?? 'copy');
export const directSaveMode = (mode: string) => ['gifts', 'transfers', 'entries', 'comments', 'jukebox'].includes(mode);
export const editorModeSection = (mode: string) => ({ photos: 'archive', comments: 'archive', entries: 'archive', portraits: 'profil', gifts: 'gift', transfers: 'gift', jukebox: 'jukebox' }[mode]);
export const sectionWebsiteTarget = (section: string) => ({ hero: '/#the-day', details: '/#details', profil: '/#profiles', story: '/#our-story', archive: '/#archive', rsvp: '/#leave-a-mark', gift: '/#gifts', keepsake: '/#closing-title', footer: '/#beyond', jukebox: '/', navigation: '/', seo: '/' }[section] ?? '/');
export const sectionNavHint = (section: string) => ({hero:'Sapaan & pembuka',details:'Jadwal, lokasi & FAQ',profil:'Nama, tiga bagian & foto',story:'Bab & urutan cerita',archive:'Album, caption & komentar',rsvp:'Kehadiran & kartu ucapan',gift:'Barang, rekening & e-wallet',keepsake:'Pesan, gambar & video',jukebox:'Playlist, audio & teks',footer:'Kalimat & tautan akhir',navigation:'Label menu & tombol',seo:'Judul & gambar saat dibagikan'}[section] ?? 'Teks tambahan');
export const sectionHelp = (section: string) => ({
  hero: 'Sapaan di amplop dan kalimat pembuka. Nama, tanggal, dan lokasi mengikuti pengaturan acara.',
  details: 'Jadwal, peta, panduan kedatangan, FAQ, dan QR tamu berada dalam satu section.',
  profil: 'Judul, nama lengkap, dan tiga bagian untuk setiap mempelai. Foto bisa diganti di tab Foto mempelai.',
  story: 'Bab cerita tampil berurutan di homepage. Judul section diatur melalui Teks & tombol.',
  archive: 'Album foto adalah kartu-kartu di Arsip cinta kami. Cerita tambahan memiliki halaman sendiri di Arsip.',
  rsvp: 'Pengantar dan tombol untuk menjawab kehadiran serta mengirim kartu ucapan.',
  gift: 'Kartu hadiah menampilkan nama barang, penerima, dan alasan dibutuhkan. Booking tersedia lewat undangan personal. Rekening dan e-wallet diatur pada tab terpisah.',
  keepsake: 'Pesan bawaan kartu untuk semua tamu. Pesan khusus seseorang diatur dari Tamu & link → Edit / pesan.',
  footer: 'Pengantar dan tombol Stakk, serta kalimat dan tautan di akhir undangan. Stakk membuka kamera di tab baru. Hashtag mengikuti Kartu kenangan.',
  jukebox: 'Playlist dan kata-kata jukebox diatur bersama. Lagu tampil setelah audio diunggah dan lagu diaktifkan.',
  seo: 'Judul dan gambar saat undangan dibagikan. Aplikasi pesan dapat menyimpan gambar share lama sementara.',
}[section] ?? 'Label menu, tombol, dan kondisi khusus. Pilih bahasa sebelum mengedit.');
