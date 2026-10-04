import { loadWebsite } from "@/lib/website-server";
import { apiError, db, privateHeaders, privateJson, requireAdmin, sha256 } from '@/lib/server';
import { invitationVault } from '@/lib/invitation-vault';
import { toCsv } from '@/lib/production';
import { DEFAULT_INVITATION_MESSAGE, invitationMessage } from '@/lib/invitation-message';

export async function GET(request:Request) {
  if(!await requireAdmin()) return apiError('Admin access is required.',403);
  const url=new URL(request.url), id=url.searchParams.get('id');
  const query="SELECT id,display_name,token_hash,invitation_token_enc FROM guests WHERE status='active'";
  const rows=await (id ? db().prepare(`${query} AND id=?`).bind(id) : db().prepare(`${query} ORDER BY display_name`)).all<{id:string;display_name:string;token_hash:string;invitation_token_enc:string|null}>();
  const template=(await db().prepare("SELECT value FROM settings WHERE key='invitation_message_template'").first<{value:string}>())?.value || DEFAULT_INVITATION_MESSAGE;
  const {config}=await loadWebsite();
  const links=[];
  const vault=await invitationVault();
  for(const row of rows.results) {
    const token=await vault.open(row.invitation_token_enc);
    if(token && await sha256(token)===row.token_hash) { const invitationUrl=new URL(`/invite/${token}`,url.origin).toString(); links.push({guestId:row.id,guest:row.display_name,invitationUrl,message:invitationMessage(template,row.display_name,invitationUrl,config)}); }
  }
  if(id) return links[0] ? privateJson({ok:true,guestId:links[0].guestId,inviteUrl:links[0].invitationUrl,message:links[0].message}) : apiError('Link tamu belum tersimpan atau sudah tidak aktif. Tempel link lama melalui detail pesan, atau perbarui link secara manual.',404);
  if(url.searchParams.get('export')==='csv') return new Response(toCsv([['Guest','Invitation URL','WhatsApp Message'],...links.map(l=>[l.guest,l.invitationUrl,l.message])]),{headers:{...privateHeaders,'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename=bagas-iga-invitations.csv'}});
  return privateJson({links,unavailable:rows.results.length-links.length});
}
