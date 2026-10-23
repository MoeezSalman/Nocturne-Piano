// The light show above the keys. Styles:
//   ribbons   bars of light rise from each key while it sounds (default)
//   spectrum  a live frequency analyser
//   wave      a glowing oscilloscope line
//   aurora    soft northern lights that bloom from the notes you play
//   galaxy    a spiral of stars that every note sets spinning
// The song player can also draw a falling-notes "waterfall" through this canvas.

const SPEED = 150; // ribbons, px per second
export const VIZ_STYLES = [
  ['ribbons', 'Ribbons'],
  ['spectrum', 'Spectrum'],
  ['wave', 'Waveform'],
  ['aurora', 'Aurora'],
  ['galaxy', 'Galaxy'],
];

export class Visualizer {
  constructor(canvas, piano, keybed) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.piano = piano;
    this.keybed = keybed;
    this.enabled = true;
    this.rainbow = false;
    this.style = 'ribbons';
    this.ribbons = [];
    this.sparks = [];
    this.blobs = [];
    this.stars = [];
    this.field = [];
    this.peaks = [];
    this.spin = 0;
    this.lastSound = 0;
    this.analyser = null;
    this.overlay = null; // (ctx, api) => boolean keepAnimating
    this.colors = { live: '#dcb46a', hi: '#f5e0a8', song: '#62d0ff', track: '#b596ff' };
    this.running = false;
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(canvas);
    ro.observe(keybed);
    piano.on('layout', () => this.resize());
    this.resize();
  }

  setAccent(color, hi) {
    this.colors.live = color;
    if (hi) this.colors.hi = hi;
  }

  setStyle(style) {
    this.style = style;
    this.blobs = [];
    this.stars = [];
    this.kick();
  }

  attachAnalyser(analyser) {
    this.analyser = analyser;
    this.freq = new Uint8Array(analyser.frequencyBinCount);
    this.wave = new Uint8Array(analyser.fftSize);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = this.keybed.getBoundingClientRect();
    this.kx = k.left - r.left;
    this.kw = k.width;
    this.field = Array.from({ length: 140 }, () => ({ a: Math.random() * Math.PI * 2, d: Math.random() ** 0.6, s: 0.4 + Math.random() * 1.2, tw: Math.random() * 6 }));
    this.kick();
  }

  /** x/width of a key in canvas pixels. */
  keyX(midi) {
    const g = this.piano.geometry(midi);
    if (!g) return null;
    return { x: this.kx + g.x * this.kw, w: g.w * this.kw, black: g.black };
  }

  colorFor(midi, source) {
    if (source === 'song') return this.colors.song;
    if (source === 'track') return this.colors.track;
    if (this.rainbow) return `hsl(${((midi % 12) * 30 + 200) % 360} 90% 62%)`;
    return this.colors.live;
  }

  noteOn(midi, source = 'live', velocity = 1) {
    if (!this.enabled) return;
    const now = performance.now();
    const color = this.colorFor(midi, source);
    const k = this.keyX(midi);
    if (this.style === 'ribbons') this.ribbons.push({ midi, source, start: now, end: null, color, vel: velocity });
    if (this.style === 'aurora' && k) {
      this.blobs.push({ x: k.x + k.w / 2, y: this.h, vy: -(26 + Math.random() * 30), r: 40 + velocity * 60, life: 3.2, age: 0, color, sway: Math.random() * 6 });
      if (this.blobs.length > 60) this.blobs.shift();
    }
    if (this.style === 'galaxy') {
      const ang = ((midi % 12) / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      for (let i = 0; i < 14; i++) {
        this.stars.push({ a: ang + (Math.random() - 0.5) * 0.5, d: 0.02, v: 0.18 + Math.random() * 0.35, age: 0, life: 2.4 + Math.random(), color, r: 0.8 + Math.random() * 1.8 });
      }
      if (this.stars.length > 700) this.stars.splice(0, this.stars.length - 700);
    }
    if (k && (this.style === 'ribbons' || this.style === 'spectrum' || this.style === 'wave')) {
      const n = 5 + Math.round(velocity * 5);
      for (let i = 0; i < n; i++) {
        this.sparks.push({
          x: k.x + k.w / 2 + (Math.random() - 0.5) * k.w * 0.6,
          y: this.h - 2,
          vx: (Math.random() - 0.5) * 60,
          vy: -(60 + Math.random() * 160),
          life: 0.5 + Math.random() * 0.6,
          age: 0,
          color,
          r: 1 + Math.random() * 1.8,
        });
      }
    }
    this.lastSound = now;
    this.kick();
  }

  noteOff(midi, source = 'live') {
    const now = performance.now();
    for (let i = this.ribbons.length - 1; i >= 0; i--) {
      const r = this.ribbons[i];
      if (r.midi === midi && r.source === source && r.end == null) {
        r.end = now;
        break;
      }
    }
  }

  clear(source) {
    const now = performance.now();
    for (const r of this.ribbons) if ((!source || r.source === source) && r.end == null) r.end = now;
  }

  kick() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame((t) => this._frame(t));
  }

  _energy() {
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.wave);
    let sum = 0;
    for (let i = 0; i < this.wave.length; i += 4) {
      const v = (this.wave[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / (this.wave.length / 4));
  }

  _frame(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    let keep = false;

    if (this.enabled && this.style !== 'ribbons' && this.analyser) {
      const energy = this._energy();
      if (energy > 0.004) this.lastSound = t;
      const alive = t - this.lastSound < 1500;
      if (alive || this.blobs.length || this.stars.length) {
        keep = true;
        ctx.save();
        if (this.style === 'spectrum') this._spectrum(ctx);
        else if (this.style === 'wave') this._wave(ctx, energy);
        else if (this.style === 'aurora') this._aurora(ctx, dt, energy, t);
        else if (this.style === 'galaxy') this._galaxy(ctx, dt, energy, t);
        ctx.restore();
      }
    }

    if (this.overlay) keep = this.overlay(ctx, this) || keep;

    if (this.ribbons.length || this.sparks.length) {
      keep = true;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const bottom = this.h;
      this.ribbons = this.ribbons.filter((r) => {
        const k = this.keyX(r.midi);
        const top = bottom - ((t - r.start) / 1000) * SPEED;
        const low = r.end == null ? bottom : bottom - ((t - r.end) / 1000) * SPEED;
        if (low < -10 || !k) return low >= -10 && !!k;
        const w = Math.max(3, k.w * (k.black ? 0.62 : 0.5));
        const x = k.x + (k.w - w) / 2;
        const hgt = Math.max(2, low - top);
        const g = ctx.createLinearGradient(0, top, 0, low);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(Math.min(0.9, 26 / hgt + 0.05), r.color);
        g.addColorStop(1, r.color);
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = g;
        roundRect(ctx, x - w * 0.6, top, w * 2.2, hgt, w);
        ctx.fill();
        ctx.globalAlpha = 0.85;
        roundRect(ctx, x, top, w, hgt, Math.min(w / 2, 6));
        ctx.fill();
        if (r.end == null) {
          ctx.globalAlpha = 0.5;
          const glow = ctx.createRadialGradient(x + w / 2, bottom, 0, x + w / 2, bottom, w * 3);
          glow.addColorStop(0, r.color);
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(x - w * 3, bottom - w * 3, w * 7, w * 3);
        }
        return true;
      });
      this.sparks = this.sparks.filter((s) => {
        s.age += dt;
        if (s.age >= s.life) return false;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 40 * dt;
        ctx.globalAlpha = (1 - s.age / s.life) * 0.9;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });
      ctx.restore();
    }

    if (keep) requestAnimationFrame((tt) => this._frame(tt));
    else this.running = false;
  }

  // ——— Styles ———
  _spectrum(ctx) {
    this.analyser.getByteFrequencyData(this.freq);
    const n = 72;
    const sr = this.analyser.context.sampleRate;
    const bin = (f) => Math.min(this.freq.length - 1, Math.round((f / (sr / 2)) * this.freq.length));
    const x0 = this.kx;
    const width = this.kw;
    const bw = width / n;
    const base = this.h - 2;
    const grad = ctx.createLinearGradient(0, base, 0, base - this.h * 0.8);
    grad.addColorStop(0, this.colors.live);
    grad.addColorStop(1, this.colors.hi);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const f0 = 40 * (12000 / 40) ** (i / n);
      const f1 = 40 * (12000 / 40) ** ((i + 1) / n);
      let v = 0;
      for (let b = bin(f0); b <= bin(f1); b++) v = Math.max(v, this.freq[b]);
      const hgt = (v / 255) ** 1.6 * this.h * 0.82;
      this.peaks[i] = Math.max(hgt, (this.peaks[i] || 0) - 1.6);
      const x = x0 + i * bw + bw * 0.15;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = grad;
      roundRect(ctx, x, base - hgt, bw * 0.7, hgt, Math.min(3, bw * 0.3));
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = this.colors.hi;
      ctx.fillRect(x, base - this.peaks[i] - 3, bw * 0.7, 2);
    }
  }

  _wave(ctx, energy) {
    const data = this.wave;
    const mid = this.h * 0.55;
    const gain = Math.min(5, 0.22 / Math.max(0.01, energy));
    const amp = this.h * 0.38;
    const draw = (offset, alpha, width) => {
      ctx.beginPath();
      const step = Math.max(1, Math.floor(data.length / this.kw));
      for (let i = 0, px = 0; i < data.length; i += step, px++) {
        const x = this.kx + (i / data.length) * this.kw;
        const y = mid + ((data[i] - 128) / 128) * amp * gain + offset;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = this.colors.live;
    ctx.shadowColor = this.colors.live;
    ctx.shadowBlur = 14;
    draw(0, 0.95, 2.4);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = this.colors.hi;
    draw(10, 0.25, 1);
    draw(-10, 0.25, 1);
  }

  _aurora(ctx, dt, energy, t) {
    ctx.globalCompositeOperation = 'lighter';
    // Curtains of light that breathe with the music.
    const level = Math.min(1, energy * 6);
    for (let layer = 0; layer < 3; layer++) {
      const g = ctx.createLinearGradient(0, this.h * 0.15, 0, this.h);
      const c = layer === 1 ? this.colors.hi : this.colors.live;
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.55, c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.06 + level * 0.12;
      ctx.beginPath();
      ctx.moveTo(0, this.h);
      for (let x = 0; x <= this.w; x += 16) {
        const y = this.h * (0.45 + layer * 0.08) + Math.sin(x * 0.006 + t * 0.0006 * (layer + 1) + layer) * 40 * (0.4 + level) + Math.sin(x * 0.017 + t * 0.001) * 14;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(this.w, this.h);
      ctx.closePath();
      ctx.fill();
    }
    this.blobs = this.blobs.filter((b) => {
      b.age += dt;
      if (b.age > b.life) return false;
      b.y += b.vy * dt;
      const x = b.x + Math.sin(b.age * 1.4 + b.sway) * 18;
      const r = b.r * (1 + b.age * 0.6);
      const a = Math.sin((b.age / b.life) * Math.PI) * 0.55;
      const g = ctx.createRadialGradient(x, b.y, 0, x, b.y, r);
      g.addColorStop(0, b.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a;
      ctx.fillStyle = g;
      ctx.fillRect(x - r, b.y - r, r * 2, r * 2);
      return true;
    });
  }

  _galaxy(ctx, dt, energy, t) {
    ctx.globalCompositeOperation = 'lighter';
    const cx = this.w / 2;
    const cy = this.h * 0.52;
    const R = Math.min(this.w * 0.48, this.h * 0.9);
    this.spin += dt * (0.05 + energy * 1.6);
    // Background star field
    for (const s of this.field) {
      const a = s.a + this.spin * 0.25 * s.s;
      const d = s.d * R;
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 0.002 + s.tw);
      ctx.fillStyle = this.colors.hi;
      ctx.fillRect(cx + Math.cos(a) * d * 1.6, cy + Math.sin(a) * d * 0.55, s.s, s.s);
    }
    // Glowing core
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60 + energy * 300);
    core.addColorStop(0, this.colors.hi);
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.18 + Math.min(0.5, energy * 3);
    ctx.fillStyle = core;
    ctx.fillRect(cx - 400, cy - 400, 800, 800);
    // Note stars spiral outwards
    this.stars = this.stars.filter((s) => {
      s.age += dt;
      if (s.age > s.life) return false;
      s.d += s.v * dt;
      s.a += dt * (1.2 - s.d);
      const x = cx + Math.cos(s.a + this.spin) * s.d * R * 1.6;
      const y = cy + Math.sin(s.a + this.spin) * s.d * R * 0.55;
      ctx.globalAlpha = (1 - s.age / s.life) * 0.95;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
