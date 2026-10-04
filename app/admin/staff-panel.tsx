"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { StaffAccount } from "@/lib/staff";
async function loadAccounts(): Promise<StaffAccount[]> {
  const response = await fetch("/api/admin/staff", { cache: "no-store" });
  const data = await response.json() as { staff?: StaffAccount[]; error?: string };
  if (!response.ok || !data.staff) throw new Error(data.error || "Daftar petugas belum tersedia.");
  return data.staff;
}
async function saveAccount(values: Record<string, unknown>) {
  const response = await fetch("/api/admin/staff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(values) });
  const data = await response.json() as { error?: string };
  if (!response.ok) throw new Error(data.error || "Akun belum tersimpan.");
}
function StaffEditor({ account, onSaved }: { account: StaffAccount; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(account.display_name), [enabled, setEnabled] = useState(Boolean(account.enabled)), [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [status, setStatus] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setStatus("");
    try { await saveAccount({ op: "save", id: account.id, name, enabled, password }); setPassword(""); await onSaved(); setStatus(password || !enabled ? "Disimpan. Sesi login lama telah dicabut." : "Akun petugas disimpan."); }
    catch (e) { setStatus(e instanceof Error ? e.message : "Akun belum tersimpan."); }
    finally { setBusy(false); }
  }
  return <article className="staff-account-editor"><header><h3>{account.display_name}</h3><p>@{account.username} · {account.enabled ? "Aktif" : "Nonaktif"}</p></header><form onSubmit={submit}>
    <label>Nama petugas<input value={name} onChange={e => setName(e.target.value)} maxLength={80} required /></label>
    <label>Ganti password<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={12} maxLength={128} autoComplete="new-password" placeholder="Kosongkan untuk mempertahankan password" /></label>
    <label className="staff-enabled"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />Akses petugas aktif</label><button disabled={busy}>{busy ? "Menyimpan…" : "Simpan akun petugas"}</button><p role="status">{status}</p>
  </form></article>;
}
export function StaffPanel() {
  const [accounts, setAccounts] = useState<StaffAccount[]>([]), [status, setStatus] = useState("Memuat petugas…"), [busy, setBusy] = useState(false);
  const [name, setName] = useState(""), [username, setUsername] = useState(""), [password, setPassword] = useState("");
  const reload = async () => { setAccounts(await loadAccounts()); };
  useEffect(() => { let cancelled = false; loadAccounts().then(rows => { if (!cancelled) { setAccounts(rows); setStatus(""); } }).catch(e => { if (!cancelled) setStatus(e instanceof Error ? e.message : "Daftar petugas belum tersedia."); }); return () => { cancelled = true; }; }, []);
  async function create(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setStatus("");
    try { await saveAccount({ op: "create", name, username, password }); setName(""); setUsername(""); setPassword(""); await reload(); setStatus("Akun dibuat. Berikan username dan password kepada petugas."); }
    catch (e) { setStatus(e instanceof Error ? e.message : "Akun belum tersimpan."); }
    finally { setBusy(false); }
  }
  return <section className="admin-panel admin-wide staff-management"><header><h2>Petugas hari H</h2></header><p>Petugas dapat mencari tamu, scan QR, mencatat kedatangan, dan melihat jumlah yang sudah datang. Sesi berlaku 12 jam.</p>
    <p><a href="/staff" target="_blank" rel="noopener noreferrer">Buka meja kedatangan</a></p><p>Alamat login petugas: <strong>/staff</strong></p>
    <form className="staff-create-form" onSubmit={create}><h3>Buat akun petugas</h3><label>Nama petugas<input value={name} onChange={e => setName(e.target.value)} maxLength={80} required /></label><label>Username<input value={username} onChange={e => setUsername(e.target.value.toLowerCase())} minLength={3} maxLength={40} pattern={"[a-z0-9][a-z0-9._\\-]{2,39}"} autoCapitalize="none" autoComplete="off" required /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /></label><p>Minimal 12 karakter. Password tidak ditampilkan lagi setelah disimpan.</p><button disabled={busy}>{busy ? "Membuat…" : "Buat akun petugas"}</button></form>
    <p role="status">{status}</p><div className="staff-account-list">{accounts.length ? accounts.map(account => <StaffEditor key={account.id} account={account} onSaved={reload} />) : <p>Belum ada akun petugas.</p>}</div>
  </section>;
}
