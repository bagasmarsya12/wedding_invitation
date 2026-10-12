import { bucket,allowMutation,privateHeaders,privateJson,requireAdmin,sameOriginMutation } from '@/lib/server';
import { sectionDefinition,sectionMediaSlots } from '@/lib/cms-editorial';
import { MAX_PHOTO_UPLOAD_BYTES,MAX_ARCHIVE_GIF_BYTES,isArchivePhotoSlot,isCmsPhotoKey,hasGifHeader } from '@/lib/cms-photo-upload';
const TYPES:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif','image/gif':'gif'};
export async function POST(request:Request,{params}:{params:Promise<{slot:string}>}){
  if(!sameOriginMutation(request))return privateJson({error:'Permintaan tidak bisa diverifikasi.'},403);
  const admin=await requireAdmin();if(!admin)return privateJson({error:'Akses admin diperlukan.'},403);
  const {slot}=await params,section=new URL(request.url).searchParams.get('section')??'';
  const archive=section==='archive'&&isArchivePhotoSlot(slot);
  const allowed=section==='archive'?archive:sectionMediaSlots(section,{}).includes(slot);
  if(!sectionDefinition(section)||!allowed)return privateJson({error:'Slot foto tidak sesuai section.'},400);
  if(Number(request.headers.get('content-length'))>(archive?MAX_ARCHIVE_GIF_BYTES:MAX_PHOTO_UPLOAD_BYTES)+100_000)return privateJson({error:archive?'Upload maksimal 20 MB.':'Foto maksimal 5 MB.'},413);
  let form:FormData;try{form=await request.formData();}catch{return privateJson({error:'Upload belum terbaca.'},400);}
  const file=form.get('file');if(!(file instanceof File)||!TYPES[file.type]||!file.size||file.type==='image/gif'&&!archive)return privateJson({error:archive?'Gunakan JPG, PNG, WebP, AVIF, atau GIF.':'Gunakan JPG, PNG, WebP, atau AVIF.'},400);
  const gif=file.type==='image/gif';
  if(file.size>(gif?MAX_ARCHIVE_GIF_BYTES:MAX_PHOTO_UPLOAD_BYTES))return privateJson({error:gif?'GIF maksimal 20 MB.':'Foto maksimal 5 MB.'},413);
  if(!await allowMutation('editor-media',admin.userId,30,60_000))return privateJson({error:'Tunggu sebentar sebelum upload lagi.'},429);
  const key=`content/revisions/${slot}/${crypto.randomUUID()}.${TYPES[file.type]}`;
  try{const body=await file.arrayBuffer();if(gif&&!hasGifHeader(new Uint8Array(body)))return privateJson({error:'Pilih file GIF yang valid.'},400);await bucket().put(key,body,{httpMetadata:{contentType:file.type}});return privateJson({ok:true,key,url:`/api/admin/editor/media/${slot}?key=${encodeURIComponent(key)}`});}
  catch{return privateJson({error:'Foto belum bisa diunggah.'},503);}
}
export async function GET(request:Request,{params}:{params:Promise<{slot:string}>}){
  if(!await requireAdmin())return privateJson({error:'Akses admin diperlukan.'},403);
  const {slot}=await params,key=new URL(request.url).searchParams.get('key')??'';
  if(!isCmsPhotoKey(slot,key))return privateJson({error:'Foto tidak tersedia.'},404);
  const object=await bucket().get(key);if(!object)return privateJson({error:'Foto tidak tersedia.'},404);
  return new Response(object.body,{headers:{...privateHeaders,'content-type':object.httpMetadata?.contentType??'image/webp'}});
}
