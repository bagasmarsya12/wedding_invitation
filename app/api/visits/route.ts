import { allowMutation, apiError, db, guestFromToken, privateJson, readJsonBody, sameOriginMutation, sha256 } from '@/lib/server';
import { loadWebsite } from '@/lib/website-server';

export async function POST(request:Request) {
  if(!sameOriginMutation(request)) return apiError('Request rejected.',403);
  const body=await readJsonBody(request,2048);
  if(!body || typeof body.session!=='string' || !/^[a-f0-9-]{36}$/.test(body.session) || !['home','invitation','gifts','archive','postcard'].includes(String(body.page))) return apiError('Invalid page activity.');
  if(!(await loadWebsite()).config.trackingEnabled || request.headers.get('dnt')==='1' || request.headers.get('sec-gpc')==='1') return privateJson({ok:true,recorded:false});
  const token=typeof body.token==='string'?body.token:'';
  const guest=token ? await guestFromToken(token) : null;
  if(token && !guest || body.page==='invitation' && !guest) return apiError('Invitation unavailable.',404);
  const sessionHash=await sha256(`page-session:v1:${body.session}`);
  const id=await sha256(`${sessionHash}:${guest?.id ?? 'public'}:${body.page}`);
  if(!await allowMutation('visit',id,1,10_000)) return privateJson({ok:true,recorded:false});
  await db().prepare(`INSERT INTO page_visits(id,guest_id,session_hash,page,first_at,last_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET views=page_visits.views+1,last_at=CURRENT_TIMESTAMP`).bind(id,guest?.id??null,sessionHash,body.page).run();
  return privateJson({ok:true,recorded:true});
}
