'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareCmsPhoto } from '@/lib/cms-photo-upload';
import { JUKEBOX_COPY, JUKEBOX_DEFAULTS, MAX_AUDIO_BYTES, MAX_JUKEBOX_TRACKS, PICKED_BY, formatAudioTime,
  type JukeboxConfig, type JukeboxCopyKey, type JukeboxTrack, type PickedBy } from '@/lib/jukebox-playlist';

const copyLabels: Record<JukeboxCopyKey, string> = {
  title: 'Judul panel', description: 'Pengantar', hint: 'Petunjuk putar pertama', resumeHint: 'Petunjuk melanjutkan',
  nowPlaying: 'Label lagu sekarang', playlist: 'Label playlist', play: 'Tombol putar', pause: 'Tombol jeda',
  open: 'Tombol buka panel', close: 'Tombol tutup panel', previous: 'Lagu sebelumnya', next: 'Lagu berikutnya',
  seek: 'Label posisi lagu', volume: 'Label volume', mute: 'Matikan suara', unmute: 'Aktifkan suara',
  select: 'Pilih lagu', loading: 'Status memuat', unavailable: 'Pesan audio gagal',
  bagas: 'Label pilihan Bagas', iga: 'Label pilihan Iga', ours: 'Label pilihan bersama', theOne: 'Label lagu kita',
};
function readDuration(file: File): Promise<number> {
  return new Promise(resolve => {
    const audio = new Audio(), url = URL.createObjectURL(file);
    let done = false;
    const finish = () => {
      if (done) return; done = true; clearTimeout(timeout);
      const value = Number.isFinite(audio.duration) ? audio.duration : 0;
      audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url); resolve(value);
    };
    const timeout = setTimeout(finish, 5000);
    audio.preload = 'metadata'; audio.addEventListener('loadedmetadata', finish, { once: true });
    audio.addEventListener('error', finish, { once: true }); audio.src = url;
  });
}
export function JukeboxManager({ notify }: { notify: (message: string) => void }) {
  const [config, setConfig] = useState<JukeboxConfig>(JUKEBOX_DEFAULTS), [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(''), [mode, setMode] = useState<'playlist' | 'copy'>('playlist');
  const [language, setLanguage] = useState<'id' | 'en'>('id'), [saved, setSaved] = useState('');
  const draft = useRef(config), baseline = useRef(saved);
  useEffect(() => { draft.current = config; baseline.current = saved; }, [config, saved]);
  useEffect(() => {
    let alive = true;
    fetch('/api/admin/jukebox', { cache: 'no-store' }).then(async response => {
      const result = await response.json() as { config?: JukeboxConfig; error?: string };
      if (!response.ok || !result.config) throw new Error(result.error || 'Jukebox belum bisa dimuat.');
      if (alive) { setConfig(result.config); setSaved(JSON.stringify(result.config)); setReady(true); setError(''); }
    }).catch(error => { if (alive) setError(error instanceof Error ? error.message : 'Jukebox belum bisa dimuat.'); });
    return () => { alive = false; };
  }, [attempt]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (baseline.current && JSON.stringify(draft.current) !== baseline.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, []);
  const dirty = ready && JSON.stringify(config) !== saved;
  const update = (id: string, values: Partial<JukeboxTrack>) => setConfig(current => ({ ...current,
    tracks: current.tracks.map(track => track.id === id ? { ...track, ...values } : track) }));
  function add() {
    const id = `track_${crypto.randomUUID()}`;
    setConfig(current => ({ ...current, tracks: [...current.tracks, { id, title: 'Lagu baru', artist: '', src: '', artwork: '',
      pickedBy: 'Ours', note: { id: '', en: '' }, duration: 0, enabled: true }] })); setEditing(id);
  }
  function move(index: number, direction: number) {
    setConfig(current => {
      const tracks = [...current.tracks], target = index + direction;
      if (target < 0 || target >= tracks.length) return current;
      [tracks[index], tracks[target]] = [tracks[target], tracks[index]];
      return { ...current, tracks };
    });
  }
  async function save() {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/jukebox', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ config }) });
      const result = await response.json() as { error?: string; config?: JukeboxConfig };
      if (!response.ok || !result.config) throw new Error(result.error || 'Jukebox gagal disimpan.');
      setConfig(result.config); setSaved(JSON.stringify(result.config));
      notify('Jukebox tersimpan. Buka ulang pratinjau untuk mendengarkan playlist.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Jukebox gagal disimpan.'); }
    finally { setBusy(false); }
  }
  async function upload(track: JukeboxTrack, file: File, cover: boolean) {
    if (!cover && file.size > MAX_AUDIO_BYTES) { notify('Audio maksimal 20 MB per lagu.'); return; }
    if (!cover && !/\.(mp3|m4a)$/i.test(file.name)) { notify('Pilih file MP3 atau M4A.'); return; }
    setBusy(true); notify(cover ? 'Menyiapkan cover untuk web…' : 'Mengunggah audio…');
    try {
      const form = new FormData(); form.set('file', cover ? await prepareCmsPhoto(file) : file);
      const duration = cover ? null : readDuration(file);
      const slot = `jukebox-${track.id.replace('track_', '')}`;
      const response = await fetch(cover ? `/api/admin/media/${slot}` : '/api/admin/jukebox/audio', { method: 'POST', body: form });
      const result = await response.json() as { error?: string; src?: string; url?: string };
      if (!response.ok || !(cover ? result.url : result.src)) throw new Error(result.error || 'Upload gagal.');
      if (cover) update(track.id, { artwork: result.url! });
      else update(track.id, { src: result.src!, duration: Math.min(await duration! || 0, 7200) });
      notify('File terunggah. Simpan jukebox untuk menerapkan perubahan.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Upload gagal.'); }
    finally { setBusy(false); }
  }
  const selected = config.tracks.find(track => track.id === editing);
  return <section className="admin-panel admin-wide cms-jukebox"><header className="cms-section-heading"><div><h2>Our Jukebox</h2><p>Playlist, audio, cover dan semua kata dalam satu section.</p></div><a href="/" target="_blank" rel="noreferrer">Buka pratinjau</a></header>
    {!ready ? <div>{error ? <><p role="alert">{error}</p><button type="button" onClick={() => setAttempt(n => n + 1)}>Coba muat ulang</button></> : <p role="status">Memuat jukebox…</p>}</div> : <>
      <div className="cms-jukebox-settings"><label className="check"><input type="checkbox" checked={config.enabled} disabled={busy} onChange={event => setConfig(c => ({ ...c, enabled: event.target.checked }))} />Tampilkan jukebox</label>
        <label className="check"><input type="checkbox" checked={config.loop} disabled={busy} onChange={event => setConfig(c => ({ ...c, loop: event.target.checked }))} />Ulangi playlist setelah lagu terakhir</label>
        <label>Volume awal: {Math.round(config.defaultVolume * 100)}%<input type="range" min="0" max="1" step="0.01" value={config.defaultVolume} disabled={busy} onChange={event => setConfig(c => ({ ...c, defaultVolume: Number(event.target.value) }))} /></label></div>
      <div className="cms-section-save"><span role="status">{dirty ? 'Perubahan jukebox belum disimpan' : 'Jukebox tersimpan'}</span><button type="button" disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Menyiapkan…' : 'Simpan jukebox'}</button></div>
      <nav className="cms-subtabs" aria-label="Konten jukebox"><button type="button" className={mode === 'playlist' ? 'on' : ''} onClick={() => setMode('playlist')}>Playlist & audio</button><button type="button" className={mode === 'copy' ? 'on' : ''} onClick={() => setMode('copy')}>Teks & tombol</button></nav>
      {mode === 'playlist' ? <>
        <p className="cms-muted">Urutan lagu mengikuti tabel. Lagu tanpa audio atau yang dinonaktifkan tidak muncul untuk tamu. MP3 / M4A, maksimal 20 MB per lagu; cover opsional, maksimal 50 MB dan disiapkan otomatis untuk web.</p>
        <div className="cms-jukebox-table-wrap"><table className="cms-jukebox-table"><caption>Playlist Iga &amp; Bagas ({config.tracks.length} / {MAX_JUKEBOX_TRACKS})</caption><thead><tr><th scope="col">Urutan</th><th scope="col">Lagu</th><th scope="col">Pilihan</th><th scope="col">Audio</th><th scope="col">Tampil</th><th scope="col">Aksi</th></tr></thead>
          <tbody>{config.tracks.map((track, index) => <tr key={track.id} className={editing === track.id ? 'is-editing' : ''}><td>{String(index + 1).padStart(2, '0')}</td>
            <td><strong>{track.title}</strong><small>{track.artist || 'Penyanyi belum diisi'}</small></td><td>{track.pickedBy}</td><td>{track.src ? <><span>Siap</span><small>{track.duration ? formatAudioTime(track.duration) : 'Durasi otomatis'}</small></> : 'Belum diunggah'}</td>
            <td><input type="checkbox" aria-label={`Tampilkan ${track.title}`} checked={track.enabled} disabled={busy} onChange={event => update(track.id, { enabled: event.target.checked })} /></td>
            <td><div className="cms-jukebox-actions"><button type="button" disabled={busy || !index} aria-label={`Naikkan ${track.title}`} onClick={() => move(index, -1)}>Naik</button><button type="button" disabled={busy || index === config.tracks.length - 1} aria-label={`Turunkan ${track.title}`} onClick={() => move(index, 1)}>Turun</button>
              <button type="button" disabled={busy} aria-expanded={editing === track.id} aria-controls="jukebox-track-editor" onClick={() => setEditing(editing === track.id ? '' : track.id)}>Edit</button><button type="button" disabled={busy} aria-label={`Hapus ${track.title}`} onClick={() => { setConfig(c => ({ ...c, tracks: c.tracks.filter(item => item.id !== track.id) })); if (editing === track.id) setEditing(''); }}>Hapus</button></div></td></tr>)}</tbody></table></div>
        {!config.tracks.length && <p>Belum ada lagu. Tambahkan lagu, upload audio, lalu simpan jukebox.</p>}
        <div className="cms-actions"><button type="button" disabled={busy || config.tracks.length >= MAX_JUKEBOX_TRACKS} onClick={add}>Tambah lagu</button></div>
        {selected && <section className="cms-jukebox-editor" id="jukebox-track-editor" aria-label={`Edit ${selected.title}`}><header className="cms-section-heading"><h3>Edit lagu</h3><button type="button" onClick={() => setEditing('')}>Tutup editor</button></header>
          <fieldset disabled={busy}><div className="cms-bilingual"><label>Judul lagu<input value={selected.title} maxLength={180} required onChange={event => update(selected.id, { title: event.target.value })} /></label>
            <label>Penyanyi<input value={selected.artist} maxLength={180} onChange={event => update(selected.id, { artist: event.target.value })} /></label>
            <label>Pilihan<select value={selected.pickedBy} onChange={event => update(selected.id, { pickedBy: event.target.value as PickedBy })}>{PICKED_BY.map(item => <option key={item}>{item}</option>)}</select></label>
            <label>Durasi dalam detik (otomatis saat upload)<input type="number" min="0" max="7200" step="0.1" value={selected.duration} onChange={event => update(selected.id, { duration: Number(event.target.value) })} /></label>
            <label>Catatan personal · Indonesia<textarea rows={3} maxLength={300} value={selected.note.id} onChange={event => update(selected.id, { note: { ...selected.note, id: event.target.value } })} /></label>
            <label>Catatan personal · English<textarea rows={3} maxLength={300} value={selected.note.en} onChange={event => update(selected.id, { note: { ...selected.note, en: event.target.value } })} /></label>
            <label>Upload / ganti audio<input type="file" accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(selected, file, false); }} /></label>
            <label>Upload / ganti cover (opsional)<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(selected, file, true); }} /></label></div>
            {selected.src && <div className="cms-jukebox-preview"><p>Pratinjau audio</p><audio controls preload="none" src={selected.src} /><small>{selected.src}</small></div>}
            {selected.artwork && <div className="cms-jukebox-cover"><img src={selected.artwork} width="80" height="96" alt={`Cover ${selected.title}`} /><button type="button" onClick={() => update(selected.id, { artwork: '' })}>Lepas cover</button></div>}
          </fieldset></section>}
      </> : <><div className="cms-language-tabs" role="group" aria-label="Bahasa teks jukebox"><button type="button" aria-pressed={language === 'id'} onClick={() => setLanguage('id')}>Indonesia</button><button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button></div>
        <p className="cms-muted">Teks dan label tombol kedua bahasa disimpan terpisah. Field kosong memakai wording bawaan setelah disimpan.</p>
        <div className="cms-jukebox-copy">{(Object.keys(JUKEBOX_COPY) as JukeboxCopyKey[]).map(key => <label key={key}>{copyLabels[key]}<textarea rows={2} maxLength={key === 'unavailable' ? 250 : 160} value={config.copy[key][language]} onChange={event => setConfig(c => ({ ...c, copy: { ...c.copy, [key]: { ...c.copy[key], [language]: event.target.value } } }))} disabled={busy} /></label>)}</div></>}
      <div className="cms-section-save"><span>{dirty ? 'Perubahan belum disimpan' : 'Semua perubahan tersimpan'}</span><button type="button" disabled={busy || !dirty} onClick={() => void save()}>Simpan jukebox</button></div>
    </>}
  </section>;
}
