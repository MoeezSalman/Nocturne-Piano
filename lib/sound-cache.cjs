// Resolves sound files for the app. Every sound lives under a relative path such as
//   salamander/C4.mp3                      Salamander Grand Piano (CC-BY 3.0)
//   gm/MusyngKite/violin-ogg.js            midi-js-soundfonts (FluidR3 / MusyngKite / FatBoy)
//   studio/cello/A2.mp3                    tonejs-instruments (CC-BY 3.0)
// A file is served from the user cache, then from the bundled folder, and otherwise
// downloaded once from its public open-source home and kept in the cache for offline use.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const UPSTREAM = [
  [/^salamander\/([A-G]s?\d)\.mp3$/, (m) => `https://tonejs.github.io/audio/salamander/${m[1]}.mp3`],
  [
    /^gm\/(FluidR3_GM|MusyngKite|FatBoy)\/([a-z0-9_]+-(?:ogg|mp3)\.js)$/,
    (m) => `https://gleitz.github.io/midi-js-soundfonts/${m[1]}/${m[2]}`,
  ],
  [/^studio\/([a-z-]+)\/([A-G]s?\d)\.mp3$/, (m) => `https://nbrosowsky.github.io/tonejs-instruments/samples/${m[1]}/${m[2]}.mp3`],
];

function upstreamFor(rel) {
  for (const [re, build] of UPSTREAM) {
    const m = rel.match(re);
    if (m) return build(m);
  }
  return null;
}

const TYPES = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.js': 'text/javascript; charset=utf-8' };
const typeOf = (rel) => TYPES[path.extname(rel)] || 'application/octet-stream';

function createSoundResolver({ cacheDir, bundledDir, fetchImpl }) {
  const inflight = new Map();

  function localPath(rel) {
    for (const base of [cacheDir, bundledDir]) {
      if (!base) continue;
      const file = path.join(base, rel);
      if (fs.existsSync(file)) return file;
    }
    return null;
  }

  async function download(url, dest) {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const data = Buffer.from(await res.arrayBuffer());
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    const tmp = `${dest}.${process.pid}.part`;
    await fsp.writeFile(tmp, data);
    await fsp.rename(tmp, dest).catch(async () => {
      // Another request may have finished first; keep whichever file won.
      await fsp.rm(tmp, { force: true });
    });
    return data;
  }

  /** Returns { status, data, type } for a relative sound path. */
  async function resolve(rel) {
    const url = upstreamFor(rel);
    if (!url) return { status: 404, data: Buffer.from('Unknown sound'), type: 'text/plain' };
    const local = localPath(rel);
    if (local) return { status: 200, data: await fsp.readFile(local), type: typeOf(rel) };
    let job = inflight.get(rel);
    if (!job) {
      job = download(url, path.join(cacheDir, rel)).finally(() => inflight.delete(rel));
      inflight.set(rel, job);
    }
    try {
      return { status: 200, data: await job, type: typeOf(rel) };
    } catch (err) {
      return { status: 502, data: Buffer.from(String(err.message || err)), type: 'text/plain' };
    }
  }

  const has = (rel) => localPath(rel) !== null;

  return { resolve, has, upstreamFor };
}

module.exports = { createSoundResolver, upstreamFor };
