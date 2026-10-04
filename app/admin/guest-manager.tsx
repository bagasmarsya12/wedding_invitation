'use client';
import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { DEFAULT_INVITATION_MESSAGE, GUEST_GROUPS } from '@/lib/invitation-message';
import { rowText as text, type AdminAction, type AdminRow } from './admin-types';
import {GuestKeepsakeEditor} from './guest-keepsake-editor';

type Props = {guests:AdminRow[];rsvps:AdminRow[];settings:AdminRow[];knownLinks:Record<string,string>;action:AdminAction;regenerate:(id:string)=>Promise<void>;rememberLink:(id:string,url:string)=>void;notify:(message:string)=>void;exportGuests:()=>void};
export function GuestManager({guests,rsvps,settings,knownLinks,action,regenerate,rememberLink,notify,exportGuests}:Props) {
  const [search,setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [group,setGroup] = useState('all');
  const [attendance,setAttendance] = useState('all');
  const [sent,setSent] = useState('all');
  const [access,setAccess] = useState('all');
  const [sharingId,setSharingId] = useState('');
  const [keepsakeId,setKeepsakeId] = useState('');
  const [link,setLink] = useState('');
  const [message,setMessage] = useState('');
  const [shareError,setShareError] = useState('');
  const [busy,setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const template = text(settings.find(row=>row.key === 'invitation_message_template')?.value) || DEFAULT_INVITATION_MESSAGE;
  const rsvpByGuest = new Map(rsvps.map(row=>[text(row.guest_id),text(row.attendance)]));
  const filtered = guests.filter(row=> {
    const response = rsvpByGuest.get(text(row.id)) || 'pending';
    return (!deferredSearch || `${text(row.display_name)} ${text(row.email)}`.toLowerCase().includes(deferredSearch)) &&
      (group === 'all' || row.guest_group === group) && (attendance === 'all' || response === attendance) &&
      (sent === 'all' || Boolean(row.invitation_sent_at) === (sent === 'sent')) && (access === 'all' || row.status === access);
  });
  const selected = guests.find(row=>row.id === sharingId);
  useEffect(()=> { if (sharingId) dialog.current?.showModal(); },[sharingId]);
  const closeShare = () => { dialog.current?.close(); setSharingId(''); setMessage(''); setShareError(''); };
  const prepare = async () => {
    setBusy(true); setMessage(''); setShareError('');
    try {
      const response = await fetch('/api/admin/state',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'prepare_invitation',id:sharingId,inviteUrl:link})});
      const result = await response.json() as {message?:string;inviteUrl?:string;error?:string};
      if (!response.ok || !result.message || !result.inviteUrl) throw new Error(result.error || 'Message could not be prepared.');
      setMessage(result.message); rememberLink(sharingId,result.inviteUrl);
    } catch(error) { setShareError(error instanceof Error ? error.message : 'Message could not be prepared.'); }
    finally { setBusy(false); }
  };
  const copyMessage = async () => {
    try { await navigator.clipboard.writeText(message); notify('Personal message copied.'); }
    catch { setShareError('Copy failed. Select and copy the message below.'); }
  };
  return <>
    <section className="admin-panel admin-wide guest-directory">
      <header className="cms-section-heading"><div><h2>Guest list</h2><p>{guests.length} invitations · {guests.filter(row=>row.invitation_sent_at).length} marked sent manually</p></div><button type="button" onClick={exportGuests}>Export guest CSV</button></header>
      <div className="guest-filters">
        <label>Search guests<input type="search" placeholder="Name or email" value={search} onChange={event=>setSearch(event.target.value)} /></label>
        <label>Group<select value={group} onChange={event=>setGroup(event.target.value)}><option value="all">All groups</option>{GUEST_GROUPS.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        <label>RSVP<select value={attendance} onChange={event=>setAttendance(event.target.value)}><option value="all">All replies</option><option value="pending">Pending</option><option value="yes">Attending</option><option value="no">Declined</option></select></label>
        <label>Invitation sent<select value={sent} onChange={event=>setSent(event.target.value)}><option value="all">All invitations</option><option value="sent">Marked sent</option><option value="not-sent">Not marked sent</option></select></label>
        <label>Access<select value={access} onChange={event=>setAccess(event.target.value)}><option value="all">All access</option><option value="active">Active</option><option value="revoked">Revoked</option></select></label>
      </div>
      <div className="cms-filter-result"><p role="status">Showing {filtered.length} of {guests.length} invitations</p><button type="button" onClick={()=> {setSearch('');setGroup('all');setAttendance('all');setSent('all');setAccess('all');}}>Clear filters</button></div>
      <div className="cms-guest-list">
        {!filtered.length && <p>No guests match these filters. Clear filters or create an invitation above.</p>}
        {filtered.map(row=> {
          const id = text(row.id); const response = rsvpByGuest.get(id) || 'pending';
          return <article className="cms-guest" key={id}>
            <div className="cms-guest-overview"><div><h3>{text(row.display_name)}</h3><p>{GUEST_GROUPS.find(item=>item.key === row.guest_group)?.label || 'Belum diatur'} · up to {text(row.party_limit)} guest(s)</p></div><div className="cms-statuses"><span className={`cms-badge is-${response}`}>{response === 'yes' ? 'Attending' : response === 'no' ? 'Declined' : 'RSVP pending'}</span><span className="cms-badge">{text(row.status)}</span><span className="cms-badge">{row.invitation_sent_at ? 'Marked sent' : 'Not marked sent'}</span></div></div>
            {Boolean(row.invitation_sent_at) && <p className="cms-muted">Marked manually: {text(row.invitation_sent_at)}</p>}
            <div className="cms-actions"><button type="button" disabled={row.status !== 'active' || busy} onClick={async()=> {setMessage('');setShareError('');setLink(knownLinks[id]||'');setSharingId(id);if(!knownLinks[id]&&row.has_saved_link){try{const response=await fetch(`/api/admin/invitations?id=${encodeURIComponent(id)}`,{cache:'no-store'});const result=await response.json() as {inviteUrl:string;error?:string};if(!response.ok)throw new Error(result.error);setLink(result.inviteUrl);rememberLink(id,result.inviteUrl);}catch(error){setShareError(error instanceof Error?error.message:'Link belum tersedia.');}}}}>Prepare WhatsApp message</button><button type="button" disabled={busy} onClick={async()=> {setBusy(true);try{await action('mark_invitation_sent',{id,sent:!row.invitation_sent_at});}finally{setBusy(false);}}}>{row.invitation_sent_at ? 'Mark as not sent' : 'Mark as sent manually'}</button></div>
            <button type="button" disabled={row.status!=='active'} onClick={()=>setKeepsakeId(id)}>Tulis pesan keepsake</button>
            <details><summary>Edit guest</summary><form onSubmit={async event=> {event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));setBusy(true);try{await action('update_guest',{...data,id});}finally{setBusy(false);}}}>
              <label>Name<input name="displayName" defaultValue={text(row.display_name)} maxLength={120} required /></label><label>Party limit<input name="partyLimit" type="number" min="1" max="20" defaultValue={text(row.party_limit)} required /></label>
              <label>Group<select name="guestGroup" defaultValue={text(row.guest_group) || 'unassigned'}>{GUEST_GROUPS.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
              <label>Access<select name="status" defaultValue={text(row.status)}><option value="active">Active</option><option value="revoked">Revoked</option></select></label><button disabled={busy}>Save guest</button></form>
              <button type="button" disabled={busy || row.status !== 'active'} onClick={async()=> {if (!confirm('Replace this invitation link? The old link and pass stop working. Save and send the new link.')) return;setBusy(true);try{await regenerate(id);}finally{setBusy(false);}}}>Regenerate link</button>
            </details>
          </article>;
        })}
      </div>
    </section>
    <section className="admin-panel admin-wide cms-message-template"><h2>WhatsApp message template</h2><p>Use {'{{nama}}'} and {'{{link}}'} in every message. Optional: {'{{tanggal}}'} and {'{{lokasi}}'}.</p><form onSubmit={event=> {event.preventDefault();void action('set_setting',{key:'invitation_message_template',value:new FormData(event.currentTarget).get('value')});}}><label>Message<textarea key={template} name="value" defaultValue={template} rows={10} maxLength={2000} required /></label><button>Save message template</button></form><p className="cms-muted">Opening WhatsApp prepares a draft. It does not send the message or record delivery. Mark sent after you send it yourself.</p></section>
    {sharingId && selected && <dialog ref={dialog} className="cms-share-dialog" onCancel={event=> {event.preventDefault();closeShare();}} aria-labelledby="share-title"><div className="cms-section-heading"><h2 id="share-title">Invitation for {text(selected.display_name)}</h2><button type="button" onClick={closeShare} aria-label="Close message">×</button></div><p>Use the saved private link for this guest. New links are saved encrypted and filled in automatically. Older links can be pasted here or regenerated.</p><label>Private invitation link<input autoFocus type="url" value={link} placeholder="Paste this guest’s saved invitation URL" onChange={event=> {setLink(event.target.value);setMessage('');setShareError('');}} /></label><button type="button" disabled={busy || !link.trim()} onClick={()=>void prepare()}>{busy ? 'Preparing…' : 'Verify link and prepare message'}</button>{shareError && <p role="alert">{shareError}</p>}{message && <><label>Personal message<textarea readOnly rows={10} value={message} /></label><div className="cms-actions"><button type="button" onClick={()=>void copyMessage()}>Copy message</button><a className="cms-button" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(message)}`}>Open WhatsApp draft</a></div><p className="cms-muted">Review, select the recipient, and send in WhatsApp. Return here to mark this invitation as sent.</p></>}</dialog>}
    {keepsakeId && <GuestKeepsakeEditor key={keepsakeId} guestId={keepsakeId} name={text(guests.find(row=>row.id===keepsakeId)?.display_name)} knownLink={knownLinks[keepsakeId]||''} rememberLink={rememberLink} notify={notify} onClose={()=>setKeepsakeId('')} />}
  </>;
}
