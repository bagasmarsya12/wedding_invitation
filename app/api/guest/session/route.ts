import { adminSessionSecret,allowMutation,apiError,guestFromToken,privateJson,readJsonBody,sameOriginMutation,sha256 } from '@/lib/server';
import { ARCHIVE_GUEST_COOKIE,ARCHIVE_GUEST_TTL,createArchiveGuestSession } from '@/lib/archive-guest-session';
export async function POST(request:Request) {
  if(!sameOriginMutation(request))return apiError('Permintaan dari halaman lain ditolak.',403);
  const body=await readJsonBody(request,1024);const token=typeof body?.token==='string'?body.token:'';
  const ip=request.headers.get('cf-connecting-ip')||'local';
  const guest=await guestFromToken(token);
  // Valid invitations have separate quotas, including guests sharing venue Wi-Fi.
  if(!await allowMutation('archive-session',guest?.id??'ip:'+ip,guest?12:40,60_000))return apiError('Coba lagi sebentar.',429);
  if(!guest)return apiError('Buka link undangan personal yang masih aktif.',401);
  const session=await createArchiveGuestSession({id:guest.id,hash:await sha256(token)},await adminSessionSecret());
  const response=privateJson({ok:true,name:guest.display_name});
  response.headers.set('set-cookie',ARCHIVE_GUEST_COOKIE+'='+session+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+ARCHIVE_GUEST_TTL+(new URL(request.url).protocol==='https:'?'; Secure':''));
  return response;
}
