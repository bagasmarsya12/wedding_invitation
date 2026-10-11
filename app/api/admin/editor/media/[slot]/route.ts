import { bucket,allowMutation,privateHeaders,privateJson,requireAdmin,sameOriginMutation } from '@/lib/server';
import { sectionDefinition,sectionMediaSlots } from '@/lib/cms-editorial';
const TYPES:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'};
export async function POST(request:Request,{params}:{params:Promise<{slot:string}>}){
  if(!sameOriginMutation(request))return privateJson({error:'Permintaan tidak bisa diverifikasi.'},403);
  const admin=await requireAdmin();if(!admin)return privateJson({error:'Akses admin diperlukan.'},403);
  const {slot}=await params,section=new URL(request.url).searchParams.get('section')??'';
  const allowed=section==='archive'?/^gallery-[a-z0-9-]{1,52}$/.test(slot):sectionMediaSlots(section,{}).includes(slot);
  if(!sectionDefinition(section)||!allowed)return privateJson({error:'Slot foto tidak sesuai section.'},400);
  if(Number(request.headers.get('content-length'))>5*1024*1024+100_000)return privateJson({error:'Foto maksimal 5 MB.'},413);
  let form:FormData;try{form=await request.formData();}catch{return privateJson({error:'Upload belum terbaca.'},400);}
  const file=form.get('file');if(!(file instanceof File)||!TYPES[file.type]||!file.size)return privateJson({error:'Gunakan JPG, PNG, WebP, atau AVIF.'},400);
  if(file.size>5*1024*1024)return privateJson({error:'Foto maksimal 5 MB.'},413);
  if(!await allowMutation('editor-media',admin.userId,30,60_000))return privateJson({error:'Tunggu sebentar sebelum upload lagi.'},429);
  const key=`content/revisions/${slot}/${crypto.randomUUID()}.${TYPES[file.type]}`;
  try{await bucket().put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});return privateJson({ok:true,key,url:`/api/admin/editor/media/${slot}?key=${encodeURIComponent(key)}`});}
  catch{return privateJson({error:'Foto belum bisa diunggah.'},503);}
}
export async function GET(request:Request,{params}:{params:Promise<{slot:string}>}){
  if(!await requireAdmin())return privateJson({error:'Akses admin diperlukan.'},403);
  const {slot}=await params,key=new URL(request.url).searchParams.get('key')??'';
  if(!/^[a-z0-9-]{1,60}$/.test(slot)||!new RegExp(`^content/(?:${slot}\\.(?:jpg|png|webp|avif)|revisions/${slot}/[a-z0-9-]+\\.(?:jpg|png|webp|avif))$`).test(key))return privateJson({error:'Foto tidak tersedia.'},404);
  const object=await bucket().get(key);if(!object)return privateJson({error:'Foto tidak tersedia.'},404);
  return new Response(object.body,{headers:{...privateHeaders,'content-type':object.httpMetadata?.contentType??'image/webp'}});
}
