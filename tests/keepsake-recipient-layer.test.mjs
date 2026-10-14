import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';

const hook=registerHooks({resolve(specifier,context,next){
 try{return next(specifier,context);}catch(error){
  if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')){
   const url=new URL(`${specifier}.ts`,context.parentURL);
   if(existsSync(url))return next(url.href,context);
  }
  throw error;
 }
}});
const {createWeddingKeepsake}=await import('../lib/wedding-keepsake.ts');
const {KEEPSAKE_SCENE_CSS}=await import('../lib/keepsake-design.ts');
hook.deregister();

test('recipient remains above floral artwork in both exported and offline front cards',async()=>{
 const previousDocument=globalThis.document,previousImage=globalThis.Image;
 const drawings=[];
 const context=new Proxy({
  font:'',measureText(value){return {width:Array.from(value).length*parseFloat(this.font)*.5,actualBoundingBoxDescent:4};},
  fillText(value){drawings.push({kind:'text',value});},drawImage(image){drawings.push({kind:'image',value:image.src});},createPattern(){return {};},
 },{get(target,key){return key in target?target[key]:()=>{};}});
 globalThis.Image=class{naturalWidth=1086;naturalHeight=1448;set src(value){this.url=value;queueMicrotask(()=>this.onload());}get src(){return this.url;}};
 globalThis.document={fonts:{ready:Promise.resolve()},createElement:()=>({getContext:()=>context,toBlob:callback=>callback(new Blob(['test'],{type:'image/png'}))})};
 try{
  for(const name of ['Fixture Tamu QA','Bapak Aditya Pratama Nugraha beserta Ibu Ratna Puspita dan Keluarga']){
   drawings.length=0;
   await createWeddingKeepsake({language:'id',name,edition:0},'front',{serif:'Georgia',sans:'Arial'});
   const lastFlower=drawings.findLastIndex(d=>d.kind==='image'&&d.value.includes('keepsake-florals'));
   const recipientLabel=drawings.findIndex(d=>d.kind==='text'&&d.value==='Untuk');
   assert.ok(lastFlower>=0&&recipientLabel>lastFlower,'The floral layer must be painted before the recipient label');
   assert.equal(drawings.slice(recipientLabel+1).map(d=>d.value).join(' '),name,'Every wrapped name line must be painted above the flowers');
  }
  const zIndex=selector=>Number(KEEPSAKE_SCENE_CSS.match(new RegExp(selector+'\\{[^}]*z-index:(\\d+)'))?.[1]);
  assert.ok(zIndex('\\.k-recipient')>zIndex('\\.k-plant'),'The offline front card must use the same recipient-over-flowers order');
 }finally{globalThis.document=previousDocument;globalThis.Image=previousImage;}
});
