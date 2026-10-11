import { db } from './server';
/** Only call after resolving a valid private invitation. Never included in public content. */
export async function guestKeepsakeNote(guestId:string):Promise<{note1:string;note2:string}|undefined>{
  const row=await db().prepare('SELECT value FROM settings WHERE key = ?').bind(`guest.keepsake.${guestId}`).first<{value:string}>();
  if(!row)return undefined;
  try{const value=JSON.parse(row.value);if(typeof value.note1==='string'&&typeof value.note2==='string'&&value.note1.length<=120&&value.note2.length<=120)return value;}catch{/* Invalid old records use the shared greeting. */}
  return undefined;
}
