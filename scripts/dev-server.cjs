// Serves the renderer over http://localhost:5178 so the UI can be developed in a normal browser.
// Sounds are resolved exactly like the desktop app does (downloaded once into ./sounds).
const http = require('node:http');
const path = require('node:path');
const fsp = require('node:fs/promises');
const { createSoundResolver } = require('../lib/sound-cache.cjs');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const PORT = Number(process.env.PORT || 5178);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

const sounds = createSoundResolver({ cacheDir: path.join(ROOT, 'sounds'), bundledDir: null, fetchImpl: fetch });

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    if (rel.startsWith('sounds/')) {
      const { status, data, type } = await sounds.resolve(rel.slice('sounds/'.length));
      res.writeHead(status, { 'content-type': type });
      res.end(data);
      return;
    }
    const file = path.normalize(path.join(SRC, rel));
    if (!file.startsWith(SRC)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const data = await fsp.readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    } catch {
      res.writeHead(404).end('Not found');
    }
  })
  .listen(PORT, () => console.log(`Nocturne dev server on http://localhost:${PORT}`));
