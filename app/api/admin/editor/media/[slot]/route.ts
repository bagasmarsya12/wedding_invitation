import { bucket,allowMutation,privateHeaders,privateJson,requireAdmin,sameOriginMutation } from '@/lib/server';
import { sectionDefinition,sectionMediaSlots } from '@/lib/cms-editorial';
import { MAX_PHOTO_UPLOAD_BYTES,MAX_ARCHIVE_GIF_BYTES,isArchivePhotoSlot,isCmsPhotoKey,hasGifHeader } from '@/lib/cms-photo-upload';
import { archivePreviewKey, archivePreviewVariant, validPreviewBytes, MAX_PREVIEW_IMAGE_BYTES, MAX_PREVIEW_VIDEO_BYTES, type ArchivePreview } from '@/lib/archive-media';
import { serveArchivePreview } from '@/lib/archive-media-server';
const TYPES:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif','image/gif':'gif'};
export async function POST(request:Request,{params}:{params:Promise<{slot:string}>}){
  if(!sameOriginMutation(request))return privateJson({error:'Permintaan tidak bisa diverifikasi.'},403);
  const admin=await requireAdmin();if(!admin)return privateJson({error:'Akses admin diperlukan.'},403);
  const {slot}=await params,section=new URL(request.url).searchParams.get('section')??'';
  const archive=section==='archive'&&isArchivePhotoSlot(slot);
  const allowed=section==='archive'?archive:sectionMediaSlots(section,{}).includes(slot);
  if(!sectionDefinition(section)||!allowed)return privateJson({error:'Slot foto tidak sesuai section.'},400);
  const limit = archive ? MAX_ARCHIVE_GIF_BYTES + MAX_PREVIEW_IMAGE_BYTES * 2 + MAX_PREVIEW_VIDEO_BYTES : MAX_PHOTO_UPLOAD_BYTES;
  if(Number(request.headers.get('content-length'))>limit+100_000)return privateJson({error:archive?'File album dan preview terlalu besar.':'Foto maksimal 5 MB.'},413);
  let form:FormData;try{form=await request.formData();}catch{return privateJson({error:'Upload belum terbaca.'},400);}
  const file=form.get('file');if(!(file instanceof File)||!TYPES[file.type]||!file.size||file.type==='image/gif'&&!archive)return privateJson({error:archive?'Gunakan JPG, PNG, WebP, AVIF, atau GIF.':'Gunakan JPG, PNG, WebP, atau AVIF.'},400);
  const gif=file.type==='image/gif';
  if(file.size>(gif?MAX_ARCHIVE_GIF_BYTES:MAX_PHOTO_UPLOAD_BYTES))return privateJson({error:gif?'GIF maksimal 20 MB.':'Foto maksimal 5 MB.'},413);
  const previews: { variant: ArchivePreview; body: ArrayBuffer; type: string }[] = [];
  for (const variant of ['card','large','motion'] as const) {
    const preview = form.get(variant);
    if (preview === null) continue;
    if (!archive || !(preview instanceof File) || variant === 'motion' && !gif) return privateJson({error:'Preview tidak sesuai foto.'},400);
    if (preview.size > (variant === 'motion' ? MAX_PREVIEW_VIDEO_BYTES : MAX_PREVIEW_IMAGE_BYTES)) return privateJson({error:'Preview terlalu besar.'},413);
    const body = await preview.arrayBuffer();
    if (!validPreviewBytes(variant, preview.type, new Uint8Array(body))) return privateJson({error:'Format preview tidak valid.'},400);
    previews.push({ variant, body, type: preview.type });
  }
  if (previews.length && (!previews.some(p=>p.variant==='card') || !previews.some(p=>p.variant==='large'))) return privateJson({error:'Preview foto belum lengkap.'},400);
  if(!await allowMutation('editor-media',admin.userId,30,60_000))return privateJson({error:'Tunggu sebentar sebelum upload lagi.'},429);
  const key=`content/revisions/${slot}/${crypto.randomUUID()}.${TYPES[file.type]}`;
  try{const body=await file.arrayBuffer();if(gif&&!hasGifHeader(new Uint8Array(body)))return privateJson({error:'Pilih file GIF yang valid.'},400);await bucket().put(key,body,{httpMetadata:{contentType:file.type}});
    await Promise.all(previews.map(async preview => bucket().put(await archivePreviewKey(key, preview.variant), preview.body, {httpMetadata:{contentType:preview.type}})));
    return privateJson({ok:true,key,url:`/api/admin/editor/media/${slot}?key=${encodeURIComponent(key)}${gif?'&motion=1':''}`,previewMode:previews.some(p=>p.variant==='motion')?'motion':previews.length?'still':'original'});}
  catch{return privateJson({error:'Foto belum bisa diunggah.'},503);}
}
export async function GET(request:Request,{params}:{params:Promise<{slot:string}>}){
  if(!await requireAdmin())return privateJson({error:'Akses admin diperlukan.'},403);
  const {slot}=await params,key=new URL(request.url).searchParams.get('key')??'';
  if(!isCmsPhotoKey(slot,key))return privateJson({error:'Foto tidak tersedia.'},404);
  const preview = archivePreviewVariant(new URL(request.url).searchParams.get('preview'));
  if (preview && isArchivePhotoSlot(slot)) {
    const response = await serveArchivePreview(request, key, preview, true);
    if (response) return response;
    if (preview === 'motion') return privateJson({error:'Preview belum tersedia.'},404);
  }
  const object=await bucket().get(key);if(!object)return privateJson({error:'Foto tidak tersedia.'},404);
  return new Response(object.body,{headers:{...privateHeaders,'content-type':object.httpMetadata?.contentType??'image/webp'}});
}
