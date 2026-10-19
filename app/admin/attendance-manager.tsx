'use client';
import {useDeferredValue,useMemo,useState} from 'react';
import {GUEST_GROUPS} from '@/lib/invitation-message';
import {formatAdminTime} from '@/lib/admin-time';
import {rowText as text,type AdminRow,type AdminAction} from './admin-types';
import {AdminRsvpDialog} from './admin-rsvp-dialog';
import {TablePagination} from './table-pagination';

type Props={action:AdminAction;guests:AdminRow[];rsvps:AdminRow[];checkins:AdminRow[];exportFile:(kind:'rsvps'|'checkins'|'backup')=>void;reload:()=>Promise<void>;notify:(message:string)=>void};
const groupLabel=(group:unknown)=>GUEST_GROUPS.find(item=>item.key===group)?.label||'Belum diatur';

export function AttendanceManager({action,guests,rsvps,checkins,exportFile,reload,notify}:Props) {
  const [search,setSearch]=useState(''),[rsvpFilter,setRsvpFilter]=useState('all'),[arrivalFilter,setArrivalFilter]=useState('all');
  const [rsvpPage,setRsvpPage]=useState(0),[arrivalPage,setArrivalPage]=useState(0),[rsvpSize,setRsvpSize]=useState(25),[arrivalSize,setArrivalSize]=useState(25),[busy,setBusy]=useState(false);
  const [rsvpGuestId,setRsvpGuestId]=useState<string|null>(null);
  const rsvpGuest=guests.find(row=>row.id===rsvpGuestId);
  const rsvpReply=rsvps.find(row=>row.guest_id===rsvpGuestId);
  const query=useDeferredValue(search.trim().toLocaleLowerCase('id'));
  const joined=useMemo(()=>{
    const replies=new Map(rsvps.map(row=>[text(row.guest_id),row]));
    const arrivals=new Map(checkins.map(row=>[text(row.guest_id),row]));
    return guests.map(guest=>({guest,reply:replies.get(text(guest.id)),arrival:arrivals.get(text(guest.id))}));
  },[guests,rsvps,checkins]);
  const searched=useMemo(()=>joined.filter(({guest})=>!query||`${text(guest.display_name)} ${text(guest.email)} ${groupLabel(guest.guest_group)}`.toLocaleLowerCase('id').includes(query)),[joined,query]);
  const replyRows=useMemo(()=>searched.filter(({reply})=>rsvpFilter==='all'||(text(reply?.attendance)||'pending')===rsvpFilter).sort((a,b)=>text(a.guest.display_name).localeCompare(text(b.guest.display_name),'id')),[searched,rsvpFilter]);
  const arrivalRows=useMemo(()=>searched.filter(({arrival})=>arrivalFilter==='all'||Boolean(arrival)===(arrivalFilter==='arrived')).sort((a,b)=>text(b.arrival?.checked_in_at).localeCompare(text(a.arrival?.checked_in_at))||text(a.guest.display_name).localeCompare(text(b.guest.display_name),'id')),[searched,arrivalFilter]);
  const currentReplyPage=Math.min(rsvpPage,Math.max(0,Math.ceil(replyRows.length/rsvpSize)-1));
  const currentArrivalPage=Math.min(arrivalPage,Math.max(0,Math.ceil(arrivalRows.length/arrivalSize)-1));
  const attending=rsvps.filter(row=>row.attendance==='yes');
  async function refresh(){setBusy(true);try{await reload();notify('Data kehadiran diperbarui.');}catch{notify('Data belum bisa dimuat ulang. Coba kembali.');}finally{setBusy(false);}}
  return <>
    <section className="admin-panel admin-wide cms-attendance-overview"><header className="cms-section-heading"><div><h2>Kehadiran tamu</h2><p>Dari jawaban undangan sampai kedatangan. Semua waktu dalam WIB.</p></div><button type="button" disabled={busy} onClick={()=>void refresh()}>{busy?'Memuat…':'Muat ulang'}</button></header>
      <dl className="cms-metrics">{[['Undangan',guests.length],['RSVP masuk',rsvps.length],['Belum menjawab',Math.max(0,guests.length-rsvps.length)],['Undangan hadir',attending.length],['Orang akan hadir',attending.reduce((sum,row)=>sum+Number(row.party_size||0),0)],['Berhalangan',rsvps.filter(row=>row.attendance==='no').length],['Undangan sudah tiba',checkins.length],['Orang sudah tiba',checkins.reduce((sum,row)=>sum+Number(row.party_size||0),0)]].map(([label,value])=><div key={String(label)}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <label className="cms-attendance-search">Cari tamu atau kelompok<input type="search" value={search} placeholder="Nama, email, atau kelompok" onChange={event=>{setSearch(event.target.value);setRsvpPage(0);setArrivalPage(0);}}/></label>
    </section>
    <section className="admin-panel admin-wide"><header className="cms-section-heading"><div><h2>Jawaban RSVP</h2><p>{replyRows.length} undangan sesuai pencarian dan filter.</p></div><button type="button" onClick={()=>exportFile('rsvps')}>Unduh CSV RSVP</button></header>
      <label className="cms-table-filter">Jawaban<select value={rsvpFilter} onChange={event=>{setRsvpFilter(event.target.value);setRsvpPage(0);}}><option value="all">Semua jawaban</option><option value="pending">Belum menjawab</option><option value="yes">Hadir</option><option value="no">Berhalangan</option></select></label>
      <div className="cms-scroll-table cms-attendance-table" tabIndex={0} role="region" aria-label="Tabel jawaban RSVP"><table><caption className="sr-only">Jawaban RSVP dan catatan tamu</caption><thead><tr>{['Nama tamu','Kelompok','Jawaban','Jumlah orang','Terakhir diperbarui','Catatan'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{replyRows.slice(currentReplyPage*rsvpSize,(currentReplyPage+1)*rsvpSize).map(({guest,reply})=>{const attendance=text(reply?.attendance)||'pending';return <tr key={text(guest.id)}><th scope="row"><strong>{text(guest.display_name)}</strong>{guest.status!=='active'&&<small>Akses dicabut</small>}</th><td>{groupLabel(guest.guest_group)}</td><td><span className={`cms-badge is-${attendance}`}>{attendance==='yes'?'Hadir':attendance==='no'?'Berhalangan':'Belum menjawab'}</span><button type="button" className="cms-rsvp-edit" disabled={busy||guest.status!=='active'} aria-label={`Atur RSVP ${text(guest.display_name)}`} onClick={()=>setRsvpGuestId(text(guest.id))}>Atur RSVP</button></td><td>{attendance==='yes'?`${text(reply?.party_size)} orang`:attendance==='no'?'0 orang':'—'}<small>Kuota {text(guest.party_limit)} orang</small></td><td>{formatAdminTime(reply?.updated_at)}</td><td>{reply&&(reply.guest_names||reply.dietary||reply.message)?<details className="cms-rsvp-note"><summary>Lihat catatan</summary>{Boolean(reply.guest_names)&&<p><strong>Nama yang hadir</strong><br/>{text(reply.guest_names)}</p>}{Boolean(reply.dietary)&&<p><strong>Kebutuhan makanan</strong><br/>{text(reply.dietary)}</p>}{Boolean(reply.message)&&<p><strong>Pesan</strong><br/>{text(reply.message)}</p>}</details>:'—'}</td></tr>;})}{!replyRows.length&&<tr><td colSpan={6}>Tidak ada tamu sesuai pencarian atau filter.</td></tr>}</tbody></table></div>
      <TablePagination label="RSVP" total={replyRows.length} page={currentReplyPage} size={rsvpSize} onPage={setRsvpPage} onSize={size=>{setRsvpSize(size);setRsvpPage(0);}}/>
    </section>
    <section className="admin-panel admin-wide"><header className="cms-section-heading"><div><h2>Check-in</h2><p>Urutan kedatangan terbaru, diikuti tamu yang belum tiba.</p></div><div className="cms-actions"><a className="cms-button" href="/admin/check-in">Buka pemindai QR</a><button type="button" onClick={()=>exportFile('checkins')}>Unduh CSV check-in</button></div></header>
      <label className="cms-table-filter">Kedatangan<select value={arrivalFilter} onChange={event=>{setArrivalFilter(event.target.value);setArrivalPage(0);}}><option value="all">Semua tamu</option><option value="pending">Belum datang</option><option value="arrived">Sudah check-in</option></select></label>
      <div className="cms-scroll-table cms-attendance-table" tabIndex={0} role="region" aria-label="Tabel check-in"><table><caption className="sr-only">Status kedatangan dan petugas pencatat</caption><thead><tr>{['Nama tamu','Kelompok','Kedatangan','Jumlah orang','Waktu check-in','Petugas','Metode'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{arrivalRows.slice(currentArrivalPage*arrivalSize,(currentArrivalPage+1)*arrivalSize).map(({guest,arrival})=><tr key={text(guest.id)}><th scope="row"><strong>{text(guest.display_name)}</strong>{guest.status!=='active'&&<small>Akses dicabut</small>}</th><td>{groupLabel(guest.guest_group)}</td><td><span className="cms-badge">{arrival?'Sudah check-in':'Belum datang'}</span></td><td>{arrival?`${text(arrival.party_size)} orang`:'—'}</td><td>{formatAdminTime(arrival?.checked_in_at)}</td><td>{text(arrival?.checked_in_by)||'—'}</td><td>{arrival?arrival.checkin_method==='qr'?'QR':arrival.checkin_method==='name'?'Pencarian nama':'Manual':'—'}</td></tr>)}{!arrivalRows.length&&<tr><td colSpan={7}>Tidak ada tamu sesuai pencarian atau filter.</td></tr>}</tbody></table></div>
      <TablePagination label="check-in" total={arrivalRows.length} page={currentArrivalPage} size={arrivalSize} onPage={setArrivalPage} onSize={size=>{setArrivalSize(size);setArrivalPage(0);}}/>
      <p className="cms-muted">Ekspor CSV mencakup seluruh data. Filter di atas hanya mengatur tabel yang sedang dilihat.</p><button type="button" onClick={()=>exportFile('backup')}>Unduh backup data pribadi</button>
    </section>
    {rsvpGuest&&<AdminRsvpDialog guest={rsvpGuest} reply={rsvpReply} action={action} notify={notify} onClose={()=>setRsvpGuestId(null)}/>}
  </>;
}
