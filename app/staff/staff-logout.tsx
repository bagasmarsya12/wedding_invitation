"use client";
import { useState } from "react";
export function StaffLogout() {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function logout() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/staff/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      window.location.assign("/staff");
    } catch { setError("Belum bisa keluar. Coba lagi."); setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={logout}>{busy ? "Keluar…" : "Keluar"}</button>{error && <p role="alert">{error}</p>}</div>;
}
