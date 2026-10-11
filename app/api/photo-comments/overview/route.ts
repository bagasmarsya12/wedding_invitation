import { apiError,privateJson } from '@/lib/server';
import { archiveGuest,commentConfig,commentCounts,commentPhotos } from '@/lib/photo-comments-server';
import { COMMENT_OVERVIEW_LIMIT,parsePhotoKey } from '@/lib/photo-comments';

export async function GET(request:Request) {
  try {
    const requested=new URL(request.url).searchParams.getAll('photo');
    if(!requested.length||requested.length>COMMENT_OVERVIEW_LIMIT||requested.some(key=>!parsePhotoKey(key)))return apiError('Foto tidak valid.');
    const keys=new Set(requested);
    const [catalog,guest,config]=await Promise.all([commentPhotos(),archiveGuest(request),commentConfig()]);
    const photos=catalog.filter(photo=>photo.live&&keys.has(photo.key));
    const counts=await commentCounts(photos.map(photo=>photo.key),guest?.id??null);
    return privateJson({viewer:guest?{name:guest.display_name}:null,requiresApproval:config.moderation,photos:Object.fromEntries(photos.map(photo=>[photo.key,{total:counts.get(photo.key)??0,enabled:config.enabled&&photo.enabled}]))});
  }catch{return apiError('Komentar belum bisa dimuat. Coba lagi.',503);}
}
