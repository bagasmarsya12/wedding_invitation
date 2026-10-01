"use client";

import { FormEvent, useEffect, useState } from "react";
import { toCsv } from "@/lib/production";
import { CONTENT_SECTIONS } from "@/lib/content-defaults";
import { PasswordPanel } from "./password-panel";

type Row = Record<string, unknown>;
type State = { guests: Row[]; rsvps: Row[]; gifts: Row[]; reservations: Row[]; marks: Row[]; archive: Row[]; settings: Row[] };
type Link = { guest: string; invitationUrl: string };
const empty: State = { guests: [], rsvps: [], gifts: [], reservations: [], marks: [], archive: [], settings: [] };
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
  const [markFilter, setMarkFilter] = useState("pending");
  const [tab, setTab] = useState("tamu");
  const [contentValues, setContentView] = useState<Record<string, string> | null>(null);
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
    const result = await response.json() as { error?: string; inviteUrl?: string; links?: Link[]; skipped?: number };
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
    if (result.inviteUrl) setInviteUrl(`${location.origin}${result.inviteUrl}`);
    if (op === "import_guests") {
      setNewLinks(result.links || []);
      if (result.links?.length) download("bagas-iga-new-invitations.csv", toCsv([["Guest Name", "Invitation URL"], ...result.links.map((link: Link) => [link.guest, link.invitationUrl])]), "text/csv;charset=utf-8");
      setStatus(`${result.links?.length ?? 0} new links created; ${result.skipped ?? 0} existing guests skipped. Save the download now.`);
    }
    form.reset();
  };
  const exportFile = async (kind: "rsvps" | "backup") => {
    setStatus("Preparing export…");
    try {
      const response = await fetch(`/api/admin/state?export=${kind}`, { cache: "no-store" });
      if (!response.ok) { const result = await response.json() as { error?: string }; throw new Error(result.error || "Export failed."); }
      download(kind === "rsvps" ? "bagas-iga-rsvps.csv" : "bagas-iga-data-backup.json", await response.text(), kind === "rsvps" ? "text/csv;charset=utf-8" : "application/json");
      setStatus("Export downloaded. Store it securely; it contains private guest data.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Export failed."); }
  };

  const responded = state.rsvps.length;
  const attending = state.rsvps.filter(row => row.attendance === "yes").length;
  const declined = state.rsvps.filter(row => row.attendance === "no").length;
  const headcount = state.rsvps.reduce((total, row) => total + (row.attendance === "yes" ? Number(row.party_size) || 0 : 0), 0);
  const invitedPeople = state.guests.reduce((total, row) => total + (Number(row.party_limit) || 0), 0);
  const visibleMarks = state.marks.filter(row => markFilter === "all" || row.moderation_status === markFilter);

  // Lazily pull CMS values when the Konten tab opens first time.
  const openTab = async (next: string) => {
    setTab(next);
    if (next === "konten" && !contentValues) {
      try {
        const response = await fetch("/api/admin/content", { cache: "no-store" });
        const result = await response.json() as { values?: Record<string, string>; error?: string };
        if (!response.ok) throw new Error(result.error || "Content is unavailable.");
        setContentView(result.values ?? {});
      } catch (error) { setStatus(error instanceof Error ? error.message : "Content is unavailable."); }
    }
  };
  const saveSection = async (sectionId: string, form: HTMLFormElement) => {
    const fields = CONTENT_SECTIONS.find(section => section.id === sectionId)?.fields ?? [];
    const entries: Record<string, string> = {};
    for (const field of fields) {
      const input = form.elements.namedItem(`k_${field.key}`) as HTMLInputElement | null;
      if (input) entries[`${sectionId}.${field.key}`] = input.value;
    }
    setStatus("Saving…");
    try {
      const response = await fetch("/api/admin/content", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ values: entries }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save.");
      setContentView(current => ({ ...(current ?? {}), ...entries }));
      setStatus("Saved — landing live.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not save."); }
  };
  const uploadPortrait = async (slot: "bagas" | "iga", file: File) => {
    setStatus("Uploading…");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(`/api/admin/media/${slot}`, { method: "POST", body });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      setStatus("Portrait uploaded — landing live.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Upload failed."); }
  };
  const regenerate = async (guestId: string) => {
    const result = await action("regenerate_token", { id: guestId });
    if (result && "inviteUrl" in result && typeof result.inviteUrl === "string") {
      const url = `${location.origin}${result.inviteUrl}`;
      setInviteUrl(url);
      download("invitation-link.txt", `${url}\n`, "text/plain");
    }
  };

  return <div className="admin-grid">
    <p className="product-status admin-status" role="status">{status}</p>

    <nav className="admin-tabs" role="tablist" aria-label="Admin sections">
      {[["tamu", "Tamu"], ["konten", "Konten"], ["hadiah", "Hadiah"], ["foto", "Foto Landing"], ["kartu", "Kartu Pos"]].map(([id, label]) => (
        <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => openTab(id)}>{label}</button>
      ))}
    </nav>

    <div hidden={tab !== "tamu"} className="admin-pane">
    <section className="admin-panel admin-create-guest"><header><p>Invitation access</p><h2>Create guest link</h2></header>
      <form onSubmit={event => submit(event, "create_guest")}><label>Guest or family name<input name="displayName" maxLength={120} required /></label><label>Email, optional<input name="email" type="email" /></label><label>Party limit<input name="partyLimit" type="number" min="1" max="20" defaultValue="1" required /></label><button>Create private link</button></form>
      {inviteUrl && <output className="invite-output"><strong>Copy and save this now. Raw tokens are not stored.</strong><input readOnly value={inviteUrl} aria-label="New invitation URL" /><button type="button" onClick={() => navigator.clipboard.writeText(inviteUrl).catch(() => setStatus("Copy failed. Select the link manually."))}>Copy link</button></output>}
    </section>

    <section className="admin-panel admin-wide"><header><p>Invitation access</p><h2>Import guest CSV</h2></header>
      <p>Columns: displayName, partyLimit, email (optional), reference (recommended unique household ID). Re-importing the same rows skips existing guests.</p>
      <form onSubmit={event => submit(event, "import_guests")}><label>CSV contents<textarea name="csv" rows={7} placeholder="displayName,partyLimit,email,reference" required /></label><button>Import and download new links</button></form>
      {newLinks.length > 0 && <div className="admin-table"><p>These {newLinks.length} links exist only in this admin session. Download and store them now.</p><button type="button" onClick={() => download("bagas-iga-new-invitations.csv", toCsv([["Guest Name", "Invitation URL"], ...newLinks.map(link => [link.guest, link.invitationUrl])]), "text/csv;charset=utf-8")}>Download new invitation links again</button></div>}
    </section>

    <section className="admin-panel admin-wide"><header><p>Attendance</p><h2>RSVP records</h2></header>
      <dl className="record-counts"><div><dt>Households</dt><dd>{state.guests.length}</dd></div><div><dt>People invited</dt><dd>{invitedPeople}</dd></div><div><dt>Responded</dt><dd>{responded}</dd></div><div><dt>Attending</dt><dd>{attending}</dd></div><div><dt>Declined</dt><dd>{declined}</dd></div><div><dt>Pending</dt><dd>{Math.max(0, state.guests.length - responded)}</dd></div><div><dt>Expected places</dt><dd>{headcount}</dd></div></dl>
      <button type="button" onClick={() => exportFile("rsvps")}>Export RSVP CSV</button> <button type="button" onClick={() => exportFile("backup")}>Download private data backup</button>
      <div className="admin-table">{state.rsvps.length ? state.rsvps.map(row => <article key={string(row.id)}><strong>{string(row.display_name)}</strong><span>{string(row.attendance)} · party {string(row.party_size)}</span><small>{string(row.updated_at)}</small></article>) : <p>No RSVP responses yet.</p>}</div>
    </section>

    <section className="admin-panel admin-wide"><header><p>Invitation access</p><h2>Guests</h2></header><div className="admin-table">
      {state.guests.map(row => <details key={string(row.id)}><summary>{string(row.display_name)} · {string(row.status)} · party {string(row.party_limit)}</summary>
        <form onSubmit={event => submit(event, "update_guest")}><input type="hidden" name="id" value={string(row.id)} /><label>Name<input name="displayName" defaultValue={string(row.display_name)} required /></label><label>Party limit<input name="partyLimit" type="number" min="1" max="20" defaultValue={string(row.party_limit)} required /></label><label>Access<select name="status" defaultValue={string(row.status)}><option value="active">Active</option><option value="revoked">Revoked</option></select></label><button>Save guest</button></form>
        <button type="button" onClick={() => { if (confirm("Regenerate this invitation link? The old link stops working immediately.")) regenerate(string(row.id)); }}>Regenerate link</button>
      </details>)}
    </div></section>
    </div>

    <div hidden={tab !== "hadiah"} className="admin-pane">
    <section className="admin-panel"><header><p>Catalogue</p><h2>Add gift</h2></header><form onSubmit={event => submit(event, "create_gift")}><label>Title<input name="title" required /></label><label>Category<select name="category"><option value="bagas">For Bagas</option><option value="iga">For Iga</option><option value="home">For Our Home</option></select></label><label>Description<textarea name="description" /></label><label>Image URL<input name="imageUrl" placeholder="HTTPS URL or /assets/…" /></label><label>Purchase URL<input name="purchaseUrl" type="url" /></label><label>Price label<input name="priceLabel" /></label><label className="check"><input name="shippingRequired" type="checkbox" /> Requires shipping</label><button>Add item</button></form></section>

    <section className="admin-panel admin-wide"><header><p>Catalogue</p><h2>Gifts &amp; reservations</h2></header><div className="admin-table">
      {state.gifts.map(row => <details key={string(row.id)}><summary>{string(row.title)} · {string(row.status)}</summary>
        <form onSubmit={event => submit(event, "update_gift")}><input type="hidden" name="id" value={string(row.id)} /><label>Title<input name="title" defaultValue={string(row.title)} required /></label><label>Category<select name="category" defaultValue={string(row.recipient_category)}><option value="bagas">For Bagas</option><option value="iga">For Iga</option><option value="home">For Our Home</option></select></label><label>Description<textarea name="description" defaultValue={string(row.description)} /></label><label>Image URL<input name="imageUrl" type="url" defaultValue={string(row.image_url)} /></label><label>Purchase URL<input name="purchaseUrl" type="url" defaultValue={string(row.purchase_url)} /></label><label>Price label<input name="priceLabel" defaultValue={string(row.price_label)} /></label><label className="check"><input name="shippingRequired" type="checkbox" defaultChecked={Boolean(row.shipping_required)} /> Requires shipping</label><button>Save gift</button></form>
        {row.status === "reserved" && <button type="button" onClick={() => action("admin_release_gift", { id: row.id })}>Release reservation</button>}
      </details>)}
      {state.reservations.map(row => <article key={string(row.id)}><strong>{string(row.gift_title)}</strong><span>{string(row.status)} · {string(row.guest_name)}</span><small>{string(row.reserved_at)}</small></article>)}
    </div></section>
    </div>

    <div hidden={tab !== "foto"} className="admin-pane">
    <section className="admin-panel admin-wide"><header><p>Content CMS</p><h2>Portraits</h2></header>
      <p>Portrait photos for the “Profil” section on the landing. JPG/PNG/WebP, up to 6 MB. Uploaded straight to storage and live immediately.</p>
      <div className="admin-table">
        {(["bagas", "iga"] as const).map(who => (
          <article key={who}>
            <strong>{who === "bagas" ? "Portrait Bagas" : "Portrait Iga"}</strong>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) uploadPortrait(who, file); event.target.value = ""; }} />
          </article>
        ))}
      </div>
    </section>
    </div>

    <div hidden={tab !== "kartu"} className="admin-pane">
    <section className="admin-panel"><header><p>Archive CMS</p><h2>Add entry</h2></header><form onSubmit={event => submit(event, "create_archive")}><label>Title<input name="title" required /></label><label>Slug<input name="slug" required pattern="[a-z0-9-]+" /></label><label>Type<select name="type"><option>photograph</option><option>place</option><option>object</option><option>conversation</option><option>note</option><option>audio</option><option>other</option></select></label><label>Excerpt<textarea name="excerpt" /></label><label>Story<textarea name="story" rows={6} /></label><label>Media URL<input name="mediaUrl" type="url" /></label><label>Visibility<select name="visibility"><option value="guests">Unlisted / draft</option><option value="public">Public</option></select></label><label className="check"><input name="featured" type="checkbox" /> Featured</label><label className="check"><input name="published" type="checkbox" /> Published</label><button>Add archive entry</button></form></section>

    <section className="admin-panel admin-wide"><header><p>Archive CMS</p><h2>Manage entries</h2></header><p>Only published public entries appear in the Archive. Unlisted entries remain private drafts.</p><div className="admin-table">
      {state.archive.map(row => <details key={string(row.id)}><summary>{string(row.title)} · {row.published ? "published" : "draft"} · {string(row.visibility)}</summary>
        <form onSubmit={event => submit(event, "update_archive")}><input type="hidden" name="id" value={string(row.id)} /><label>Title<input name="title" defaultValue={string(row.title)} required /></label><label>Slug<input name="slug" defaultValue={string(row.slug)} required /></label><label>Type<input name="type" defaultValue={string(row.type)} /></label><label>Excerpt<textarea name="excerpt" defaultValue={string(row.excerpt)} /></label><label>Story<textarea name="story" rows={6} defaultValue={string(row.story)} /></label><label>Media URL<input name="mediaUrl" type="url" defaultValue={string(row.media_url)} /></label><label>Featured order<input name="featuredOrder" type="number" min="0" defaultValue={string(row.featured_order)} /></label><label>Visibility<select name="visibility" defaultValue={string(row.visibility)}><option value="guests">Unlisted / draft</option><option value="public">Public</option></select></label><label className="check"><input name="featured" type="checkbox" defaultChecked={Boolean(row.featured)} /> Featured</label><label className="check"><input name="published" type="checkbox" defaultChecked={Boolean(row.published)} /> Published</label><button>Save entry</button></form>
        <button type="button" onClick={() => action("archive_entry", { id: row.id })}>Archive / unpublish</button>
      </details>)}
    </div></section>

    <section className="admin-panel admin-settings"><header><p>Private configuration</p><h2>Lifecycle &amp; details</h2></header><form onSubmit={event => submit(event, "set_setting")}><label>Setting<select name="key"><option value="site_phase">Site phase (auto, pre-wedding, wedding-day, post-wedding)</option><option value="rsvp_enabled">RSVP (auto, on, off)</option><option value="gifts_enabled">Gifts (auto, on, off)</option><option value="marks_enabled">Leave a Mark (auto, on, off)</option><option value="shipping_instructions">Private shipping instructions</option><option value="cash_gift_details">Cash gift details</option></select></label><label>Value<textarea name="value" rows={5} placeholder="Use auto unless overriding a feature" required /></label><button>Save setting</button></form><div className="admin-table">{state.settings.map(row => <article key={string(row.key)}><strong>{string(row.key)}</strong><span>{string(row.value)}</span></article>)}</div></section>
    <PasswordPanel />
    </div>

    <div hidden={tab !== "konten"} className="admin-pane">
      {contentValues === null
        ? <section className="admin-panel admin-wide"><p>Loading content…</p></section>
        : CONTENT_SECTIONS.map(section => (
          <section key={section.id} className="admin-panel admin-wide">
            <header><p>Content CMS</p><h2>{section.label} <small>{section.fields.length} field{section.photo ? " · 2 foto" : ""}</small></h2></header>
            {section.photo && <p className="hint">Portrait photos for this section are managed in the <strong>Foto Landing</strong> tab.</p>}
            <form onSubmit={event => { event.preventDefault(); saveSection(section.id, event.currentTarget); }}>
              {section.fields.map(field => (
                <label key={field.key} className="admin-field">
                  <span>{field.label} <small>{section.id}.{field.key}</small></span>
                  <input name={`k_${field.key}`} defaultValue={contentValues[`${section.id}.${field.key}`] ?? field.value} maxLength={500} />
                </label>
              ))}
              <button>Simpan seksi — landing live</button>
            </form>
          </section>
        ))}
    </div>

    <div hidden={tab !== "kartu"} className="admin-pane">
    <section className="admin-panel admin-wide"><header><p>Moderation queue</p><h2>Guest marks</h2></header><label>Status filter<select value={markFilter} onChange={event => setMarkFilter(event.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option></select></label><div className="admin-table">{visibleMarks.length ? visibleMarks.map(row => <article key={string(row.id)}><strong>{string(row.author_name)}</strong><span>{string(row.message) || "Drawing only"}</span><small>{string(row.visibility)} · {string(row.moderation_status)} · {string(row.created_at)}</small>{Boolean(row.drawing_key) && <a href={`/api/marks/${row.id}/image`} target="_blank" rel="noreferrer">View drawing</a>}<div><button type="button" onClick={() => action("moderate_mark", { id: row.id, status: "approved" })}>Approve</button><button type="button" onClick={() => action("moderate_mark", { id: row.id, status: "rejected" })}>Reject</button></div></article>) : <p>No marks in this status.</p>}</div></section>
    </div>
   </div>;
}
