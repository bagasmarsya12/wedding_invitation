import { parseCsv } from './production';
import { validGuestGroup } from './invitation-message';
export type ImportGuest = { row:number; displayName:string; partyLimit:number; email:string; reference:string; group:string };
export type ImportIssue = {row:number;message:string};
export function readGuestImport(csv:string): {records:ImportGuest[];issues:ImportIssue[]} {
  const rows=parseCsv(csv.replace(/^\uFEFF/,''));
  if(!rows || rows.length<2) return {records:[],issues:[{row:1,message:'Gunakan header dan 1–500 baris tamu.'}]};
  const aliases:Record<string,string>={nama:'displayname',namatamu:'displayname',guest:'displayname',name:'displayname',kuota:'partylimit',jumlah:'partylimit',jumlahtamu:'partylimit',category:'group',kategori:'group',grup:'group',referensi:'reference',id:'reference'};
  const headers=rows[0].map(v=>{const key=v.toLowerCase().replace(/[\s_-]/g,'');return aliases[key]??key;});
  if(!headers.includes('displayname') || !headers.includes('partylimit')) return {records:[],issues:[{row:1,message:'Kolom nama/displayName dan kuota/partyLimit wajib ada.'}]};
  if(new Set(headers).size!==headers.length) return {records:[],issues:[{row:1,message:'Nama kolom tidak boleh duplikat.'}]};
  const seen=new Set<string>(),records:ImportGuest[]=[],issues:ImportIssue[]=[];
  for(const [index,row] of rows.slice(1).entries()) {
    const at=index+2,read=(key:string)=>row[headers.indexOf(key)]?.trim()??'';
    const displayName=read('displayname'),partyLimit=Number(read('partylimit')),email=read('email'),reference=read('reference');
    const rawGroup=read('group').toLowerCase();
    const group=({keluarga:'family',lainnya:'other','belum diatur':'unassigned'} as Record<string,string>)[rawGroup]??(rawGroup||'unassigned');
    let message='';
    if(!displayName || displayName.length>120) message='Nama wajib diisi, maksimal 120 karakter.';
    else if(!Number.isInteger(partyLimit)||partyLimit<1||partyLimit>20) message='Kuota harus 1–20 orang.';
    else if(email.length>180 || (email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) message='Email tidak valid.';
    else if(reference.length>120) message='Referensi maksimal 120 karakter.';
    else if(!validGuestGroup(group)) message='Grup: bagas, iga, family, other, unassigned.';
    const identity=reference ? `ref:${reference.toLowerCase()}` : `name:${displayName.toLowerCase()}|${email.toLowerCase()}`;
    if(seen.has(identity)) message='Baris duplikat. Pakai referensi unik untuk nama yang sama.';
    seen.add(identity);
    if(message) issues.push({row:at,message});
    records.push({row:at,displayName,partyLimit,email,reference,group});
  }
  return {records,issues};
}
