import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCoupleWording } from '../lib/couple-wording.ts';

test('older CMS couple wording normalizes without changing individual names or the wedding hashtag', () => {
  for (const pair of ['Bagas × Iga', 'Bagas x Iga', 'Bagas & Iga', 'Iga × Bagas', 'Iga x Bagas', 'Iga dan Bagas', 'Bagas and Iga']) {
    assert.equal(normalizeCoupleWording(`Dengan sayang, ${pair}. #IganyaBagas`), 'Dengan sayang, Iga & Bagas. #IganyaBagas');
  }
  assert.equal(normalizeCoupleWording('Bagas, menurut Iga. Iga, menurut Bagas.'), 'Bagas, menurut Iga. Iga, menurut Bagas.');
  assert.equal(normalizeCoupleWording('Iga & Bagas'), 'Iga & Bagas');
});
