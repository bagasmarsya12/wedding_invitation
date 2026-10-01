import test from 'node:test';
import assert from 'node:assert/strict';
import { destinationLightShift } from '../lib/destination-light.ts';

test('destination light is bounded, smooth, reversible and smaller on mobile', () => {
  const shift = scroll=>destinationLightShift(scroll,1000,1000,800);
  assert.equal(shift(-900),-16);
  assert.equal(shift(600),-16);
  assert.equal(shift(1100),0);
  assert.equal(shift(1600),16);
  assert.equal(shift(5000),16);
  let previous=-16;
  for(let scroll=600;scroll<=1600;scroll++) {
    const value=shift(scroll);
    assert.ok(value>=previous && value<=16);
    assert.ok(value-previous<.05,'Light must never snap at a boundary');
    assert.equal(destinationLightShift(scroll,1000,1000,800,true),value/2);
    previous=value;
  }
  assert.equal(destinationLightShift(1600,1000,1000,800,false,true),0);
  assert.equal(destinationLightShift(1600,1000,0,800),0);
  assert.equal(destinationLightShift(1600,1000,1000,0),0);
  const forward=[700,900,1100,1300,1500].map(shift);
  const reverse=[1500,1300,1100,900,700].map(shift).reverse();
  assert.deepEqual(reverse,forward,'Reverse journeys must not accumulate offsets');
});
