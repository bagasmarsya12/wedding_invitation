import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { attestBuild, sourceFingerprint, validateApprovedDesign, verifyReleaseBuild } from '../scripts/release-guard.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'wedding-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, value) => { const target = join(root, path); mkdirSync(join(target, '..'), { recursive: true }); writeFileSync(target, value); };
  const art = 'approved flower pixels', css = '.flower { width: 26rem; }';
  put('public/flowers.png', art); put('app/flowers.css', css); put('app/page.tsx', 'current invitation');
  put('dist/client/flowers.png', art); put('dist/client/app.js', 'compiled invitation'); put('dist/server/index.js', 'current server');
  const files = [['public/flowers.png', art], ['app/flowers.css', css]].map(([path, value]) => ({ path, sha256: createHash('sha256').update(value).digest('hex') }));
  put('deploy/approved-design.json', JSON.stringify({ schema: 1, edition: 'approved', files }));
  return { root, put, files };
}
test('an unchanged approved package and current build can be released', t => {
  const { root } = fixture(t);
  attestBuild(root, sourceFingerprint(root));
  assert.equal(verifyReleaseBuild(root).edition, 'approved');
});
test('substituted flowers and changed floral placement both stop the release', t => {
  for (const path of ['public/flowers.png', 'app/flowers.css']) {
    const { root, put } = fixture(t); put(path, 'unexpected replacement');
    assert.throws(() => validateApprovedDesign(root), /Approved design changed/);
  }
});
test('an old built image cannot pass just because source artwork is correct', t => {
  const { root, put } = fixture(t); put('dist/client/flowers.png', 'old artwork');
  assert.throws(() => attestBuild(root, sourceFingerprint(root)), /Built artwork does not match/);
});
test('new feature code invalidates a previous build but does not require changing approved art', t => {
  const { root, put } = fixture(t); attestBuild(root, sourceFingerprint(root));
  put('app/page.tsx', 'invitation with a new feature');
  assert.throws(() => verifyReleaseBuild(root), /Build is stale/);
  assert.equal(validateApprovedDesign(root).files, 2);
  put('dist/client/app.js', 'new compiled invitation'); attestBuild(root, sourceFingerprint(root));
  assert.equal(verifyReleaseBuild(root).edition, 'approved');
});
test('a modified compiled worker cannot be deployed under an existing proof', t => {
  const { root, put } = fixture(t); attestBuild(root, sourceFingerprint(root));
  put('dist/server/index.js', 'wrong worker');
  assert.throws(() => verifyReleaseBuild(root), /Build artifacts changed/);
});
test('edits during build are rejected, and raw builds have no release proof', t => {
  const { root, put } = fixture(t), before = sourceFingerprint(root);
  assert.throws(() => verifyReleaseBuild(root), /Verified build missing/);
  put('app/page.tsx', 'concurrent edit');
  assert.throws(() => attestBuild(root, before), /Source changed during/);
});
test('manifest entries cannot escape the approved package or repeat paths', t => {
  const { root, put, files } = fixture(t);
  for (const entries of [[...files, files[0]], [{ ...files[0], path: '../flowers.png' }]]) {
    put('deploy/approved-design.json', JSON.stringify({ schema: 1, files: entries }));
    assert.throws(() => validateApprovedDesign(root), /Invalid approved design entry/);
  }
});
