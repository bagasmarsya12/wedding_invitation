import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
const hook = registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')) {
      const url = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(url)) return next(url.href, context);
    }
    throw error;
  }
} });
const { PROFILE_LABEL_KEYS, RETIRED_PROFILE_LABEL_KEYS, upgradeProfileLabelCopy } = await import('../lib/profile-labels.ts');
const { CONTENT_DEFAULTS, CONTENT_SECTIONS } = await import('../lib/content-defaults.ts');
const editorial = existsSync(new URL('../lib/cms-editorial.ts', import.meta.url)) ? await import('../lib/cms-editorial.ts') : null;
const website = editorial ? await import('../lib/website-content.ts') : null;
hook.deregister();

test('profile labels have separate Indonesian perspectives and the requested English wording', () => {
  const expected = {
    person_label: ['The Person', 'Di Balik Nama'],
    b_known_label: ['The Peculiarities', 'Hal Spesial Menurut Iga'],
    i_known_label: ['The Peculiarities', 'Hal Spesial Menurut Bagas'],
    b_eyes_label: ['Through Her Eyes', 'Di Mata Iga'],
    i_eyes_label: ['Through His Eyes', 'Di Mata Bagas'],
  };
  for (const [key, [en, id]] of Object.entries(expected)) {
    assert.equal(CONTENT_DEFAULTS[`profil.${key}`], en);
    assert.equal(CONTENT_DEFAULTS[`id.profil.${key}`], id);
  }
});

test('CMS relabels existing profile bodies while keeping their stable keys and defaults', () => {
  const fields = CONTENT_SECTIONS.find(section => section.id === 'profil').fields;
  for (const [key, label] of Object.entries({
    b_family: 'Bagas — Di Balik Nama', i_family: 'Iga — Di Balik Nama',
    b_known: 'Bagas — Hal Spesial Menurut Iga', i_known: 'Iga — Hal Spesial Menurut Bagas',
    quote1: 'Bagas — Di Mata Iga', quote2: 'Iga — Di Mata Bagas',
  })) assert.equal(fields.find(field => field.key === key).label, label);
  assert.equal(CONTENT_DEFAULTS['profil.b_family'], 'Family details will be added.');
  assert.equal(CONTENT_DEFAULTS['profil.b_known'], 'A small detail about Bagas, from Iga.');
});

test('old profile revision upgrades preserve authored bodies, media and independent label overrides', () => {
  const old = {
    'profil.b_family': 'Riwayat Bagas yang sudah ditulis',
    'id.profil.i_known': 'Isi personal untuk Iga',
    'profil.quote1': 'An authored quote',
    'id.profil.b_known_label': 'Label khusus Bagas',
    ...Object.fromEntries(RETIRED_PROFILE_LABEL_KEYS.flatMap(key => [[key, 'Old label'], [`id.${key}`, 'Label lama']])),
  };
  const before = structuredClone(old);
  const next = upgradeProfileLabelCopy(old);
  assert.deepEqual(old, before);
  for (const key of ['profil.b_family', 'id.profil.i_known', 'profil.quote1', 'id.profil.b_known_label']) assert.equal(next[key], old[key]);
  assert.equal(next['id.profil.i_known_label'], 'Hal Spesial Menurut Bagas');
  for (const key of RETIRED_PROFILE_LABEL_KEYS) { assert.ok(!(key in next)); assert.ok(!(`id.${key}` in next)); }
});

if (editorial) test('CMS accepts old profile revisions and still rejects foreign section keys', () => {
  const base = {config: website.WEBSITE_DEFAULTS, blocks: website.defaultWebsiteBlocks()};
  const copy = Object.fromEntries(editorial.sectionCopyKeys('profil').map(key => [key, CONTENT_DEFAULTS[key]]));
  for (const key of PROFILE_LABEL_KEYS) { delete copy[key]; delete copy[`id.${key}`]; }
  Object.assign(copy, Object.fromEntries(RETIRED_PROFILE_LABEL_KEYS.flatMap(key => [[key, 'Old label'], [`id.${key}`, 'Label lama']])));
  copy['id.profil.b_known'] = 'Jangan hilangkan isi yang sudah ditulis';
  const snapshot = {copy, config: {}, blocks: {}, media: {bagas: 'content/bagas.jpg', iga: 'content/iga.png'}};
  const restored = editorial.validateSectionSnapshot('profil', snapshot, base);
  assert.ok(restored);
  assert.equal(restored.copy['id.profil.b_known'], copy['id.profil.b_known']);
  assert.deepEqual(restored.media, snapshot.media);
  assert.equal(restored.copy['id.profil.i_eyes_label'], 'Di Mata Bagas');
  assert.equal(editorial.validateSectionSnapshot('profil', {...snapshot, copy: {...copy, 'id.hero.hero head': 'foreign'}}, base), null);
});
