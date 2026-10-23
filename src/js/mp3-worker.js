/* global lamejs */
// Encodes a stereo mix to MP3 off the main thread so the UI stays responsive.
importScripts('../vendor/lame.min.js');

function toInt16(f32) {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

self.onmessage = (e) => {
  const { left, right, sampleRate, kbps } = e.data;
  const encoder = new lamejs.Mp3Encoder(2, sampleRate, kbps || 192);
  const l = toInt16(left);
  const r = toInt16(right);
  const block = 1152;
  const chunks = [];
  let size = 0;
  const step = block * 64;
  for (let i = 0; i < l.length; i += block) {
    const out = encoder.encodeBuffer(l.subarray(i, i + block), r.subarray(i, i + block));
    if (out.length) {
      chunks.push(out);
      size += out.length;
    }
    if (i % step === 0) self.postMessage({ progress: i / l.length });
  }
  const tail = encoder.flush();
  if (tail.length) {
    chunks.push(tail);
    size += tail.length;
  }
  const bytes = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) {
    bytes.set(new Uint8Array(c.buffer, c.byteOffset, c.length), o);
    o += c.length;
  }
  self.postMessage({ progress: 1 });
  self.postMessage({ done: true, bytes }, [bytes.buffer]);
};
