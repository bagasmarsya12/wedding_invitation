'use client';
/* eslint-disable @next/next/no-img-element */
import type { ArrivalContent } from '@/lib/arrival-content';
import type { Localized } from '@/lib/website-content';

type Props = {
  value: ArrivalContent; onChange: (value: ArrivalContent) => void; busy: boolean;
  media: Record<string, string>; onUpload: (slot: string, file: File) => Promise<void>;
  onRemovePhoto: (slot: string) => Promise<void>; onSave: () => void;
};
export function ArrivalEditor({ value, onChange, busy, media, onUpload, onRemovePhoto, onSave }: Props) {
  function bilingual(copy: Localized, update: (copy: Localized) => void, label: string, max = 2000) {
    return <div className="cms-bilingual"><label>{label} · Indonesia<textarea rows={3} maxLength={max} value={copy.id} onChange={event => update({ ...copy, id: event.target.value })} /></label><label>{label} · English<textarea rows={3} maxLength={max} value={copy.en} onChange={event => update({ ...copy, en: event.target.value })} /></label></div>;
  }
  function field(key: keyof ArrivalContent, label: string, max = 2000) {
    return bilingual(value[key] as Localized, copy => onChange({ ...value, [key]: copy }), label, max);
  }
  return <div className="cms-arrival-editor">
    <p>Panduan awal terisi contoh. Ganti sesuai venue, lalu matikan penanda contoh setelah detail dikonfirmasi. Panduan berada di section hari & tempat, bersama jadwal, peta dan FAQ. Tanggal, jadwal, alamat, dan Google Maps mengikuti tab Jadwal & lokasi.</p>
    <form onSubmit={event => { event.preventDefault(); onSave(); }}><fieldset disabled={busy}>
      <label className="check"><input type="checkbox" checked={value.enabled} onChange={event => onChange({ ...value, enabled: event.target.checked })} />Tampilkan panduan kedatangan</label>
      <label className="check"><input type="checkbox" checked={value.isExample} onChange={event => onChange({ ...value, isExample: event.target.checked })} />Tampilkan penanda konten contoh</label>
      {field('title', 'Judul panduan', 300)}{field('intro', 'Pengantar')}{field('sampleNote', 'Penanda contoh')}
      <h3>Empat langkah kedatangan</h3>
      <div className="cms-arrival-steps">{value.steps.map((step, index) => <article className="cms-arrival-step" key={step.id}><h4>Langkah {index + 1}</h4>{bilingual(step.title, title => onChange({ ...value, steps: value.steps.map((row, i) => i === index ? { ...row, title } : row) }), 'Judul', 200)}{bilingual(step.body, body => onChange({ ...value, steps: value.steps.map((row, i) => i === index ? { ...row, body } : row) }), 'Petunjuk')}</article>)}</div>
      <h3>Denah venue (opsional)</h3>
      <p>JPG, PNG, WebP, atau AVIF; maks. 50 MB. Foto disiapkan otomatis untuk web. Denah tampil di dalam accordion panduan. Bila kosong, tamu cukup menggunakan peta dan petunjuk arah di atasnya. Foto dan teks mengikuti draf section. Keduanya tampil ke tamu setelah publikasi.</p>
      <div className="cms-arrival-photos">{[['arrival-map', 'Denah venue']].map(([slot, label]) => <article className="cms-arrival-photo" key={slot}><h4>{label}</h4>{media[slot] && <img src={media[slot]} alt={label} />}<label>Upload {label.toLowerCase()}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void onUpload(slot, file); }} /></label>{media[slot] && <button type="button" onClick={() => void onRemovePhoto(slot)}>Hapus gambar {label.toLowerCase()}</button>}</article>)}</div>
      {field('mapCaption', 'Caption denah')}{field('mapAlt', 'Deskripsi denah untuk aksesibilitas', 300)}
      <h3>Informasi praktis</h3>{field('dressCode', 'Panduan pakaian')}{field('accessibility', 'Aksesibilitas & bantuan')}{field('transport', 'Transportasi & drop-off')}
      <h3>Kontak bantuan</h3>{field('contactName', 'Nama panitia', 300)}
      <label>Nomor WhatsApp panitia<input type="tel" maxLength={40} value={value.contactPhone} placeholder="Isi nomor yang benar; kosongkan bila belum ada" onChange={event => onChange({ ...value, contactPhone: event.target.value })} /></label>
      {field('contactMessage', 'Pesan WhatsApp awal (gunakan {{name}} untuk nama tamu)')}
      <button type="submit">Simpan draf panduan</button>
    </fieldset></form>
  </div>;
}
