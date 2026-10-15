"use client";

import { ActivityPanel } from "./activity-panel";
import { PhotoCommentsManager } from "./photo-comments-manager";
import { ContentManager } from "./content-manager";
import { GuestImporter } from "./guest-importer";
import { ModerationManager } from "./moderation-manager";
import { FormEvent, useEffect, useState } from "react";
import { toCsv } from "@/lib/production";
import { MAX_GUEST_PARTY_LIMIT } from '@/lib/guest-limits';
import { useLanguage } from "../language";
import { PasswordPanel } from "./password-panel";
import { StaffPanel } from "./staff-panel";
import { JukeboxManager } from "./jukebox-manager";

import { GuestManager } from './guest-manager';
import { GiftManager } from './gift-manager';
import { GiftSettings } from './gift-settings';
import {AttendanceManager} from './attendance-manager';
import {SettingsPanel,lifecycleSettings} from './settings-panel';
import { DEFAULT_INVITATION_MESSAGE, GUEST_GROUPS, invitationMessage } from '@/lib/invitation-message';
import type { AdminResult, InviteLink } from './admin-types';

type Row = Record<string, unknown>;
type State = { guests: Row[]; rsvps: Row[]; gifts: Row[]; reservations: Row[]; marks: Row[]; archive: Row[]; settings: Row[]; checkins: Row[] };
type Link = InviteLink;
const empty: State = { guests: [], rsvps: [], gifts: [], reservations: [], marks: [], archive: [], settings: [], checkins: [] };
const string = (value: unknown) => String(value ?? "");

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function AdminClient() {
  const [state, setState] = useState<State>(empty);
  const [stateReady,setStateReady]=useState(false);
  const [status, setStatus] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [, setNewLinks] = useState<Link[]>([]);
  const [knownLinks,setKnownLinks] = useState<Record<string,string>>({});
  const rememberLink = (id:string,url:string) => setKnownLinks(current=>({...current,[id]:url}));
  const {website}=useLanguage();
  const [contentMounted,setContentMounted]=useState(false);
  const [contentDirty,setContentDirty]=useState(false);
  const [directDirty,setDirectDirty]=useState(false);
  const [settingsDirty,setSettingsDirty]=useState(false);
  const [contentMode,setContentMode]=useState("copy");
  const [tab, setTab] = useState("dashboard");

  const load = async () => {
    const response = await fetch("/api/admin/state", { cache: "no-store" });
    const result = await response.json() as State & { error?: string };
    if (!response.ok) throw new Error(result.error || "Admin data is unavailable.");
    setState(result);
    setStateReady(true);
  };
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/state", { cache: "no-store" })
      .then(async response => { const result = await response.json() as State & { error?: string }; if (!response.ok) throw new Error(result.error || "Admin data is unavailable."); return result; })
      .then(result => { if (!cancelled) {setState(result);setStateReady(true);} })
      .catch(error => { if (!cancelled) setStatus(error instanceof Error ? error.message : "Admin data is unavailable."); });
    return () => { cancelled = true; };
  }, []);

  const send = async (op: string, values: Record<string, unknown>) => {
    const response = await fetch("/api/admin/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op, ...values }) });
    const result = await response.json() as AdminResult;
    if (!response.ok) throw new Error(result.error || "Could not save.");
    return result;
  };
  const action = async (op: string, values: Record<string, unknown>) => {
    setStatus("Menyimpan…");
    try { const result = await send(op, values); await load(); setDirectDirty(false); setStatus("Tersimpan."); return result; }
    catch (error) { setStatus(error instanceof Error ? error.message : "Could not save."); return null; }
  };
  const submit = async (event: FormEvent<HTMLFormElement>, op: string) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (op === "create_archive" && !data.slug) data.slug = `${String(data.title || "kenangan").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "kenangan"}-${crypto.randomUUID().slice(0, 8)}`;
    const result = await action(op, { ...data, featured: data.featured === "on", published: data.published === "on", shippingRequired: data.shippingRequired === "on" });
    if (!result) return;
    if (result.inviteUrl) {
      const url = new URL(result.inviteUrl,location.origin).toString();
      setInviteUrl(url);
      if (result.guestId) rememberLink(result.guestId,url);
    }
    if (op === "import_guests") {
      setNewLinks(result.links || []);
      if (result.links?.length) {
        setKnownLinks(current=>({...current,...Object.fromEntries(result.links!.map(link=>[link.guestId,link.invitationUrl]))}));
        downloadLinks(result.links);
      }
      setStatus(`${result.links?.length ?? 0} new links created; ${result.skipped ?? 0} existing guests skipped. Save the download now.`);
    }
    form.reset();
  };
  const exportFile = async (kind: "rsvps" | "backup" | "checkins" | 'guests') => {
    setStatus("Menyiapkan unduhan…");
    try {
      const response = await fetch(`/api/admin/state?export=${kind}`, { cache: "no-store" });
      if (!response.ok) { const result = await response.json() as { error?: string }; throw new Error(result.error || "Export failed."); }
      download(kind === "backup" ? "bagas-iga-data-backup.json" : `bagas-iga-${kind}.csv`, await response.text(), kind === "backup" ? "application/json" : "text/csv;charset=utf-8");
      setStatus("Unduhan siap. Simpan dengan baik karena berisi data pribadi tamu.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Export failed."); }
  };

  const downloadLinks = (links:Link[]) => {
    const template = string(state.settings.find(row=>row.key === 'invitation_message_template')?.value) || DEFAULT_INVITATION_MESSAGE;
    download('bagas-iga-new-invitations.csv',toCsv([['Guest Name','Invitation URL','WhatsApp Message'],...links.map(link=> {
      const name=string(state.guests.find(guest=>guest.id === link.guestId)?.display_name) || link.guest;
      return [name,link.invitationUrl,invitationMessage(template,name,link.invitationUrl,website)];
    })]),'text/csv;charset=utf-8');
  };

  const openTab = (next:string)=>{
    if((contentDirty||directDirty||settingsDirty)&&next!==tab){setStatus('Simpan atau batalkan perubahan sebelum berpindah menu.');return false;}
    setStatus('');if(next==='konten')setContentMounted(true);setTab(next);return true;
  };
  const regenerate = async (guestId: string) => {
    const result = await action("regenerate_token", { id: guestId });
    if (result && "inviteUrl" in result && typeof result.inviteUrl === "string") {
      const url = `${location.origin}${result.inviteUrl}`;
      setInviteUrl(url);
      rememberLink(guestId,url);
      setNewLinks(current=>current.map(link=>link.guestId === guestId ? {...link,invitationUrl:url} : link));
      download("invitation-link.txt", `${url}\n`, "text/plain");
    }
  };

  const archiveEditor = <>
    <section className="admin-panel"><header><h2>Tambah cerita arsip</h2></header><form onSubmit={event => submit(event, "create_archive")}><label>Judul cerita<input name="title" required /></label><label>Alamat cerita (opsional)<input name="slug" pattern="[a-z0-9-]+" placeholder="Dibuat otomatis dari judul" /></label><label>Jenis cerita<select name="type"><option>photograph</option><option>place</option><option>object</option><option>conversation</option><option>note</option><option>audio</option><option>other</option></select></label><label>Ringkasan<textarea name="excerpt" /></label><label>Isi cerita<textarea name="story" rows={6} /></label><label>Link media (opsional)<input name="mediaUrl" type="url" /></label><label>Akses cerita<select name="visibility"><option value="guests">Privat / draf</option><option value="public">Publik</option></select></label><label className="check"><input name="featured" type="checkbox" /> Jadikan sorotan homepage</label><label className="check"><input name="published" type="checkbox" /> Terbitkan cerita</label><button>Simpan cerita</button></form></section>

    <section className="admin-panel admin-wide"><header><h2>Cerita yang tersimpan</h2></header><p>Hanya cerita publik yang diterbitkan muncul di halaman Arsip. Pilihan sorotan menambahkan cuplikan ke homepage (maksimal dua cerita).</p><div className="admin-table">
      {state.archive.map(row => <details key={string(row.id)}><summary>{string(row.title)} · {row.published ? "published" : "draft"} · {string(row.visibility)}</summary>
        <form onSubmit={event => submit(event, "update_archive")}><input type="hidden" name="id" value={string(row.id)} /><label>Judul cerita<input name="title" defaultValue={string(row.title)} required /></label><label>Alamat cerita<input name="slug" defaultValue={string(row.slug)} required /></label><label>Jenis cerita<input name="type" defaultValue={string(row.type)} /></label><label>Ringkasan<textarea name="excerpt" defaultValue={string(row.excerpt)} /></label><label>Isi cerita<textarea name="story" rows={6} defaultValue={string(row.story)} /></label><label>Link media (opsional)<input name="mediaUrl" type="url" defaultValue={string(row.media_url)} /></label><label>Urutan sorotan<input name="featuredOrder" type="number" min="0" defaultValue={string(row.featured_order)} /></label><label>Akses cerita<select name="visibility" defaultValue={string(row.visibility)}><option value="guests">Privat / draf</option><option value="public">Publik</option></select></label><label className="check"><input name="featured" type="checkbox" defaultChecked={Boolean(row.featured)} /> Jadikan sorotan homepage</label><label className="check"><input name="published" type="checkbox" defaultChecked={Boolean(row.published)} /> Terbitkan cerita</label><button>Simpan perubahan cerita</button></form>
        <button type="button" onClick={() => action("archive_entry", { id: row.id })}>Tarik dari website</button>
      </details>)}
    </div></section>
  </>;
  return <div className="admin-grid" data-admin-area={tab}>
    <p className="product-status admin-status" role="status">{status}</p>

    <nav className="admin-tabs" role="tablist" aria-label="Admin sections">
      {[["dashboard","Ringkasan"],["konten","Edit website"],["tamu","Tamu & link"],["kehadiran","Kehadiran"],["kartu","Kartu ucapan"],["komentar","Komentar foto"],["petugas","Petugas"],["pengaturan","Pengaturan"]].map(([id, label]) => (
        <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => openTab(id)}>{label}</button>
      ))}
    </nav>

    {tab === "dashboard" && <div className="admin-pane"><ActivityPanel guests={state.guests} rsvps={state.rsvps} checkins={state.checkins} marks={state.marks} reservations={state.reservations} notify={setStatus} reload={load} /></div>}
    {tab === "komentar" && <div className="admin-pane"><PhotoCommentsManager notify={setStatus} /></div>}
    {tab === "petugas" && <div className="admin-pane"><StaffPanel /></div>}
    <div hidden={tab !== "tamu"} className="admin-pane">
    <GuestManager guests={state.guests} rsvps={state.rsvps} settings={state.settings} knownLinks={knownLinks} action={action} regenerate={regenerate} rememberLink={rememberLink} notify={setStatus} exportGuests={()=>void exportFile('guests')} />
    <details className="admin-panel admin-wide guest-create-tools"><summary>Tambah tamu & impor daftar</summary>
    <section className="admin-panel admin-create-guest"><header><p>Undangan personal</p><h2>Tambah tamu</h2></header>
      <form onSubmit={event => submit(event, "create_guest")}><label>Nama tamu atau keluarga<input name="displayName" maxLength={120} required /></label><label>Email (opsional)<input name="email" type="email" /></label><label>Kuota orang<input name="partyLimit" type="number" min="1" max={MAX_GUEST_PARTY_LIMIT} defaultValue="1" required /></label><label>Kelompok<select name="guestGroup">{GUEST_GROUPS.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label><button>Buat link personal</button></form>
      {inviteUrl && <output className="invite-output"><strong>Link ini tersimpan terenkripsi. Bisa disalin atau diekspor kembali dari CMS.</strong><input readOnly value={inviteUrl} aria-label="New invitation URL" /><button type="button" onClick={() => navigator.clipboard.writeText(inviteUrl).catch(() => setStatus("Copy failed. Select the link manually."))}>Salin link</button></output>}
    </section>

    <GuestImporter action={action} notify={setStatus} onLinks={links=>{setNewLinks(links);setKnownLinks(current=>({...current,...Object.fromEntries(links.map(link=>[link.guestId,link.invitationUrl]))}));if(links.length)downloadLinks(links);}} />
    <section className="admin-panel admin-wide"><h2>Link yang tersimpan</h2><p>{state.guests.filter(guest=>guest.status==='active'&&guest.has_saved_link).length} dari {state.guests.filter(guest=>guest.status==='active').length} link tamu aktif bisa diekspor ulang.</p><p>Link lama bisa ditempel lewat menu Edit / pesan. Mengganti link akan membatalkan link dan QR sebelumnya.</p><a href="/api/admin/invitations?export=csv" download>Unduh semua link tersimpan</a></section>

    </details></div>
    <div hidden={tab !== "kehadiran"} className="admin-pane">
      <AttendanceManager guests={state.guests} rsvps={state.rsvps} checkins={state.checkins} exportFile={kind=>void exportFile(kind)} reload={load} notify={setStatus}/>
    </div>

    <div hidden={tab !== "pengaturan"} className="admin-pane">
    {stateReady?<SettingsPanel key={JSON.stringify(lifecycleSettings(state.settings))} settings={state.settings} weddingDate={website.weddingDate} action={action} notify={setStatus} onDirtyChange={setSettingsDirty} onGifts={()=>{if(openTab('konten'))setContentMode('transfers');}}/>:<section className="admin-panel admin-wide"><p role="status">Pengaturan belum tersedia. Muat data sebelum mengubahnya.</p><button type="button" onClick={()=>void load().catch(()=>setStatus('Pengaturan belum bisa dimuat. Coba kembali.'))}>Muat ulang pengaturan</button></section>}
    <PasswordPanel />
    </div>

    {contentMounted && <div hidden={tab!=="konten"} className="admin-pane"><ContentManager notify={setStatus} requestedMode={contentMode} onModeChange={setContentMode} onDirtyChange={setContentDirty} externalDirty={directDirty} onExternalDirtyChange={setDirectDirty} onOpenArea={openTab} giftsEnabled={lifecycleSettings(state.settings).gifts !== 'off'} archiveEditor={archiveEditor} commentsEditor={<PhotoCommentsManager notify={setStatus} />} transferEditor={<GiftSettings settings={state.settings} action={action} />} giftEditor={<><GiftManager gifts={state.gifts} action={action} reload={load} notify={setStatus} /><details className="cms-advanced-fields"><summary>Riwayat pilihan hadiah</summary><div className="admin-table">{state.reservations.length?state.reservations.map(row=><article key={string(row.id)}><strong>{string(row.gift_title)}</strong><span>{string(row.status)} · {string(row.guest_name)}</span></article>):<p>Belum ada hadiah yang dipilih tamu.</p>}</div></details></>} jukeboxEditor={<JukeboxManager notify={setStatus} onDirtyChange={setDirectDirty} />} /></div>}

    <div hidden={tab !== "kartu"} className="admin-pane">
    <ModerationManager marks={state.marks} action={action} />
    </div>
   </div>;
}
