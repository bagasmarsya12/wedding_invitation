'use client';

export function TablePagination({label,total,page,size,onPage,onSize}:{label:string;total:number;page:number;size:number;onPage:(page:number)=>void;onSize:(size:number)=>void}) {
  const pages = Math.max(1,Math.ceil(total/size));
  const current = Math.min(page,pages-1);
  return <div className="guest-pagination" aria-label={`Halaman ${label}`}>
    <label>Baris per halaman<select aria-label={`Baris ${label} per halaman`} value={size} onChange={event=>onSize(Number(event.target.value))}>{[25,50,100].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
    <span role="status">{total?current*size+1:0}–{Math.min((current+1)*size,total)} dari {total}</span>
    <div><button type="button" disabled={current===0} onClick={()=>onPage(current-1)} aria-label={`Halaman ${label} sebelumnya`}>Sebelumnya</button><span>{current+1} / {pages}</span><button type="button" disabled={current+1>=pages} onClick={()=>onPage(current+1)} aria-label={`Halaman ${label} berikutnya`}>Berikutnya</button></div>
  </div>;
}
