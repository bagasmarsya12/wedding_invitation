"use client";

export function LogoutButton() {
  return (
    <button type="button" onClick={async () => {
      try { await fetch("/api/admin/logout", { method: "POST" }); } catch { /* still leave the desk */ }
      window.location.reload();
    }}>Sign out</button>
  );
}
