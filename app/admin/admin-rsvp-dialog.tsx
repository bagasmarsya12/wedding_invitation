'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {formatAdminTime} from '@/lib/admin-time';
import {rowText as text,type AdminAction,type AdminRow} from './admin-types';

export function AdminRsvpDialog({guest,reply,action,notify,onClose}:{guest:AdminRow;reply?:AdminRow;action:AdminAction;notify:(message:string)=>void;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const initialAttendance=text(reply?.attendance);
  const initialSize=initialAttendance==='yes'?Number(reply?.party_size):Number(guest.party_limit);
  const [attendance,setAttendance]=useState(initialAttendance),[partySize,setPartySize]=useState(String(initialSize)),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const changed=attendance!==initialAttendance||(attendance==='yes'&&Number(partySize)!==initialSize);
  useEffect(()=>{dialog.current?.showModal();},[]);
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');
    try {
      const result=await action('set_guest_rsvp',{id:guest.id,attendance,partySize:attendance==='yes'?Number(partySize):0,expectedUpdatedAt:reply?.updated_at??null});
      if(!result){setError('Jawaban belum tersimpan. Jika datanya berubah, tutup dialog dan muat ulang sebelum mencoba lagi.');return;}
      notify(`RSVP ${text(guest.display_name)} diperbarui: ${attendance==='yes'?`hadir · ${partySize} orang`:'tidak hadir'}.`);
      onClose();
    } finally {setBusy(false);}
  }
  return <dialog ref={dialog} className="cms-share-dialog cms-rsvp-dialog" aria-labelledby="admin-rsvp-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <header className="cms-section-heading"><div><h2 id="admin-rsvp-title">Atur RSVP · {text(guest.display_name)}</h2><p>Untuk konfirmasi yang kamu terima lewat chat atau secara langsung.</p></div><button type="button" disabled={busy} onClick={onClose} aria-label="Tutup pengaturan RSVP">×</button></header>
    <p>Jawaban masuk ke daftar tamu, rekap kehadiran, dan ekspor CSV. Ini tidak menandai tamu sudah check-in.</p>
    {reply&&<p className="cms-muted">Jawaban terakhir: {initialAttendance==='yes'?'Hadir':'Tidak hadir'} · {formatAdminTime(reply.updated_at)}</p>}
    <form onSubmit={save}>
      <label>Konfirmasi kehadiran<select value={attendance} required disabled={busy} onChange={event=>setAttendance(event.target.value)}><option value="" disabled>Pilih jawaban tamu</option><option value="yes">Hadir</option><option value="no">Tidak hadir</option></select></label>
      {attendance==='yes'&&<label>Jumlah orang yang dikonfirmasi<input type="number" min={1} max={Number(guest.party_limit)} step={1} value={partySize} required disabled={busy} onChange={event=>setPartySize(event.target.value)}/><small>Kuota undangan: {text(guest.party_limit)} orang. Sesuaikan dengan konfirmasi tamu.</small></label>}
      <p className="cms-muted">Catatan dan kartu ucapan tamu tetap tersimpan. Tamu masih bisa memperbarui RSVP melalui link undangannya selama RSVP dibuka.</p>
      {error&&<p role="alert">{error}</p>}
      <div className="cms-actions"><button type="submit" disabled={busy||!attendance||!changed}>{busy?'Menyimpan…':'Simpan RSVP'}</button><button type="button" disabled={busy} onClick={onClose}>Batal</button></div>
    </form>
  </dialog>;
}
