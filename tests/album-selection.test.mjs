import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
const hook=registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')){
      const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context);
    }throw error;
  }
}});
const {defaultWebsiteBlocks,validateWebsiteBlocks,isHomepagePhoto,MAX_ALBUM_PHOTOS}=await import('../lib/website-content.ts');
hook.deregister();

test('legacy homepage photos remain selected while archive-only photos retain their identity and order',()=>{
  const blocks=defaultWebsiteBlocks();
  const originalIds=blocks.photos.map(photo=>photo.id);
  blocks.photos.splice(2,0,{id:'archive-only',slot:'gallery-extra',caption:{id:'Tambahan',en:'Extra'},homepage:false});
  const clean=validateWebsiteBlocks(blocks);
  assert.ok(clean);
  assert.deepEqual(clean.photos.filter(isHomepagePhoto).map(photo=>photo.id),originalIds);
  assert.equal(clean.photos[2].id,'archive-only');
  assert.equal(clean.photos[2].homepage,false);
  clean.photos[2].homepage=true;
  assert.equal(validateWebsiteBlocks(clean).photos.filter(isHomepagePhoto).length,originalIds.length+1);
});

test('album allows 100 photos, rejects invalid selection flags and keeps duplicate-slot protection',()=>{
  const blocks=defaultWebsiteBlocks();
  blocks.photos=Array.from({length:MAX_ALBUM_PHOTOS},(_,i)=>({id:`photo-${i}`,slot:`gallery-${i}`,caption:{id:'',en:''},homepage:i<17}));
  assert.ok(validateWebsiteBlocks(blocks));
  blocks.photos[0].homepage='false';assert.equal(validateWebsiteBlocks(blocks),null);
  blocks.photos[0].homepage=true;blocks.photos[1].slot=blocks.photos[0].slot;assert.equal(validateWebsiteBlocks(blocks),null);
  blocks.photos[1].slot='gallery-1';blocks.photos.push({...blocks.photos[0],id:'extra',slot:'gallery-extra'});assert.equal(validateWebsiteBlocks(blocks),null);
});
