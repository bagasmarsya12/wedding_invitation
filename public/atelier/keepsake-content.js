const clean=(value,max=2000)=>Array.from(String(value??'').normalize('NFC').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'')).slice(0,max).join('');
export const DEFAULT_CONTENT={
 language:'id',recipient:'',
 card:{forLabel:'Untuk',genericRecipient:'kamu',frontNote:'Sedikit dari hari kami,\nuntuk kamu simpan.',message:'Sedikit dari hari kami,\nuntuk kamu simpan.',signatureGreeting:'Dengan sayang,',signatureNames:'Iga dan Bagas'},
 ui:{
  pageTitle:'Keepsake — Iga dan Bagas',loading:'Menyiapkan kartumu…',downloadsAria:'Unduh kartu',progressAria:'Menyiapkan video',
  hintFront:'Ketuk kartu untuk membaca pesan.',hintBack:'Ketuk kartu untuk kembali ke depan.',hintNext:'Ketuk kartu untuk melanjutkan pesan.',
  downloadFront:'Unduh gambar depan',downloadBack:'Unduh gambar belakang',downloadBackPage:'Unduh gambar belakang · {page}/{pages}',
  downloadVideo:'Unduh video',downloadVideoReady:'Unduh video MP4',cancel:'Batalkan',
  preparingImage:'Menyiapkan gambar…',imageReady:'Gambar siap disimpan.',
  preparingVideo:'Menyiapkan video… {progress}%',videoReady:'Videonya siap. Ketuk untuk mengunduh.',
  videoCancelled:'Pembuatan video dibatalkan.',imageFailed:'Gambar belum bisa disimpan. Coba lagi.',
  videoFailed:'Video belum bisa dibuat di browser ini. Gambar tetap bisa disimpan.',
  loadFailed:'Kartunya belum bisa dimuat. Coba buka kembali.',graphicsFailed:'Tampilan gambar tetap bisa dibuka dan disimpan.',
  frontAria:'Kartu untuk {name}. {hint}',backAria:'Pesan untuk {name}. {message} {hint}'
 }
};
export function normalizeContent(input={}){
 const card={},ui={};
 for(const key of Object.keys(DEFAULT_CONTENT.card))card[key]=clean(input.card?.[key]??DEFAULT_CONTENT.card[key],key==='message'?600:key==='frontNote'?180:120);
 for(const key of Object.keys(DEFAULT_CONTENT.ui))ui[key]=clean(input.ui?.[key]??DEFAULT_CONTENT.ui[key],500);
 return {language:/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(input.language??'')?input.language:'id',recipient:clean(input.recipient,120),card,ui};
}
export const format=(value,params={})=>value.replace(/\{(\w+)\}/g,(match,key)=>params[key]===undefined?match:String(params[key]));
export async function loadKeepsakeContent(){
 const response=await fetch('./content.json?v=7',{cache:'no-store'});
 if(!response.ok)throw new Error('Content unavailable');
 return normalizeContent(await response.json());
}
