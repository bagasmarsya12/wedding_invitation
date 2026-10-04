'use client';
import { useState } from 'react';
import { readGuestImport } from '@/lib/guest-import';
import type { AdminAction, InviteLink } from './admin-types';

const headers=['displayName','partyLimit','email','reference','group'];
export function GuestImporter({action,onLinks,notify}:{action:AdminAction;onLinks:(links:InviteLink[])=>void;notify:(text:string)=>void}) {
  const [csv,setCsv]=useState(''),[fileName,setFileName]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
  const [error,setError]=useState('');
  const preview=readGuestImport(csv);
  const download=(name:string,bytes:BlobPart,type:string)=>{const url=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10_000);};
  async function template() {
    setBusy(true);
    try {
      const ExcelJS=(await import('exceljs')).default;
      const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Tamu');
      sheet.addRow(headers); sheet.addRow(['Tamu Contoh',2,'','HOUSE-001','family']);
      sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF21382C'}};
      sheet.columns.forEach((c,i)=>{c.width=[35,16,32,22,20][i];});sheet.views=[{state:'frozen',ySplit:1}];
      download('bagas-iga-template-tamu.xlsx',new Uint8Array(await workbook.xlsx.writeBuffer()),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }catch{notify('Template Excel belum bisa disiapkan. Gunakan kolom CSV yang tersedia.');}
    finally{setBusy(false);}
  }
  async function readFile(file:File) {
    setBusy(true);setCsv('');setError('');setFileName(file.name);
    try {
      if(file.size>2*1024*1024) throw new Error('File maksimal 2 MB.');
      if(/\.csv$/i.test(file.name)) setCsv(await file.text());
      else if(/\.xlsx$/i.test(file.name)) {
        const ExcelJS=(await import('exceljs')).default;
        const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await file.arrayBuffer());
        const sheet=workbook.getWorksheet('Tamu')??workbook.worksheets[0];
        if(!sheet || sheet.rowCount>501 || sheet.columnCount>30) throw new Error('Gunakan 1–500 tamu, maksimal 30 kolom.');
        const rows:string[][]=[];
        sheet.eachRow(row=>{const cells:string[]=[];for(let i=1;i<=sheet.columnCount;i++){const cell=row.getCell(i);if(cell.formula) throw new Error('Gunakan nilai biasa, tanpa formula Excel.');cells.push(cell.text);}rows.push(cells);});
        setCsv(rows.map(row=>row.map(v=>`"${v.replaceAll('"','""')}"`).join(',')).join('\n'));
      } else throw new Error('Pilih file .xlsx atau .csv.');
    } catch(error){const message=error instanceof Error?error.message:'File tidak bisa dibaca.';setError(message);notify(message);}
    finally{setBusy(false);}
  }
  async function commit() {
    if(preview.issues.length||!preview.records.length) return;
    setBusy(true);setError('');
    const links:InviteLink[]=[];let skipped=0,completed=0;
    try {
      // Keep each database invocation small. Validate the whole file first;
      // retries skip already imported references rather than creating duplicate links.
      for(let offset=0;offset<preview.records.length;offset+=25){
        const rows=preview.records.slice(offset,offset+25).map(r=>[r.displayName,r.partyLimit,r.email,r.reference,r.group].map(v=>`"${String(v).replaceAll('"','""')}"`).join(','));
        setProgress(`Membuat undangan ${offset+1}–${Math.min(offset+25,preview.records.length)} dari ${preview.records.length}…`);
        const result=await action('import_guests',{csv:[headers.join(','),...rows].join('\n')});
        if(!result)throw new Error(`Impor berhenti setelah ${completed} baris. Perbaiki masalah, lalu ulangi file; tamu yang sudah dibuat akan dilewati.`);
        links.push(...(result.links??[]));skipped+=result.skipped??0;completed+=rows.length;
      }
      notify(`${links.length} undangan dibuat; ${skipped} tamu yang sudah ada dilewati. Link tersedia di CMS dan ekspor.`);setCsv('');
    }catch(error){const message=error instanceof Error?error.message:'Impor terhenti. Link yang sudah dibuat tetap tersimpan.';setError(message);notify(message);}
    finally{if(links.length)onLinks(links);setBusy(false);setProgress('');}
  }
  return <section className="admin-panel admin-wide cms-importer"><header className="cms-section-heading"><div><h2>Impor tamu dari Excel</h2><p>Unggah daftar, periksa pratinjau, lalu buat link pribadi.</p></div><button type="button" disabled={busy} onClick={()=>void template()}>Download template Excel</button></header>
    <p>Kolom wajib: <strong>displayName / nama</strong> dan <strong>partyLimit / kuota</strong>. Email, reference, dan group opsional. Referensi unik membedakan tamu dengan nama sama. Maksimal 500 tamu per file.</p>
    <label>File Excel atau CSV<input type="file" accept=".xlsx,.csv" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void readFile(file);e.target.value='';}} /></label>
    <details><summary>Atau tempel CSV</summary><label>Isi CSV<textarea rows={6} value={csv} onChange={e=>{setCsv(e.target.value);setFileName('CSV');}} placeholder={headers.join(',')} /></label></details>
    {busy&&<p role="status">{progress||'Memproses file…'}</p>}
    {error&&<p role="alert" className="cms-loading-error">{error}</p>}
    {csv&&<><h3>Pratinjau {fileName} · {preview.records.length} tamu</h3>{preview.issues.length>0&&<div role="alert">{preview.issues.map(issue=><p key={issue.row}>Baris {issue.row}: {issue.message}</p>)}</div>}
      <div className="cms-scroll-table"><table><thead><tr><th>Baris</th><th>Nama</th><th>Kuota</th><th>Grup</th><th>Referensi</th></tr></thead><tbody>{preview.records.slice(0,50).map(r=><tr key={r.row}><td>{r.row}</td><td>{r.displayName}</td><td>{r.partyLimit}</td><td>{r.group}</td><td>{r.reference||'—'}</td></tr>)}</tbody></table></div>
      {preview.records.length>50&&<p>Menampilkan 50 baris pertama. Semua {preview.records.length} baris diperiksa.</p>}
      <button type="button" disabled={busy||!!preview.issues.length||!preview.records.length} onClick={()=>void commit()}>Buat link untuk {preview.records.length} tamu</button></>}
  </section>;
}
