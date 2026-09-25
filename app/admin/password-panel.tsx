"use client";

import { useState, type FormEvent } from "react";

export function PasswordPanel() {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== repeat) {
      setStatus("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (response.ok) {
        setStatus("Password saved. Email + password sign-in is active for this address.");
        setPassword("");
        setRepeat("");
      } else {
        setStatus(payload?.error ?? "Could not save the password.");
      }
    } catch {
      setStatus("Network error. Try again.");
    }
    setBusy(false);
  }

  return (
    <section className="admin-panel">
      <header><p>Admin access</p><h2>Email &amp; password login</h2></header>
      <p>Set or rotate the password for your admin email. Sessions already signed in stay valid.</p>
      <form onSubmit={submit}>
        <label>New password<input type="password" value={password} autoComplete="new-password" minLength={12} maxLength={512} onChange={event => setPassword(event.target.value)} required /></label>
        <label>Repeat password<input type="password" value={repeat} autoComplete="new-password" onChange={event => setRepeat(event.target.value)} required /></label>
        {status ? <p className="product-status" role="status">{status}</p> : null}
        <button disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
      </form>
    </section>
  );
}
