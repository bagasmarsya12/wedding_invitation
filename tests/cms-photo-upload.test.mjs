import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhotoSource, photoUploadDimensions, MAX_PHOTO_SOURCE_BYTES, MAX_PHOTO_UPLOAD_BYTES } from '../lib/cms-photo-upload.ts';
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
