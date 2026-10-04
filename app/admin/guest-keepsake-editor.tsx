'use client';
import {useEffect,useRef,useState} from 'react';
import type {GuestKeepsakeNote} from '@/lib/guest-keepsake';

export function GuestKeepsakeEditor({guestId,name,knownLink,rememberLink,notify,onClose}:{guestId:string;name:string;knownLink:string;rememberLink:(id:string,url:string)=>void;notify:(s:string)=>void;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const access=useRef({knownLink,rememberLink});
  useEffect(()=>{access.current={knownLink,rememberLink};},[knownLink,rememberLink]);
  const [note,setNote]=useState<GuestKeepsakeNote>({language:'id',frontNote:'',message:''});
  const [link,setLink]=useState(knownLink),[busy,setBusy]=useState(true),[error,setError]=useState(''),[dirty,setDirty]=useState(false),[loaded,setLoaded]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    dialog.current?.showModal();let alive=true;
    const {knownLink,rememberLink}=access.current;
    fetch(`/api/admin/keepsake?guestId=${encodeURIComponent(guestId)}`,{cache:'no-store'}).then(async r=>{const data=await r.json() as {note:GuestKeepsakeNote;error?:string};if(!r.ok)throw Error(data.error);if(alive){setNote(data.note);setLoaded(true);setBusy(false);}}).catch(e=>{if(alive){setError(e.message||'Pesan belum bisa dimuat.');setBusy(false);}});
    if(!knownLink)fetch(`/api/admin/invitations?id=${encodeURIComponent(guestId)}`,{cache:'no-store'}).then(async r=>{const data=await r.json() as {inviteUrl:string;error?:string};if(r.ok&&alive){setLink(data.inviteUrl);rememberLink(guestId,data.inviteUrl);}}).catch(()=>{});
    return()=>{alive=false;};
  },[guestId,attempt]);
  const update=(change:Partial<GuestKeepsakeNote>)=>{setNote(old=>({...old,...change}));setDirty(true);};
  const close=()=>{if(dirty&&!confirm('Tutup tanpa menyimpan pesan keepsake?'))return;dialog.current?.close();onClose();};
  const save=async()=>{
    setBusy(true);setError('');
    try{
      const r=await fetch('/api/admin/keepsake',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({guestId,note})});const data=await r.json() as {note:GuestKeepsakeNote;error?:string};if(!r.ok)throw Error(data.error);setNote(data.note);setDirty(false);notify('Pesan keepsake tersimpan. Buka ulang kartu untuk melihat hasilnya.');
    }catch(e){setError(e instanceof Error?e.message:'Penyimpanan gagal.');}finally{setBusy(false);}
  };
  const keepsakeLink=link?link.replace(/\/$/,'')+'/keepsake':'';
  return <dialog ref={dialog} className="cms-share-dialog cms-keepsake-editor" onCancel={e=>{e.preventDefault();close();}} aria-labelledby="keepsake-editor-title">
    <div className="cms-section-heading"><div><h2 id="keepsake-editor-title">Keepsake untuk {name}</h2><p>Pesan ini hanya tampil pada kartu milik tamu ini.</p></div><button type="button" onClick={close} aria-label="Tutup editor keepsake">×</button></div>
    <form onSubmit={e=>{e.preventDefault();void save();}}>
      <label>Bahasa label kartu<select value={note.language} disabled={busy||!loaded} onChange={e=>update({language:e.target.value as 'id'|'en'})}><option value="id">Indonesia</option><option value="en">English</option></select></label>
      <label>Catatan singkat di depan<textarea autoFocus value={note.frontNote} maxLength={180} rows={3} disabled={busy||!loaded} onChange={e=>update({frontNote:e.target.value})}/></label>
      <label>Pesan pribadi di belakang<textarea value={note.message} maxLength={600} rows={9} disabled={busy||!loaded} onChange={e=>update({message:e.target.value})}/></label>
      <p className="cms-muted">Isi pesan ditampilkan persis dalam bahasa yang kamu tulis. Kosongkan untuk memakai ucapan umum dari Konten → Keepsake. Tanda tangan dan semua tombol bisa diatur di Konten.</p>
      {error&&<p role="alert">{error}</p>}{!loaded&&!busy&&<button type="button" onClick={()=>{setBusy(true);setError('');setAttempt(a=>a+1);}}>Muat ulang pesan</button>}
      <button disabled={busy||!loaded}>{busy?'Menyiapkan…':'Simpan pesan keepsake'}</button>
    </form>
    {keepsakeLink?<><label>Link kartu pribadi<input readOnly value={keepsakeLink}/></label><div className="cms-actions"><a href={keepsakeLink} target="_blank" rel="noopener noreferrer">Buka kartu tamu</a><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(keepsakeLink);notify('Link keepsake disalin.');}catch{setError('Pilih dan salin link di atas.');}}}>Salin link kartu</button></div>{dirty&&<p className="cms-muted">Simpan dulu untuk melihat perubahan.</p>}</>:<p className="cms-muted">Link undangan lama belum tersimpan. Verifikasi melalui “Prepare WhatsApp message” atau buat link pengganti untuk mendapatkan link kartu ini.</p>}
  </dialog>;
}
