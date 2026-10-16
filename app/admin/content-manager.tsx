'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { RichTextField } from './rich-text-field';
import { isRichTextField, richTextPlain } from '@/lib/rich-text';
import { archiveMediaUrls } from '@/lib/archive-media';
import { prepareCmsPhoto, PHOTO_UPLOAD_HELP, ARCHIVE_PHOTO_ACCEPT, ARCHIVE_PHOTO_UPLOAD_HELP } from '@/lib/cms-photo-upload';
import { ArrivalEditor } from './arrival-editor';
import { ARRIVAL_DEFAULTS, type ArrivalContent } from '@/lib/arrival-content';
import { CONTENT_DEFAULTS } from '@/lib/content-defaults';
import type { EditorSection } from '@/lib/content-editor-sections';
import { defaultEditorMode, directSaveMode, editorFieldLabel, editorModeSection, groupEditorFields, sectionHelp, sectionNavHint, sectionWebsiteTarget } from '@/lib/cms-field-guide';
import { publishSectionChanges } from '@/lib/cms-publish-workflow';
import { SectionPublishing } from './section-publishing';
import { sectionCopyKeys, sectionConfigKeys, sectionBlockKeys, sectionMediaSlots, type SectionSnapshot, type EditorialResponse } from '@/lib/cms-editorial';
import { MAX_ALBUM_PHOTOS, WEBSITE_DEFAULTS, type WebsiteBlocks, type WebsiteConfig, type Localized } from '@/lib/website-content';

type SiteResponse = { config: WebsiteConfig; blocks: WebsiteBlocks; arrival: ArrivalContent; media: Record<string, string>; error?: string };
type ContentResponse = { editorSections: EditorSection[]; values: Record<string, string>; error?: string };
type Props = {
  notify: (message: string) => void; requestedMode?: string; onModeChange?: (mode: string) => void;
  onDirtyChange?: (dirty: boolean) => void; onOpenArea?: (area: string) => void;
  giftsEnabled?: boolean; externalDirty?: boolean; onExternalDirtyChange?: (dirty: boolean) => void;
  giftEditor?: ReactNode; transferEditor?: ReactNode; archiveEditor?: ReactNode; commentsEditor?: ReactNode; jukeboxEditor?: ReactNode;
};
const toolLabels: Record<string, string> = {
  event: 'Jadwal & lokasi', arrival: 'Panduan kedatangan', story: 'Bab cerita', faq: 'FAQ', photos: 'Foto & GIF',
  links: 'Tautan penutup', portraits: 'Foto mempelai', gifts: 'Hadiah barang', transfers: 'Rekening & e-wallet',
  entries: 'Cerita tambahan', comments: 'Komentar foto', jukebox: 'Playlist & teks',
};
const itemLabels = { story: 'Bab', faq: 'Pertanyaan', photos: 'Foto', links: 'Tautan' };

export function ContentManager({ notify, requestedMode = 'copy', onModeChange, onDirtyChange, onOpenArea, giftsEnabled = true, externalDirty = false, onExternalDirtyChange, giftEditor, transferEditor, archiveEditor, commentsEditor, jukeboxEditor }: Props) {
  const [data, setData] = useState<ContentResponse | null>(null);
  const [config, setConfig] = useState<WebsiteConfig>(WEBSITE_DEFAULTS), [blocks, setBlocks] = useState<WebsiteBlocks | null>(null);
  const [arrival, setArrival] = useState<ArrivalContent>(ARRIVAL_DEFAULTS);
  const [loadError, setLoadError] = useState(''), [loadAttempt, setLoadAttempt] = useState(0);
  const [section, setSection] = useState('hero'), [query, setQuery] = useState(''), [busy, setBusy] = useState(false);
  const [savedValues, setSavedValues] = useState<Record<string, string>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({}), [draftMedia, setDraftMedia] = useState<Record<string, string | null>>({});
  const [editorial, setEditorial] = useState<EditorialResponse | null>(null), [editorReady, setEditorReady] = useState(false);
  const [editorError, setEditorError] = useState(''), [editorAttempt, setEditorAttempt] = useState(0);
  const [mode, setMode] = useState(requestedMode), [editLanguage, setEditLanguage] = useState<'id' | 'en'>('id');
  const [directEditorVersion, setDirectEditorVersion] = useState(0);
  const unsaved = useRef(false), currentSection = useRef(section), formArea = useRef<HTMLFieldSetElement>(null);
  useEffect(() => { currentSection.current = section; }, [section]);
  useEffect(() => { queueMicrotask(() => {
    if (unsaved.current) return; setMode(requestedMode);
    const target = editorModeSection(requestedMode);
    if (target && target !== currentSection.current) { setEditorReady(false); setEditorial(null); setSection(target); setQuery(''); }
  }); }, [requestedMode]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (unsaved.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', protect); return () => window.removeEventListener('beforeunload', protect);
  }, []);
  useEffect(() => {
    let alive = true;
    Promise.all([fetch('/api/admin/content', { cache: 'no-store' }), fetch('/api/admin/website', { cache: 'no-store' })]).then(async responses => {
      const [copy, site] = await Promise.all([responses[0].json() as Promise<ContentResponse>, responses[1].json() as Promise<SiteResponse>]);
      if (responses.some(response => !response.ok)) throw new Error(copy.error || site.error);
      if (alive) { setData(copy); setSavedValues(copy.values); setConfig(site.config); setBlocks(site.blocks); setArrival(site.arrival); setPhotoUrls(site.media); }
    }).catch(() => { if (alive) setLoadError('Konten tidak bisa dimuat. Coba muat ulang.'); });
    return () => { alive = false; };
  }, [loadAttempt]);
  const contentReady = Boolean(data && blocks);
  const applySnapshot = useCallback((snapshot: SectionSnapshot) => {
    setData(current => current ? { ...current, values: { ...current.values, ...snapshot.copy } } : current);
    setSavedValues(current => ({ ...current, ...snapshot.copy })); setConfig(current => ({ ...current, ...snapshot.config }));
    setBlocks(current => current ? { ...current, ...snapshot.blocks } : current); if (snapshot.arrival) setArrival(snapshot.arrival);
    setDraftMedia(current => ({ ...current, ...snapshot.media }));
    setPhotoUrls(current => {
      const next = { ...current };
      for (const [slot, key] of Object.entries(snapshot.media)) { if (key) next[slot] = `/api/admin/editor/media/${slot}?key=${encodeURIComponent(key)}`; else delete next[slot]; }
      return next;
    });
  }, []);
  useEffect(() => {
    if (!contentReady) return; let alive = true;
    queueMicrotask(() => { setEditorReady(false); setEditorError(''); setEditorial(null); });
    fetch(`/api/admin/editor?section=${section}`, { cache: 'no-store' }).then(async response => {
      const value = await response.json() as EditorialResponse; if (!response.ok) throw new Error(value.error || 'Editor belum tersedia.');
      if (alive) { applySnapshot(value.document.draft ?? value.live); setEditorial(value); setEditorReady(true); }
    }).catch(error => { if (alive) setEditorError(error instanceof Error ? error.message : 'Editor belum tersedia.'); });
    return () => { alive = false; };
  }, [contentReady, section, editorAttempt, applySnapshot]);
  const editorSnapshot: SectionSnapshot = {
    copy: Object.fromEntries(sectionCopyKeys(section).map(key => [key, data?.values[key] ?? ''])),
    config: Object.fromEntries(sectionConfigKeys(section).map(key => [key, config[key]])),
    blocks: Object.fromEntries(sectionBlockKeys(section).map(key => [key, blocks?.[key] ?? []])),
    ...(section === 'details' ? { arrival } : {}), media: Object.fromEntries(sectionMediaSlots(section, blocks ?? {}).map(slot => [slot, draftMedia[slot] ?? null])),
  };
  const publishingDirty = editorReady && !!editorial && JSON.stringify(editorSnapshot) !== JSON.stringify(editorial.document.draft ?? editorial.live);
  useEffect(() => { unsaved.current = publishingDirty || externalDirty; onDirtyChange?.(publishingDirty); }, [publishingDirty, externalDirty, onDirtyChange]);
  async function editorialAction(op: 'save' | 'publish' | 'discard' | 'restore', revision?: string) {
    if (!editorReady || !editorial) return null;
    if ((op === 'save' || op === 'publish') && formArea.current) {
      const invalid = Array.from(formArea.current.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')).find(input => !input.checkValidity());
      if (invalid) { invalid.reportValidity(); notify('Periksa field yang ditandai sebelum menyimpan.'); return null; }
    }
    setBusy(true);
    const mutate = async (operation: string, state: EditorialResponse, snapshot?: SectionSnapshot) => {
      const response = await fetch('/api/admin/editor', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ section, op: operation, version: state.document.version, ...(snapshot ? { snapshot } : {}), ...(revision ? { revision } : {}) }) });
      const result = await response.json() as EditorialResponse; if (!response.ok) throw new Error(result.error || 'Perubahan belum tersimpan.');
      applySnapshot(result.document.draft ?? result.live); setEditorial(result); return result;
    };
    try {
      const result = op === 'publish' ? await publishSectionChanges(editorial, editorSnapshot, mutate) : await mutate(op, editorial, op === 'save' ? editorSnapshot : undefined);
      notify({ save: 'Draf tersimpan. Tamu belum melihat perubahan ini.', publish: 'Perubahan sudah tayang di website.', discard: 'Draf dibuang. Editor kembali ke versi website.', restore: 'Versi lama dipulihkan sebagai draf. Belum ditayangkan.' }[op]); return result;
    } catch (error) { notify(error instanceof Error ? error.message : 'Perubahan belum tersimpan.'); return null; } finally { setBusy(false); }
  }
  async function uploadPhoto(slot: string, file: File) {
    const gif=section==='archive'&&file.type==='image/gif';
    setBusy(true); notify(gif?'Mengunggah GIF dengan animasi aslinya…':'Menyiapkan foto untuk web…');
    try {
      const form = new FormData(); const prepared = await prepareCmsPhoto(file,{allowGif:section==='archive'}); form.set('file', prepared);
      if (section === 'archive') {
        notify(gif ? 'Menyiapkan animasi dan preview album…' : 'Menyiapkan preview album…');
        const { prepareArchivePreviews } = await import('@/lib/archive-preview-upload');
        const previews = await prepareArchivePreviews(prepared);
        form.set('card', previews.card, 'card.webp'); form.set('large', previews.large, 'large.webp');
        if (previews.motion) form.set('motion', previews.motion, 'motion.mp4');
      }
      const response = await fetch(`/api/admin/editor/media/${slot}?section=${section}`, { method: 'POST', body: form });
      const result = await response.json().catch(()=>({error:response.status===413?(gif?'GIF maksimal 20 MB.':'Foto yang disiapkan terlalu besar. Coba versi JPG.'):'Upload belum bisa diproses. Coba lagi.'})) as { key?: string; url?: string; error?: string; previewMode?: string };
      if (!response.ok || !result.key || !result.url) throw new Error(result.error || 'Upload gagal.');
      setDraftMedia(current => ({ ...current, [slot]: result.key! })); setPhotoUrls(current => ({ ...current, [slot]: result.url! }));
      notify(`${gif?'GIF':'Foto'} siap di editor.${gif && result.previewMode === 'still' ? ' Browser ini menyiapkan preview foto; GIF asli tetap tersedia saat dibuka besar.' : ''} Klik Tayangkan perubahan agar muncul di website.`);
    } catch (error) { notify(error instanceof Error ? error.message : 'Upload gagal.'); } finally { setBusy(false); }
  }
  async function removePhoto(slot: string) { setDraftMedia(current => ({ ...current, [slot]: null })); setPhotoUrls(current => { const next = { ...current }; delete next[slot]; return next; }); }
  const update = (key: string, value: string) => setData(current => current ? { ...current, values: { ...current.values, [key]: value } } : null);
  const updateBlock = (kind: keyof WebsiteBlocks, index: number, field: string, value: unknown) => setBlocks(current => current ? { ...current, [kind]: current[kind].map((row, i) => i === index ? { ...row, [field]: value } : row) } : current);
  const remove = (kind: keyof WebsiteBlocks, index: number) => setBlocks(current => current ? { ...current, [kind]: current[kind].filter((_, i) => i !== index) } : current);
  const move = (kind: keyof WebsiteBlocks, index: number, offset: number) => setBlocks(current => {
    if (!current) return current; const rows = [...current[kind]], target = index + offset; if (target < 0 || target >= rows.length) return current;
    [rows[index], rows[target]] = [rows[target], rows[index]]; return { ...current, [kind]: rows };
  });
  const add = (kind: keyof WebsiteBlocks) => setBlocks(current => {
    if (!current || current[kind].length >= (kind==='photos'?MAX_ALBUM_PHOTOS:24)) return current; const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
    const item = kind === 'photos' ? { id, slot: `gallery-${crypto.randomUUID().slice(0, 8)}`, caption: { en: '', id: '' }, homepage: false } : { id, title: { en: '', id: '' }, body: { en: '', id: '' }, ...(kind === 'links' ? { href: '/archive' } : {}) };
    return { ...current, [kind]: [...current[kind], item] };
  });
  function localized(value: Localized, onChange: (value: Localized) => void, label: string, max = 2000, rich = false) {
    if(rich)return <div className="cms-localized-field"><span>{label}</span><RichTextField label={`${label} · ${editLanguage === 'id' ? 'Indonesia' : 'English'}`} value={value[editLanguage]} limit={max} disabled={busy||!editorReady} onChange={text=>onChange({...value,[editLanguage]:text})}/></div>;
    return <label className="cms-localized-field">{label}<textarea aria-label={`${label} · ${editLanguage === 'id' ? 'Indonesia' : 'English'}`} value={value[editLanguage]} maxLength={max} rows={3} onChange={event => onChange({ ...value, [editLanguage]: event.target.value })} /></label>;
  }
  function chooseSection(next: string) {
    if (publishingDirty || externalDirty) { notify('Simpan perubahan atau draf sebelum pindah section.'); return; }
    if (next !== section) { setEditorReady(false); setEditorial(null); setSection(next); }
    const nextMode = defaultEditorMode(next); setMode(nextMode); onModeChange?.(nextMode); setQuery('');
  }
  function chooseMode(next: string) {
    if (externalDirty) { notify('Simpan form yang sedang diedit sebelum berpindah tab.'); return; }
    setMode(next); onModeChange?.(next);
  }
  const selected = data?.editorSections.find(item => item.id === section), fieldGroups = selected ? groupEditorFields(selected, query, data?.values) : [];
  const direct = directSaveMode(mode), languageName = editLanguage === 'id' ? 'Indonesia' : 'English';
  const localizedMode = ['copy', 'arrival', 'story', 'faq', 'photos', 'links'].includes(mode);
  const tools = selected?.tools.flatMap(tool => tool === 'gifts' ? ['gifts', 'transfers'] : [tool]) ?? [];
  return <section className="admin-panel admin-wide cms-content-manager cms-workspace-v3">
    <header className="cms-section-heading"><div><h2>Edit website</h2><p>Pilih bagian undangan, ubah isinya, lalu lihat hasilnya.</p></div><a className="cms-button" href="/" target="_blank" rel="noreferrer">Buka website</a></header>
    {!data || !blocks ? <div role={loadError ? 'alert' : 'status'}>{loadError ? <><p>{loadError}</p><button type="button" onClick={() => { setLoadError(''); setLoadAttempt(attempt => attempt + 1); }}>Muat ulang</button></> : 'Memuat editor…'}</div> : <div className="cms-editor-shell">
      <nav className="cms-section-nav" aria-label="Bagian website">{data.editorSections.map(item => <button key={item.id} type="button" aria-current={section === item.id ? 'page' : undefined} disabled={busy} onClick={() => chooseSection(item.id)}><span>{item.label}</span><small>{sectionNavHint(item.id)}</small></button>)}</nav>
      <div className="cms-editor-content">
        <header className="cms-current-section"><div><h3>{selected?.label}</h3><p>{sectionHelp(section)}</p></div><a href={sectionWebsiteTarget(section)} target="_blank" rel="noreferrer">Lihat di website ↗</a></header>
        {section === 'gift' && !giftsEnabled && <p className="cms-editor-conflict" role="status">Section Tanda kasih sedang dinonaktifkan. Isian tetap tersimpan, tetapi belum terlihat di website. <button type="button" onClick={() => onOpenArea?.('pengaturan')}>Buka pengaturan hadiah</button></p>}
        {section === 'profil' && !config.profilesEnabled && <p className="cms-editor-conflict" role="status">Profil sedang disembunyikan. Aktifkan melalui Hari, kedatangan & FAQ → Jadwal & lokasi.</p>}
        <div className="cms-subtabs" role="tablist" aria-label="Isi bagian website">
          {section !== 'jukebox' && section !== 'seo' && <button type="button" role="tab" aria-selected={mode === 'copy'} className={mode === 'copy' ? 'on' : ''} onClick={() => chooseMode('copy')}>Teks & tombol</button>}
          {tools.map(tool => <button key={tool} type="button" role="tab" aria-selected={mode === tool} className={mode === tool ? 'on' : ''} onClick={() => chooseMode(tool)}>{section === 'seo' && tool === 'event' ? 'Judul & gambar share' : toolLabels[tool]}</button>)}
        </div>
        {!direct && localizedMode && <div className="cms-editor-language"><div className="cms-language-tabs" role="group" aria-label="Bahasa yang diedit"><button type="button" aria-pressed={editLanguage === 'id'} onClick={() => setEditLanguage('id')}>Indonesia</button><button type="button" aria-pressed={editLanguage === 'en'} onClick={() => setEditLanguage('en')}>English</button></div><small>Yang diubah hanya versi {languageName}.</small></div>}
        {mode === 'event' && <p className="cms-reset-help">{section === 'seo' ? 'Judul, deskripsi, dan gambar share ini digunakan untuk kedua bahasa.' : 'Tanggal, jadwal, nama pendek, dan lokasi berlaku untuk kedua bahasa.'}</p>}
        {direct ? <p className="cms-direct-save-note">Tab ini memakai tombol simpan sendiri. Setelah disimpan, perubahan langsung diterapkan ke website.</p> : editorial && editorReady ? <SectionPublishing key={section} state={editorial} snapshot={editorSnapshot} busy={busy} language={editLanguage} onAction={editorialAction} notify={notify} onCancelEdits={() => { applySnapshot(editorial.document.draft ?? editorial.live); notify('Form kembali ke versi tersimpan.'); }} onReload={() => { if (publishingDirty) { notify('Simpan draf sebelum memuat ulang.'); return; } setEditorAttempt(attempt => attempt + 1); }} /> : <div role={editorError ? 'alert' : 'status'}>{editorError ? <><p>{editorError}</p><button type="button" onClick={() => setEditorAttempt(attempt => attempt + 1)}>Muat ulang editor</button></> : 'Memuat versi website dan draf…'}</div>}
        {direct && externalDirty && <div role="status" className="cms-form-dirty"><span>Ada perubahan pada form yang belum disimpan.</span><button type="button" onClick={() => { setDirectEditorVersion(version => version + 1); onExternalDirtyChange?.(false); notify('Form kembali ke versi tersimpan.'); }}>Batalkan perubahan form</button></div>}
        <fieldset key={direct ? `${mode}-${directEditorVersion}` : 'section-editor'} ref={formArea} className="cms-editor-fields" disabled={busy || (!direct && !editorReady)} onChange={event => {
          if (!['gifts', 'transfers', 'entries'].includes(mode)) return;
          if (event.target instanceof HTMLInputElement && event.target.type === 'file' && event.target.name !== 'photo') return;
          onExternalDirtyChange?.(true);
        }}>
          {mode === 'copy' && <>
            <label className="cms-section-search">Cari teks di bagian ini<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari judul, kalimat, atau tombol" /></label>
            {!fieldGroups.length && <p>Tidak ada teks yang cocok. Foto, jadwal, dan daftar tersedia di tab masing-masing.</p>}
            {fieldGroups.map(group => {
              const content = <div className="cms-field-group-content">{group.fields.map(field => {
                const key = editLanguage === 'id' ? `id.${field.key}` : field.key, value = data.values[key] ?? '', fallback = CONTENT_DEFAULTS[key] ?? field.value;
                return <div className="cms-copy-field" key={field.key}><span className="cms-field-heading"><span>{editorFieldLabel(field)}</span>{value !== savedValues[key] && <small>Diubah</small>}</span>{isRichTextField(field.key)?<RichTextField value={value} label={`${group.title} · ${editorFieldLabel(field)} · ${languageName}`} limit={field.limit} placeholder={fallback} disabled={busy||!editorReady} onChange={text=>update(key,text)}/>:<textarea aria-label={`${group.title} · ${editorFieldLabel(field)} · ${languageName}`} rows={field.kind === 'cta' ? 2 : 3} value={value} placeholder={fallback} maxLength={field.limit} onChange={event => update(key, event.target.value)} />}<div className="cms-field-footer"><small>{richTextPlain(value).length} / {field.limit}{!value && ' · Memakai teks bawaan'}</small><button type="button" disabled={busy || value === ''} onClick={() => update(key, '')}>Reset teks</button></div>{/\{\{[a-z]+\}\}/.test(fallback) && <small className="cms-token-help">Pertahankan {fallback.match(/\{\{[a-z]+\}\}/g)?.join(', ')}; nilainya diisi otomatis.</small>}</div>;
              })}</div>;
              return group.advanced ? <details className="cms-advanced-fields" key={group.title} open={query ? true : undefined}><summary>{group.title}<small>{group.fields.length} teks tambahan</small></summary><p>Label dan pesan untuk tombol, aksesibilitas, atau kondisi khusus. Tidak semuanya terlihat saat halaman baru dibuka.</p>{content}</details> : <section className="cms-field-group" key={group.title}><h4>{group.title}</h4>{content}</section>;
            })}
            <p className="cms-reset-help">Reset teks menggunakan wording bawaan pada bahasa yang sedang diedit. Bahasa lain tetap seperti sebelumnya.</p>
          </>}
          {mode === 'portraits' && <div className="cms-portrait-editors"><p>Animasi foto yang sekarang dipakai adalah bawaan undangan. Upload foto baru akan menggantikan animasi untuk mempelai tersebut. {PHOTO_UPLOAD_HELP}.</p><div className="cms-bilingual">{['bagas', 'iga'].map(who => <section className="cms-portrait-editor" key={who}><h4>{who === 'bagas' ? 'Bagas' : 'Iga'}</h4><img className="cms-photo-preview" src={photoUrls[who] || `/assets/profiles/${who}-portrait.webp`} alt={`Foto ${who}`} /><p>{photoUrls[who] ? 'Foto dari CMS' : 'Animasi bawaan undangan'}</p><label>{photoUrls[who] ? 'Ganti foto' : 'Upload foto pengganti'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void uploadPhoto(who, file); }} /></label>{photoUrls[who] && <button type="button" onClick={() => void removePhoto(who)}>Kembalikan animasi bawaan</button>}</section>)}</div></div>}
          {mode === 'gifts' && giftEditor}{mode === 'transfers' && transferEditor}
          {mode === 'entries' && <><p>Cerita tambahan tampil di halaman Arsip jika berstatus publik dan diterbitkan. Untuk foto dan GIF pada album, gunakan tab Foto & GIF.</p>{archiveEditor}</>}
          {mode === 'comments' && commentsEditor}{mode === 'jukebox' && jukeboxEditor}
          {mode === 'arrival' && <ArrivalEditor value={arrival} onChange={setArrival} busy={busy||!editorReady} language={editLanguage} media={photoUrls} onUpload={uploadPhoto} onRemovePhoto={removePhoto} />}
          {mode === 'event' && <div className="cms-event-editor"><section className="cms-field-group"><h4>{section === 'seo' ? 'Tampilan saat link dibagikan' : 'Tanggal & jadwal'}</h4><div className="cms-bilingual">{Object.entries(section === 'seo' ? { metaTitle: 'Judul website', metaDescription: 'Deskripsi singkat', ogImage: 'Gambar share (URL)' } : { weddingDate: 'Tanggal acara', akadTime: 'Jam akad (WIB)', receptionTime: 'Jam resepsi (WIB)' }).map(([key, label]) => <label key={key}>{label}<input type={key === 'weddingDate' ? 'date' : key.endsWith('Time') ? 'time' : 'text'} required maxLength={key === 'metaTitle' ? 180 : 500} value={String(config[key as keyof WebsiteConfig])} onChange={event => setConfig(current => ({ ...current, [key]: event.target.value }))} /></label>)}</div></section>{section !== 'seo' && <><section className="cms-field-group"><h4>Tempat acara</h4><div className="cms-bilingual">{Object.entries({ venueName: 'Nama tempat', venueCity: 'Kota', venueAddress: 'Alamat lengkap', mapsUrl: 'Link Google Maps' }).map(([key, label]) => <label key={key}>{label}<input type={key === 'mapsUrl' ? 'url' : 'text'} required maxLength={500} value={String(config[key as keyof WebsiteConfig])} onChange={event => setConfig(current => ({ ...current, [key]: event.target.value }))} /></label>)}</div><details className="cms-advanced-fields"><summary>Posisi pin pada peta</summary><p>Koordinat menentukan pin pada peta interaktif; link Google Maps adalah tujuan tombol petunjuk arah.</p><div className="cms-bilingual"><label>Bujur (longitude)<input type="number" step="any" min={-180} max={180} required value={config.longitude} onChange={event => setConfig(current => ({ ...current, longitude: Number(event.target.value) }))} /></label><label>Lintang (latitude)<input type="number" step="any" min={-90} max={90} required value={config.latitude} onChange={event => setConfig(current => ({ ...current, latitude: Number(event.target.value) }))} /></label></div></details></section><section className="cms-field-group"><h4>Nama di pembuka undangan</h4><div className="cms-bilingual"><label>Nama pendek Iga<input required maxLength={50} value={config.secondName} onChange={event => setConfig(current => ({ ...current, secondName: event.target.value }))} /></label><label>Nama pendek Bagas<input required maxLength={50} value={config.firstName} onChange={event => setConfig(current => ({ ...current, firstName: event.target.value }))} /></label></div><label className="check"><input type="checkbox" checked={config.profilesEnabled} onChange={event => setConfig(current => ({ ...current, profilesEnabled: event.target.checked }))} />Tampilkan section profil mempelai</label><details className="cms-advanced-fields"><summary>Aktivitas undangan</summary><label className="check"><input type="checkbox" checked={config.trackingEnabled} onChange={event => setConfig(current => ({ ...current, trackingEnabled: event.target.checked }))} />Catat aktivitas link undangan</label></details></section></>}</div>}
          {(['story', 'faq', 'photos', 'links'] as const).filter(kind => mode === kind).map(kind => <div className={`cms-collection-editor is-${kind}`} key={kind}><p>{kind === 'photos' ? 'Semua foto dan GIF yang ditayangkan masuk ke halaman Arsip kami. Pilihan homepage tetap seperti sekarang; foto baru hanya masuk arsip, kecuali kamu mengaktifkan Tampilkan di homepage.' : 'Isi dan urutan di sini tampil setelah klik Tayangkan perubahan.'}</p>{blocks[kind].map((raw, index) => {
            const row = raw as unknown as Record<string, unknown>;
            return <article className="cms-block" key={String(row.id)}><header className="cms-section-heading"><h4>{itemLabels[kind]} {index + 1}</h4><div className="cms-actions"><button type="button" aria-label={`Naikkan ${itemLabels[kind].toLowerCase()} ${index + 1}`} disabled={index === 0} onClick={() => move(kind, index, -1)}>Naik</button><button type="button" aria-label={`Turunkan ${itemLabels[kind].toLowerCase()} ${index + 1}`} disabled={index === blocks[kind].length - 1} onClick={() => move(kind, index, 1)}>Turun</button><button type="button" aria-label={`Hapus ${itemLabels[kind].toLowerCase()} ${index + 1}`} onClick={() => remove(kind, index)}>Hapus</button></div></header>{kind === 'photos' ? <>{photoUrls[String(row.slot)] ? <img className="cms-photo-preview" src={archiveMediaUrls(photoUrls[String(row.slot)])?.card ?? photoUrls[String(row.slot)]} loading="lazy" decoding="async" alt={`Foto ${index + 1}`} onError={event => { const original = photoUrls[String(row.slot)]; if (event.currentTarget.getAttribute('src') !== original) event.currentTarget.src = original; }} /> : <div className="cms-photo-empty">Belum ada foto</div>}<label>{photoUrls[String(row.slot)] ? 'Ganti foto / GIF' : 'Upload foto / GIF'}<input type="file" aria-label={`Upload foto ${index + 1}`} accept={ARCHIVE_PHOTO_ACCEPT} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void uploadPhoto(String(row.slot), file); }} /></label><small>{ARCHIVE_PHOTO_UPLOAD_HELP}</small><label className="check"><input type="checkbox" checked={row.homepage !== false} onChange={event => updateBlock(kind, index, 'homepage', event.target.checked)} />Tampilkan di homepage</label><small>{row.homepage !== false ? 'Homepage & Arsip kami' : 'Hanya Arsip kami'}</small>{localized(row.caption as Localized, value => updateBlock(kind, index, 'caption', value), `Caption foto ${index + 1}`, 500)}{photoUrls[String(row.slot)] && <button type="button" onClick={() => void removePhoto(String(row.slot))}>Hapus foto, pertahankan kartu</button>}</> : <>{localized(row.title as Localized, value => updateBlock(kind, index, 'title', value), `${kind === 'faq' ? 'Pertanyaan' : 'Judul'} ${index + 1}`, 200)}{localized(row.body as Localized, value => updateBlock(kind, index, 'body', value), `${kind === 'faq' ? 'Jawaban' : 'Isi'} ${index + 1}`,2000,true)}{kind === 'links' && <label>Tujuan tautan<input required value={String(row.href)} onChange={event => updateBlock(kind, index, 'href', event.target.value)} placeholder="/archive atau https://…" /></label>}</>}</article>;
          })}<div className="cms-actions"><button type="button" disabled={blocks[kind].length >= (kind==='photos'?MAX_ALBUM_PHOTOS:24)} onClick={() => add(kind)}>Tambah {itemLabels[kind].toLowerCase()}</button><small>{blocks[kind].length} dari maksimal {kind==='photos'?MAX_ALBUM_PHOTOS:24} {itemLabels[kind].toLowerCase()}</small></div></div>)}
        </fieldset>
        {section === 'keepsake' && <button className="cms-personal-message-link" type="button" onClick={() => onOpenArea?.('tamu')}>Atur pesan khusus per tamu</button>}
      </div>
    </div>}
  </section>;
}
