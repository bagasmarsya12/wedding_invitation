/* eslint-disable @next/next/no-html-link-for-pages */
"use client";

import { useState, type FormEvent } from "react";

export function AdminLogin({ returnTo = "" }: { returnTo?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (response.ok) {
        if (/^\/(?:check-in\/[a-f0-9]{32}|admin\/check-in)$/.test(returnTo)) window.location.assign(returnTo);
        else window.location.reload();
        return;
      }
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      setError(payload?.error ?? "Sign in failed. Try again.");
    } catch {
      setError("Network error. Try again.");
    }
    setBusy(false);
  }

  return (
    <main className="product-page admin-page">
      <header className="product-header"><a href="/">Bagas <i>×</i> Iga</a><nav><span>Wedding Desk</span></nav></header>
      <section className="admin-hero"><p>Private management surface</p><h1>Wedding <em>Desk</em></h1><p>Sign in to manage guests, RSVP, gifts, content, and moderation.</p></section>
      <div className="admin-grid">
        <section className="admin-panel admin-login">
          <header><p>Admin access</p><h2>Sign in</h2></header>
          <form onSubmit={submit}>
            <label>Email<input type="email" value={email} autoComplete="username" onChange={event => setEmail(event.target.value)} required /></label>
            <label>Password<input type="password" value={password} autoComplete="current-password" onChange={event => setPassword(event.target.value)} required /></label>
            {error ? <p className="product-status" role="alert">{error}</p> : null}
            <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
