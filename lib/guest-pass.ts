/** Pass codes are independent of invitation credentials and contain no name. */
export const PASS_CODE = /^[a-f0-9]{32}$/;
export function passCodeFromInput(value: string, origin: string): string | null {
  const trimmed = value.trim();
  if (PASS_CODE.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.origin !== origin || url.search || url.hash) return null;
    const match = /^\/check-in\/([a-f0-9]{32})\/?$/.exec(url.pathname);
    return match?.[1] ?? null;
  } catch { return null; }
}
export type GuestPassData = { code: string; guestName: string; partyLimit: number; qrData: string; passUrl: string };
