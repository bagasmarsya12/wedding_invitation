import { apiError,db,privateJson,sameOriginMutation } from '@/lib/server';
import { archiveGuest } from '@/lib/photo-comments-server';
import { commentId } from '@/lib/photo-comments';
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}) {
  if(!sameOriginMutation(request))return apiError('Permintaan dari halaman lain ditolak.',403);
  const guest=await archiveGuest(request);if(!guest)return apiError('Buka link undangan personalmu.',401);
  const {id}=await params;if(!commentId(id))return apiError('Komentar tidak valid.');
  const result=await db().prepare("UPDATE photo_comments SET moderation_status='hidden',removed_at=CURRENT_TIMESTAMP WHERE id=? AND guest_id=? AND removed_at IS NULL").bind(id,guest.id).run();
  return result.meta.changes?privateJson({ok:true}):apiError('Komentar tidak ditemukan.',404);
}
