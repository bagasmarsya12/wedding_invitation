/** Local photo preparation. Original files are never overwritten. */
export const MAX_PHOTO_SOURCE_BYTES = 50 * 1024 * 1024;
export const MAX_PHOTO_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_ARCHIVE_GIF_BYTES = 20 * 1024 * 1024;
export const PHOTO_LONG_EDGE = 3840;
export const PHOTO_UPLOAD_HELP = 'JPG, PNG, WebP, atau AVIF · maks. 50 MB · disiapkan otomatis untuk web';
export const ARCHIVE_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif';
export const ARCHIVE_PHOTO_UPLOAD_HELP = 'Foto JPG, PNG, WebP, atau AVIF hingga 50 MB. GIF hingga 20 MB. Preview album disiapkan otomatis; file asli tetap tersedia saat dibuka besar.';
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
type PhotoOptions = {allowGif?:boolean};
export const isArchivePhotoSlot = (slot:string) => /^gallery-[a-z0-9-]{1,52}$/.test(slot);
export function isCmsPhotoKey(slot:string,key:string) {
  if(!/^[a-z0-9-]{1,60}$/.test(slot))return false;
  const types=isArchivePhotoSlot(slot)?'jpg|png|webp|avif|gif':'jpg|png|webp|avif';
  return new RegExp(`^content/(?:${slot}\\.(?:${types})|revisions/${slot}/[a-z0-9-]+\\.(?:${types}))$`).test(key);
}
export const hasGifHeader = (bytes:Uint8Array) => bytes.length>=6 && bytes[0]===71 && bytes[1]===73 && bytes[2]===70 && bytes[3]===56 && (bytes[4]===55 || bytes[4]===57) && bytes[5]===97;
export function validatePhotoSource(file: Pick<File, 'size' | 'type'>,options:PhotoOptions={}) {
  if(file.type==='image/gif'&&options.allowGif){
    if(!file.size)throw new Error('Pilih file GIF yang valid.');
    if(file.size>MAX_ARCHIVE_GIF_BYTES)throw new Error('GIF maksimal 20 MB.');
    return;
  }
  if (!file.size || !TYPES.has(file.type)) throw new Error('Pilih foto JPG, PNG, WebP, atau AVIF.');
  if (file.size > MAX_PHOTO_SOURCE_BYTES) throw new Error('Foto sumber maksimal 50 MB.');
}
export function photoUploadDimensions(width: number, height: number, limit = PHOTO_LONG_EDGE) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) throw new Error('Ukuran foto tidak terbaca.');
  const scale = Math.min(1, limit / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

type DecodedPhoto = { source: CanvasImageSource; width: number; height: number; close: () => void };
export async function decodePhoto(file: File): Promise<DecodedPhoto> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch { /* The image element covers browser-specific decoder support. */ }
  }
  const url = URL.createObjectURL(file), image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve(); image.onerror = () => reject(new Error('Foto tidak terbaca. Pilih file JPG, PNG, WebP, atau AVIF yang valid.')); image.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => { image.src = ''; URL.revokeObjectURL(url); } };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}
export function encodePhoto(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Foto belum bisa disiapkan. Coba pilih kembali.')), type, quality));
}
export async function prepareCmsPhoto(file: File,options:PhotoOptions={}): Promise<File> {
  validatePhotoSource(file,options);
  // Canvas encoding flattens animations. Keep GIF frames, timing and loop metadata byte for byte.
  if(file.type==='image/gif'){
    if(!hasGifHeader(new Uint8Array(await file.slice(0,6).arrayBuffer())))throw new Error('Pilih file GIF yang valid.');
    return file;
  }
  const image = await decodePhoto(file);
  let canvas: HTMLCanvasElement | null = null;
  try {
    const size = photoUploadDimensions(image.width, image.height);
    if (size.width === image.width && size.height === image.height && file.size <= MAX_PHOTO_UPLOAD_BYTES) return file;
    canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Browser belum bisa menyiapkan foto. Coba browser lain.');
    const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
    // Keep high quality; unusually detailed images get a smaller canvas instead of heavy compression.
    for (let edge = Math.max(size.width, size.height); edge >= Math.min(960, Math.max(size.width, size.height)); edge = Math.floor(edge * .85)) {
      const target = photoUploadDimensions(image.width, image.height, edge);
      canvas.width = target.width; canvas.height = target.height;
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
      context.drawImage(image.source, 0, 0, target.width, target.height);
      for (const quality of [.94, .90]) {
        const blob = await encodePhoto(canvas, type, quality);
        if (blob.size > 0 && blob.size <= MAX_PHOTO_UPLOAD_BYTES) {
          const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png';
          return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-web.${extension}`, { type: blob.type, lastModified: file.lastModified });
        }
      }
    }
    throw new Error('Foto ini belum bisa disiapkan untuk web. Coba versi JPG.');
  } finally {
    image.close();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}
