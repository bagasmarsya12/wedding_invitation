import test from 'node:test';
import assert from 'node:assert/strict';
import { phaseForDate } from '../lib/production.ts';
import { weddingDayPath, fullInvitationPath, weddingDayRedirect } from '../lib/wedding-day-routing.ts';

test('the compact page and full invitation preserve the same personal link without a redirect loop', () => {
  const token='fixture_personal_guest_1234567890';
  assert.equal(weddingDayPath(token),`/hari-h/${token}`);
  assert.equal(fullInvitationPath(token),`/invite/${token}?view=full`);
  assert.equal(weddingDayRedirect('wedding-day',undefined,token),weddingDayPath(token));
  assert.equal(weddingDayRedirect('wedding-day','full',token),null);
  for(const phase of ['pre-wedding','post-wedding',undefined])assert.equal(weddingDayRedirect(phase,undefined,token),null);
  assert.equal(weddingDayRedirect('wedding-day',undefined),'/hari-h');
  assert.equal(fullInvitationPath(),'/?view=full');
  assert.equal(weddingDayRedirect('wedding-day','full'),null);
});

test('day-of view follows the full Jakarta calendar day, independent of UTC midnight', () => {
  assert.equal(phaseForDate(new Date('2026-10-31T16:59:59.999Z')), 'pre-wedding');
  assert.equal(phaseForDate(new Date('2026-10-31T17:00:00.000Z')), 'wedding-day');
  assert.equal(phaseForDate(new Date('2026-11-01T16:59:59.999Z')), 'wedding-day');
  assert.equal(phaseForDate(new Date('2026-11-01T17:00:00.000Z')), 'post-wedding');
});

test('a CMS date change and existing phase overrides control the day-of view', () => {
  const now = new Date('2026-11-01T05:00:00Z');
  assert.equal(phaseForDate(now, 'auto', '2026-11-02'), 'pre-wedding');
  assert.equal(phaseForDate(now, 'auto', '2026-10-31'), 'post-wedding');
  assert.equal(phaseForDate(now, 'wedding-day', '2026-11-02'), 'wedding-day');
  assert.equal(phaseForDate(now, 'pre-wedding'), 'pre-wedding');
  assert.equal(phaseForDate(now, 'post-wedding'), 'post-wedding');
});
