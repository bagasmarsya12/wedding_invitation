export type SitePhase = "pre-wedding" | "wedding-day" | "post-wedding";

const weddingDay = "2026-11-01";

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function randomInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function phaseForDate(now: Date, override?: string | null): SitePhase {
  if (override === "pre-wedding" || override === "wedding-day" || override === "post-wedding") return override;
  const jakartaDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  if (jakartaDay < weddingDay) return "pre-wedding";
  return jakartaDay === weddingDay ? "wedding-day" : "post-wedding";
}

export function validateRsvp(attendance: unknown, partySize: unknown, partyLimit: number): { attendance: "yes" | "no"; partySize: number } | null {
  if (attendance !== "yes" && attendance !== "no") return null;
  if (attendance === "no") return { attendance, partySize: 0 };
  const size = partySize === undefined ? 1 : partySize;
  if (typeof size !== "number" || !Number.isInteger(size) || size < 1 || size > partyLimit) return null;
  return { attendance, partySize: size };
}

/** No guest-facing count: keep an existing answer's count, otherwise use the
 * invitation's allocated places. This is an allocation, not a new headcount survey. */
export function validateSimpleRsvp(attendance: unknown, partyLimit: number, previous?: { attendance: string; party_size: number } | null) {
  const size = previous?.attendance === "yes" && previous.party_size > 0
    ? Math.min(previous.party_size, partyLimit) : partyLimit;
  return validateRsvp(attendance, size, partyLimit);
}

export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
}

export function safeMediaUrl(value: unknown): string | null {
  if (typeof value === "string" && value.length <= 500 && /^\/assets\/[A-Za-z0-9_./-]+$/.test(value) && !value.includes("..")) return value;
  return safeExternalUrl(value);
}

export function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 33 || !signature.every((byte, index) => bytes[index] === byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13 || String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") return null;
  const width = view.getUint32(16); const height = view.getUint32(20);
  if (!width || !height || width > 2048 || height > 2048) return null;
  return { width, height };
}

export function csvCell(value: unknown): string {
  const raw = String(value ?? "");
  const safe = /^[\s]*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function toCsv(rows: unknown[][]): string {
  return `\uFEFF${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function parseCsv(input: string): string[][] | null {
  if (input.length > 32_000) return null;
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted) quoted = false;
      else if (!cell) quoted = true;
      else return null;
    } else if (!quoted && (char === "," || char === "\n" || char === "\r")) {
      row.push(cell); cell = "";
      if (char === ",") continue;
      if (char === "\r" && input[i + 1] === "\n") i++;
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) return null;
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows.length <= 101 ? rows : null;
}
