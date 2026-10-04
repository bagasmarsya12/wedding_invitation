"use client";

import { ActivityPanel } from "./activity-panel";
import { ContentManager } from "./content-manager";
import { GuestImporter } from "./guest-importer";
import { ModerationManager } from "./moderation-manager";
import { FormEvent, useEffect, useState } from "react";
import { toCsv } from "@/lib/production";
import { useLanguage } from "../language";
import { PasswordPanel } from "./password-panel";
import { StaffPanel } from "./staff-panel";

import { GuestManager } from './guest-manager';
import { GiftManager } from './gift-manager';
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
  const [status, setStatus] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [newLinks, setNewLinks] = useState<Link[]>([]);
  const [knownLinks,setKnownLinks] = useState<Record<string,string>>({});
  const rememberLink = (id:string,url:string) => setKnownLinks(current=>({...current,[id]:url}));
  const {website}=useLanguage();
  const [contentMounted,setContentMounted]=useState(false);
  const [contentMode,setContentMode]=useState("copy");
  const [tab, setTab] = useState("dashboard");

  const load = async () => {
    const response = await fetch("/api/admin/state", { cache: "no-store" });
    const result = await response.json() as State & { error?: string };
    if (!response.ok) throw new Error(result.error || "Admin data is unavailable.");
    setState(result);
  };
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/state", { cache: "no-store" })
      .then(async response => { const result = await response.json() as State & { error?: string }; if (!response.ok) throw new Error(result.error || "Admin data is unavailable."); return result; })
      .then(result => { if (!cancelled) setState(result); })
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
    setStatus("Saving…");
    try { const result = await send(op, values); await load(); setStatus("Saved."); return result; }
    catch (error) { setStatus(error instanceof Error ? error.message : "Could not save."); return null; }
  };
  const submit = async (event: FormEvent<HTMLFormElement>, op: string) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
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
    setStatus("Preparing export…");
    try {
      const response = await fetch(`/api/admin/state?export=${kind}`, { cache: "no-store" });
      if (!response.ok) { const result = await response.json() as { error?: string }; throw new Error(result.error || "Export failed."); }
      download(kind === "backup" ? "bagas-iga-data-backup.json" : `bagas-iga-${kind}.csv`, await response.text(), kind === "backup" ? "application/json" : "text/csv;charset=utf-8");
      setStatus("Export downloaded. Store it securely; it contains private guest data.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Export failed."); }
  };

  const responded = state.rsvps.length;
  const attending = state.rsvps.filter(row => row.attendance === "yes").length;
  const declined = state.rsvps.filter(row => row.attendance === "no").length;
  const headcount = state.rsvps.reduce((total, row) => total + (row.attendance === "yes" ? Number(row.party_size) || 0 : 0), 0);
  const invitedPeople = state.guests.reduce((total, row) => total + (Number(row.party_limit) || 0), 0);

  const downloadLinks = (links:Link[]) => {
    const template = string(state.settings.find(row=>row.key === 'invitation_message_template')?.value) || DEFAULT_INVITATION_MESSAGE;
    download('bagas-iga-new-invitations.csv',toCsv([['Guest Name','Invitation URL','WhatsApp Message'],...links.map(link=> {
      const name=string(state.guests.find(guest=>guest.id === link.guestId)?.display_name) || link.guest;
      return [name,link.invitationUrl,invitationMessage(template,name,link.invitationUrl,website)];
    })]),'text/csv;charset=utf-8');
  };

  const openTab = (next:string)=>{if(next==='konten')setContentMounted(true);setTab(next);};
  const uploadPortrait = async (slot: string, file: File) => {
    setStatus("Uploading…");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(`/api/admin/media/${slot}`, { method: "POST", body });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      await load(); setStatus("Photograph uploaded — landing updated.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Upload failed."); }
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

  return <div className="admin-grid">
    <p className="product-status admin-status" role="status">{status}</p>

    <nav className="admin-tabs" role="tablist" aria-label="Admin sections">
      {[["dashboard","Dashboard"],["tamu","Tamu & link"],["kehadiran","Kehadiran"],["konten","Konten"],["foto","Foto"],["hadiah","Hadiah"],["kartu","Mading"],["arsip","Arsip"],["petugas","Petugas"],["pengaturan","Pengaturan"]].map(([id, label]) => (
        <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => openTab(id)}>{label}</button>
      ))}
    </nav>

    {tab === "dashboard" && <div className="admin-pane"><ActivityPanel guests={state.guests} rsvps={state.rsvps} checkins={state.checkins} marks={state.marks} reservations={state.reservations} notify={setStatus} reload={load} /></div>}
    {tab === "petugas" && <div className="admin-pane"><StaffPanel /></div>}
    <div hidden={tab !== "tamu"} className="admin-pane">
    <GuestManager guests={state.guests} rsvps={state.rsvps} settings={state.settings} knownLinks={knownLinks} action={action} regenerate={regenerate} rememberLink={rememberLink} notify={setStatus} exportGuests={()=>void exportFile('guests')} />
    <section className="admin-panel admin-create-guest"><header><p>Invitation access</p><h2>Create guest link</h2></header>
      <form onSubmit={event => submit(event, "create_guest")}><label>Guest or family name<input name="displayName" maxLength={120} required /></label><label>Email, optional<input name="email" type="email" /></label><label>Party limit<input name="partyLimit" type="number" min="1" max="20" defaultValue="1" required /></label><label>Group<select name="guestGroup">{GUEST_GROUPS.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label><button>Create private link</button></form>
      {inviteUrl && <output className="invite-output"><strong>Link ini tersimpan terenkripsi. Bisa disalin atau diekspor kembali dari CMS.</strong><input readOnly value={inviteUrl} aria-label="New invitation URL" /><button type="button" onClick={() => navigator.clipboard.writeText(inviteUrl).catch(() => setStatus("Copy failed. Select the link manually."))}>Copy link</button></output>}
    </section>

    <GuestImporter action={action} notify={setStatus} onLinks={links=>{setNewLinks(links);setKnownLinks(current=>({...current,...Object.fromEntries(links.map(link=>[link.guestId,link.invitationUrl]))}));if(links.length)downloadLinks(links);}} />
    <section className="admin-panel admin-wide"><h2>Link yang tersimpan</h2><p>{state.guests.filter(guest=>guest.status==='active'&&guest.has_saved_link).length} dari {state.guests.filter(guest=>guest.status==='active').length} link tamu aktif bisa diekspor ulang.</p><p>Link lama yang belum tersimpan dapat ditempel melalui Detail pesan & link untuk diverifikasi dan disimpan. Regenerate menghasilkan link baru dan membatalkan link lama.</p><a href="/api/admin/invitations?export=csv" download>Download semua link undangan yang tersimpan</a></section>
    </div>
    <div hidden={tab !== "kehadiran"} className="admin-pane">
    <section className="admin-panel admin-wide"><header><p>Guest arrival</p><h2>Check-in</h2></header><p><a href="/admin/check-in">Open QR scanner and guest lookup</a></p><p>{state.checkins.length} invitations checked in · {state.checkins.reduce((total, row) => total + Number(row.party_size || 0), 0)} guests arrived</p><button type="button" onClick={() => exportFile("checkins")}>Export check-in CSV</button><button type="button" onClick={() => { load().catch(() => setStatus("Records could not be refreshed.")); }}>Refresh arrivals</button><div className="admin-table">{state.checkins.length ? state.checkins.map(row => <article key={string(row.guest_id)}><strong>{string(row.display_name)}</strong><span>{string(row.party_size)} guests · {string(row.checked_in_at)}</span><small>{string(row.checked_in_by)}</small></article>) : <p>No arrivals recorded.</p>}</div></section>

    <section className="admin-panel admin-wide"><header><p>Attendance</p><h2>RSVP records</h2></header>
      <dl className="record-counts"><div><dt>Households</dt><dd>{state.guests.length}</dd></div><div><dt>People invited</dt><dd>{invitedPeople}</dd></div><div><dt>Responded</dt><dd>{responded}</dd></div><div><dt>Attending</dt><dd>{attending}</dd></div><div><dt>Declined</dt><dd>{declined}</dd></div><div><dt>Pending</dt><dd>{Math.max(0, state.guests.length - responded)}</dd></div><div><dt>Expected places</dt><dd>{headcount}</dd></div></dl>
      <button type="button" onClick={() => exportFile("rsvps")}>Export RSVP CSV</button> <button type="button" onClick={() => exportFile("backup")}>Download private data backup</button>
      <div className="admin-table">{state.rsvps.length ? state.rsvps.map(row => <article key={string(row.id)}><strong>{string(row.display_name)}</strong><span>{string(row.attendance)} · party {string(row.party_size)}</span><small>{string(row.updated_at)}</small></article>) : <p>No RSVP responses yet.</p>}</div>
    </section>


    </div>

    <div hidden={tab !== "hadiah"} className="admin-pane">
    <GiftManager gifts={state.gifts} action={action} reload={load} notify={setStatus} />
    <section className="admin-panel admin-wide"><h2>Reservation history</h2><div className="admin-table">{state.reservations.length ? state.reservations.map(row=><article key={string(row.id)}><strong>{string(row.gift_title)}</strong><span>{string(row.status)} · {string(row.guest_name)}</span><small>{string(row.reserved_at)}</small></article>) : <p>No reservations recorded.</p>}</div></section>
    </div>

    <div hidden={tab !== "foto"} className="admin-pane">
    <section className="admin-panel admin-wide"><header><p>Content CMS</p><h2>Foto profil</h2></header>
      <button type="button" onClick={()=>{setContentMode("photos");openTab("konten");}}>Kelola album polaroid & caption</button>
      <p>Foto profil menerima JPG/PNG/WebP/AVIF, maksimal 5 MB. Jumlah, susunan foto polaroid, dan caption diatur melalui Konten → Foto & caption.</p>
      <div className="admin-table">
        {["bagas", "iga"].map(who => (
          <article key={who}>
            <strong>{who === "bagas" ? "Portrait Bagas" : who === "iga" ? "Portrait Iga" : `Selected Moments ${who.slice(-2)}`}</strong>
            {state.settings.some(row => row.key === `media.${who}`) && <img className="admin-media-preview" src={`/api/admin/media/${who}?v=${encodeURIComponent(string(state.settings.find(row => row.key === `media.${who}`)?.updated_at))}`} alt={who} />}
            <input aria-label={`Upload ${who}`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => { const file = event.target.files?.[0]; if (file) uploadPortrait(who, file); event.target.value = ""; }} />
          </article>
        ))}
      </div>
    </section>
    </div>

    <div hidden={tab !== "arsip"} className="admin-pane">
    <section className="admin-panel"><header><p>Archive CMS</p><h2>Add entry</h2></header><form onSubmit={event => submit(event, "create_archive")}><label>Title<input name="title" required /></label><label>Slug<input name="slug" required pattern="[a-z0-9-]+" /></label><label>Type<select name="type"><option>photograph</option><option>place</option><option>object</option><option>conversation</option><option>note</option><option>audio</option><option>other</option></select></label><label>Excerpt<textarea name="excerpt" /></label><label>Story<textarea name="story" rows={6} /></label><label>Media URL<input name="mediaUrl" type="url" /></label><label>Visibility<select name="visibility"><option value="guests">Unlisted / draft</option><option value="public">Public</option></select></label><label className="check"><input name="featured" type="checkbox" /> Featured</label><label className="check"><input name="published" type="checkbox" /> Published</label><button>Add archive entry</button></form></section>

    <section className="admin-panel admin-wide"><header><p>Archive CMS</p><h2>Manage entries</h2></header><p>Only published public entries appear in the Archive. Unlisted entries remain private drafts.</p><div className="admin-table">
      {state.archive.map(row => <details key={string(row.id)}><summary>{string(row.title)} · {row.published ? "published" : "draft"} · {string(row.visibility)}</summary>
        <form onSubmit={event => submit(event, "update_archive")}><input type="hidden" name="id" value={string(row.id)} /><label>Title<input name="title" defaultValue={string(row.title)} required /></label><label>Slug<input name="slug" defaultValue={string(row.slug)} required /></label><label>Type<input name="type" defaultValue={string(row.type)} /></label><label>Excerpt<textarea name="excerpt" defaultValue={string(row.excerpt)} /></label><label>Story<textarea name="story" rows={6} defaultValue={string(row.story)} /></label><label>Media URL<input name="mediaUrl" type="url" defaultValue={string(row.media_url)} /></label><label>Featured order<input name="featuredOrder" type="number" min="0" defaultValue={string(row.featured_order)} /></label><label>Visibility<select name="visibility" defaultValue={string(row.visibility)}><option value="guests">Unlisted / draft</option><option value="public">Public</option></select></label><label className="check"><input name="featured" type="checkbox" defaultChecked={Boolean(row.featured)} /> Featured</label><label className="check"><input name="published" type="checkbox" defaultChecked={Boolean(row.published)} /> Published</label><button>Save entry</button></form>
        <button type="button" onClick={() => action("archive_entry", { id: row.id })}>Archive / unpublish</button>
      </details>)}
    </div></section>

    </div>
    <div hidden={tab !== "pengaturan"} className="admin-pane">
    <section className="admin-panel admin-settings"><header><p>Private configuration</p><h2>Lifecycle &amp; details</h2></header><form onSubmit={event => submit(event, "set_setting")}><label>Setting<select name="key"><option value="site_phase">Site phase (auto, pre-wedding, wedding-day, post-wedding)</option><option value="rsvp_enabled">RSVP (auto, on, off)</option><option value="gifts_enabled">Gifts (auto, on, off)</option><option value="marks_enabled">Leave a Mark (auto, on, off)</option><option value="shipping_instructions">Private shipping instructions</option><option value="cash_gift_details">Cash gift details</option></select></label><label>Value<textarea name="value" rows={5} placeholder="Use auto unless overriding a feature" required /></label><button>Save setting</button></form><div className="admin-table">{state.settings.filter(row=>!string(row.key).startsWith("content.")&&!string(row.key).startsWith("media.")&&!string(row.key).startsWith("cms.")).map(row => <article key={string(row.key)}><strong>{string(row.key)}</strong><span>{string(row.value)}</span></article>)}</div></section>
    <PasswordPanel />
    </div>

    {contentMounted && <div hidden={tab!=="konten"} className="admin-pane"><ContentManager notify={setStatus} requestedMode={contentMode} onModeChange={setContentMode} /></div>}

    <div hidden={tab !== "kartu"} className="admin-pane">
    <ModerationManager marks={state.marks} action={action} />
    </div>
   </div>;
}
