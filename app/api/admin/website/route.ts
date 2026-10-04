import { allowMutation, apiError, db, privateJson, readJsonBody, requireAdmin, sameOriginMutation } from '@/lib/server';
import { loadWebsite } from '@/lib/website-server';
import { validateWebsiteBlocks, validateWebsiteConfig } from '@/lib/website-content';

export async function GET() {
  if(!await requireAdmin()) return apiError('Admin access is required.',403);
  const [site,media]=await Promise.all([loadWebsite(),db().prepare("SELECT key,updated_at FROM settings WHERE key LIKE 'media.%'").all<{key:string;updated_at:string}>()]);
  return privateJson({...site,media:Object.fromEntries(media.results.map(row=>{const slot=row.key.slice(6);return [slot,`/api/admin/media/${slot}?v=${encodeURIComponent(row.updated_at)}`];}))});
}
export async function PUT(request:Request) {
  if(!sameOriginMutation(request)) return apiError('Cross-origin request rejected.',403);
  const admin=await requireAdmin(); if(!admin) return apiError('Admin access is required.',403);
  const body=await readJsonBody(request,200_000); if(!body) return apiError('Invalid website content.');
  const changes:{key:string;value:unknown}[]=[];
  if(body.config!==undefined) { const config=validateWebsiteConfig(body.config); if(!config) return apiError('Check event date, times, names, coordinates, and HTTPS links.'); changes.push({key:'cms.website',value:config}); }
  if(body.blocks!==undefined) { const blocks=validateWebsiteBlocks(body.blocks); if(!blocks) return apiError('Check block IDs, lengths, translations, and links. Maximum 24 items per collection.'); changes.push({key:'cms.blocks',value:blocks}); }
  if(!changes.length) return apiError('No website changes supplied.');
  if(!await allowMutation('admin-website',admin.userId,60,60_000)) return apiError('Please wait before saving again.',429);
  await db().batch(changes.map(c=>db().prepare('INSERT INTO settings (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP').bind(c.key,JSON.stringify(c.value))));
  return privateJson({ok:true});
}
