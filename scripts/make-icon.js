// Draws the app icon (build/icon.png, 512×512) without any image libraries.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DESIGN = 512;
const SS = 3; // supersampling per axis

const mix = (a, b, t) => a + (b - a) * t;
const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

function shade(x, y) {
  // Background tile
  if (!inRoundRect(x, y, 16, 16, 496, 496, 110)) return null;
  const g = y / DESIGN;
  let c = [mix(26, 9, g), mix(26, 9, g), mix(34, 12, g)];
  // Soft gold glow
  const d = Math.hypot(x - 256, y - 330) / 300;
  const glow = Math.max(0, 1 - d) ** 2 * 0.35;
  c = [c[0] + 220 * glow, c[1] + 170 * glow, c[2] + 90 * glow];
  // Gold fallboard bar
  if (inRoundRect(x, y, 86, 150, 426, 196, 14)) {
    const t = (y - 150) / 46;
    return [mix(250, 170, t), mix(226, 124, t), mix(160, 48, t)];
  }
  // Keys area
  const kx0 = 86;
  const kx1 = 426;
  const ky0 = 206;
  const ky1 = 400;
  const whites = 5;
  const kw = (kx1 - kx0) / whites;
  // Black keys over white keys
  for (const i of [1, 2, 4]) {
    const cx = kx0 + i * kw;
    if (inRoundRect(x, y, cx - kw * 0.3, ky0, cx + kw * 0.3, ky0 + (ky1 - ky0) * 0.6, 8)) {
      const t = (y - ky0) / ((ky1 - ky0) * 0.6);
      const hl = Math.abs(x - cx) < kw * 0.12 && t < 0.8 ? 18 : 0;
      return [mix(40, 12, t) + hl, mix(40, 12, t) + hl, mix(46, 15, t) + hl];
    }
  }
  if (x >= kx0 && x <= kx1 && y >= ky0) {
    const i = Math.floor((x - kx0) / kw);
    const lx = x - (kx0 + i * kw);
    if (lx > 3 && lx < kw - 3 && inRoundRect(x, y, kx0 + i * kw + 3, ky0, kx0 + (i + 1) * kw - 3, ky1, 12)) {
      const t = (y - ky0) / (ky1 - ky0);
      const warm = i === 2 ? 1 : 0; // one key "pressed" in gold
      return [mix(250, 226, t) - warm * 10, mix(247, 214, t) - warm * 40, mix(240, 190, t) - warm * 120];
    }
  }
  return c;
}

function render(SIZE) {
  const out = new Float32Array(SIZE * SIZE * 4);
  const k = DESIGN / SIZE;
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = shade((px + (sx + 0.5) / SS) * k, (py + (sy + 0.5) / SS) * k);
          if (!c) continue;
          r += c[0];
          g += c[1];
          b += c[2];
          a += 1;
        }
      }
      const i = (py * SIZE + px) * 4;
      out[i] = a ? r / a : 0;
      out[i + 1] = a ? g / a : 0;
      out[i + 2] = a ? b / a : 0;
      out[i + 3] = (a / (SS * SS)) * 255;
    }
  }
  return out;
}

// ——— PNG encoding ———
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(SIZE) {
  const out = render(SIZE);
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    for (let x = 0; x < SIZE * 4; x++) raw[y * (SIZE * 4 + 1) + 1 + x] = Math.max(0, Math.min(255, Math.round(out[y * SIZE * 4 + x])));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ICO with PNG-compressed entries (Windows Vista and later).
function ico(sizes) {
  const images = sizes.map((s) => [s, png(s)]);
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(([s, data], i) => {
    const e = 6 + i * 16;
    header[e] = s >= 256 ? 0 : s;
    header[e + 1] = s >= 256 ? 0 : s;
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map(([, d]) => d)]);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'build');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'icon.png'), png(512));
writeFileSync(join(dir, 'icon.ico'), ico([256, 64, 48, 32, 16]));
console.log(`Wrote icon.png and icon.ico in ${dir}`);
