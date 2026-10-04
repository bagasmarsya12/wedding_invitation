"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { staffReturnPath } from "@/lib/staff-path";
export function StaffLogin({ returnTo = "/staff" }: { returnTo?: string }) {
  const [username, setUsername] = useState(""), [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try {
      const response = await fetch("/api/staff/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Belum bisa masuk. Coba lagi.");
      window.location.assign(staffReturnPath(returnTo));
    } catch (e) { setError(e instanceof Error ? e.message : "Periksa koneksi lalu coba lagi."); setBusy(false); }
  }
  return <main className="product-page check-in-page staff-page staff-login-page">
    <header className="staff-header"><Link href="/">Bagas <i>×</i> Iga</Link><span>1 November 2026</span></header>
    <section className="staff-login-panel"><h1>Meja kedatangan</h1><p>Masuk dengan akun petugas yang diberikan Bagas & Iga.</p>
      <form onSubmit={submit}><label>Username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={40} required /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" maxLength={128} required /></label>
        {error && <p role="alert" className="staff-error">{error}</p>}<button disabled={busy}>{busy ? "Sedang masuk…" : "Masuk sebagai petugas"}</button>
      </form><a href="/admin">Masuk sebagai admin</a>
    </section>
  </main>;
}
