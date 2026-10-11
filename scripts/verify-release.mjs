import { fileURLToPath } from 'node:url';
import { verifyReleaseBuild } from './release-guard.mjs';
try {
  const proof = verifyReleaseBuild(fileURLToPath(new URL('..', import.meta.url)));
  console.log(`Release verified: ${proof.edition}, built ${proof.builtAt}.`);
} catch (error) { console.error(error.message); process.exit(1); }
