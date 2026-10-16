import { MAX_AUDIO_BYTES } from './jukebox-playlist';

export type AudioKind = { ext: 'mp3' | 'm4a'; type: 'audio/mpeg' | 'audio/mp4' };
/** Only accept audio filenames, then identify the actual container rather than trusting MIME. */
export function audioKind(name: string, prefix: Uint8Array, size: number): AudioKind | null {
  if (size < 16 || size > MAX_AUDIO_BYTES) return null;
  const ext = name.toLowerCase().split('.').pop();
  if (ext !== 'mp3' && ext !== 'm4a') return null;
  const id3 = prefix[0] === 0x49 && prefix[1] === 0x44 && prefix[2] === 0x33 && prefix[3] < 5;
  // MPEG audio frame sync; reject AAC ADTS (MPEG layer bits are zero).
  const mpeg = prefix[0] === 0xff && (prefix[1] & 0xe0) === 0xe0 && (prefix[1] & 0x06) !== 0 && (prefix[1] & 0x18) !== 0x08;
  if (id3 || mpeg) return { ext: 'mp3', type: 'audio/mpeg' };
  if (prefix.length >= 16) {
    const tag = String.fromCharCode(...prefix.slice(4, 8));
    const boxSize = new DataView(prefix.buffer, prefix.byteOffset, prefix.byteLength).getUint32(0);
    if (tag === 'ftyp' && boxSize >= 16 && boxSize <= size && boxSize % 4 === 0) {
      const brands = [String.fromCharCode(...prefix.slice(8, 12))];
      for (let offset = 16; offset + 4 <= Math.min(boxSize, prefix.length); offset += 4) brands.push(String.fromCharCode(...prefix.slice(offset, offset + 4)));
      if (brands.some(brand => ['M4A ', 'M4B ', 'isom', 'mp41', 'mp42', 'iso2', 'iso6', 'dash'].includes(brand))) return { ext: 'm4a', type: 'audio/mp4' };
    }
  }
  return null;
}

/** Correct downloaded audio labels without re-encoding or changing the original bytes. */
export async function prepareCmsAudio(file: File): Promise<File> {
  if (file.size > MAX_AUDIO_BYTES) throw new Error('Audio maksimal 20 MB per lagu.');
  const kind = audioKind(file.name, new Uint8Array(await file.slice(0, 64).arrayBuffer()), file.size);
  if (!kind) throw new Error('Gunakan file MP3 atau M4A yang valid.');
  const name = file.name.replace(/\.(?:mp3|m4a)$/i, `.${kind.ext}`);
  return name === file.name && file.type === kind.type ? file : new File([file], name, { type: kind.type, lastModified: file.lastModified });
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
