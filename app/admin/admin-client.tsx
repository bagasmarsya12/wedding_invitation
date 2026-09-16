"use client";

import { FormEvent, useEffect, useState } from "react";

type State = { guests: Record<string, unknown>[]; rsvps: Record<string, unknown>[]; gifts: Record<string, unknown>[]; marks: Record<string, unknown>[]; archive: Record<string, unknown>[]; settings: Record<string, unknown>[] };
const empty: State = { guests: [], rsvps: [], gifts: [], marks: [], archive: [], settings: [] };

export function AdminClient() {
  const [state, setState] = useState<State>(empty);
  const [status, setStatus] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const load = async () => { const response = await fetch("/api/admin/state", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setState(result); };
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/state", { cache: "no-store" })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        return result;
      })
      .then(result => { if (!cancelled) setState(result); })
      .catch(error => { if (!cancelled) setStatus(error.message); });
    return () => { cancelled = true; };
  }, []);
  const submit = async (event: FormEvent<HTMLFormElement>, op: string) => {
    event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); setStatus("Saving…");
    const response = await fetch("/api/admin/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op, ...data, featured: data.featured === "on", published: data.published === "on", shippingRequired: data.shippingRequired === "on" }) });
    const result = await response.json(); if (!response.ok) { setStatus(result.error || "Could not save."); return; }
    if (result.inviteUrl) setInviteUrl(`${location.origin}${result.inviteUrl}`); form.reset(); setStatus("Saved."); await load();
  };
  const moderate = async (id: unknown, markStatus: string) => { await fetch("/api/admin/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "moderate_mark", id, status: markStatus }) }); await load(); };
  return <div className="admin-grid">
    <p className="product-status admin-status" role="status">{status}</p>
    <section className="admin-panel admin-create-guest"><header><p>Invitation access</p><h2>Create guest link</h2></header><form onSubmit={event => submit(event, "create_guest")}><label>Guest or family name<input name="displayName" required /></label><label>Email, optional<input name="email" type="email" /></label><label>Party limit<input name="partyLimit" type="number" min="1" max="20" defaultValue="1" /></label><button>Create private link</button></form>{inviteUrl && <output className="invite-output"><strong>Copy this now. The raw token is not stored.</strong><input readOnly value={inviteUrl} /><button onClick={() => navigator.clipboard.writeText(inviteUrl)}>Copy link</button></output>}</section>
    <section className="admin-panel"><header><p>Catalogue</p><h2>Add gift</h2></header><form onSubmit={event => submit(event, "create_gift")}><label>Title<input name="title" required /></label><label>Category<select name="category"><option value="bagas">For Bagas</option><option value="iga">For Iga</option><option value="home">For Our Home</option></select></label><label>Description<textarea name="description" /></label><label>Purchase URL<input name="purchaseUrl" type="url" /></label><label>Price label<input name="priceLabel" /></label><label className="check"><input name="shippingRequired" type="checkbox" /> Requires shipping</label><button>Add item</button></form></section>
    <section className="admin-panel"><header><p>Archive CMS</p><h2>Add entry</h2></header><form onSubmit={event => submit(event, "create_archive")}><label>Title<input name="title" required /></label><label>Slug<input name="slug" required pattern="[a-z0-9-]+" /></label><label>Type<select name="type"><option>photograph</option><option>place</option><option>object</option><option>conversation</option><option>note</option><option>audio</option><option>other</option></select></label><label>Excerpt<textarea name="excerpt" /></label><label>Story<textarea name="story" rows={6} /></label><label>Media URL<input name="mediaUrl" type="url" /></label><label>Visibility<select name="visibility"><option value="guests">Invited guests</option><option value="public">Public</option></select></label><label className="check"><input name="featured" type="checkbox" /> Featured</label><label className="check"><input name="published" type="checkbox" /> Published</label><button>Add archive entry</button></form></section>
    <section className="admin-panel admin-settings"><header><p>Private configuration</p><h2>Lifecycle &amp; details</h2></header><form onSubmit={event => submit(event, "set_setting")}><label>Setting<select name="key"><option value="site_phase">Site phase</option><option value="shipping_instructions">Private shipping instructions</option><option value="cash_gift_details">Cash gift details</option></select></label><label>Value<textarea name="value" rows={5} placeholder="For site phase: pre-wedding, wedding-day, or post-wedding" required /></label><button>Save setting</button></form></section>
    <section className="admin-panel admin-wide"><header><p>Attendance</p><h2>RSVP records</h2></header><div className="admin-table">{state.rsvps.length ? state.rsvps.map(row => <article key={String(row.id)}><strong>{String(row.display_name)}</strong><span>{String(row.attendance)} · party {String(row.party_size)}</span><small>{String(row.updated_at)}</small></article>) : <p>No RSVP responses yet.</p>}</div></section>
    <section className="admin-panel admin-wide"><header><p>Moderation queue</p><h2>Guest marks</h2></header><div className="admin-table">{state.marks.length ? state.marks.map(row => <article key={String(row.id)}><strong>{String(row.author_name)}</strong><span>{String(row.message || "Drawing only")}</span><small>{String(row.visibility)} · {String(row.moderation_status)}</small><div><button onClick={() => moderate(row.id, "approved")}>Approve</button><button onClick={() => moderate(row.id, "rejected")}>Reject</button></div></article>) : <p>No guest marks yet.</p>}</div></section>
    <section className="admin-panel admin-wide"><header><p>Overview</p><h2>Current records</h2></header><dl className="record-counts"><div><dt>Guests</dt><dd>{state.guests.length}</dd></div><div><dt>Gifts</dt><dd>{state.gifts.length}</dd></div><div><dt>Archive</dt><dd>{state.archive.length}</dd></div><div><dt>Marks</dt><dd>{state.marks.length}</dd></div></dl></section>
  </div>;
}
