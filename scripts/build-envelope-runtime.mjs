// Derive a smaller live runtime from the immutable, approved Three r186 scene.
// Keep master artwork, shaders, camera geometry and export renderers untouched.
import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const root = fileURLToPath(new URL('..', import.meta.url));
const license = await readFile(new URL('../public/atelier/vendor/THREE-LICENSE.txt', import.meta.url), 'utf8');
await build({
  configFile: false,
  root,
  publicDir: false,
  logLevel: 'warn',
  build: {
    target: 'es2020',
    minify: true,
    outDir: 'public/atelier/runtime',
    emptyOutDir: false,
    rolldownOptions: { output: { banner: `/*!\n${license}\n*/` } },
    lib: {
      entry: 'public/atelier/envelope-scene.js',
      formats: ['es'],
      fileName: () => 'envelope-v1.js',
    },
  },
});
