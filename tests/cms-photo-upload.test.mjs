import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCmsPhoto, validatePhotoSource, photoUploadDimensions, isCmsPhotoKey, MAX_PHOTO_SOURCE_BYTES, MAX_PHOTO_UPLOAD_BYTES } from '../lib/cms-photo-upload.ts';
const mb = 1024 * 1024;
test('camera photos above 5 MB are accepted locally without expanding the transmitted upload limit', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/avif']) assert.doesNotThrow(() => validatePhotoSource({size:35*mb,type}));
  assert.doesNotThrow(() => validatePhotoSource({size:50*mb,type:'image/jpeg'}));
  assert.equal(MAX_PHOTO_SOURCE_BYTES,50*mb);
  assert.equal(MAX_PHOTO_UPLOAD_BYTES,5*mb);
});
test('empty, unsupported and oversized source files fail before decoding or upload', () => {
  for (const file of [{size:0,type:'image/jpeg'},{size:mb,type:'image/heic'},{size:mb,type:'image/gif'},{size:50*mb+1,type:'image/png'}]) assert.throws(() => validatePhotoSource(file));
});
test('full-resolution web photos keep their proportions and never upscale small originals', () => {
  assert.deepEqual(photoUploadDimensions(6000,4000),{width:3840,height:2560});
  assert.deepEqual(photoUploadDimensions(4000,6000),{width:2560,height:3840});
  assert.deepEqual(photoUploadDimensions(1000,750),{width:1000,height:750});
  assert.deepEqual(photoUploadDimensions(8000,1),{width:3840,height:1});
  for (const [w,h] of [[0,100],[100,-1],[NaN,100],[100,Infinity]]) assert.throws(() => photoUploadDimensions(w,h));
});
test('archive GIF preparation preserves every original animation byte without a canvas', async () => {
  const bytes=Buffer.from('R0lGODlhBAADAIEAACFDMQAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQIEgAAACwAAAAABAADAAAICAABCBxIUGBAACH5BAgqAAAALAAAAAAEAAMAgeiqwAAAAAAAAAAAAAgIAAEIHEhQYEAAIfkECEgAAAAsAAAAAAQAAwCBuphYAAAAAAAAAAAACAgAAQgcSFBgQAA7','base64');
  const file=new File([bytes],'three-frames.gif',{type:'image/gif',lastModified:123});
  const prepared=await prepareCmsPhoto(file,{allowGif:true});
  assert.equal(prepared,file);
  assert.equal(prepared.type,'image/gif');
  assert.equal(prepared.name,file.name);
  assert.deepEqual(Buffer.from(await prepared.arrayBuffer()),bytes);
  await assert.rejects(()=>prepareCmsPhoto(file),/Pilih foto/);
  await assert.rejects(()=>prepareCmsPhoto(new File(['not a GIF'],'invalid.gif',{type:'image/gif'}),{allowGif:true}),/GIF.*valid/);
});
test('only archive uploads allow GIFs, with a separate unchanged-animation size limit',()=>{
  assert.doesNotThrow(()=>validatePhotoSource({size:20*mb,type:'image/gif'},{allowGif:true}));
  assert.throws(()=>validatePhotoSource({size:20*mb+1,type:'image/gif'},{allowGif:true}),/20 MB/);
  assert.throws(()=>validatePhotoSource({size:1,type:'image/gif'}));
  assert.throws(()=>validatePhotoSource({size:0,type:'image/gif'},{allowGif:true}));
  assert.throws(()=>validatePhotoSource({size:1,type:'image/svg+xml'},{allowGif:true}));
});
test('GIF media keys are limited to archive slots and preserve earlier photo revision paths',()=>{
  assert.ok(isCmsPhotoKey('gallery-1','content/revisions/gallery-1/1234-5678.gif'));
  assert.ok(isCmsPhotoKey('gallery-1','content/gallery-1.gif'));
  assert.ok(isCmsPhotoKey('bagas','content/revisions/bagas/1234-5678.png'));
  for(const [slot,key] of [['bagas','content/revisions/bagas/1234.gif'],['arrival-map','content/arrival-map.gif'],['gallery-1','content/revisions/gallery-2/1234.gif'],['gallery-1','content/revisions/gallery-1/../1234.gif'],['gallery-1','content/gallery-1.svg'],['gallery-1.*','content/gallery-1-any.gif']])assert.equal(isCmsPhotoKey(slot,key),false);
});
