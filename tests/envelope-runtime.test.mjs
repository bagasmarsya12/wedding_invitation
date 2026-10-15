import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import * as approved from '../public/atelier/envelope-scene.js';
import * as runtime from '../public/atelier/runtime/envelope-v1.js';

test('smaller envelope runtime retains the approved animation at every sampled pose', () => {
  assert.equal(runtime.ENVELOPE_DURATION, approved.ENVELOPE_DURATION);
  for (let frame = 0; frame <= 360; frame++) {
    const time = frame / 60;
    assert.deepEqual(runtime.envelopePose(time), approved.envelopePose(time));
  }
  assert.equal(typeof runtime.composeEnvelope, 'function');
  assert.equal(typeof runtime.EnvelopeScene, 'function');
});

test('live envelope does not ship the complete unminified vendor library', async () => {
  const bytes = (await stat(new URL('../public/atelier/runtime/envelope-v1.js', import.meta.url))).size;
  assert.ok(bytes < 750_000, `Envelope runtime is ${bytes} bytes`);
});
