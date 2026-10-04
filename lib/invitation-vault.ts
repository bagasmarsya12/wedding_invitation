import { adminSessionSecret } from './server';

async function key() {
  const secret=await adminSessionSecret();
  const bytes=new Uint8Array(secret.length+20); bytes.set(secret); bytes.set(new TextEncoder().encode('invitation-vault:v1'),secret.length);
  return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',bytes),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const decode=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
async function encrypt(token:string,material:CryptoKey) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},material,new TextEncoder().encode(token));
  return `${encode(iv)}.${encode(new Uint8Array(ciphertext))}`;
}
async function decrypt(value:string|null,material:CryptoKey) {
  if(!value) return null;
  try {
    const [iv,ciphertext]=value.split('.');
    return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv)},material,decode(ciphertext)));
  }catch{return null;}
}

/** One key lookup per request, including bulk imports and exports. */
export async function invitationVault() {
  const material=await key();
  return {seal:(token:string)=>encrypt(token,material),open:(value:string|null)=>decrypt(value,material)};
}
export async function sealInvitationToken(token:string) {return (await invitationVault()).seal(token);}
export async function openInvitationToken(value:string|null) {return (await invitationVault()).open(value);}
