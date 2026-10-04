'use client';
import { Fragment, useDeferredValue, useEffect, useRef, useState } from 'react';
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
  const [copyingId,setCopyingId] = useState('');
  const [copiedId,setCopiedId] = useState('');
  const [expandedId,setExpandedId] = useState('');
  const copyInProgress = useRef(false);
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
    try { await navigator.clipboard.writeText(message); setShareError(''); notify('Pesan WA tersalin. Tempel ke WhatsApp untuk mengirim.'); }
    catch { setShareError('Pesan belum bisa disalin otomatis. Pilih dan salin teks pesan di bawah.'); }
  };
  const openShare = async (row:AdminRow) => {
    const id=text(row.id);
    setMessage('');setShareError('');setLink(knownLinks[id]||'');setSharingId(id);
    if(!knownLinks[id]&&row.has_saved_link){
      try{
        const response=await fetch(`/api/admin/invitations?id=${encodeURIComponent(id)}`,{cache:'no-store'});
        const result=await response.json() as {inviteUrl:string;error?:string};
        if(!response.ok)throw new Error(result.error);
        setLink(result.inviteUrl);rememberLink(id,result.inviteUrl);
      }catch(error){setShareError(error instanceof Error?error.message:'Link belum tersedia.');}
    }
  };
  const copyInvitation = async (row:AdminRow) => {
    if(copyInProgress.current)return;
    const id=text(row.id);
    copyInProgress.current=true;setBusy(true);setCopyingId(id);setCopiedId('');
    const prepared=fetch(`/api/admin/invitations?id=${encodeURIComponent(id)}`,{cache:'no-store'}).then(async response=>{
      const result=await response.json() as {guestId:string;inviteUrl:string;message:string;error?:string};
      if(!response.ok)throw new Error(result.error||'Pesan belum bisa disiapkan. Coba lagi.');
      if(result.guestId!==id||!result.inviteUrl||!result.message)throw new Error('Pesan tamu belum bisa diverifikasi. Muat ulang daftar tamu.');
      rememberLink(id,result.inviteUrl);
      return result;
    });
    try{
      // Keep Safari's user activation, then use the plain text path as well:
      // embedded browsers can expose write() without supporting promised data.
      let deferredWrite:Promise<void>|undefined;
      if(navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){
        deferredWrite=navigator.clipboard.write([new ClipboardItem({'text/plain':prepared.then(result=>new Blob([result.message],{type:'text/plain'}))})]);
        void deferredWrite.catch(()=>{});
      }
      const result=await prepared;
      try{
        await navigator.clipboard.writeText(result.message);
      }catch(error){
        if(!deferredWrite)throw error;
        await deferredWrite;
      }
      if(deferredWrite)await deferredWrite.catch(()=>{});
      setCopiedId(id);notify(`Pesan WA untuk ${text(row.display_name)} tersalin. Tempel ke WhatsApp untuk mengirim.`);
    }catch{
      try{
        const result=await prepared;
        setLink(result.inviteUrl);setMessage(result.message);setShareError('Pesan belum bisa disalin otomatis. Klik Salin pesan atau pilih teks di bawah.');setSharingId(id);
      }catch(error){
        setLink('');setMessage('');setShareError(error instanceof Error?error.message:'Pesan belum bisa disiapkan. Coba lagi.');setSharingId(id);
      }
    }finally{copyInProgress.current=false;setBusy(false);setCopyingId('');}
  };
  return <>
    <section className="admin-panel admin-wide guest-directory">
      <header className="cms-section-heading"><div><h2>Daftar tamu</h2><p>{guests.length} undangan · {guests.filter(row=>row.invitation_sent_at).length} ditandai sudah dikirim</p><p>Salin pesan WA untuk mendapatkan template dengan nama dan link personal tamu.</p></div><button type="button" onClick={exportGuests}>Ekspor tamu CSV</button></header>
      <div className="guest-filters">
        <label>Cari tamu<input type="search" placeholder="Nama atau email" value={search} onChange={event=>setSearch(event.target.value)} /></label>
        <label>Kelompok<select value={group} onChange={event=>setGroup(event.target.value)}><option value="all">Semua kelompok</option>{GUEST_GROUPS.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        <label>RSVP<select value={attendance} onChange={event=>setAttendance(event.target.value)}><option value="all">Semua jawaban</option><option value="pending">Belum balas</option><option value="yes">Hadir</option><option value="no">Tidak hadir</option></select></label>
        <label>Pengiriman<select value={sent} onChange={event=>setSent(event.target.value)}><option value="all">Semua undangan</option><option value="sent">Sudah dikirim</option><option value="not-sent">Belum ditandai</option></select></label>
        <label>Akses<select value={access} onChange={event=>setAccess(event.target.value)}><option value="all">Semua akses</option><option value="active">Aktif</option><option value="revoked">Dicabut</option></select></label>
      </div>
      <div className="cms-filter-result"><p role="status">Menampilkan {filtered.length} dari {guests.length} undangan</p><button type="button" onClick={()=> {setSearch('');setGroup('all');setAttendance('all');setSent('all');setAccess('all');}}>Hapus filter</button></div>
      <div className="cms-scroll-table cms-guest-table" tabIndex={0} role="region" aria-label="Tabel tamu, geser untuk melihat semua kolom">
        <table><caption className="sr-only">Daftar tamu dan pesan undangan personal</caption><thead><tr><th scope="col">Nama</th><th scope="col">Kelompok</th><th scope="col">Kuota</th><th scope="col">RSVP</th><th scope="col">Dikirim</th><th scope="col">Aksi</th></tr></thead><tbody>
        {!filtered.length && <tr><td colSpan={6}>Tidak ada tamu sesuai filter. Ubah filter atau tambahkan tamu.</td></tr>}
        {filtered.map(row=> {
          const id = text(row.id); const response = rsvpByGuest.get(id) || 'pending';
          return <Fragment key={id}><tr>
            <th scope="row"><strong>{text(row.display_name)}</strong><small>{row.status==='active'?'Aktif':'Akses dicabut'}{!row.has_saved_link&&!knownLinks[id]&&row.status==='active'?' · Link belum tersimpan':''}</small></th>
            <td>{GUEST_GROUPS.find(item=>item.key===row.guest_group)?.label||'Belum diatur'}</td><td>{text(row.party_limit)} orang</td>
            <td><span className={`cms-badge is-${response}`}>{response==='yes'?'Hadir':response==='no'?'Tidak hadir':'Belum balas'}</span></td><td>{row.invitation_sent_at?'Sudah dikirim':'Belum ditandai'}</td>
            <td><div className="cms-guest-row-actions"><button type="button" className="cms-copy-wa" disabled={row.status!=='active'||busy} onClick={()=>void copyInvitation(row)} aria-label={`Salin pesan WA untuk ${text(row.display_name)}`}>{copyingId===id?'Menyalin…':copiedId===id?'Tersalin':'Salin pesan WA'}</button><button type="button" aria-expanded={expandedId===id} aria-controls={`guest-details-${id}`} onClick={()=>setExpandedId(expandedId===id?'':id)}>Detail</button></div></td>
          </tr>{expandedId===id&&<tr id={`guest-details-${id}`} className="cms-guest-detail"><td colSpan={6}><div className="cms-guest-detail-body">
            <h3>Detail {text(row.display_name)}</h3>
            {Boolean(row.invitation_sent_at)&&<p className="cms-muted">Ditandai dikirim: {text(row.invitation_sent_at)}</p>}
            <div className="cms-actions"><button type="button" disabled={row.status!=='active'||busy} onClick={()=>void openShare(row)}>Detail pesan & link</button><button type="button" disabled={busy} onClick={async()=> {setBusy(true);try{await action('mark_invitation_sent',{id,sent:!row.invitation_sent_at});}finally{setBusy(false);}}}>{row.invitation_sent_at?'Tandai belum dikirim':'Tandai sudah dikirim'}</button><button type="button" disabled={row.status!=='active'||busy} onClick={()=>setKeepsakeId(id)}>Tulis pesan keepsake</button></div>
            <form onSubmit={async event=> {event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));setBusy(true);try{await action('update_guest',{...data,id});}finally{setBusy(false);}}}>
              <label>Nama<input name="displayName" defaultValue={text(row.display_name)} maxLength={120} required /></label><label>Kuota<input name="partyLimit" type="number" min="1" max="20" defaultValue={text(row.party_limit)} required /></label>
              <label>Kelompok<select name="guestGroup" defaultValue={text(row.guest_group) || 'unassigned'}>{GUEST_GROUPS.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
              <label>Akses<select name="status" defaultValue={text(row.status)}><option value="active">Aktif</option><option value="revoked">Dicabut</option></select></label><button disabled={busy}>Simpan tamu</button></form>
              <button type="button" disabled={busy || row.status !== 'active'} onClick={async()=> {if (!confirm('Replace this invitation link? The old link and pass stop working. Save and send the new link.')) return;setBusy(true);try{await regenerate(id);}finally{setBusy(false);}}}>Regenerate link</button>
            </div></td></tr>}</Fragment>;
        })}
        </tbody></table>
      </div>
    </section>
    <section className="admin-panel admin-wide cms-message-template"><details><summary>Template pesan WhatsApp</summary><p>Gunakan {'{{nama}}'} dan {'{{link}}'} di dalam template. Opsional: {'{{tanggal}}'} dan {'{{lokasi}}'}.</p><form onSubmit={event=> {event.preventDefault();void action('set_setting',{key:'invitation_message_template',value:new FormData(event.currentTarget).get('value')});}}><label>Pesan<textarea key={template} name="value" defaultValue={template} rows={10} maxLength={2000} required /></label><button>Simpan template pesan</button></form><p className="cms-muted">Setelah pesan dikirim di WhatsApp, tandai undangan sebagai sudah dikirim melalui Detail.</p></details></section>
    {sharingId && selected && <dialog ref={dialog} className="cms-share-dialog" onCancel={event=> {event.preventDefault();closeShare();}} aria-labelledby="share-title"><div className="cms-section-heading"><h2 id="share-title">Pesan untuk {text(selected.display_name)}</h2><button type="button" onClick={closeShare} aria-label="Tutup pesan">×</button></div><p>Link personal tamu terisi otomatis. Untuk undangan lama, tempelkan link yang sudah kamu kirim.</p><label>Link undangan personal<input autoFocus type="url" value={link} placeholder="Tempel link undangan milik tamu ini" onChange={event=> {setLink(event.target.value);setMessage('');setShareError('');}} /></label><button type="button" disabled={busy || !link.trim()} onClick={()=>void prepare()}>{busy ? 'Menyiapkan…' : 'Siapkan pesan'}</button>{shareError && <p role="alert">{shareError}</p>}{message && <><label>Pesan untuk WhatsApp<textarea readOnly rows={10} value={message} /></label><div className="cms-actions"><button type="button" onClick={()=>void copyMessage()}>Salin pesan</button><a className="cms-button" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(message)}`}>Buka WhatsApp</a></div><p className="cms-muted">Pilih penerima dan kirim di WhatsApp. Setelah itu, tandai undangan sebagai sudah dikirim melalui Detail.</p></>}</dialog>}
    {keepsakeId && <GuestKeepsakeEditor key={keepsakeId} guestId={keepsakeId} name={text(guests.find(row=>row.id===keepsakeId)?.display_name)} knownLink={knownLinks[keepsakeId]||''} rememberLink={rememberLink} notify={notify} onClose={()=>setKeepsakeId('')} />}
  </>;
}
