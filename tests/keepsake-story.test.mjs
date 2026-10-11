import test from 'node:test';
import assert from 'node:assert/strict';
import { storyPose, storyDuration } from '../public/atelier/keepsake-renderer.js';
import { grandePose, grandeDuration, MESSAGE_START } from '../public/atelier/story-cinema.js';

test('Story holds both sides, turns once, and gives longer notes more reading time', () => {
  const short = { backs: [{ lines: ['A little of our day,', 'kept for you.'] }] };
  const long = { backs: [{ lines: ['A personal message '.repeat(25)] }] };
  assert.ok(storyDuration(short) >= 15);
  assert.ok(storyDuration(long) > storyDuration(short));
  assert.equal(storyPose(4, short).flip, 0);
  assert.equal(storyPose(9, short).flip, 1);
  for (let t = 0; t < storyDuration(short); t += .1) {
    const pose = storyPose(t, short);
    assert.ok(pose.flip >= 0 && pose.flip <= 1);
    assert.ok(pose.opacity >= 0 && pose.opacity <= 1);
    assert.equal(pose.page, 0);
  }
});

test('grande Story keeps the front readable, completes one turn and holds the message', () => {
  const design={backs:[{lines:['A little of our day,','kept for you.']}]};
  assert.equal(grandeDuration(design),10);
  assert.equal(grandePose(2.8,design).flip,0);
  assert.equal(grandePose(MESSAGE_START,design).flip,1);
  let previous=0;
  for(let t=0;t<grandeDuration(design);t+=.05){
    const p=grandePose(t,design);
    assert.ok(p.flip>=previous && p.flip<=1);previous=p.flip;
    assert.ok(p.opacity>=0 && p.opacity<=1);
    assert.ok(p.scale>=.76 && p.scale<=1.012);
    assert.equal(p.page,0);
  }
  assert.ok(grandePose(3,design).gardenReveal>grandePose(.5,design).gardenReveal);
});

test('long messages and every back page fit within the same ten-second limit', () => {
  for(const count of [1,2,5]){
    const design={backs:Array.from({length:count},()=>({lines:['A personal message '.repeat(100)]}))};
    assert.equal(grandeDuration(design),10);
    const seen=new Set();
    for(let t=MESSAGE_START;t<10;t+=.01){
      const pose=grandePose(t,design);
      assert.equal(pose.flip,1);
      assert.ok(pose.page>=0 && pose.page<count);
      seen.add(pose.page);
    }
    assert.equal(seen.size,count);
    assert.equal(grandePose(9.99,design).page,count-1);
  }
});
