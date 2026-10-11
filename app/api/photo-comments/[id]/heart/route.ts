import { allowMutation,apiError,db,privateJson,readJsonBody,sameOriginMutation } from '@/lib/server';
import { archiveGuest,commentConfig,commentPhoto,readableComment } from '@/lib/photo-comments-server';
import { commentId } from '@/lib/photo-comments';
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}) {
  if(!sameOriginMutation(request))return apiError('Permintaan dari halaman lain ditolak.',403);
  const guest=await archiveGuest(request);if(!guest)return apiError('Buka link undangan personalmu.',401);
  const {id}=await params,body=await readJsonBody(request,1024);if(!commentId(id)||typeof body?.liked!=='boolean')return apiError('Reaksi tidak valid.');
  const row=await readableComment(id);if(!row)return apiError('Komentar tidak tersedia.',404);
  const [photo,config]=await Promise.all([commentPhoto(row.photo_key),commentConfig()]);if(!photo?.live)return apiError('Foto belum tersedia.',404);
  if(!config.enabled||!photo.enabled)return apiError('Reaksi untuk foto ini sedang ditutup.',403);
  if(!await allowMutation('photo-heart',guest.id,60,60_000))return apiError('Coba lagi sebentar.',429);
  if(body.liked)await db().prepare("INSERT INTO photo_comment_hearts (comment_id,guest_id) SELECT c.id,? FROM photo_comments c WHERE c.id=? AND c.moderation_status='approved' AND c.removed_at IS NULL AND (c.parent_id IS NULL OR EXISTS(SELECT 1 FROM photo_comments p WHERE p.id=c.parent_id AND p.moderation_status='approved' AND p.removed_at IS NULL)) ON CONFLICT(comment_id,guest_id) DO NOTHING").bind(guest.id,id).run();
  else await db().prepare('DELETE FROM photo_comment_hearts WHERE comment_id=? AND guest_id=?').bind(id,guest.id).run();
  const state=await db().prepare('SELECT COUNT(*) AS hearts,MAX(CASE WHEN guest_id=? THEN 1 ELSE 0 END) AS liked FROM photo_comment_hearts WHERE comment_id=?').bind(guest.id,id).first<{hearts:number;liked:number}>();
  return privateJson({hearts:state?.hearts||0,liked:!!state?.liked});
}
