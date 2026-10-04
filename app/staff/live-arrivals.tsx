"use client";
import { useEffect, useState } from "react";
import type { ArrivalSummary } from "@/lib/check-in";
export function LiveArrivals({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<ArrivalSummary | null>(null), [error, setError] = useState(""), [expired, setExpired] = useState(false);
  useEffect(() => {
    let stopped = false, running = false, controller: AbortController | null = null;
    async function refresh() {
      if (stopped || running || document.visibilityState === "hidden") return;
      running = true; controller = new AbortController();
      const timer = setTimeout(() => controller?.abort(), 10000);
      try {
        const response = await fetch("/api/staff/arrivals", { cache: "no-store", signal: controller.signal });
        if (response.status === 403) { if (!stopped) setExpired(true); throw new Error("Sesi berakhir. Masuk kembali."); }
        const result = await response.json() as ArrivalSummary & { error?: string };
        if (!response.ok) throw new Error(result.error || "Data belum bisa diperbarui.");
        if (!stopped) { setData(result); setError(""); setExpired(false); }
      } catch (e) { if (!stopped) setError(e instanceof Error && e.name !== "AbortError" ? e.message : "Koneksi terputus. Data terakhir ditampilkan; kedatangan baru perlu koneksi."); }
      finally { clearTimeout(timer); running = false; }
    }
    void refresh();
    const interval = setInterval(() => void refresh(), 5000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus); document.addEventListener("visibilitychange", focus);
    return () => { stopped = true; clearInterval(interval); controller?.abort(); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [refreshKey]);
  return <><section className="staff-arrival-dashboard" aria-label="Ringkasan kedatangan">
    <dl className="staff-counts"><div><dt>Orang sudah datang</dt><dd>{data?.arrivedPeople ?? "—"}</dd></div><div><dt>Undangan check-in</dt><dd>{data?.arrivedInvitations ?? "—"}</dd></div><div><dt>Undangan belum datang</dt><dd>{data?.pendingInvitations ?? "—"}</dd></div></dl>
    <p>{data ? `${data.activeInvitations} undangan aktif · ${data.expectedPeople} orang RSVP hadir` : "Memuat kedatangan…"}</p>
    <p className="staff-sync" role="status">{error || (data ? `Diperbarui ${new Date(data.updatedAt).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" })} WIB · otomatis setiap 5 detik` : "")}{expired && <> <a href="/staff">Masuk kembali</a></>}</p>
  </section>{data && <section className="staff-recent" aria-labelledby="recent-arrivals"><h2 id="recent-arrivals">Kedatangan terbaru</h2>
    {data.recent.length ? <ul>{data.recent.map(row => <li key={row.guestId}><strong>{row.name}</strong><span>{row.partySize} orang · {new Date(row.at).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })} WIB</span><small>{row.method === "name" ? "Pencarian nama" : "QR pass"}</small></li>)}</ul> : <p>Belum ada tamu yang check-in.</p>}</section>}</>;
}
