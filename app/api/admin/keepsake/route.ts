import { allowMutation,apiError,db,privateJson,readJsonBody,requireAdmin,sameOriginMutation } from '@/lib/server';
import { loadGuestKeepsake,validateGuestKeepsake } from '@/lib/guest-keepsake';

export async function GET(request:Request) {
  if(!await requireAdmin())return apiError('Admin access is required.',403);
  const id=new URL(request.url).searchParams.get('guestId');
  if(!id||!await db().prepare('SELECT id FROM guests WHERE id=?').bind(id).first())return apiError('Guest not found.',404);
  return privateJson({note:await loadGuestKeepsake(id)});
}
export async function PUT(request:Request) {
  if(!sameOriginMutation(request))return apiError('Cross-origin request rejected.',403);
  const admin=await requireAdmin();if(!admin)return apiError('Admin access is required.',403);
  const body=await readJsonBody(request,8000);
  if(!body||typeof body.guestId!=='string')return apiError('Choose a guest.');
  const note=validateGuestKeepsake(body.note);if(!note)return apiError('Check the language and text lengths: front 180, message 600 characters.');
  if(!await db().prepare('SELECT id FROM guests WHERE id=?').bind(body.guestId).first())return apiError('Guest not found.',404);
  if(!await allowMutation('admin-keepsake',admin.userId,60,60000))return apiError('Please wait before saving again.',429);
  await db().prepare('INSERT INTO settings(key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP').bind(`guest-keepsake.${body.guestId}`,JSON.stringify(note)).run();
  return privateJson({ok:true,note});
}
