import { createSessionToken, readSessionToken } from './admin-auth';
export const ARCHIVE_GUEST_COOKIE = 'wedding_archive_guest';
export const ARCHIVE_GUEST_TTL = 7*24*60*60;
export type ArchiveGuestIdentity = {id:string;hash:string};
async function guestKey(secret:Uint8Array) {
  const label=new TextEncoder().encode('wedding:archive-guest:v1');
  const material=new Uint8Array(secret.length+label.length);material.set(secret);material.set(label,secret.length);
  return new Uint8Array(await crypto.subtle.digest('SHA-256',material));
}
export async function createArchiveGuestSession(identity:ArchiveGuestIdentity,secret:Uint8Array,now=Date.now()) {
  return createSessionToken(JSON.stringify(identity),await guestKey(secret),now);
}
export async function readArchiveGuestSession(token:string,secret:Uint8Array,now=Date.now()):Promise<ArchiveGuestIdentity|null> {
  if(token.length>1024)return null;
  const payload=await readSessionToken(token,await guestKey(secret),now);if(!payload)return null;
  try {const value=JSON.parse(payload);return typeof value.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value.id)&&typeof value.hash==='string'&&/^[a-f0-9]{64}$/.test(value.hash)?value:null;}catch{return null;}
}
