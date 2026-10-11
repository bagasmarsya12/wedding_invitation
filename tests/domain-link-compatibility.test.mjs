import test from 'node:test';
import assert from 'node:assert/strict';
import { passCodeFromInput } from '../lib/guest-pass.ts';

const origins = ['https://iganyabagas.com', 'https://bagas-iga-wedding.bagasmarsya.workers.dev'];
const code = '0123456789abcdef0123456789abcdef';

test('staff can read existing QR passes across both production addresses', () => {
  for (const current of origins) for (const source of origins) {
    assert.equal(passCodeFromInput(`${source}/check-in/${code}`, current), code);
  }
});

test('foreign hosts, lookalikes, insecure URLs and local/production crossings remain rejected', () => {
  for (const current of origins) for (const source of [
    'https://example.com', 'https://iganyabagas.com.example.com',
    'https://other.bagasmarsya.workers.dev', 'http://iganyabagas.com',
    'https://iganyabagas.com:8443', 'http://localhost:5214',
  ]) assert.equal(passCodeFromInput(`${source}/check-in/${code}`, current), null);
  for (const source of origins) assert.equal(passCodeFromInput(`${source}/check-in/${code}`, 'http://localhost:5214'), null);
});

test('the QR payload still requires a plain pass or exact check-in path', () => {
  for (const current of origins) {
    assert.equal(passCodeFromInput(`  ${code}  `, current), code);
    for (const suffix of [`/invite/${code}`, `/check-in/${code}?name=someone`, `/check-in/${code}#guest`, '/check-in/not-a-code']) {
      assert.equal(passCodeFromInput(`${current}${suffix}`, current), null);
    }
  }
  assert.equal(passCodeFromInput(`http://localhost:5214/check-in/${code}`, 'http://localhost:5214'), code);
});
