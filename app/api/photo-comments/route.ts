import { allowMutation,apiError,db,privateJson,randomId,readJsonBody,sameOriginMutation } from '@/lib/server';
import { archiveGuest,commentConfig,commentDto,commentPage,commentPhoto,type CommentRow } from '@/lib/photo-comments-server';
import { commentId,commentMessage,parsePhotoKey } from '@/lib/photo-comments';
export async function GET(request:Request) {
  try {
    const url=new URL(request.url),key=url.searchParams.get('photo')||'';if(!parsePhotoKey(key))return apiError('Foto tidak valid.');
    const [photo,guest,config]=await Promise.all([commentPhoto(key),archiveGuest(request),commentConfig()]);if(!photo?.live)return apiError('Foto belum tersedia.',404);
    const after=url.searchParams.get('after'),parent=url.searchParams.get('parent');
    if((after&&!commentId(after))||(parent&&!commentId(parent)))return apiError('Halaman komentar tidak valid.');
    const page=await commentPage(key,guest?.id??null,after,parent);
    return privateJson({photo:{key,title:photo.title},enabled:config.enabled&&photo.enabled,requiresApproval:config.moderation,viewer:guest?{name:guest.display_name}:null,...page});
  }catch{return apiError('Komentar belum bisa dimuat. Coba lagi.',503);}
}
export async function POST(request:Request) {
  if(!sameOriginMutation(request))return apiError('Permintaan dari halaman lain ditolak.',403);
  const guest=await archiveGuest(request);if(!guest)return apiError('Buka link undangan personalmu untuk ikut mengobrol.',401);
  const body=await readJsonBody(request,4096),key=typeof body?.photo==='string'?body.photo:'',message=commentMessage(body?.message);
  const parent=body?.parentId===null||body?.parentId===undefined?null:commentId(body.parentId);
  if(!parsePhotoKey(key)||!message||(body?.parentId!==null&&body?.parentId!==undefined&&!parent))return apiError('Isi komentar maksimal 600 karakter.');
  const [photo,config]=await Promise.all([commentPhoto(key),commentConfig()]);if(!photo?.live)return apiError('Foto belum tersedia.',404);
  if(!config.enabled||!photo.enabled)return apiError('Komentar baru untuk foto ini sedang ditutup.',403);
  if(!await allowMutation('photo-comment',guest.id,8,60_000))return apiError('Cerita sebelumnya sudah sampai. Coba lagi sebentar.',429);
  const id=randomId('pc');
  try {
    await db().prepare("INSERT INTO photo_comments (id,photo_key,parent_id,guest_id,author_kind,author_name,message,moderation_status) VALUES (?,?,?,?,'guest',?,?,?)").bind(id,key,parent,guest.id,guest.display_name,message,config.moderation?'pending':'approved').run();
  }catch{return apiError('Balasan hanya bisa dikirim ke komentar yang sudah disetujui.',409);}
  const row=await db().prepare('SELECT * FROM photo_comments WHERE id=?').bind(id).first<CommentRow>();
  return privateJson({comment:commentDto(row!,guest.id)},201);
}
