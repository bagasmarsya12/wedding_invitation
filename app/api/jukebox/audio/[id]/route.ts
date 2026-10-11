import { bucket, db } from '@/lib/server';
import { isAudioAssetId } from '@/lib/jukebox-playlist';
import { parseAudioRange } from '@/lib/jukebox-media';

type Context = { params: Promise<{ id: string }> };
async function serve(request: Request, context: Context, head: boolean) {
  const { id } = await context.params;
  if (!isAudioAssetId(id)) return new Response('Not found', { status: 404 });
  const row = await db().prepare('SELECT value FROM settings WHERE key=? LIMIT 1').bind(`jukebox.audio.${id}`).first<{ value: string }>();
  if (!row) return new Response('Not found', { status: 404 });
  let stored: { key: string; type: string };
  try { stored = JSON.parse(row.value); }
  catch { return new Response('Not found', { status: 404 }); }
  if (!['audio/mpeg', 'audio/mp4'].includes(stored.type) || ![`jukebox/audio/${id}.mp3`, `jukebox/audio/${id}.m4a`].includes(stored.key)) return new Response('Not found', { status: 404 });
  const info = await bucket().head(stored.key);
  if (!info) return new Response('Not found', { status: 404 });
  const headers = new Headers({ 'content-type': stored.type, 'accept-ranges': 'bytes', 'etag': info.httpEtag,
    'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' });
  const ifRange = request.headers.get('if-range');
  const range = parseAudioRange(ifRange && ifRange !== info.httpEtag ? null : request.headers.get('range'), info.size);
  if (range === false) {
    headers.set('content-range', `bytes */${info.size}`);
    return new Response(null, { status: 416, headers });
  }
  if (!range && request.headers.get('if-none-match') === info.httpEtag) return new Response(null, { status: 304, headers });
  headers.set('content-length', String(range ? range.length : info.size));
  if (range) headers.set('content-range', `bytes ${range.offset}-${range.offset + range.length - 1}/${info.size}`);
  if (head) return new Response(null, { status: range ? 206 : 200, headers });
  const object = await bucket().get(stored.key, range ? { range } : undefined);
  if (!object) return new Response('Not found', { status: 404 });
  return new Response(object.body, { status: range ? 206 : 200, headers });
}
export function GET(request: Request, context: Context) { return serve(request, context, false); }
export function HEAD(request: Request, context: Context) { return serve(request, context, true); }
