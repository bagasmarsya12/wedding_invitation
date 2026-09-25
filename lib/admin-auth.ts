// Password hashing and signed session tokens for the admin password login.
// WebCrypto only, so this module runs unchanged in Node (tests, seed script)
// and in the Worker runtime.

export type StoredCredential = { salt: string; hash: string; iterations: number };

export const DEFAULT_ITERATIONS = 50_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as BufferSource, iterations },
    material,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function hashPassword(password: string, iterations = DEFAULT_ITERATIONS): Promise<StoredCredential> {
  if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 2_000_000) {
    throw new Error("Unsupported iteration count.");
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, iterations);
  return { salt: toBase64Url(salt), hash: toBase64Url(hash), iterations };
}

export async function verifyPassword(password: string, credential: StoredCredential): Promise<boolean> {
  const expected = fromBase64Url(credential.hash);
  const actual = await derive(password, fromBase64Url(credential.salt), credential.iterations);
  return equalBytes(actual, expected);
}

// Fixed far-miss credential so sign-in attempts against unknown emails pay the
// same PBKDF2 cost, keeping response timing from enumerating accounts.
export const DUMMY_CREDENTIAL: StoredCredential = {
  salt: toBase64Url(new Uint8Array(SALT_BYTES)),
  hash: toBase64Url(new Uint8Array(32)),
  iterations: DEFAULT_ITERATIONS,
};

export function credentialKey(email: string): string {
  return `admin.credential.${email.trim().toLowerCase()}`;
}

export function parseCredential(value: unknown): StoredCredential | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 4_096) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const { salt, hash, iterations } = record;
    if (typeof salt !== "string" || typeof hash !== "string" || typeof iterations !== "number") return null;
    if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 2_000_000) return null;
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(salt) || !/^[A-Za-z0-9_-]{32,128}$/.test(hash)) return null;
    return { salt, hash, iterations };
  } catch {
    return null;
  }
}

// --- signed session tokens (HMAC-SHA256 over a base64url payload) ---

async function sessionKey(secret: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", secret as unknown as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSessionToken(email: string, secret: Uint8Array, now = Date.now()): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ email, exp: now + SESSION_TTL_MS })));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await sessionKey(secret), encoder.encode(payload)));
  return `${payload}.${toBase64Url(signature)}`;
}

export async function readSessionToken(token: string, secret: Uint8Array, now = Date.now()): Promise<string | null> {
  const separator = token.indexOf(".");
  if (separator <= 0) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!signature) return null;
  let valid = false;
  try {
    valid = await crypto.subtle.verify("HMAC", await sessionKey(secret), fromBase64Url(signature) as unknown as BufferSource, encoder.encode(payload));
  } catch {
    return null;
  }
  if (!valid) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { email?: unknown; exp?: unknown };
    if (typeof parsed.email !== "string" || parsed.email.length === 0) return null;
    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp) || parsed.exp < now) return null;
    return parsed.email;
  } catch {
    return null;
  }
}

export function newSecret(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export function secretToText(secret: Uint8Array): string {
  return toBase64Url(secret);
}

export function secretFromText(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(text)) return null;
  return fromBase64Url(text);
}
