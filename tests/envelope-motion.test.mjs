import assert from 'node:assert/strict';
import test from 'node:test';
import {envelopePose,ENVELOPE_DURATION} from '../public/atelier/envelope-scene.js';

test('the letter waits for the flap, then leaves in one bounded direction',()=>{
  assert.equal(envelopePose(0).hinge,0);
  assert.equal(envelopePose(0).seal,1);
  assert.equal(envelopePose(1.15).cardY,0);
  assert.ok(envelopePose(1.15).hinge>.99);
  let prior=0;
  for(let time=0;time<=ENVELOPE_DURATION;time+=.02){
    const p=envelopePose(time);
    assert.ok(p.cardY>=prior-1e-9,'The emerging letter must not reverse back into the envelope');
    assert.ok(p.envelopeY>=-.400001&&p.envelopeY<=0,'The envelope stays beside the letter instead of falling away');
    assert.ok(p.cardZ>0&&p.cardZ<.1,'The letter remains behind the front pocket');
    assert.ok(p.opacity>=0&&p.opacity<=1);
    prior=p.cardY;
  }
  assert.equal(envelopePose(2.6).opacity,1);
  assert.ok(envelopePose(2.6).cardY>2.4);
  assert.equal(envelopePose(ENVELOPE_DURATION).opacity,0);
});

test("opened flap stays behind the emerging letter",()=>{
  for(let t=1.17;t<=ENVELOPE_DURATION;t+=.02){
    const p=envelopePose(t);
    assert.ok(p.flapZ<p.cardZ);
  }
});
