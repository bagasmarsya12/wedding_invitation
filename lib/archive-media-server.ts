import { archivePreviewKey, previewByteRange, type ArchivePreview } from './archive-media';
import { bucket, privateHeaders } from './server';

function conditional(response: Response, request: Request) {
  const etag = response.headers.get('etag');
  if (etag && request.headers.get('if-none-match')?.split(',').some(value => value.trim() === etag || value.trim() === '*')) {
    return new Response(null, { status: 304, headers: response.headers });
  }
  return response;
}
async function ranged(response: Response, request: Request, variant: ArchivePreview) {
  const range = request.headers.get('range');
  if (response.status !== 200 || variant !== 'motion' || !range || request.headers.has('if-range') && request.headers.get('if-range') !== response.headers.get('etag')) return response;
  const size = Number(response.headers.get('content-length')), span = previewByteRange(range, size);
  const headers = new Headers(response.headers);
  if (!span) { headers.set('content-range', `bytes */${size}`); headers.delete('content-length'); return new Response(null, { status: 416, headers }); }
  const bytes = await response.arrayBuffer();
  headers.set('content-range', `bytes ${span.start}-${span.end}/${size}`);
  headers.set('content-length', String(span.end - span.start + 1));
  return new Response(bytes.slice(span.start, span.end + 1), { status: 206, headers });
}

/** Callers resolve either the current public mapping or an authenticated private revision first. */
export async function serveArchivePreview(request: Request, originalKey: string, variant: ArchivePreview, privateView = false) {
  const key = await archivePreviewKey(originalKey, variant);
  const cacheKey = new Request(new URL(`/__archive_preview_cache/${key}`, request.url));
  let cache: Cache | undefined;
  if (!privateView) {
    try { cache = await caches.open('archive-previews-v1'); const hit = await cache.match(cacheKey); if (hit) return ranged(conditional(hit, request), request, variant); }
    catch { /* R2 remains available when the edge cache is unavailable. */ }
  }
  const object = await bucket().get(key);
  if (!object) return null;
  const response = new Response(object.body, { headers: {
    ...(privateView ? privateHeaders : { 'cache-control': 'public, max-age=300, s-maxage=86400' }),
    'content-type': object.httpMetadata?.contentType ?? (variant === 'motion' ? 'video/mp4' : 'image/webp'),
    'content-length': String(object.size),
    'etag': object.httpEtag,
    ...(variant === 'motion' ? { 'accept-ranges': 'bytes' } : {}),
    'x-content-type-options': 'nosniff',
  } });
  if (cache) { try { await cache.put(cacheKey, response.clone()); } catch { /* A cache miss does not prevent delivery. */ } }
  return ranged(conditional(response, request), request, variant);
}
