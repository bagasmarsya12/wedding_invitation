import test from 'node:test';
import assert from 'node:assert/strict';
import { createGardenPreparation, gardenPixelRatio, gardenFrameDue } from '../lib/garden-performance.ts';

test('continuous scroll cannot postpone the pending preparation', () => {
  const jobs = [];
  let prepared = 0, cancellations = 0, currentRoom = 'hero', preparedRoom;
  const queue = createGardenPreparation(callback => {
    jobs.push(callback);
    return () => { cancellations++; };
  }, () => { prepared++; preparedRoom = currentRoom; return false; });
  queue.request();
  for (let i = 0; i < 120; i++) queue.request();
  currentRoom = 'archive';
  assert.equal(jobs.length, 1);
  assert.equal(cancellations, 0);
  jobs.shift()({ didTimeout: false, timeRemaining: () => 12 });
  assert.equal(prepared, 1);
  assert.equal(preparedRoom, 'archive');
});

test('preparation yields a tight frame and cancels cleanly when hidden or disposed', () => {
  const jobs = [];
  let prepared = 0, cancelled = 0;
  const queue = createGardenPreparation(callback => {
    jobs.push(callback);
    return () => { cancelled++; };
  }, () => { prepared++; return true; });
  queue.request();
  jobs.shift()({ didTimeout: false, timeRemaining: () => 1 });
  assert.equal(prepared, 0);
  assert.equal(jobs.length, 1);
  queue.cancel();
  assert.equal(cancelled, 1);
  jobs.shift()({ didTimeout: true, timeRemaining: () => 0 });
  assert.equal(prepared, 0, 'a cancelled callback must not create geometry');
  queue.request();
  jobs.shift()({ didTimeout: false, timeRemaining: () => 12 });
  assert.equal(prepared, 1);
  assert.equal(jobs.length, 1, 'remaining chapters get a separate idle slot');
  queue.cancel();
});

test('Retina and large screens stay within the background pixel budget', () => {
  for (const [w, h, dpr, mobile, budget] of [
    [1456, 958, 2, false, 2_000_000],
    [2560, 1440, 2, false, 2_000_000],
    [390, 844, 3, true, 750_000],
    [430, 932, 3, true, 750_000],
  ]) {
    const ratio = gardenPixelRatio(w, h, dpr, mobile);
    assert.ok(Math.floor(w * ratio) * Math.floor(h * ratio) <= budget);
    assert.ok(ratio <= dpr);
  }
  assert.equal(gardenPixelRatio(390, 844, 1, true), 1);
});

test('short idle slots on a high-refresh screen cannot restart the preparation deadline', () => {
  const jobs = [];
  let now = 0, prepared = 0;
  const queue = createGardenPreparation(callback => {
    jobs.push(callback); return () => {};
  }, () => { prepared++; return false; }, () => now);
  queue.request();
  for (let i = 0; i < 6; i++) {
    now += 200;
    jobs.shift()({ didTimeout: false, timeRemaining: () => 1 });
  }
  assert.equal(prepared, 1, 'the original maximum wait still applies when idle slots are tight');
  assert.equal(jobs.length, 0);
});

test('scroll events on a 120 Hz display do not double WebGL render work', () => {
  let last = -100, draws = 0;
  for (let i = 0; i < 120; i++) {
    const now = i * 1000 / 120;
    if (gardenFrameDue(now, last, 1000 / 60)) { last = now; draws++; }
  }
  assert.ok(draws >= 59 && draws <= 61, `${draws} draws`);
  assert.equal(gardenFrameDue(100, 0, 1000 / 12), true);
});
