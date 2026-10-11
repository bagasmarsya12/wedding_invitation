import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';

const hook=registerHooks({resolve(specifier,context,next){
 try{return next(specifier,context);}catch(error){
  if(error.code==='ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')){
   const url=new URL(`${specifier}.ts`,context.parentURL);
   if(existsSync(url))return next(url.href,context);
  }
  throw error;
 }
}});
const {keepsakeText,keepsakeMarkup}=await import('../lib/keepsake-design.ts');
const {WEBSITE_DEFAULTS}=await import('../lib/website-content.ts');
hook.deregister();

test('both languages keep the CMS date, Iga & Bagas, guest text and hashtag without venue details',()=>{
 const website={...WEBSITE_DEFAULTS,weddingDate:'2026-11-08',venueName:'Venue must not appear',venueCity:'Hidden city'};
 for(const language of ['id','en']){
  const data={language,name:'Guest <script> & Family',edition:2,website};
  const text=keepsakeText(data),html=keepsakeMarkup(data);
  assert.equal(text.names,'Iga & Bagas');assert.equal(text.firstName,'Iga');assert.equal(text.secondName,'Bagas');
  assert.equal(text.date,'2026-11-08');assert.equal(text.hashtag,'#IganyaBagas');
  assert.ok(html.includes('Guest &lt;script&gt; &amp; Family'));
  assert.ok(html.includes('datetime="2026-11-08"'));
  assert.equal((html.match(/#IganyaBagas/g)||[]).length,2);
  assert.ok(!html.includes('Venue must not appear') && !html.includes('Hidden city'));
  assert.ok(!html.includes('k-venue') && !html.includes('k-back-venue'));
  assert.ok(html.includes('Iga &amp; Bagas'));
 }
});
