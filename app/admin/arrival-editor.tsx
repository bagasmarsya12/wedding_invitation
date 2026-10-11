'use client';
import type { ArrivalContent } from '@/lib/arrival-content';
import type { Localized } from '@/lib/website-content';

type Props = {
  value: ArrivalContent; onChange: (value: ArrivalContent) => void; busy: boolean; language: 'id' | 'en';
  media: Record<string, string>; onUpload: (slot: string, file: File) => Promise<void>; onRemovePhoto: (slot: string) => Promise<void>;
};
export function ArrivalEditor({ value, onChange, busy, language, media, onUpload, onRemovePhoto }: Props) {
  function localized(copy: Localized, update: (copy: Localized) => void, label: string, max = 2000) {
    return <label className="cms-localized-field">{label}<textarea aria-label={`${label} · ${language === 'id' ? 'Indonesia' : 'English'}`} rows={3} maxLength={max} value={copy[language]} onChange={event => update({ ...copy, [language]: event.target.value })} /></label>;
  }
  function field(key: keyof ArrivalContent, label: string, max = 2000) {
    return localized(value[key] as Localized, copy => onChange({ ...value, [key]: copy }), label, max);
  }
  return <div className="cms-arrival-editor">
    <p>Tampil di tab Panduan kedatangan. Jadwal, alamat, dan petunjuk Google Maps mengikuti tab Jadwal & lokasi.</p>
    <label className="check"><input type="checkbox" checked={value.enabled} onChange={event => onChange({ ...value, enabled: event.target.checked })} />Tampilkan panduan kedatangan</label>
    {!value.enabled && <p className="cms-editor-conflict">Panduan sedang disembunyikan. Isinya tetap tersimpan.</p>}
    <section className="cms-field-group"><h4>Pembuka panduan</h4>{field('title', 'Judul panduan', 300)}{field('intro', 'Pengantar')}</section>
    <section className="cms-field-group"><h4>Empat langkah kedatangan</h4>{value.steps.map((step, index) => <section className="cms-arrival-step" key={step.id}><h5>Langkah {index + 1}</h5>{localized(step.title, title => onChange({ ...value, steps: value.steps.map((row, i) => i === index ? { ...row, title } : row) }), `Judul langkah ${index + 1}`, 200)}{localized(step.body, body => onChange({ ...value, steps: value.steps.map((row, i) => i === index ? { ...row, body } : row) }), `Petunjuk langkah ${index + 1}`)}</section>)}</section>
    <details className="cms-advanced-fields"><summary>Denah venue (opsional)</summary><p>Tampil di dalam panduan jika ada gambar. Foto patokan pintu dan parkir sudah tidak digunakan.</p>{media['arrival-map'] && <img className="cms-photo-preview" src={media['arrival-map']} alt="Denah venue" />}<label>Upload denah<input type="file" disabled={busy} accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void onUpload('arrival-map', file); }} /></label><small>JPG, PNG, WebP, atau AVIF hingga 50 MB; disiapkan otomatis untuk web.</small>{media['arrival-map'] && <><button type="button" onClick={() => void onRemovePhoto('arrival-map')}>Hapus denah</button>{field('mapCaption', 'Caption denah')}{field('mapAlt', 'Deskripsi gambar untuk aksesibilitas', 300)}</>}</details>
    <section className="cms-field-group"><h4>Bantuan & perjalanan</h4>{field('accessibility', 'Aksesibilitas & bantuan')}{field('transport', 'Transportasi & drop-off')}</section>
    <section className="cms-field-group"><h4>Kontak panitia</h4><p>Tombol WhatsApp muncul jika nomor diisi. Kosongkan untuk menyembunyikan kontak.</p>{field('contactName', 'Nama panitia', 300)}<label>Nomor WhatsApp panitia<input type="tel" maxLength={40} value={value.contactPhone} placeholder="Contoh: 62812…" onChange={event => onChange({ ...value, contactPhone: event.target.value })} /></label>{field('contactMessage', 'Pesan awal WhatsApp ({{name}} adalah nama tamu)')}</section>
  </div>;
}
