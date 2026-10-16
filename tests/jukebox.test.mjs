import assert from 'node:assert/strict';
import test from 'node:test';
import { JUKEBOX_DEFAULTS, adjacentTrack, formatAudioTime, isJukeboxPage, parseJukeboxSession, playableTracks,
  validateJukeboxConfig } from '../lib/jukebox-playlist.ts';
import { shouldStartInvitationAudio } from '../lib/invitation-audio.ts';

const track = { id: 'track-a', title: 'One', artist: 'Iga & Bagas', src: '/audio/jukebox/test.mp3',
  artwork: '', pickedBy: 'Ours', note: { id: '', en: '' }, duration: 240, enabled: true };
const config = () => structuredClone({ ...JUKEBOX_DEFAULTS, tracks: [track] });
test('playlist preserves order and hides drafts, disabled tracks and a disabled jukebox', () => {
  const value = config();
  value.tracks.push({ ...track, id: 'draft', src: '' }, { ...track, id: 'disabled', enabled: false }, { ...track, id: 'last' });
  assert.deepEqual(playableTracks(value).map(track => track.id), ['track-a', 'last']);
  assert.deepEqual(playableTracks({ ...value, enabled: false }), []);
});
test('CMS rejects foreign sources, traversal, duplicate IDs and invalid limits', () => {
  for (const src of ['https://example.com/song.mp3', '//example.com/a.mp3', '/audio/jukebox/../private.mp3', '/api/jukebox/audio/../../../x', 'javascript:alert(1)']) {
    const value = config(); value.tracks[0].src = src;
    assert.equal(validateJukeboxConfig(value), null, src);
  }
  const duplicate = config(); duplicate.tracks.push({ ...track }); assert.equal(validateJukeboxConfig(duplicate), null);
  for (const volume of [-1, 1.1, NaN]) assert.equal(validateJukeboxConfig({ ...config(), defaultVolume: volume }), null);
  const tooMany = config(); tooMany.tracks = Array.from({ length: 21 }, (_, n) => ({ ...track, id: `track-${n}` }));
  assert.equal(validateJukeboxConfig(tooMany), null);
  const cover = config(); cover.tracks[0].artwork = 'https://example.com/tracker.png'; assert.equal(validateJukeboxConfig(cover), null);
});
test('empty CMS wording restores defaults and bilingual notes stay separate', () => {
  const value = config(); value.copy.play.id = ''; value.tracks[0].note = { id: 'Untukmu.', en: 'For you.' };
  const clean = validateJukeboxConfig(value);
  assert.equal(clean.copy.play.id, JUKEBOX_DEFAULTS.copy.play.id);
  assert.deepEqual(clean.tracks[0].note, { id: 'Untukmu.', en: 'For you.' });
});
test('next and previous honor deterministic order, boundaries and optional looping', () => {
  assert.equal(adjacentTrack(0, 10, -1, true), 9);
  assert.equal(adjacentTrack(9, 10, 1, true), 0);
  assert.equal(adjacentTrack(9, 10, 1, false), null);
  assert.equal(adjacentTrack(0, 10, -1, false), null);
  assert.equal(adjacentTrack(0, 0, 1, true), null);
});
test('session restoration clamps untrusted values and never controls autoplay', () => {
  assert.deepEqual(parseJukeboxSession('{broken', [track], .3), { trackId: 'track-a', time: 0, volume: .3, wantedPlaying: false });
  assert.deepEqual(parseJukeboxSession(JSON.stringify({ trackId: track.id, time: 99999, volume: -2, wantedPlaying: true }), [track], .3),
    { trackId: track.id, time: 7200, volume: 0, wantedPlaying: true });
  assert.equal(parseJukeboxSession(JSON.stringify({ trackId: 'removed', wantedPlaying: true }), [track], .3).wantedPlaying, false);
});
test('jukebox is absent from staff, CMS, auth and check-in surfaces', () => {
  for (const path of ['/admin', '/staff', '/check-in', '/admin/check-in', '/signin-with-chatgpt', '/api/admin/state']) assert.equal(isJukeboxPage(path), false);
  for (const path of ['/', '/archive', '/archive/our-first-date', '/gifts', '/invite/abcdefghijklmnopqrstuvwxyz', '/invite/abcdefghijklmnopqrstuvwxyz/mark']) assert.equal(isJukeboxPage(path), true);
});
test('timeline formatting handles invalid and negative media times', () => {
  assert.equal(formatAudioTime(240.9), '4:00'); assert.equal(formatAudioTime(Infinity), '0:00'); assert.equal(formatAudioTime(-1), '0:00');
});
test('opening autoplay defaults on, respects an explicit pause and can be disabled in CMS', () => {
  assert.equal(shouldStartInvitationAudio(null),true);
  assert.equal(shouldStartInvitationAudio('{broken'),true);
  assert.equal(shouldStartInvitationAudio(JSON.stringify({wantedPlaying:false})),true);
  assert.equal(shouldStartInvitationAudio(JSON.stringify({wantedPlaying:true})),true);
  assert.equal(shouldStartInvitationAudio(JSON.stringify({wantedPlaying:false,autoplayPaused:true})),false);
  assert.equal(shouldStartInvitationAudio(JSON.stringify({wantedPlaying:false,autoplayPaused:false})),true);
  const legacy=config();delete legacy.autoplayOnOpen;
  assert.equal(validateJukeboxConfig(legacy).autoplayOnOpen,true);
  assert.equal(validateJukeboxConfig({...config(),autoplayOnOpen:false}).autoplayOnOpen,false);
  assert.equal(validateJukeboxConfig({...config(),autoplayOnOpen:'yes'}),null);
});
