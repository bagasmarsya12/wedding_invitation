import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/atelier/vendor/three.module.js';
import { EnvelopeScene, ENVELOPE_DURATION, envelopePose } from '../public/atelier/envelope-scene.js';
import { OPENING_HANDOFF_SECONDS, OPENING_DURATION_MS, OPENING_FAILSAFE_MS, fallbackLetterRect } from '../lib/envelope-passage.ts';

test('the extracted letter rests before the DOM takes over, within the three-second entry',()=>{
  const resting=envelopePose(OPENING_HANDOFF_SECONDS);
  assert.equal(ENVELOPE_DURATION*1000,OPENING_DURATION_MS);
  assert.ok(OPENING_FAILSAFE_MS>OPENING_DURATION_MS);
  assert.ok(OPENING_FAILSAFE_MS<4000);
  assert.equal(resting.hinge,1);
  assert.equal(resting.seal,0);
  assert.equal(resting.opacity,1);
  for(const t of [1.5,2,3,5]){
    const pose=envelopePose(t);
    for(const key of ['cardY','cardZ','cardTilt'])assert.ok(Math.abs(pose[key]-resting[key])<1e-10,`${key} should rest after the handoff`);
  }
  assert.equal(envelopePose(ENVELOPE_DURATION).opacity,0);
});

test('the HTML fallback matches the native letter projection at desktop and phone sizes',()=>{
  for(const [width,height] of [[1080,608],[367,724],[301,620]]){
    const root=new THREE.Group(),card=new THREE.Mesh(new THREE.PlaneGeometry(5.33,3.34));
    const pose=envelopePose(OPENING_HANDOFF_SECONDS);root.position.y=-.4;root.add(card);card.position.set(0,pose.cardY,pose.cardZ);
    const camera=new THREE.PerspectiveCamera(30,width/height,.1,50);
    const h=Math.max(6.6,6.7/(width/height));camera.position.set(0,.35,h/(2*Math.tan(Math.PI/12)));camera.updateProjectionMatrix();
    const actual=EnvelopeScene.prototype.letterBounds.call({card,camera,canvas:{clientWidth:width,clientHeight:height}});
    const fallback=fallbackLetterRect({left:0,top:0,width,height});
    for(const key of ['left','top','width','height'])assert.ok(Math.abs(actual[key]-fallback[key])<.001,`${width}px ${key}: ${actual[key]} vs ${fallback[key]}`);
    assert.ok(actual.width>0&&actual.width<width);assert.ok(actual.top>0&&actual.top+actual.height<height);
    card.geometry.dispose();card.material.dispose();
  }
});
