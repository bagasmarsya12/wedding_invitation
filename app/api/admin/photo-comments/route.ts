import { allowMutation,apiError,db,privateJson,randomId,readJsonBody,requireAdmin,sameOriginMutation } from '@/lib/server';
import { commentConfig,commentPhoto,commentPhotos,type CommentRow } from '@/lib/photo-comments-server';
import { commentId,commentMessage,parsePhotoKey } from '@/lib/photo-comments';

export async function GET(request:Request) {
  if(!await requireAdmin())return apiError('Akses admin diperlukan.',403);
  const url=new URL(request.url),status=url.searchParams.get('status')||'pending',photo=url.searchParams.get('photo')||'',query=(url.searchParams.get('q')||'').trim().slice(0,80);
  if(!['pending','approved','hidden','all'].includes(status)||(photo&&!parsePhotoKey(photo)))return apiError('Filter tidak valid.');
  const page=Math.min(500,Math.max(0,Number.parseInt(url.searchParams.get('page')||'0',10)||0)),conditions:string[]=[],bindings:string[]=[];
  if(status!=='all'){conditions.push('c.moderation_status=?');bindings.push(status);}
  if(photo){conditions.push('c.photo_key=?');bindings.push(photo);}
  if(query){conditions.push('(c.author_name LIKE ? OR c.message LIKE ?)');bindings.push('%'+query+'%','%'+query+'%');}
  const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
  const [config,photos,rows,total,counts]=await Promise.all([commentConfig(),commentPhotos(),db().prepare('SELECT c.*,p.moderation_status AS parent_status FROM photo_comments c LEFT JOIN photo_comments p ON p.id=c.parent_id'+where+' ORDER BY c.created_at DESC,c.id DESC LIMIT 25 OFFSET ?').bind(...bindings,page*25).all<CommentRow>(),db().prepare('SELECT COUNT(*) AS count FROM photo_comments c'+where).bind(...bindings).first<{count:number}>(),db().prepare('SELECT moderation_status AS status,COUNT(*) AS count FROM photo_comments GROUP BY moderation_status').all<{status:string;count:number}>()]);
  return privateJson({config,photos,comments:rows.results,total:total?.count||0,page,pageSize:25,counts:Object.fromEntries(counts.results.map(r=>[r.status,r.count]))});
}
export async function POST(request:Request) {
  if(!sameOriginMutation(request))return apiError('Permintaan dari halaman lain ditolak.',403);
  const admin=await requireAdmin();if(!admin)return apiError('Akses admin diperlukan.',403);
  if(!await allowMutation('admin-photo-comments',admin.userId,120,60_000))return apiError('Coba lagi sebentar.',429);
  const body=await readJsonBody(request,4096);if(!body)return apiError('Data tidak valid.');
  if(body.op==='config') {
    if(typeof body.enabled!=='boolean'||typeof body.moderation!=='boolean')return apiError('Pengaturan tidak valid.');
    await db().batch([db().prepare("INSERT INTO settings (key,value,updated_at) VALUES ('photo_comments.enabled',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(body.enabled?'on':'off'),db().prepare("INSERT INTO settings (key,value,updated_at) VALUES ('photo_comments.moderation',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(body.moderation?'on':'off')]);
  }else if(body.op==='photo') {
    const key=typeof body.photo==='string'?body.photo:'';if(typeof body.enabled!=='boolean'||!await commentPhoto(key))return apiError('Foto tidak valid.');
    await db().prepare('INSERT INTO photo_comment_settings (photo_key,enabled,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(photo_key) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at').bind(key,body.enabled?1:0).run();
  }else if(body.op==='moderate') {
    const id=commentId(body.id),status=body.status;if(!id||!['pending','approved','hidden'].includes(String(status)))return apiError('Moderasi tidak valid.');
    const result=await db().prepare("UPDATE photo_comments SET moderation_status=? WHERE id=? AND removed_at IS NULL AND (?!='approved' OR parent_id IS NULL OR EXISTS(SELECT 1 FROM photo_comments p WHERE p.id=photo_comments.parent_id AND p.moderation_status='approved' AND p.removed_at IS NULL))").bind(status,id,status).run();
    if(!result.meta.changes)return apiError('Setujui komentar utama dahulu. Komentar yang dihapus penulis tidak bisa dipulihkan.',409);
  }else if(body.op==='reply') {
    const parentId=commentId(body.id),message=commentMessage(body.message);if(!parentId||!message)return apiError('Isi balasan maksimal 600 karakter.');
    const parent=await db().prepare('SELECT * FROM photo_comments WHERE id=?').bind(parentId).first<CommentRow>();
    if(!parent||parent.parent_id||parent.moderation_status!=='approved'||parent.removed_at)return apiError('Balas komentar utama yang sudah disetujui.',409);
    const photo=await commentPhoto(parent.photo_key);if(!photo?.live)return apiError('Foto belum dipublikasikan.',409);
    try{await db().prepare("INSERT INTO photo_comments (id,photo_key,parent_id,guest_id,author_kind,author_name,message,moderation_status) VALUES (?,?,?,NULL,'couple','Iga & Bagas',?,'approved')").bind(randomId('pc'),parent.photo_key,parentId,message).run();}catch{return apiError('Komentar utama berubah. Muat ulang sebelum membalas.',409);}
  }else return apiError('Aksi tidak dikenal.');
  return privateJson({ok:true});
}
