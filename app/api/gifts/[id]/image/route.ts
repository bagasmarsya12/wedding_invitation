import { bucket, db, logFailure, privateHeaders, requireAdmin } from '@/lib/server';
export async function GET(request: Request, {params}: {params: Promise<{id:string}>}) {
  try {
    const {id} = await params;
    if (!/^gift_[A-Za-z0-9_-]{1,100}$/.test(id)) return new Response('Not found',{status:404});
    const row = await db().prepare('SELECT m.object_key, m.content_type, g.published FROM gift_media m JOIN gifts g ON g.id = m.gift_id WHERE m.gift_id = ?').bind(id).first<{object_key:string;content_type:string;published:number}>();
    if (!row) return new Response('Not found',{status:404});
    if (!row.published && !(await requireAdmin())) return new Response('Not found',{status:404,headers:privateHeaders});
    const object = await bucket().get(row.object_key);
    if (!object) return new Response('Not found',{status:404});
    const headers = {'content-type':row.content_type,'cache-control':'public, max-age=300','x-content-type-options':'nosniff','etag':object.httpEtag,...(!row.published ? privateHeaders : {})};
    if (request.headers.get('if-none-match') === object.httpEtag) return new Response(null,{status:304,headers});
    return new Response(object.body,{headers});
  } catch (error) { logFailure('gift_image_read',error); return new Response('Image unavailable',{status:503}); }
}
