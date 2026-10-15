import test from 'node:test';
import assert from 'node:assert/strict';
import { mutableMediaResponse } from '../lib/media-response.ts';

test('immutable cache-style response becomes writable for route-adapter headers without changing media bytes', async () => {
  const cached = await fetch('data:application/octet-stream;base64,AAECAwQF');
  assert.throws(() => cached.headers.set('x-route-header','value'), TypeError);
  const response = mutableMediaResponse(cached);
  assert.doesNotThrow(() => response.headers.set('x-route-header','value'));
  assert.equal(response.status,200);
  assert.equal(response.headers.get('content-type'),cached.headers.get('content-type'));
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()),new Uint8Array([0,1,2,3,4,5]));
});
