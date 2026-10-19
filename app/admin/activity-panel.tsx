"use client";
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { formatAdminTime } from '@/lib/admin-time';
import { deviceCountLabel } from '@/lib/visit-activity';
import { rowText as text, type AdminRow } from './admin-types';

type Activity = {guests:AdminRow[];totals:Record<string,number>|null;recent:AdminRow[];trackingEnabled:boolean;error?:string};
export function ActivityPanel({guests,rsvps,checkins,marks,gifts,notify,reload}:{guests:AdminRow[];rsvps:AdminRow[];checkins:AdminRow[];marks:AdminRow[];gifts:AdminRow[];notify:(message:string)=>void;reload:()=>Promise<void>}) {
  const [data,setData]=useState<Activity|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[access,setAccess]=useState('active'),[sort,setSort]=useState('latest'),[page,setPage]=useState(0);
  const query=useDeferredValue(search.trim().toLocaleLowerCase('id'));
  const load=async()=>{
    setBusy(true);setError('');
    try {
      const [response]=await Promise.all([fetch('/api/admin/activity',{cache:'no-store'}),reload()]);
      const result=await response.json() as Activity;
      if(!response.ok)throw new Error(result.error||'Aktivitas belum tersedia.');
      setData(result);
    } catch(e) {const message=e instanceof Error?e.message:'Aktivitas belum tersedia.';setError(message);notify(message);}
    finally {setBusy(false);}
  };
  useEffect(()=>{
    let active=true;
    fetch('/api/admin/activity',{cache:'no-store'}).then(async response=>{
      const result=await response.json() as Activity;
      if(!response.ok)throw new Error(result.error||'Aktivitas belum tersedia.');
      if(active)setData(result);
    }).catch(e=>{if(active){setError(e.message||'Aktivitas belum tersedia.');notify(e.message||'Aktivitas belum tersedia.');}});
    return()=>{active=false;};
  },[notify]);
  const rows=useMemo(()=>(data?.guests??[]).filter(r=>
    (!query||`${text(r.display_name)} ${text(r.guest_group)}`.toLocaleLowerCase('id').includes(query))&&
    (access==='all'||r.status===access)&&
    (filter==='all'||filter==='opened'&&Number(r.sessions)>0||filter==='unopened'&&!Number(r.sessions)||filter==='multiple'&&Number(r.devices)>1||filter==='followup'&&Number(r.sessions)>0&&!r.attendance||filter==='arrived'&&!!r.checked_in_at)
  ).sort((a,b)=>(sort==='opens'?Number(b.link_opens)-Number(a.link_opens):sort==='devices'?Number(b.devices)-Number(a.devices):sort==='name'?0:text(b.last_at).localeCompare(text(a.last_at)))||text(a.display_name).localeCompare(text(b.display_name),'id')),[data,query,access,filter,sort]);
  const pages=Math.max(1,Math.ceil(rows.length/25)),currentPage=Math.min(page,pages-1),visible=rows.slice(currentPage*25,(currentPage+1)*25);
  return <>
    <section className="admin-panel admin-wide cms-dashboard">
      <header className="cms-section-heading"><div><h2>Ringkasan undangan</h2><p>Dari link dibagikan sampai tamu tiba.</p></div><button type="button" disabled={busy} onClick={()=>void load()}>{busy?'Memuat…':'Refresh aktivitas'}</button></header>
      <dl className="cms-metrics">{[['Undangan aktif',guests.filter(g=>g.status==='active').length],['Link sudah dibuka',data?.totals?.opened??'—'],['Buka undangan tercatat',data?.totals?.link_opens??'—'],['Browser terdeteksi*',data?.totals?deviceCountLabel(data.totals):'—'],['RSVP masuk',rsvps.length],['Orang akan hadir',rsvps.reduce((n,r)=>n+(r.attendance==='yes'?Number(r.party_size)||0:0),0)],['Orang sudah tiba',checkins.reduce((n,r)=>n+(Number(r.party_size)||0),0)],['Mading perlu review',marks.filter(m=>m.moderation_status==='pending').length],['Hadiah dibooking',gifts.filter(r=>r.status==='reserved'||r.status==='purchased').length],['Sesi kunjungan',data?.totals?.sessions??'—']].map(([label,count])=><div key={String(label)}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
    </section>
    <section className="admin-panel admin-wide">
      <header className="cms-section-heading"><div><h2>Siapa yang membuka link</h2><p>Berapa kali undangan dibuka dan berapa perangkat/browser yang terdeteksi. Nama adalah pemilik link, termasuk bila linknya diteruskan.</p></div><a href="/api/admin/activity?export=csv" download>Unduh semua aktivitas CSV</a></header>
      {data?.trackingEnabled===false&&<p role="status" className="cms-muted">Pencatatan aktivitas sedang nonaktif di pengaturan website. Data di bawah adalah kunjungan sebelumnya.</p>}
      {error&&<p role="alert">{error} Tekan Refresh aktivitas untuk mencoba kembali.</p>}
      <div className="guest-filters">
        <label>Cari tamu<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Nama atau grup"/></label>
        <label>Aktivitas<select value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="all">Semua aktivitas</option><option value="opened">Sudah buka</option><option value="unopened">Belum buka</option><option value="multiple">Lebih dari 1 perangkat</option><option value="followup">Sudah buka, belum RSVP</option><option value="arrived">Sudah tiba</option></select></label>
        <label>Akses undangan<select value={access} onChange={e=>{setAccess(e.target.value);setPage(0);}}><option value="active">Aktif</option><option value="all">Semua akses</option><option value="revoked">Dicabut</option></select></label>
        <label>Urutan aktivitas<select value={sort} onChange={e=>{setSort(e.target.value);setPage(0);}}><option value="latest">Terakhir dibuka</option><option value="opens">Paling sering dibuka</option><option value="devices">Perangkat terbanyak</option><option value="name">Nama A–Z</option></select></label>
      </div>
      {!data?!error&&<p role="status">Memuat aktivitas…</p>:<>
        <p role="status">{rows.length} undangan sesuai filter · waktu dalam WIB</p>
        <div className="cms-scroll-table" tabIndex={0} role="region" aria-label="Tabel aktivitas link undangan"><table className="activity-table"><caption className="sr-only">Kunjungan dan perangkat per pemilik link undangan</caption><thead><tr>{['Tamu','Dibuka','Perangkat*','Pertama buka','Terakhir buka','Sesi / semua halaman','RSVP','Kedatangan'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{visible.map(r=><tr key={text(r.id)}>
          <th scope="row"><strong>{text(r.display_name)}</strong><small>{text(r.guest_group)}{r.status==='revoked'?' · akses dicabut':''}</small></th>
          <td><strong>{text(r.link_opens)} kali</strong></td>
          <td><strong>{deviceCountLabel(r)}</strong>{Number(r.unidentified_sessions)>0&&<small>Ada sesi tanpa ID perangkat</small>}</td>
          <td>{formatAdminTime(r.first_at)}</td><td>{formatAdminTime(r.last_at)}</td><td>{text(r.sessions)} / {text(r.views)}</td>
          <td>{r.attendance==='yes'?'Hadir':r.attendance==='no'?'Tidak hadir':'Belum balas'}</td><td>{r.checked_in_at?`${r.arrived_people} orang · ${formatAdminTime(r.checked_in_at)}`:'Belum check-in'}</td>
        </tr>)}{!rows.length&&<tr><td colSpan={8}>Tidak ada tamu sesuai filter.</td></tr>}</tbody></table></div>
        <div className="guest-pagination"><span>{rows.length?currentPage*25+1:0}–{Math.min((currentPage+1)*25,rows.length)} dari {rows.length}</span><div><button type="button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Sebelumnya</button><span>{currentPage+1} / {pages}</span><button type="button" disabled={currentPage+1>=pages} onClick={()=>setPage(currentPage+1)}>Berikutnya</button></div></div>
      </>}
      <p className="cms-muted">Dibuka menghitung tampilan halaman undangan personal, termasuk buka ulang; halaman arsip dan hadiah hanya masuk ke total halaman. Refresh cepat dalam 10 detik disaring. Sesi berakhir setelah 30 menit tanpa aktivitas halaman.</p>
      <p className="cms-muted">*Perangkat adalah browser dengan ID acak tersimpan, bukan identitas orang atau fingerprint perangkat. Browser lain, mode privat, atau menghapus data situs bisa menambah hitungan. Kunjungan lama atau browser tanpa penyimpanan tidak memiliki ID; ≥ berarti jumlah minimum yang terdeteksi. Do Not Track, Global Privacy Control, dan pemblokir dapat membuat kunjungan tidak tercatat. Data perangkat mulai tersedia sejak fitur aktif.</p>
    </section>
    <section className="admin-panel admin-wide"><h2>Aktivitas halaman terbaru</h2><div className="admin-table">{data?.recent.length?data.recent.map((r,i)=><article key={i}><strong>{text(r.display_name)||'Pengunjung umum'}</strong><span>{text(r.page)} · {text(r.views)} kali</span><small>{formatAdminTime(r.last_at)}</small></article>):<p>Belum ada kunjungan tercatat.</p>}</div></section>
  </>;
}
