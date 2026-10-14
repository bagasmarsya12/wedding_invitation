import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyGiftTransfers, validateGiftTransfers, readGiftTransfers, visibleGiftTransfers } from '../lib/gift-transfers.ts';

function fixture() {
  const config = emptyGiftTransfers();
  for (const method of Object.values(config)) { method.enabled = true; method.recipient = 'Penerima fixture'; }
  config.bca.destination = '0012345678'; config.mandiri.destination = '0012345678901';
  config.dana.destination = 'https://example.test/dana-fixture'; config.gopay.destination = '+62 812-3456-7890';
  config.bca.cta = { id: 'Titip kasih', en: 'Copy these details' };
  return config;
}

test('four CMS methods preserve account leading zeros and independent bilingual CTAs', () => {
  const config = validateGiftTransfers(fixture());
  assert.ok(config); assert.equal(config.bca.destination, '0012345678');
  const visible = visibleGiftTransfers(config);
  assert.deepEqual(visible.map(row => row.id), ['bca', 'mandiri', 'dana', 'gopay']);
  assert.deepEqual(visible[0].cta, { id: 'Titip kasih', en: 'Copy these details' });
  config.mandiri.enabled = false;
  assert.deepEqual(visibleGiftTransfers(config).map(row => row.id), ['bca', 'dana', 'gopay']);
});

test('blank defaults hide methods; incomplete active methods are rejected', () => {
  assert.deepEqual(visibleGiftTransfers(validateGiftTransfers(emptyGiftTransfers())), []);
  const config = fixture(); config.bca.recipient = ' ';
  assert.equal(validateGiftTransfers(config), null);
  config.bca.enabled = false; assert.ok(validateGiftTransfers(config));
  config.bca.enabled = true; config.bca.recipient = 'Fixture'; config.bca.destination = '';
  assert.equal(validateGiftTransfers(config), null);
});

test('unsafe DANA destinations, malformed numbers and invalid/oversized labels are rejected', () => {
  for (const destination of ['javascript:alert(1)', 'http://example.test/dana', 'https://user:password@example.test/dana', '/relative']) {
    const config = fixture(); config.dana.destination = destination; assert.equal(validateGiftTransfers(config), null);
  }
  for (const [id, value] of [['bca', '00123ABC'], ['gopay', '08123<script>'], ['gopay', '123']]) {
    const config = fixture(); config[id].destination = value; assert.equal(validateGiftTransfers(config), null);
  }
  const config = fixture(); config.dana.cta.id = 'a'.repeat(101); assert.equal(validateGiftTransfers(config), null);
  assert.equal(validateGiftTransfers({ bca: config.bca }), null);
});

test('unreadable settings fail closed with no fabricated payment details', () => {
  for (const input of [null, '', '{bad json', '{"bca":{}}']) assert.deepEqual(visibleGiftTransfers(readGiftTransfers(input)), []);
});

test('DANA phone keeps its leading zero while the payment link and CTA remain independent', () => {
  const input = fixture();
  input.dana.phone = ' 081395746085 ';
  input.dana.cta = { id: 'Buka DANA', en: 'Open DANA' };
  const saved = validateGiftTransfers(input);
  assert.ok(saved);
  const reloaded = readGiftTransfers(JSON.stringify(saved));
  const dana = visibleGiftTransfers(reloaded).find(method => method.id === 'dana');
  assert.equal(dana.phone, '081395746085');
  assert.equal(dana.destination, input.dana.destination);
  assert.deepEqual(dana.cta, input.dana.cta);
});

test('older DANA settings remain valid without a phone; invalid optional phones are rejected', () => {
  const old = fixture();
  assert.equal(readGiftTransfers(JSON.stringify(old)).dana.phone, undefined);
  for (const phone of ['123', '0813<script>', '1'.repeat(41), 81395746085]) {
    const input = fixture(); input.dana.phone = phone;
    assert.equal(validateGiftTransfers(input), null);
  }
  const cleared = fixture(); cleared.dana.phone = ' ';
  assert.equal(validateGiftTransfers(cleared).dana.phone, undefined);
});
