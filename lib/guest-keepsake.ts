import { db } from './server';
import { loadLandingContent } from './landing-content';
import { KEEPSAKE_UI_EN } from './keepsake-copy';

export type GuestKeepsakeNote = { language:'id'|'en'; frontNote:string; message:string };
export const EMPTY_GUEST_KEEPSAKE:GuestKeepsakeNote={language:'id',frontNote:'',message:''};
export function validateGuestKeepsake(input:unknown):GuestKeepsakeNote|null {
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  const p=input as Record<string,unknown>;
  if(!['id','en'].includes(String(p.language))||typeof p.frontNote!=='string'||typeof p.message!=='string'||Array.from(p.frontNote).length>180||Array.from(p.message).length>600||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(p.frontNote+p.message))return null;
  return {language:p.language as 'id'|'en',frontNote:p.frontNote.normalize('NFC'),message:p.message.normalize('NFC')};
}
export async function loadGuestKeepsake(guestId:string):Promise<GuestKeepsakeNote> {
  const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(`guest-keepsake.${guestId}`).first<{value:string}>();
  if(!row)return {...EMPTY_GUEST_KEEPSAKE};
  try{return validateGuestKeepsake(JSON.parse(row.value))??{...EMPTY_GUEST_KEEPSAKE};}catch{return {...EMPTY_GUEST_KEEPSAKE};}
}
export async function guestKeepsakePayload(guest:{id:string;display_name:string}) {
  const [note,{values}]=await Promise.all([loadGuestKeepsake(guest.id),loadLandingContent()]);
  const copy=(key:string)=>values[(note.language==='id'?'id.':'')+key]??values[key]??'';
  const sample=[copy('keepsake.note1'),copy('keepsake.note2')].filter(Boolean).join('\n');
  return {language:note.language,recipient:guest.display_name,card:{forLabel:copy('keepsake.forLabel'),genericRecipient:copy('keepsake.genericRecipient'),frontNote:note.frontNote.trim()?note.frontNote:sample,message:note.message.trim()?note.message:sample,signatureGreeting:copy('keepsake.love'),signatureNames:copy('keepsake.signatureNames')},ui:Object.fromEntries(Object.keys(KEEPSAKE_UI_EN).map(key=>[key,copy(`keepsakeUi.${key}`)]))};
}
export type GuestKeepsakePayload=Awaited<ReturnType<typeof guestKeepsakePayload>>;
