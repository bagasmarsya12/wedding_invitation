import test from 'node:test';
import assert from 'node:assert/strict';
import { archivePreviewKey, archiveMediaUrls, archivePreviewVariant, validPreviewBytes, previewByteRange, previewDimensions } from '../lib/archive-media.ts';

test('preview storage changes with the immutable original revision, independent of a reused slot', async () => {
  const a=await archivePreviewKey('content/revisions/gallery-1/a.gif','card');
  const b=await archivePreviewKey('content/revisions/gallery-1/b.gif','card');
  assert.notEqual(a,b); assert.match(a,/^content\/previews\/archive-v1\/[a-f0-9]{64}\/card.webp$/);
  assert.equal(await archivePreviewKey('content/revisions/gallery-1/a.gif','card'),a);
});
test('gallery previews keep source revisions, private keys and original viewer URLs separate', () => {
  const source='/api/admin/media/gallery-1?v=revision&motion=1';
  const urls=archiveMediaUrls(source); assert.equal(new URL(urls.card,'https://example.com').searchParams.get('v'),'revision');
  assert.match(urls.motion,/preview=motion/); assert.match(urls.large,/preview=large/);
  assert.equal(source,'/api/admin/media/gallery-1?v=revision&motion=1');
  assert.equal(archiveMediaUrls('/api/admin/media/gallery-1?v=a').motion,null);
  const privateUrl=archiveMediaUrls('/api/admin/editor/media/gallery-1?key=content%2Frevisions%2Fgallery-1%2Fa.gif&motion=1');
  assert.equal(new URL(privateUrl.card,'https://example.com').searchParams.get('key'),'content/revisions/gallery-1/a.gif');
  for(const src of ['https://example.com/photo.jpg','/api/admin/media/bagas?v=1','/assets/photo.gif']) assert.equal(archiveMediaUrls(src),null);
});
test('preview sizes preserve framing, never enlarge photos, and keep video dimensions even', () => {
  assert.deepEqual(previewDimensions(1536,1024,640),{width:640,height:427});
  assert.deepEqual(previewDimensions(800,920,640,true),{width:640,height:736});
  assert.deepEqual(previewDimensions(320,240,640),{width:320,height:240});
  assert.throws(()=>previewDimensions(Infinity,100,640));
});
test('preview format allowlist rejects executable content, mixed formats and oversized files', () => {
  assert.ok(validPreviewBytes('card','image/webp',Buffer.from('RIFFxxxxWEBP')));
  assert.ok(validPreviewBytes('motion','video/mp4',Buffer.from('xxxxftypisom')));
  assert.equal(validPreviewBytes('card','image/svg+xml',Buffer.from('<svg/>')),false);
  assert.equal(validPreviewBytes('motion','image/webp',Buffer.from('RIFFxxxxWEBP')),false);
  assert.equal(validPreviewBytes('card','image/webp',new Uint8Array(1024*1024+1)),false);
  assert.equal(archivePreviewVariant('original'),null);
});
test('video byte ranges support Safari probes, suffix reads and invalid range rejection', () => {
  assert.deepEqual(previewByteRange('bytes=0-1',100),{start:0,end:1});
  assert.deepEqual(previewByteRange('bytes=50-',100),{start:50,end:99});
  assert.deepEqual(previewByteRange('bytes=-10',100),{start:90,end:99});
  assert.deepEqual(previewByteRange('bytes=0-999',100),{start:0,end:99});
  for (const value of ['bytes=100-','bytes=-0','bytes=2-1','bytes=0-1,3-4','bytes=-','other']) assert.equal(previewByteRange(value,100),null);
});
