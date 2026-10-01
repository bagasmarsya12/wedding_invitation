import test from 'node:test';
import assert from 'node:assert/strict';
import { heroPassage, heroCameraDistance } from '../lib/hero-passage.ts';

test('hero passage is bounded, reversible and still under reduced motion', () => {
  assert.equal(heroPassage(-100,0,1000),0);
  assert.equal(heroPassage(0,0,1000),0);
  assert.equal(heroPassage(410,0,1000),.5);
  assert.equal(heroPassage(2000,0,1000),1);
  assert.equal(heroPassage(400,0,1000,true),0);
  assert.equal(heroPassage(400,0,0),0);
  assert.equal(heroPassage(1410,1000,1000),.5);
  assert.ok(heroCameraDistance(940)>940);
});
