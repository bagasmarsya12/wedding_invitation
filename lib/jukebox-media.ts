import { MAX_AUDIO_BYTES } from './jukebox-playlist';

export type AudioKind = { ext: 'mp3' | 'm4a'; type: 'audio/mpeg' | 'audio/mp4' };
/** Check the container signature as well as the extension, not just browser MIME. */
export function audioKind(name: string, prefix: Uint8Array, size: number): AudioKind | null {
  if (size < 16 || size > MAX_AUDIO_BYTES) return null;
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'mp3') {
    const id3 = prefix[0] === 0x49 && prefix[1] === 0x44 && prefix[2] === 0x33 && prefix[3] < 5;
    // MPEG audio frame sync; reject AAC ADTS (MPEG layer bits are zero).
    const mpeg = prefix[0] === 0xff && (prefix[1] & 0xe0) === 0xe0 && (prefix[1] & 0x06) !== 0 && (prefix[1] & 0x18) !== 0x08;
    if (id3 || mpeg) return { ext: 'mp3', type: 'audio/mpeg' };
  }
  if (ext === 'm4a' && prefix.length >= 12) {
    const tag = String.fromCharCode(...prefix.slice(4, 8));
    const brands = Array.from({ length: Math.max(0, Math.floor((prefix.length - 8) / 4)) }, (_, i) => String.fromCharCode(...prefix.slice(8 + i * 4, 12 + i * 4)));
    if (tag === 'ftyp' && brands.some(brand => ['M4A ', 'M4B ', 'isom', 'mp42', 'iso2'].includes(brand))) return { ext: 'm4a', type: 'audio/mp4' };
  }
  return null;
}
export type AudioRange = { offset: number; length: number };
/** null means no range; false means an unsatisfiable/unsupported single range. */
export function parseAudioRange(header: string | null, size: number): AudioRange | null | false {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2]) || size <= 0) return false;
  if (!match[1]) {
    const tail = Number(match[2]);
    if (!Number.isSafeInteger(tail) || tail <= 0) return false;
    const length = Math.min(tail, size);
    return { offset: size - length, length };
  }
  const offset = Number(match[1]), last = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(last) || offset >= size || last < offset) return false;
  return { offset, length: Math.min(last, size - 1) - offset + 1 };
}
