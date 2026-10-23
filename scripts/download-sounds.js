// Downloads every instrument's samples into ./sounds so the app (and the installer) work offline.
// Safe to re-run: files already present are skipped.
import { mkdir, writeFile, rename, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PRESETS, soundFiles } from '../src/js/instruments.js';

const require = createRequire(import.meta.url);
const { upstreamFor } = require('../lib/sound-cache.cjs');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'sounds');

const files = [...new Set(PRESETS.flatMap(soundFiles))];
const todo = files.filter((f) => !existsSync(join(ROOT, f)));
console.log(`${files.length} sound files for ${PRESETS.length} sounds — ${files.length - todo.length} already here, ${todo.length} to download`);

let done = 0;
let bytes = 0;
const failed = [];

async function fetchOne(rel) {
  const url = upstreamFor(rel);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = Buffer.from(await res.arrayBuffer());
      const dest = join(ROOT, rel);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(`${dest}.part`, data);
      await rename(`${dest}.part`, dest);
      bytes += data.length;
      return;
    } catch (err) {
      if (attempt === 3) failed.push(`${rel} (${err.message})`);
      else await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
}

const queue = [...todo];
async function worker() {
  while (queue.length) {
    const rel = queue.shift();
    await fetchOne(rel);
    done++;
    if (done % 25 === 0 || done === todo.length) {
      console.log(`  ${done}/${todo.length} files · ${(bytes / 1048576).toFixed(1)} MB`);
    }
  }
}

await Promise.all(Array.from({ length: 8 }, worker));

let total = 0;
for (const f of files) {
  try {
    total += (await stat(join(ROOT, f))).size;
  } catch {
    /* missing */
  }
}
console.log(`\nDone. Library size: ${(total / 1048576).toFixed(0)} MB in ${ROOT}`);
if (failed.length) {
  console.log(`${failed.length} file(s) failed:\n  ${failed.join('\n  ')}`);
  process.exitCode = 1;
}
