'use client';
import {useEffect,useState} from 'react';
import {phaseForDate} from '@/lib/production';
import {rowText as text,type AdminAction,type AdminRow} from './admin-types';

type Lifecycle={phase:string;rsvp:string;gifts:string;marks:string};
const features=[
  {key:'rsvp',name:'Konfirmasi kehadiran',description:'Izinkan tamu mengirim atau memperbarui RSVP.'},
  {key:'gifts',name:'Hadiah',description:'Izinkan tamu memilih hadiah dan membuka pilihan tanda kasih.'},
  {key:'marks',name:'Kartu dari tamu',description:'Izinkan tamu mengirim pesan, coretan, atau doa.'},
] as const;
const phaseNames={'pre-wedding':'Sebelum acara','wedding-day':'Hari acara','post-wedding':'Setelah acara'};
export function lifecycleSettings(settings:AdminRow[]):Lifecycle {
  const get=(key:string)=>text(settings.find(row=>row.key===key)?.value)||'auto';
  return {phase:get('site_phase'),rsvp:get('rsvp_enabled'),gifts:get('gifts_enabled'),marks:get('marks_enabled')};
}

export function SettingsPanel({settings,weddingDate,action,notify,onGifts,onDirtyChange}:{settings:AdminRow[];weddingDate:string;action:AdminAction;notify:(message:string)=>void;onGifts:()=>void;onDirtyChange?:(dirty:boolean)=>void}) {
  const baseline=lifecycleSettings(settings);
  const [draft,setDraft]=useState<Lifecycle>(baseline),[busy,setBusy]=useState(false);
  const dirty=JSON.stringify(draft)!==JSON.stringify(baseline);
  useEffect(()=>{onDirtyChange?.(dirty);},[dirty,onDirtyChange]);
  const phase=phaseForDate(new Date(),draft.phase,weddingDate);
  useEffect(()=>{const protect=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[dirty]);
  async function save(){setBusy(true);try{const result=await action('set_lifecycle',draft);if(result)notify('Pengaturan website tersimpan.');}finally{setBusy(false);}}
  return <>
    <section className="admin-panel admin-wide cms-settings-panel"><header><h2>Pengaturan website</h2><p>Atur fase acara dan fitur yang bisa digunakan tamu. Perubahan berlaku setelah disimpan.</p></header>
      <form onSubmit={event=>{event.preventDefault();void save();}}>
        <label>Fase acara<select value={draft.phase} onChange={event=>setDraft(current=>({...current,phase:event.target.value}))} disabled={busy}><option value="auto">Otomatis sesuai tanggal acara</option><option value="pre-wedding">Sebelum acara</option><option value="wedding-day">Hari acara</option><option value="post-wedding">Setelah acara</option></select></label>
        <p className="cms-setting-hint">{draft.phase==='auto'?'Mengikuti tanggal acara di CMS.':'Fase dipilih secara manual.'} Dengan pilihan ini: <strong>{phaseNames[phase]}</strong>.</p>
        <div className="cms-feature-settings">{features.map(feature=>{const value=draft[feature.key],automatic=value==='auto',enabled=automatic?(feature.key==='rsvp'?phase!=='post-wedding':true):value==='on';return <fieldset key={feature.key}><legend>{feature.name}</legend><p>{feature.description}</p><div className="cms-feature-controls"><label className="check"><input type="checkbox" checked={automatic} disabled={busy} onChange={event=>setDraft(current=>({...current,[feature.key]:event.target.checked?'auto':enabled?'on':'off'}))}/>Ikuti pengaturan otomatis</label><button className="cms-feature-switch" type="button" role="switch" aria-checked={enabled} aria-label={`${feature.name} aktif`} disabled={busy||automatic} onClick={()=>setDraft(current=>({...current,[feature.key]:enabled?'off':'on'}))}><span aria-hidden="true"/>{enabled?'Aktif':'Nonaktif'}</button></div><small>{automatic?feature.key==='rsvp'?'RSVP aktif sebelum dan saat acara; nonaktif setelah acara.':'Fitur ini tetap aktif dalam mode otomatis.':'Diatur manual, terlepas dari fase acara.'}</small></fieldset>;})}</div>
        <div className="cms-settings-save"><span role="status">{dirty?'Ada perubahan yang belum disimpan':'Pengaturan tersimpan'}</span><div className="cms-actions"><button type="button" disabled={!dirty||busy} onClick={()=>setDraft(baseline)}>Batalkan perubahan</button><button disabled={!dirty||busy}>{busy?'Menyimpan…':'Simpan pengaturan'}</button></div></div>
      </form>
    </section>
    <section className="admin-panel admin-wide"><h2>Pengaturan hadiah</h2><p>Nomor rekening, DANA, GoPay, dan petunjuk hadiah dikelola bersama pilihan hadiah.</p><button type="button" onClick={onGifts}>Kelola hadiah & tanda kasih</button>
    </section>
  </>;
}
