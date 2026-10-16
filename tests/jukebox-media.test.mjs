import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
const hook=registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')){const url=new URL(`${specifier}.ts`,context.parentURL);if(existsSync(url))return next(url.href,context);}throw error;}}});
const {audioKind,prepareCmsAudio}=await import('../lib/jukebox-media.ts');
hook.deregister();
const dash=new Uint8Array(Buffer.from('0000001866747970646173680000000069736f366d703431','hex'));

test('AAC downloads named MP3 are recognized by their MP4 container',()=>{
  for(const name of ['download.mp3','download.m4a'])assert.deepEqual(audioKind(name,dash,4632394),{ext:'m4a',type:'audio/mp4'});
});

test('CMS corrects a misleading extension and MIME without changing audio bytes',async()=>{
  const source=new File([dash],'Song (Official Audio).mp3',{type:'audio/mpeg',lastModified:123456});
  const prepared=await prepareCmsAudio(source);
  assert.equal(prepared.name,'Song (Official Audio).m4a');
  assert.equal(prepared.type,'audio/mp4');
  assert.equal(prepared.lastModified,source.lastModified);
  assert.deepEqual(new Uint8Array(await prepared.arrayBuffer()),dash);
});

test('audio uploads still reject unsupported names, invalid signatures, ADTS and oversized files',()=>{
  for(const [name,prefix,size] of [['download.svg',dash,100],['download.mp3',new Uint8Array(64),100],['download.mp3',new Uint8Array([255,241,...new Array(62).fill(0)]),100],['download.m4a',dash,21*1024*1024],['download.m4a',dash,15]])assert.equal(audioKind(name,prefix,size),null);
});
