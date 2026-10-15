export const ARCHIVE_PREVIEW_FILES = { card: 'card.webp', large: 'large.webp', motion: 'motion.mp4' } as const;
export type ArchivePreview = keyof typeof ARCHIVE_PREVIEW_FILES;
export function archivePreviewVariant(value: string | null): ArchivePreview | null {
  return value === 'card' || value === 'large' || value === 'motion' ? value : null;
}
/** Original revision keys are immutable; a new upload gets an independent preview namespace. */
export async function archivePreviewKey(originalKey: string, variant: ArchivePreview) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(originalKey));
  const hash = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  return `content/previews/archive-v1/${hash}/${ARCHIVE_PREVIEW_FILES[variant]}`;
}
/** Only CMS gallery media has derivatives. External photos and other rooms keep their existing URLs. */
export function archiveMediaUrls(src: string) {
  const [path, query = ''] = src.split('?');
  if (!/^\/api\/admin\/(?:editor\/)?media\/gallery-[a-z0-9-]+$/.test(path)) return null;
  const params = new URLSearchParams(query);
  const url = (variant: ArchivePreview) => {
    const next = new URLSearchParams(params); next.set('preview', variant);
    return `${path}?${next}`;
  };
  return { card: url('card'), large: url('large'), motion: params.get('motion') === '1' ? url('motion') : null };
}

export const MAX_PREVIEW_IMAGE_BYTES = 1024 * 1024;
export const MAX_PREVIEW_VIDEO_BYTES = 8 * 1024 * 1024;
export function previewByteRange(value: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || !size || !match[1] && !match[2]) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start <= end && start < size ? { start, end } : null;
}
export function validPreviewBytes(variant: ArchivePreview, type: string, bytes: Uint8Array) {
  if (!bytes.length || bytes.length > (variant === 'motion' ? MAX_PREVIEW_VIDEO_BYTES : MAX_PREVIEW_IMAGE_BYTES)) return false;
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (variant === 'motion') return type === 'video/mp4' && ascii(4, 8) === 'ftyp';
  return type === 'image/webp' && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
    || type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    || type === 'image/png' && bytes[0] === 137 && ascii(1, 4) === 'PNG';
}

export function previewDimensions(width: number, height: number, edge: number, even = false) {
  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) throw new Error('Ukuran foto tidak terbaca.');
  const scale = Math.min(1, edge / width, edge * 2 / height);
  const round = (n: number) => even ? Math.max(2, Math.floor(n / 2) * 2) : Math.max(1, Math.round(n));
  return { width: round(width * scale), height: round(height * scale) };
}
