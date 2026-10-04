"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type QrScanner from "qr-scanner";
import type { CheckInGuest, GuestSearchHit } from "@/lib/check-in";
import { passCodeFromInput } from "@/lib/guest-pass";
import { LiveArrivals } from "@/app/staff/live-arrivals";
const groupLabel: Record<string, string> = { bagas: "Bagas", iga: "Iga", family: "Keluarga", other: "Lainnya", unassigned: "Belum dikelompokkan" };

export function CheckInClient({ initialCode = "" }: { initialCode?: string }) {
  const [input, setInput] = useState(initialCode), [guest, setGuest] = useState<CheckInGuest | null>(null), [mode, setMode] = useState<"qr" | "name">("qr");
  const [party, setParty] = useState(1), [message, setMessage] = useState(initialCode ? "Mencari tamu…" : ""), [busy, setBusy] = useState(Boolean(initialCode));
  const [camera, setCamera] = useState(false), [cameraStarting, setCameraStarting] = useState(false), [refreshKey, setRefreshKey] = useState(0);
  const [query, setQuery] = useState(""), [filter, setFilter] = useState("all"), [hits, setHits] = useState<GuestSearchHit[]>([]), [searched, setSearched] = useState(false), [limited, setLimited] = useState(false), [searchBusy, setSearchBusy] = useState(false), [searchError, setSearchError] = useState("");
  const video = useRef<HTMLVideoElement>(null), scanner = useRef<QrScanner | null>(null), pending = useRef(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const alive = useRef(true), cameraGeneration = useRef(0), starting = useRef(false), searchGeneration = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; scanner.current?.destroy(); }; }, []);
  useEffect(() => { if (guest?.guestId) resultHeading.current?.focus(); }, [guest?.guestId]);
  function stopCamera() { cameraGeneration.current++; scanner.current?.stop(); setCamera(false); }
  function acceptGuest(result: CheckInGuest, nextMode: "qr" | "name") {
    setGuest(result); setMode(nextMode); setParty(Math.min(result.partyLimit, Math.max(1, result.attendance === "yes" ? result.expectedParty || 1 : 1)));
    setMessage(result.arrival ? "Undangan ini sudah check-in." : "Cocokkan nama tamu, lalu konfirmasi jumlah yang datang.");
  }
  async function lookup(raw: string, nextMode: "qr" | "name" = "qr") {
    if (pending.current) return;
    stopCamera();
    const code = nextMode === "qr" ? passCodeFromInput(raw, location.origin) : null;
    if (nextMode === "qr" && !code) { setGuest(null); setMessage("Masukkan kode QR atau link pass dari undangan ini."); return; }
    if (code) setInput(code);
    pending.current = true; setBusy(true); setGuest(null); setMessage("Mencari tamu…");
    try {
      const response = await fetch(`/api/admin/check-in?${nextMode === "qr" ? "code" : "guestId"}=${encodeURIComponent(code || raw)}`, { cache: "no-store" });
      const data = await response.json() as { guest?: CheckInGuest; error?: string };
      if (!response.ok || !data.guest) throw new Error(data.error || "Tamu belum ditemukan.");
      if (alive.current) acceptGuest(data.guest, nextMode);
    } catch (e) { if (alive.current) setMessage(e instanceof Error ? e.message : "Periksa koneksi lalu coba kembali."); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  useEffect(() => {
    if (!initialCode) return;
    let cancelled = false; pending.current = true;
    fetch(`/api/admin/check-in?code=${encodeURIComponent(initialCode)}`, { cache: "no-store" }).then(async response => {
      const data = await response.json() as { guest?: CheckInGuest; error?: string }; if (!response.ok || !data.guest) throw new Error(data.error || "Tamu belum ditemukan."); return data.guest;
    }).then(result => { if (!cancelled) acceptGuest(result, "qr"); }).catch(e => { if (!cancelled) setMessage(e instanceof Error ? e.message : "Tamu belum ditemukan."); })
      .finally(() => { if (!cancelled) { pending.current = false; setBusy(false); } });
    return () => { cancelled = true; };
  }, [initialCode]);
  async function startCamera() {
    if (!video.current || pending.current || starting.current || camera) return;
    const generation = ++cameraGeneration.current; starting.current = true; setCameraStarting(true); setCamera(true); setGuest(null); setInput(""); setMessage("Membuka kamera…");
    try {
      const { default: Scanner } = await import("qr-scanner");
      if (!alive.current || generation !== cameraGeneration.current || !video.current) return;
      scanner.current?.destroy();
      const instance = new Scanner(video.current, result => { void lookup(result.data); }, { preferredCamera: "environment", maxScansPerSecond: 5, returnDetailedScanResult: true });
      scanner.current = instance; await instance.start();
      if (!alive.current || generation !== cameraGeneration.current) { instance.destroy(); return; }
      setMessage("Arahkan kamera ke QR pass tamu.");
    } catch { if (alive.current && generation === cameraGeneration.current) { scanner.current?.destroy(); scanner.current = null; setCamera(false); setMessage("Kamera belum tersedia. Pilih gambar QR atau cari nama tamu."); } }
    finally { starting.current = false; if (alive.current) setCameraStarting(false); }
  }
  async function scanImage(file: File) {
    if (pending.current || starting.current) return;
    stopCamera(); pending.current = true; setBusy(true); setMessage("Membaca gambar QR…"); let code: string | null = null;
    try { const { default: Scanner } = await import("qr-scanner"); code = (await Scanner.scanImage(file, { returnDetailedScanResult: true })).data; }
    catch { if (alive.current) setMessage("QR belum terbaca. Gunakan kode pass atau cari nama tamu."); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
    if (code && alive.current) await lookup(code);
  }
  async function search(nextFilter = filter) {
    const generation = ++searchGeneration.current; setSearchBusy(true); setSearchError(""); setHits([]); setSearched(false);
    try {
      const response = await fetch(`/api/admin/check-in?q=${encodeURIComponent(query)}&filter=${nextFilter}`, { cache: "no-store" });
      const data = await response.json() as { guests?: GuestSearchHit[]; limited?: boolean; error?: string };
      if (!response.ok || !data.guests) throw new Error(data.error || "Pencarian belum tersedia.");
      if (alive.current && generation === searchGeneration.current) { setHits(data.guests); setLimited(Boolean(data.limited)); setSearched(true); }
    } catch (e) { if (alive.current && generation === searchGeneration.current) setSearchError(e instanceof Error ? e.message : "Periksa koneksi lalu coba kembali."); }
    finally { if (alive.current && generation === searchGeneration.current) setSearchBusy(false); }
  }
  async function confirm(event: FormEvent) {
    event.preventDefault(); if (!guest || guest.arrival || pending.current) return;
    pending.current = true; setBusy(true); setMessage("Mencatat kedatangan…");
    try {
      const identity = mode === "qr" ? { code: guest.code } : { guestId: guest.guestId };
      const response = await fetch("/api/admin/check-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...identity, partySize: party }) });
      const data = await response.json() as { guest?: CheckInGuest; duplicate?: boolean; error?: string };
      if (data.guest && alive.current) setGuest(data.guest);
      if (!response.ok && !data.duplicate) throw new Error(data.error || "Kedatangan belum tercatat.");
      if (alive.current) {
        setMessage(data.duplicate ? "Sudah check-in sebelumnya. Kedatangan kedua tidak ditambahkan." : "Kedatangan berhasil dicatat.");
        setRefreshKey(value => value + 1); setHits(rows => rows.map(row => row.guestId === guest.guestId ? { ...row, arrived: true } : row));
      }
    } catch (e) { if (alive.current) setMessage(e instanceof Error ? e.message : "Periksa koneksi lalu coba kembali."); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  return <div className="staff-workspace"><LiveArrivals refreshKey={refreshKey} />
    <section className="staff-scanner" aria-labelledby="scanner-title"><h2 id="scanner-title">Scan QR tamu</h2><p>Scan, cocokkan nama, lalu catat jumlah yang datang.</p>
      <div className="check-in-controls"><button type="button" disabled={busy || cameraStarting} onClick={camera ? stopCamera : startCamera}>{cameraStarting ? "Membuka kamera…" : camera ? "Tutup kamera" : "Buka kamera"}</button><label className="staff-file">Pilih gambar QR<input type="file" accept="image/*" disabled={busy || cameraStarting} onChange={e => { const file = e.target.files?.[0]; if (file) void scanImage(file); e.target.value = ""; }} /></label></div>
      <video ref={video} muted playsInline hidden={!camera} /><details><summary>Masukkan kode QR</summary><form onSubmit={e => { e.preventDefault(); if (!cameraStarting) void lookup(input); }}><label>Kode pass atau link QR<input value={input} maxLength={512} onChange={e => setInput(e.target.value)} autoComplete="off" required /></label><button disabled={busy || cameraStarting}>Cari lewat kode</button></form></details>
    </section>
    <section className="staff-name-search" aria-labelledby="name-search-title"><h2 id="name-search-title">Cari nama tamu</h2><p>Tidak membawa QR? Cari nama pada undangannya.</p>
      <form onSubmit={e => { e.preventDefault(); void search(); }}><label>Nama tamu<input value={query} onChange={e => setQuery(e.target.value)} maxLength={80} autoComplete="off" placeholder="Ketik nama tamu" /></label><label>Status kedatangan<select value={filter} onChange={e => { setFilter(e.target.value); void search(e.target.value); }}><option value="all">Semua tamu</option><option value="pending">Belum datang</option><option value="arrived">Sudah check-in</option></select></label><button disabled={searchBusy}>{searchBusy ? "Mencari…" : "Cari nama"}</button></form>
      {searchError && <p role="alert" className="staff-error">{searchError}</p>}{searched && <><p role="status">{hits.length ? `${hits.length} undangan ditemukan${limited ? "; persempit nama untuk hasil lainnya" : ""}.` : "Nama belum ditemukan. Coba ejaan lain atau gunakan kode QR."}</p><ul className="staff-search-results">{hits.map(hit => <li key={hit.guestId}><button type="button" disabled={busy || cameraStarting} onClick={() => void lookup(hit.guestId, "name")}><strong>{hit.name}</strong><span>{groupLabel[hit.group] || "Lainnya"} · maks. {hit.partyLimit} orang · ref. {hit.guestId.slice(-6)}</span><small>{hit.arrived ? "Sudah check-in" : "Pilih undangan"}</small></button></li>)}</ul></>}
    </section>
    <section className="staff-confirmation" aria-label="Konfirmasi kedatangan"><p role="status" className="staff-result-status">{message}</p>
      {guest && <div className={`check-in-result ${guest.arrival ? "is-arrived" : ""}`}><h2 ref={resultHeading} tabIndex={-1}>{guest.name}</h2><p>{groupLabel[guest.group] || "Lainnya"} · ref. {guest.guestId.slice(-6)} · maksimal {guest.partyLimit} orang</p><p>RSVP: {guest.attendance === "yes" ? `hadir (${guest.expectedParty} orang)` : guest.attendance === "no" ? "tidak hadir — konfirmasi ulang dengan tamu" : "belum menjawab"}</p>
        {guest.arrival ? <><strong>Sudah check-in · {guest.arrival.partySize} orang</strong><p>{new Date(guest.arrival.at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</p><p>Dicatat oleh {guest.arrival.by} · {guest.arrival.method === "name" ? "pencarian nama" : "QR pass"}</p><button type="button" onClick={() => { setGuest(null); setInput(""); setMessage("Siap menerima tamu berikutnya."); }}>Tamu berikutnya</button></> : <form onSubmit={confirm}><label>Jumlah yang datang<select value={party} onChange={e => setParty(Number(e.target.value))} disabled={busy}>{Array.from({ length: guest.partyLimit }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} orang</option>)}</select></label><p>{mode === "name" ? "Pastikan nama dan kelompok undangan sesuai dengan tamu." : "Konfirmasi jumlah rombongan dengan tamu."}</p><button disabled={busy}>{busy ? "Mencatat…" : "Konfirmasi check-in"}</button></form>}
      </div>}
    </section>
  </div>;
}
