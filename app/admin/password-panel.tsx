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
      setStatus("Kedua kata sandi belum sama.");
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
        setStatus("Kata sandi tersimpan. Kamu bisa masuk memakai email admin dan kata sandi ini.");
        setPassword("");
        setRepeat("");
      } else {
        setStatus(payload?.error ?? "Kata sandi belum tersimpan. Coba kembali.");
      }
    } catch {
      setStatus("Koneksi bermasalah. Coba kembali.");
    }
    setBusy(false);
  }

  return (
    <section className="admin-panel">
      <header><p>Akses admin</p><h2>Masuk dengan email & kata sandi</h2></header>
      <p>Atur kata sandi untuk email adminmu. Sesi yang sudah masuk tetap berlaku.</p>
      <form onSubmit={submit}>
        <label>Kata sandi baru<input type="password" value={password} autoComplete="new-password" minLength={12} maxLength={512} onChange={event => setPassword(event.target.value)} required /></label>
        <label>Ulangi kata sandi<input type="password" value={repeat} autoComplete="new-password" onChange={event => setRepeat(event.target.value)} required /></label>
        {status ? <p className="product-status" role="status">{status}</p> : null}
        <button disabled={busy}>{busy ? "Menyimpan…" : "Simpan kata sandi"}</button>
      </form>
    </section>
  );
}
