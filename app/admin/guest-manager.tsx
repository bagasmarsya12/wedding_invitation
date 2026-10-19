"use client";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_INVITATION_MESSAGE, GUEST_GROUPS } from '@/lib/invitation-message';
import { rowText as text, type AdminAction, type AdminRow } from './admin-types';
import {formatAdminTime} from '@/lib/admin-time';
import { MAX_GUEST_PARTY_LIMIT } from '@/lib/guest-limits';
import { deviceCountLabel } from '@/lib/visit-activity';

type Props={guests:AdminRow[];rsvps:AdminRow[];settings:AdminRow[];knownLinks:Record<string,string>;action:AdminAction;regenerate:(id:string)=>Promise<void>;rememberLink:(id:string,url:string)=>void;notify:(message:string)=>void;exportGuests:()=>void};
type Modal={id:string;kind:'share'|'edit'|'qr'};
export function GuestManager({guests,rsvps,settings,knownLinks,action,regenerate,rememberLink,notify,exportGuests}:Props){
  const [search,setSearch]=useState(''),[group,setGroup]=useState('all'),[attendance,setAttendance]=useState('all'),[sent,setSent]=useState('all'),[access,setAccess]=useState('active');
  const [page,setPage]=useState(0),[pageSize,setPageSize]=useState(25),[sort,setSort]=useState('name');
  const query=useDeferredValue(search.trim().toLocaleLowerCase('id'));
  const [modal,setModal]=useState<Modal|null>(null),[link,setLink]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [qr,setQr]=useState<{qrData:string;code:string}|null>(null);
  const [chosen,setChosen]=useState<Set<string>>(()=>new Set()),[bulkField,setBulkField]=useState<'sent'|'group'>('sent'),[bulkSent,setBulkSent]=useState('sent'),[bulkGroup,setBulkGroup]=useState('unassigned');
  const allCheckbox=useRef<HTMLInputElement>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const template=text(settings.find(r=>r.key==='invitation_message_template')?.value)||DEFAULT_INVITATION_MESSAGE;
  const responses=useMemo(()=>new Map(rsvps.map(r=>[text(r.guest_id),r])),[rsvps]);
  const filtered=useMemo(()=>guests.filter(row=>{
    const reply=text(responses.get(text(row.id))?.attendance)||'pending';
    return (!query||`${text(row.display_name)} ${text(row.email)}`.toLocaleLowerCase('id').includes(query))&&(group==='all'||row.guest_group===group)&&(attendance==='all'||reply===attendance)&&(sent==='all'||Boolean(row.invitation_sent_at)===(sent==='sent'))&&(access==='all'||row.status===access);
  }).sort((a,b)=>(sort==='latest'?text(b.created_at).localeCompare(text(a.created_at)):sort==='opens'?Number(b.link_opens)-Number(a.link_opens):sort==='devices'?Number(b.devices)-Number(a.devices):0)||text(a.display_name).localeCompare(text(b.display_name),'id')),[guests,responses,query,group,attendance,sent,access,sort]);
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),currentPage=Math.min(page,pages-1),visible=filtered.slice(currentPage*pageSize,(currentPage+1)*pageSize);
  const selectedIds=filtered.map(row=>text(row.id)).filter(id=>chosen.has(id));
  const visibleSelected=visible.filter(row=>chosen.has(text(row.id))).length;
  useEffect(()=>{if(allCheckbox.current)allCheckbox.current.indeterminate=visibleSelected>0&&visibleSelected<visible.length;},[visibleSelected,visible.length]);
  function selectOne(id:string){setChosen(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});}
  function selectPage(){setChosen(current=>{const next=new Set(current);for(const row of visible){if(visibleSelected===visible.length)next.delete(text(row.id));else next.add(text(row.id));}return next;});}
  async function markSent(row:AdminRow){setBusy(true);try{const result=await action('mark_invitation_sent',{id:text(row.id),sent:!row.invitation_sent_at});if(result)notify(`Status pengiriman ${text(row.display_name)} diperbarui.`);}finally{setBusy(false);}}
  async function applyBulk(){if(!selectedIds.length)return;setBusy(true);try{const result=await action('update_guests_bulk',{ids:selectedIds,field:bulkField,value:bulkField==='sent'?bulkSent==='sent':bulkGroup});if(result){setChosen(new Set());notify(`${result.updated??selectedIds.length} tamu diperbarui.`);}}finally{setBusy(false);}}
  const selected=guests.find(r=>r.id===modal?.id);
  useEffect(()=>{if(modal)dialog.current?.showModal();},[modal]);
  const close=()=>{dialog.current?.close();setModal(null);setMessage('');setError('');setQr(null);};
  function reset(){setSearch('');setGroup('all');setAttendance('all');setSent('all');setAccess('active');setPage(0);setChosen(new Set());}
  async function savedLink(row:AdminRow){
    const id=text(row.id);if(knownLinks[id])return knownLinks[id];
    if(!row.has_saved_link)throw new Error('Link lama belum tersimpan. Tempel link yang pernah dibagikan lewat menu Edit / pesan.');
    const response=await fetch(`/api/admin/invitations?id=${encodeURIComponent(id)}`,{cache:'no-store'}),result=await response.json() as {inviteUrl?:string;error?:string};
    if(!response.ok||!result.inviteUrl)throw new Error(result.error||'Link belum bisa dimuat.');rememberLink(id,result.inviteUrl);return result.inviteUrl;
  }
  async function prepare(id:string,url:string){
    const response=await fetch('/api/admin/state',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'prepare_invitation',id,inviteUrl:url})}),result=await response.json() as {message?:string;inviteUrl?:string;error?:string};
    if(!response.ok||!result.message||!result.inviteUrl)throw new Error(result.error||'Pesan belum bisa disiapkan.');rememberLink(id,result.inviteUrl);setLink(result.inviteUrl);setMessage(result.message);return result.message;
  }
  async function share(row:AdminRow,kind:'copy'|'link'|'qr'){
    setBusy(true);setError('');setMessage('');setQr(null);let url='';
    try{
      url=await savedLink(row);setLink(url);
      if(kind==='qr'){
        setModal({id:text(row.id),kind:'qr'});const token=new URL(url).pathname.split('/').at(-1)!;
        const response=await fetch(`/api/invite/${encodeURIComponent(token)}/pass`,{cache:'no-store'}),result=await response.json() as {qrData:string;code:string;error?:string};
        if(!response.ok||!result.qrData)throw new Error(result.error||'QR belum bisa dimuat.');setQr(result);
      }else{const value=kind==='copy'?await prepare(text(row.id),url):url;await navigator.clipboard.writeText(value);notify(kind==='copy'?`Pesan WA untuk ${text(row.display_name)} tersalin.`:'Link undangan tersalin.');}
    }catch(e){setError(e instanceof Error?e.message:'Aksi belum berhasil.');setLink(url);setModal({id:text(row.id),kind:'share'});}
    finally{setBusy(false);}
  }
  const note=selected?text(settings.find(r=>r.key===`guest.keepsake.${selected.id}`)?.value):'';
  let personal:{note1?:string;note2?:string}={};try{const parsed=JSON.parse(note||'{}');if(parsed&&typeof parsed==='object')personal=parsed;}catch{/* Old records keep the default greeting. */}
  return <>
    <section className="admin-panel admin-wide guest-directory">
      <header className="cms-section-heading"><div><h2>Daftar tamu</h2><p>{guests.filter(r=>r.status==='active').length} undangan aktif · {guests.filter(r=>r.status==='active'&&r.invitation_sent_at).length} ditandai sudah dikirim</p></div><button type="button" onClick={exportGuests}>Unduh CSV tamu</button></header>
      <div className="guest-filters">
        <label>Cari tamu<input type="search" placeholder="Nama atau email" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);setChosen(new Set());}} /></label>
        <label>Kelompok<select value={group} onChange={e=>{setGroup(e.target.value);setPage(0);setChosen(new Set());}}><option value="all">Semua kelompok</option>{GUEST_GROUPS.map(g=><option key={g.key} value={g.key}>{g.label}</option>)}</select></label>
        <label>RSVP<select value={attendance} onChange={e=>{setAttendance(e.target.value);setPage(0);setChosen(new Set());}}><option value="all">Semua jawaban</option><option value="pending">Belum menjawab</option><option value="yes">Hadir</option><option value="no">Berhalangan</option></select></label>
        <label>Pengiriman<select value={sent} onChange={e=>{setSent(e.target.value);setPage(0);setChosen(new Set());}}><option value="all">Semua undangan</option><option value="sent">Sudah dikirim</option><option value="not-sent">Belum dikirim</option></select></label>
        <label>Akses<select value={access} onChange={e=>{setAccess(e.target.value);setPage(0);setChosen(new Set());}}><option value="all">Semua akses</option><option value="active">Aktif</option><option value="revoked">Dicabut</option></select></label>
      </div>
      <div className="cms-filter-result"><p role="status">{filtered.length} dari {guests.length} undangan</p><div className="guest-table-tools"><label>Urutan<select value={sort} onChange={e=>{setSort(e.target.value);setPage(0);}}><option value="name">Nama A–Z</option><option value="latest">Terbaru</option><option value="opens">Paling sering dibuka</option><option value="devices">Perangkat terbanyak</option></select></label><button type="button" onClick={reset}>Hapus filter</button></div></div>
      {selectedIds.length>0&&<div className="cms-bulk-toolbar" aria-label="Aksi tamu terpilih"><div className="cms-bulk-selection"><strong role="status">{selectedIds.length} tamu dipilih</strong>{selectedIds.length<filtered.length&&filtered.length<=1000&&<button type="button" disabled={busy} onClick={()=>setChosen(new Set(filtered.map(row=>text(row.id))))}>Pilih seluruh hasil ({filtered.length})</button>}<button type="button" disabled={busy} onClick={()=>setChosen(new Set())}>Hapus pilihan</button></div><label>Ubah massal<select value={bulkField} disabled={busy} onChange={event=>setBulkField(event.target.value as 'sent'|'group')}><option value="sent">Status pengiriman</option><option value="group">Kelompok tamu</option></select></label>{bulkField==='sent'?<label>Status baru<select value={bulkSent} disabled={busy} onChange={event=>setBulkSent(event.target.value)}><option value="sent">Sudah dikirim</option><option value="not-sent">Belum dikirim</option></select></label>:<label>Kelompok baru<select value={bulkGroup} disabled={busy} onChange={event=>setBulkGroup(event.target.value)}>{GUEST_GROUPS.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label>}<button type="button" disabled={busy||selectedIds.length>1000} onClick={()=>void applyBulk()}>{busy?'Menyimpan…':`Terapkan ke ${selectedIds.length} tamu`}</button><small>Hanya tamu yang dipilih diubah. Tandai sudah dikirim setelah pesan benar-benar kamu kirim.</small></div>}
      <div className="cms-scroll-table guest-table-scroll" tabIndex={0} role="region" aria-label="Tabel tamu dan aksi undangan">
        <table className="guest-table"><caption className="sr-only">Daftar tamu, aktivitas link, status RSVP, pengiriman dan aksi undangan personal</caption><thead><tr><th scope="col" className="cms-selection-cell"><input ref={allCheckbox} type="checkbox" checked={visible.length>0&&visibleSelected===visible.length} disabled={busy||!visible.length} onChange={selectPage} aria-label="Pilih semua tamu di halaman ini"/></th>{['No.','Nama tamu','Kelompok','Kuota','RSVP','Dibuka','Perangkat*','Pengiriman','Akses','Aksi'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{visible.map((row,index)=>{const id=text(row.id),reply=responses.get(id),response=text(reply?.attendance)||'pending';return <tr key={id}>
          <td className="cms-selection-cell"><input type="checkbox" checked={chosen.has(id)} disabled={busy} onChange={()=>selectOne(id)} aria-label={`Pilih ${text(row.display_name)}`}/></td><td>{currentPage*pageSize+index+1}</td><th scope="row"><strong>{text(row.display_name)}</strong>{Boolean(row.email)&&<small>{text(row.email)}</small>}</th>
          <td>{GUEST_GROUPS.find(g=>g.key===row.guest_group)?.label||'Belum diatur'}</td><td>{text(row.party_limit)} orang</td>
          <td><span className={`cms-badge is-${response}`}>{response==='yes'?'Hadir':response==='no'?'Berhalangan':'Belum menjawab'}</span>{response==='yes'&&<small>{text(reply?.party_size)} orang</small>}</td>
          <td><strong>{Number(row.link_opens)||0} kali</strong>{Boolean(row.last_at)&&<small>{formatAdminTime(row.last_at)}</small>}</td><td>{deviceCountLabel(row)}{Number(row.unidentified_sessions)>0&&<small>Ada sesi tanpa ID perangkat</small>}</td>
          <td><button className="cms-sent-toggle" type="button" aria-pressed={Boolean(row.invitation_sent_at)} aria-label={`Tandai ${text(row.display_name)} ${row.invitation_sent_at?'belum':'sudah'} dikirim`} disabled={busy} onClick={()=>void markSent(row)}>{row.invitation_sent_at?'Sudah dikirim ✓':'Tandai sudah dikirim'}</button>{Boolean(row.invitation_sent_at)&&<small>{formatAdminTime(row.invitation_sent_at)}</small>}</td><td>{row.status==='active'?'Aktif':'Dicabut'}</td>
          <td><div className="guest-row-actions"><button className="guest-primary" type="button" disabled={busy||row.status!=='active'} onClick={()=>void share(row,'copy')} aria-label={`Salin pesan WA untuk ${text(row.display_name)}`}>Salin pesan WA</button><button type="button" disabled={busy||row.status!=='active'} onClick={()=>void share(row,'link')} aria-label={`Salin link ${text(row.display_name)}`}>Link</button><button type="button" disabled={busy||row.status!=='active'} onClick={()=>void share(row,'qr')} aria-label={`Lihat QR ${text(row.display_name)}`}>QR</button><button type="button" disabled={busy} onClick={()=>{setError('');setModal({id,kind:'edit'});}} aria-label={`Edit tamu ${text(row.display_name)}`}>Edit</button></div></td>
        </tr>;})}{!visible.length&&<tr><td colSpan={11}>Tidak ada tamu yang cocok. Hapus filter atau tambahkan tamu.</td></tr>}</tbody></table>
      </div>
      <div className="guest-pagination"><label>Baris per halaman<select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(0);}}>{[25,50,100].map(n=><option value={n} key={n}>{n}</option>)}</select></label><span>{filtered.length?currentPage*pageSize+1:0}–{Math.min((currentPage+1)*pageSize,filtered.length)} dari {filtered.length}</span><div><button type="button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Sebelumnya</button><span>{currentPage+1} / {pages}</span><button type="button" disabled={currentPage+1>=pages} onClick={()=>setPage(currentPage+1)}>Berikutnya</button></div></div>
      <p className="cms-muted">Salin pesan WA memakai template dan link personal tamu. Setelah mengirim pesan, tandai langsung di kolom Pengiriman atau pilih beberapa tamu untuk menandainya bersama.</p>
      <p className="cms-muted">Dibuka menghitung tampilan halaman link personal, termasuk buka ulang. *Perangkat adalah browser dengan ID acak tersimpan, bukan jumlah orang. Hitungan dimulai sejak fitur aktif; ≥ berarti masih ada sesi tanpa ID perangkat. Detail dan unduhan aktivitas ada di Ringkasan.</p>
    </section>
    <details className="admin-panel admin-wide cms-message-template"><summary>Template pesan WhatsApp</summary><p>Gunakan {'{{nama}}'} dan {'{{link}}'}. Opsional: {'{{tanggal}}'} dan {'{{lokasi}}'}.</p><form onSubmit={e=>{e.preventDefault();void action('set_setting',{key:'invitation_message_template',value:new FormData(e.currentTarget).get('value')});}}><label>Pesan<textarea key={template} name="value" defaultValue={template} rows={10} maxLength={2000} required /></label><button>Simpan template pesan</button></form></details>
    {modal&&selected&&<dialog ref={dialog} className="cms-share-dialog" onCancel={e=>{e.preventDefault();close();}} aria-labelledby="guest-dialog-title"><header className="cms-section-heading"><h2 id="guest-dialog-title">{modal.kind==='qr'?'QR masuk':modal.kind==='edit'?'Edit tamu':'Pesan undangan'} · {text(selected.display_name)}</h2><button type="button" onClick={close} aria-label="Tutup detail tamu">×</button></header>
      {error&&<p role="alert">{error}</p>}
      {modal.kind==='edit'&&<form onSubmit={async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));setBusy(true);try{const result=await action('update_guest',{...values,id:modal.id});if(result)close();}finally{setBusy(false);}}}>
        <label>Nama tamu<input name="displayName" defaultValue={text(selected.display_name)} maxLength={120} required /></label><label>Kuota orang<input name="partyLimit" type="number" min={1} max={MAX_GUEST_PARTY_LIMIT} defaultValue={text(selected.party_limit)} required /></label><label>Kelompok<select name="guestGroup" defaultValue={text(selected.guest_group)||'unassigned'}>{GUEST_GROUPS.map(g=><option key={g.key} value={g.key}>{g.label}</option>)}</select></label><label>Akses<select name="status" defaultValue={text(selected.status)}><option value="active">Aktif</option><option value="revoked">Dicabut</option></select></label>
        <fieldset><legend>Pesan personal di kartu kenangan</legend><p>Kosongkan keduanya untuk memakai ucapan bawaan dari section Kartu kenangan.</p><label>Baris pertama<input name="note1" maxLength={120} defaultValue={personal.note1||''} /></label><label>Baris kedua<input name="note2" maxLength={120} defaultValue={personal.note2||''} /></label></fieldset><button disabled={busy}>Simpan tamu</button>
        <div className="cms-actions"><button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{const result=await action('mark_invitation_sent',{id:modal.id,sent:!selected.invitation_sent_at});if(result)close();}finally{setBusy(false);}}}>{selected.invitation_sent_at?'Tandai belum dikirim':'Tandai sudah dikirim'}</button><button type="button" disabled={busy||selected.status!=='active'} onClick={()=>{setLink(knownLinks[modal.id]||'');setMessage('');setModal({...modal,kind:'share'});}}>Pesan / link lama</button><button type="button" disabled={busy||selected.status!=='active'} onClick={async()=>{if(!confirm('Ganti link undangan ini? Link dan QR lama akan berhenti berlaku.'))return;setBusy(true);try{await regenerate(modal.id);close();}finally{setBusy(false);}}}>Ganti link</button></div>
      </form>}
      {modal.kind==='share'&&<><p>Link tersimpan akan terisi otomatis. Jika link lama belum tersimpan, tempel link yang pernah dibagikan untuk memverifikasinya.</p><label>Link undangan personal<input type="url" value={link} onChange={e=>{setLink(e.target.value);setMessage('');setError('');}} /></label><button type="button" disabled={busy||!link.trim()} onClick={async()=>{setBusy(true);try{await prepare(modal.id,link);setError('');}catch(e){setError(e instanceof Error?e.message:'Pesan belum bisa disiapkan.');}finally{setBusy(false);}}}>Siapkan pesan</button>{message&&<><label>Pesan WA<textarea readOnly value={message} rows={10}/></label><div className="cms-actions"><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(message);notify('Pesan tersalin.');}catch{setError('Pilih dan salin pesan secara manual.');}}}>Salin pesan</button><a className="cms-button" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Buka draf WhatsApp</a></div></>}</>}
      {modal.kind==='qr'&&(qr?<><img className="cms-guest-qr" src={qr.qrData} alt={`QR masuk ${text(selected.display_name)}`}/><code>{qr.code}</code><p>Petugas penerima tamu memindai QR ini saat kedatangan.</p><a className="cms-button" href={qr.qrData} download={`qr-${text(selected.id)}.svg`}>Unduh QR</a></>:<p role="status">Menyiapkan QR…</p>)}
    </dialog>}
  </>;
}
