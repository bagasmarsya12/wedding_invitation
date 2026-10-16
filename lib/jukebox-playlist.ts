/** Central data contract for both the owner CMS and the public jukebox. */
export const JUKEBOX_SETTING = 'cms.jukebox';
export const MAX_JUKEBOX_TRACKS = 20;
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const JUKEBOX_SESSION_KEY = 'bagas-iga:jukebox:v1';
export const PICKED_BY = ['Bagas', 'Iga', 'Ours', 'The One'] as const;
export type PickedBy = typeof PICKED_BY[number];
export type JukeboxText = { id: string; en: string };
export const JUKEBOX_COPY = {
  title: { id: 'Our Jukebox', en: 'Our Jukebox' },
  description: { id: 'Beberapa lagu, banyak kenangan.', en: 'A few songs we kept.' },
  hint: { id: 'Putar soundtrack kami', en: 'Play our soundtrack' },
  resumeHint: { id: 'Lanjutkan soundtrack kami', en: 'Resume our soundtrack' },
  nowPlaying: { id: 'Sedang diputar', en: 'Now playing' },
  playlist: { id: 'Daftar lagu', en: 'Playlist' },
  play: { id: 'Putar musik', en: 'Play soundtrack' },
  pause: { id: 'Jeda musik', en: 'Pause soundtrack' },
  open: { id: 'Buka jukebox', en: 'Open jukebox' },
  close: { id: 'Tutup jukebox', en: 'Close jukebox' },
  previous: { id: 'Lagu sebelumnya', en: 'Previous song' },
  next: { id: 'Lagu berikutnya', en: 'Next song' },
  seek: { id: 'Posisi lagu', en: 'Seek' },
  volume: { id: 'Volume', en: 'Volume' },
  mute: { id: 'Matikan suara', en: 'Mute' },
  unmute: { id: 'Aktifkan suara', en: 'Unmute' },
  select: { id: 'Putar lagu', en: 'Play song' },
  loading: { id: 'Menyiapkan lagu…', en: 'Loading track…' },
  unavailable: { id: 'Lagu belum bisa diputar. Pilih lagu lain atau coba lagi.', en: 'Track unavailable. Choose another song or try again.' },
  bagas: { id: 'Bagas', en: 'Bagas' },
  iga: { id: 'Iga', en: 'Iga' },
  ours: { id: 'Pilihan kita', en: 'Ours' },
  theOne: { id: 'Lagu kita', en: 'The One' },
};
export type JukeboxCopyKey = keyof typeof JUKEBOX_COPY;
export type JukeboxCopy = Record<JukeboxCopyKey, JukeboxText>;
export type JukeboxTrack = {
  id: string;
  title: string;
  artist: string;
  src: string;
  artwork: string;
  pickedBy: PickedBy;
  note: JukeboxText;
  duration: number;
  enabled: boolean;
};
export type JukeboxConfig = {
  version: 1;
  enabled: boolean;
  autoplayOnOpen?: boolean;
  loop: boolean;
  defaultVolume: number;
  tracks: JukeboxTrack[];
  copy: JukeboxCopy;
};
export const JUKEBOX_DEFAULTS: JukeboxConfig = {
  version: 1, enabled: true, autoplayOnOpen: true, loop: true, defaultVolume: 0.3,
  tracks: [], copy: JUKEBOX_COPY,
};
const assetId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function isAudioAssetId(id: string): boolean { return assetId.test(id); }
export function uploadedAudioId(src: string): string | null {
  const id = src.startsWith('/api/jukebox/audio/') ? src.slice('/api/jukebox/audio/'.length) : '';
  return isAudioAssetId(id) ? id : null;
}
export function isAudioSource(src: string): boolean {
  return src === '' || !!uploadedAudioId(src) || /^\/audio\/jukebox\/[a-zA-Z0-9_-]+\.(mp3|m4a)$/.test(src);
}
function string(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) ? value.trim() : null;
}
function text(value: unknown, max: number): JukeboxText | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>, id = string(v.id, max), en = string(v.en, max);
  return id !== null && en !== null ? { id, en } : null;
}
function artworkSource(src: string): boolean {
  return src === '' || /^\/api\/admin\/media\/[a-z0-9-]{1,60}(?:\?v=[a-zA-Z0-9%_.:-]+)?$/.test(src) || /^\/(?:assets|atelier\/assets)\/[a-zA-Z0-9_/-]+\.(?:png|jpg|jpeg|webp|avif)$/.test(src);
}
/** Reject foreign audio URLs, malformed tracks and duplicate IDs before saving. */
export function validateJukeboxConfig(value: unknown): JukeboxConfig | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || typeof v.enabled !== 'boolean' || (v.autoplayOnOpen!==undefined&&typeof v.autoplayOnOpen!=='boolean') || typeof v.loop !== 'boolean' ||
    typeof v.defaultVolume !== 'number' || !Number.isFinite(v.defaultVolume) || v.defaultVolume < 0 || v.defaultVolume > 1 ||
    !Array.isArray(v.tracks) || v.tracks.length > MAX_JUKEBOX_TRACKS || !v.copy || typeof v.copy !== 'object') return null;
  const copy = {} as JukeboxCopy;
  for (const key of Object.keys(JUKEBOX_COPY) as JukeboxCopyKey[]) {
    const item = text((v.copy as Record<string, unknown>)[key], key === 'unavailable' ? 250 : 160);
    if (!item) return null;
    copy[key] = { id: item.id || JUKEBOX_COPY[key].id, en: item.en || JUKEBOX_COPY[key].en };
  }
  const ids = new Set<string>(), tracks: JukeboxTrack[] = [];
  for (const raw of v.tracks) {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Record<string, unknown>;
    const id = string(item.id, 80), title = string(item.title, 180), artist = string(item.artist, 180);
    const src = string(item.src, 240), artwork = string(item.artwork, 240), note = text(item.note, 300);
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id) || !title || artist === null || src === null ||
      !isAudioSource(src) || artwork === null || !artworkSource(artwork) || !note ||
      !PICKED_BY.includes(item.pickedBy as PickedBy) || typeof item.enabled !== 'boolean' ||
      typeof item.duration !== 'number' || !Number.isFinite(item.duration) || item.duration < 0 || item.duration > 7200) return null;
    ids.add(id);
    tracks.push({ id, title, artist, src, artwork, pickedBy: item.pickedBy as PickedBy, note, duration: item.duration, enabled: item.enabled });
  }
  return { version: 1, enabled: v.enabled, autoplayOnOpen: v.autoplayOnOpen !== false, loop: v.loop, defaultVolume: v.defaultVolume, tracks, copy };
}
export function playableTracks(config: JukeboxConfig): JukeboxTrack[] {
  return config.enabled ? config.tracks.filter(track => track.enabled && !!track.src) : [];
}
export function isJukeboxPage(path: string): boolean {
  return path === '/' || /^\/archive(?:\/[^/]+)?\/?$/.test(path) || path === '/gifts' ||
    /^\/invite\/[A-Za-z0-9_-]{24,160}(?:\/(?:gifts|mark))?\/?$/.test(path);
}
export function adjacentTrack(index: number, count: number, direction: number, loop: boolean): number | null {
  if (!count) return null;
  const next = index + direction;
  return next >= 0 && next < count ? next : loop ? ((next % count) + count) % count : null;
}
export function formatAudioTime(seconds: number): string {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
export type JukeboxSession = { trackId: string; time: number; volume: number; wantedPlaying: boolean };
export function parseJukeboxSession(raw: string | null, tracks: JukeboxTrack[], defaultVolume: number): JukeboxSession {
  const fallback: JukeboxSession = { trackId: tracks[0]?.id ?? '', time: 0, volume: defaultVolume, wantedPlaying: false };
  try {
    const value = JSON.parse(raw ?? 'null') as Partial<JukeboxSession> | null;
    if (!value || !tracks.some(track => track.id === value.trackId)) return fallback;
    return { trackId: value.trackId!, time: typeof value.time === 'number' && Number.isFinite(value.time) ? Math.max(0, Math.min(value.time, 7200)) : 0,
      volume: typeof value.volume === 'number' && Number.isFinite(value.volume) ? Math.max(0, Math.min(value.volume, 1)) : defaultVolume,
      wantedPlaying: value.wantedPlaying === true };
  } catch { return fallback; }
}
