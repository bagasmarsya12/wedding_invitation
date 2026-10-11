import { allowMutation,privateJson,readJsonBody,requireAdmin,sameOriginMutation } from '@/lib/server';
import { sectionDefinition } from '@/lib/cms-editorial';
import { editorState,mutateEditorial,readEditorialRevision,EditorialConflict,EditorialInputError } from '@/lib/cms-editorial-server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  if(!await requireAdmin())return privateJson({error:'Akses admin diperlukan.'},403);
  const query=new URL(request.url).searchParams,id=query.get('section')??'',version=query.get('revision');
  if(!sectionDefinition(id))return privateJson({error:'Section tidak tersedia.'},400);
  try{const state=await editorState(id);if(version){if(!state.document.history.some(r=>r.id===version))return privateJson({error:'Versi tidak tersedia.'},404);const revision=await readEditorialRevision(id,version);if(!revision)return privateJson({error:'Versi tidak tersedia.'},404);return privateJson({...state,revision});}return privateJson(state);}
  catch{return privateJson({error:'Konten belum bisa dimuat. Coba lagi.'},503);}
}
export async function POST(request:Request){
  if(!sameOriginMutation(request))return privateJson({error:'Permintaan tidak bisa diverifikasi.'},403);
  const admin=await requireAdmin();if(!admin)return privateJson({error:'Akses admin diperlukan.'},403);
  const body=await readJsonBody(request,1_000_000);
  if(!body||typeof body.section!=='string'||!sectionDefinition(body.section)||!['save','publish','restore','discard'].includes(String(body.op))||typeof body.version!=='string')return privateJson({error:'Periksa aksi dan section.'},400);
  if(body.op==='restore'&&(typeof body.revision!=='string'||body.snapshot!==undefined))return privateJson({error:'Pilih versi yang ingin dipulihkan.'},400);
  if(!await allowMutation('admin-editorial',admin.userId,90,60_000))return privateJson({error:'Tunggu sebentar sebelum menyimpan lagi.'},429);
  try{return privateJson(await mutateEditorial(body.section,String(body.op),body.version,body.snapshot,admin.email,body.revision));}
  catch(error){return privateJson({error:error instanceof EditorialConflict||error instanceof EditorialInputError?error.message:'Perubahan belum bisa disimpan. Coba lagi.'},error instanceof EditorialConflict?409:error instanceof EditorialInputError?400:503);}
}
