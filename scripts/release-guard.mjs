import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestPath = 'deploy/approved-design.json';
const proofPath = 'dist/approved-build.json';
const sourceDirectories = ['app', 'lib', 'public', 'build', 'scripts', 'drizzle', 'deploy', '.openai'];
const sourceFiles = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'next.config.ts', 'next.config.mjs', 'postcss.config.mjs', 'eslint.config.mjs'];

function filesAt(root, directory) {
  const base = join(root, directory), files = [];
  if (!existsSync(base)) return files;
  function visit(path) {
    for (const item of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, item.name);
      if (item.isSymbolicLink()) throw new Error(`Release input cannot be a symlink: ${relative(root, file)}`);
      if (item.isDirectory()) visit(file);
      else if (item.isFile()) files.push(relative(root, file).split(sep).join('/'));
    }
  }
  visit(base); return files;
}
function fingerprint(root, paths) {
  return sha([...new Set(paths)].sort().map(path => `${path}\0${sha(readFileSync(join(root, path)))}`).join('\n'));
}
export function sourceFingerprint(root) {
  return fingerprint(root, [...sourceDirectories.flatMap(directory => filesAt(root, directory)), ...sourceFiles.filter(path => existsSync(join(root, path)))]);
}
function buildFingerprint(root) {
  return fingerprint(root, filesAt(root, 'dist').filter(path => ![proofPath, 'dist/server/wrangler.deploy.json'].includes(path)));
}

export function validateApprovedDesign(root, { built = false } = {}) {
  if (!existsSync(join(root, manifestPath))) throw new Error('Approved design manifest missing. Restore the approved Atelier package before building.');
  const bytes = readFileSync(join(root, manifestPath)), manifest = JSON.parse(bytes);
  if (manifest.schema !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Invalid approved design manifest.');
  const seen = new Set();
  for (const { path, sha256 } of manifest.files) {
    if (typeof path !== 'string' || !/^[a-zA-Z0-9_./-]+$/.test(path) || path.startsWith('/') || path.split('/').some(part => !part || part === '..' || part === '.') || !/^[a-f0-9]{64}$/.test(sha256) || seen.has(path)) throw new Error('Invalid approved design entry.');
    seen.add(path);
    const file = resolve(root, path);
    if (!existsSync(file) || !lstatSync(file).isFile() || sha(readFileSync(file)) !== sha256) throw new Error(`Approved design changed: ${path}. Restore this file or review and explicitly approve a new design edition.`);
    if (built && path.startsWith('public/')) {
      const artifact = join(root, 'dist/client', path.slice('public/'.length));
      if (!existsSync(artifact) || sha(readFileSync(artifact)) !== sha256) throw new Error(`Built artwork does not match the approved design: ${path}. Rebuild before deploying.`);
    }
  }
  return { edition: manifest.edition, manifestSha256: sha(bytes), files: seen.size };
}
export function attestBuild(root, expectedSource) {
  const approved = validateApprovedDesign(root, { built: true }), currentSource = sourceFingerprint(root);
  if (currentSource !== expectedSource) throw new Error('Source changed during the build. Build again from one consistent checkout.');
  const proof = { schema: 1, builtAt: new Date().toISOString(), ...approved, sourceSha256: currentSource, buildSha256: buildFingerprint(root) };
  writeFileSync(join(root, proofPath), JSON.stringify(proof, null, 2) + '\n');
  return proof;
}
export function verifyReleaseBuild(root) {
  const approved = validateApprovedDesign(root, { built: true });
  if (!existsSync(join(root, proofPath))) throw new Error('Verified build missing. Run npm run build before deploying.');
  const proof = JSON.parse(readFileSync(join(root, proofPath), 'utf8'));
  if (proof.schema !== 1 || proof.manifestSha256 !== approved.manifestSha256 || proof.sourceSha256 !== sourceFingerprint(root)) throw new Error('Build is stale: source or approved design changed. Run npm run build again.');
  if (proof.buildSha256 !== buildFingerprint(root)) throw new Error('Build artifacts changed after verification. Rebuild before deploying.');
  return proof;
}
