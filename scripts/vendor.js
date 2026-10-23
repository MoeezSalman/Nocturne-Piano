// Copies the few browser-side libraries and fonts the renderer needs into src/vendor.
// Runs automatically after `npm install`.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'src', 'vendor');

const files = [
  ['lamejs/lame.min.js', 'lame.min.js'],
  ['@tonejs/midi/build/Midi.js', 'Midi.js'],
  ['@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2', 'fonts/manrope-latin-wght-normal.woff2'],
  ['@fontsource-variable/manrope/files/manrope-latin-ext-wght-normal.woff2', 'fonts/manrope-latin-ext-wght-normal.woff2'],
  ['@fontsource/playfair-display/files/playfair-display-latin-500-italic.woff2', 'fonts/playfair-500-italic.woff2'],
  ['@fontsource/playfair-display/files/playfair-display-latin-600-normal.woff2', 'fonts/playfair-600-normal.woff2'],
  ['@fontsource/playfair-display/files/playfair-display-latin-700-italic.woff2', 'fonts/playfair-700-italic.woff2'],
];

let missing = 0;
for (const [from, to] of files) {
  const src = join(nm, from);
  const dst = join(out, to);
  if (!existsSync(src)) {
    console.warn(`[vendor] missing ${from}`);
    missing++;
    continue;
  }
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
}
console.log(`[vendor] copied ${files.length - missing}/${files.length} files into src/vendor`);
