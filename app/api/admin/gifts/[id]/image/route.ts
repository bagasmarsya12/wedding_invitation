import { allowMutation, apiError, bucket, db, logFailure, privateJson, requireAdmin, sameOriginMutation } from '@/lib/server';
import { GIFT_IMAGE_TYPES, imageHeaderMatches } from '@/lib/gift-image';

export async function POST(request: Request, {params}: {params: Promise<{id:string}>}) {
  if (!sameOriginMutation(request)) return apiError('This request could not be verified.',403);
  const admin = await requireAdmin();
  if (!admin) return apiError('Admin access is required.',403);
  try {
    const {id} = await params;
    if (!/^gift_[A-Za-z0-9_-]{1,100}$/.test(id)) return apiError('Invalid gift.',400);
    if (!(await db().prepare('SELECT id FROM gifts WHERE id = ?').bind(id).first())) return apiError('Gift not found.',404);
    if (Number(request.headers.get('content-length')) > 5.5*1024*1024) return apiError('Image is larger than 5 MB.',413);
    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) return apiError('Choose a photograph.');
    if (!file.size || file.size > 5*1024*1024) return apiError('Choose an image up to 5 MB.',413);
    const ext = GIFT_IMAGE_TYPES[file.type];
    if (!ext) return apiError('Use JPEG, PNG, WebP, or AVIF.',415);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!imageHeaderMatches(bytes,file.type)) return apiError('The image format does not match the file type.',415);
    if (!(await allowMutation('gift-image',admin.userId,30,60_000))) return apiError('Please slow down and try again shortly.',429);
    const version = crypto.randomUUID();
    const key = `gifts/${id}/${version}.${ext}`;
    const url = `/api/gifts/${id}/image?v=${version}`;
    await bucket().put(key,bytes,{httpMetadata:{contentType:file.type}});
    const now = new Date().toISOString();
    try {
      await db().batch([
        db().prepare('INSERT INTO gift_media (gift_id, object_key, content_type, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(gift_id) DO UPDATE SET object_key = excluded.object_key, content_type = excluded.content_type, updated_at = excluded.updated_at').bind(id,key,file.type,now),
        db().prepare('UPDATE gifts SET image_url = ?, updated_at = ? WHERE id = ?').bind(url,now,id),
      ]);
    } catch (error) { await bucket().delete(key); throw error; }
    return privateJson({ok:true,url});
  } catch (error) { logFailure('gift_image_upload',error); return apiError('Image could not be uploaded. Try again.',503); }
}
