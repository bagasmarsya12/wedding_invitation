export const GIFT_IMAGE_TYPES: Record<string,string> = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'};
export function imageHeaderMatches(bytes: Uint8Array, type: string) {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start,end));
  if (type === 'image/jpeg') return bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/png') return [137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value);
  if (type === 'image/webp') return bytes.length > 12 && text(0,4) === 'RIFF' && text(8,12) === 'WEBP';
  if (type === 'image/avif') {
    if (text(4,8) !== 'ftyp') return false;
    for (let offset=8; offset<Math.min(bytes.length,64); offset+=4) if (['avif','avis'].includes(text(offset,offset+4))) return true;
  }
  return false;
}
