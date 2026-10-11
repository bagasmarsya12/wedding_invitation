import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { attestBuild, sourceFingerprint, validateApprovedDesign } from './release-guard.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
try {
  const design = validateApprovedDesign(root), source = sourceFingerprint(root);
  console.log(`Approved Atelier design: ${design.edition} (${design.files} protected files)`);
  const result = spawnSync(process.execPath, ['scripts/run-framework.mjs', 'build', ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
  attestBuild(root, source);
  console.log('Build verified: approved assets, current source, and generated artifacts match.');
} catch (error) { console.error(error.message); process.exit(1); }
