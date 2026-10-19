'use client';
import {useState,type FormEvent} from 'react';
import {rowText as text,type AdminRow,type AdminAction} from './admin-types';

export function GiftBookingEditor({gift,busy,setBusy,action,reload,notify}:{gift:AdminRow;busy:boolean;setBusy:(value:boolean)=>void;action:AdminAction;reload:()=>Promise<void>;notify:(message:string)=>void}) {
  const initialBooked=gift.status!=='available';
  const initialName=text(gift.booking_name)||text(gift.reserved_by_name);
  const initialAnonymous=Boolean(gift.booking_anonymous)||(initialBooked&&!text(gift.booking_name));
  const [booked,setBooked]=useState(initialBooked),[name,setName]=useState(initialName),[anonymous,setAnonymous]=useState(initialAnonymous),[error,setError]=useState('');
  const changed=booked!==initialBooked||name!==initialName||anonymous!==initialAnonymous;
  const displayName=anonymous||!name.trim()?'Teman terkasih':name.trim();
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');
    try {
      const result=await action(booked?'set_gift_booking':'admin_release_gift',{id:gift.id,expectedUpdatedAt:gift.updated_at,...(booked?{name,anonymous}:{})});
      if(!result){setError('Booking belum tersimpan. Muat ulang data hadiah, lalu coba lagi.');return;}
      notify(booked?`Booking ${text(gift.title)} tersimpan. Nama yang tampil: ${displayName}.`:`Booking ${text(gift.title)} dibuka kembali.`);
    } finally {setBusy(false);}
  }
  return <form className="cms-gift-booking-form" onSubmit={save}>
    <label>Status hadiah<select value={booked?'booked':'available'} disabled={busy||gift.status==='purchased'} onChange={e=>setBooked(e.target.value==='booked')}><option value="available">Tersedia · booking via WhatsApp aktif</option><option value="booked">{gift.status==='purchased'?'Sudah dibeli':'Sudah dibooking · tombol nonaktif'}</option></select></label>
    {booked&&<>
      <label className="check"><input type="checkbox" checked={anonymous} disabled={busy} onChange={e=>setAnonymous(e.target.checked)}/>Sembunyikan nama · tampilkan “Teman terkasih”</label>
      <label>{anonymous?'Nama pemesan (opsional, hanya untuk CMS)':'Nama pemesan yang ditampilkan'}<input value={name} maxLength={120} required={!anonymous} disabled={busy} onChange={e=>setName(e.target.value)} placeholder={anonymous?'Boleh dikosongkan':'Nama orang atau keluarga'}/></label>
      <p className="cms-gift-booking-preview">Di website: <strong>Sudah dibooking oleh {displayName}</strong><small>Label bahasa Inggris dan Indonesia bisa diatur pada teks Tanda kasih.</small></p>
    </>}
    {!booked&&initialBooked&&<p>Membuka booking akan mengaktifkan kembali tombol WhatsApp untuk hadiah ini.</p>}
    {gift.status==='purchased'&&<p className="cms-muted">Hadiah sudah ditandai dibeli. Nama tampilan masih bisa diubah; booking ini tidak bisa dibuka kembali.</p>}
    {error&&<p role="alert">{error} <button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{await reload();setError('');}catch{notify('Data hadiah belum bisa dimuat. Coba kembali.');}finally{setBusy(false);}}}>Muat ulang data hadiah</button></p>}
    <button disabled={busy||!changed}>{busy?'Menyimpan…':'Simpan status booking'}</button>
  </form>;
}
