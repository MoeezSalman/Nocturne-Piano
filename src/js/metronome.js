// Metronome with look-ahead scheduling. "Beep" is the original site's sound (1200 Hz accent,
// 800 Hz beat). Tempo and time signature can change on the fly without breaking the beat.
import { Emitter } from './util.js';

export const TIME_SIGNATURES = ['1/4', '2/4', '3/4', '4/4', '5/4', '6/4', '7/4', '3/8', '5/8', '6/8', '7/8', '9/8', '12/8'];
export const METRO_SOUNDS = [
  { id: 'beep', label: 'Beep (original)' },
  { id: 'click', label: 'Click' },
  { id: 'wood', label: 'Woodblock' },
  { id: 'cowbell', label: 'Cowbell' },
];
export const BPM_MIN = 20;
export const BPM_MAX = 300;

const LOOKAHEAD = 0.12;

function beep(ctx, out, t, accent) {
  const f = accent ? 1200 : 800;
  const dur = accent ? 0.12 : 0.08;
  const level = accent ? 0.35 : 0.25;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.setValueAtTime(level, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur);
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(f * 2, t);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(level * 0.15, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.8);
  o2.connect(g2).connect(out);
  o2.start(t);
  o2.stop(t + dur);
}

let noise = null;
function noiseBurst(ctx, out, t, len, power, lp, level) {
  const n = Math.round(ctx.sampleRate * len);
  if (!noise || noise.length !== n || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** power;
  }
  const s = ctx.createBufferSource();
  s.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len * 1.5);
  s.connect(f).connect(g).connect(out);
  s.start(t);
  s.stop(t + len * 1.5);
}

function sweep(ctx, out, t, f0, f1, len, level) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.8);
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + len);
}

const SOUNDS = {
  beep,
  click(ctx, out, t, accent) {
    noiseBurst(ctx, out, t, 0.004, 3, 2500, accent ? 0.7 : 0.45);
    sweep(ctx, out, t, accent ? 1300 : 900, 400, 0.015, accent ? 0.28 : 0.18);
    sweep(ctx, out, t, 120, 50, 0.018, 0.2);
  },
  wood(ctx, out, t, accent) {
    const f = accent ? 1250 : 950;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(accent ? 1.2 : 0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(bp).connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.08);
  },
  cowbell(ctx, out, t, accent) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(accent ? 0.22 : 0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800;
    bp.Q.value = 1.5;
    bp.connect(g).connect(out);
    for (const f of [540, 800]) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      o.connect(bp);
      o.start(t);
      o.stop(t + 0.3);
    }
  },
};

/** The site's tiny UI clicks for opening/closing panels. */
export function uiClick(ctx, out, kind = 'open') {
  if (ctx.state !== 'running') return;
  const t = ctx.currentTime;
  if (kind === 'open') {
    noiseBurst(ctx, out, t, 0.004, 3, 2500, 0.45);
    sweep(ctx, out, t, 900, 400, 0.015, 0.18);
    sweep(ctx, out, t, 120, 50, 0.018, 0.2);
  } else {
    noiseBurst(ctx, out, t, 0.003, 4, 3000, 0.3);
    sweep(ctx, out, t, 1200, 700, 0.01, 0.1);
  }
}

/** Ticks per quarter note on the shared clock (divisible by 2, 3 and 4 for straight and triplet notes). */
export const PPQ = 24;

/**
 * Shared musical clock. The metronome, arpeggiator and band all schedule on its ticks so they
 * stay locked together. It runs while anything holds it.
 */
export class Transport extends Emitter {
  constructor(ctx, { bpm = 120, timeSig = '4/4' } = {}) {
    super();
    this.ctx = ctx;
    this.bpm = bpm;
    this.timeSig = timeSig;
    this.holders = new Set();
    this.running = false;
    this.timer = null;
  }

  get beatsPerBar() {
    return Number(this.timeSig.split('/')[0]);
  }

  get spb() {
    return 60 / this.bpm;
  }

  hold(who) {
    this.holders.add(who);
    if (!this.running) this._start();
  }

  release(who) {
    this.holders.delete(who);
    if (!this.holders.size && this.running) this._stop();
  }

  _start() {
    this.running = true;
    this.tick = 0;
    this.beatInBar = 0;
    this.bar = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this._pump(), 20);
    this.emit('start', this.nextTime);
    this._pump();
  }

  _stop() {
    this.running = false;
    clearInterval(this.timer);
    this.emit('stop');
  }

  _pump() {
    const horizon = this.ctx.currentTime + LOOKAHEAD;
    while (this.running && this.nextTime < horizon) {
      const sub = this.tick % PPQ;
      if (sub === 0 && this.tick > 0) {
        this.beatInBar++;
        if (this.beatInBar >= this.beatsPerBar) {
          this.beatInBar = 0;
          this.bar++;
        }
      }
      const spt = this.spb / PPQ;
      this.emit('tick', { tick: this.tick, time: this.nextTime, sub, beatInBar: this.beatInBar, bar: this.bar, spb: this.spb, spt });
      this.tick++;
      this.nextTime += spt;
    }
  }
}

export const SUBDIVISIONS = [
  [1, 'None'],
  [2, 'Eighths'],
  [3, 'Triplets'],
  [4, 'Sixteenths'],
];

export class Metronome extends Emitter {
  constructor(engine, transport, opts = {}) {
    super();
    this.engine = engine;
    this.ctx = engine.ctx;
    this.transport = transport;
    transport.bpm = opts.bpm ?? 120;
    transport.timeSig = opts.timeSig ?? '4/4';
    this.sound = opts.sound ?? 'beep';
    this.subdivision = opts.subdivision ?? 1;
    this.accent = opts.accent ?? true;
    this.trainer = { on: false, step: 5, every: 4, target: 160, bars: 0 };
    this.out = this.ctx.createGain();
    this.out.gain.value = opts.volume ?? 1;
    this.out.connect(engine.chain.output);
    this.running = false;
    transport.on('tick', (t) => this._onTick(t));
  }

  get bpm() {
    return this.transport.bpm;
  }

  get timeSig() {
    return this.transport.timeSig;
  }

  get beatsPerBar() {
    return this.transport.beatsPerBar;
  }

  get beatSeconds() {
    return 60 / this.bpm;
  }

  setBpm(bpm) {
    this.transport.bpm = Math.round(Math.min(BPM_MAX, Math.max(BPM_MIN, bpm)));
    this.emit('change');
  }

  setTimeSig(sig) {
    this.transport.timeSig = sig;
    this.emit('change');
  }

  setSound(id) {
    this.sound = id;
    this.emit('change');
  }

  setSubdivision(n) {
    this.subdivision = n;
    this.emit('change');
  }

  setTrainer(patch) {
    Object.assign(this.trainer, patch, { bars: 0 });
    this.emit('change');
  }

  setVolume(v) {
    this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.trainer.bars = 0;
    this.transport.hold('metronome');
    this.emit('state', true);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.transport.release('metronome');
    this.emit('state', false);
  }

  toggle() {
    if (this.running) this.stop();
    else this.start();
  }

  click(t, accent) {
    (SOUNDS[this.sound] || beep)(this.ctx, this.out, t, accent);
  }

  _subClick(t) {
    const o = this.ctx.createOscillator();
    o.frequency.value = 1500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.035);
  }

  _onTick({ tick, time, sub, beatInBar }) {
    if (!this.running) return;
    if (sub === 0) {
      if (beatInBar === 0 && tick > 0 && this.trainer.on) this._trainerBar();
      const accent = this.accent && beatInBar === 0;
      this.click(time, accent);
      const delay = Math.max(0, (time - this.ctx.currentTime) * 1000);
      setTimeout(() => this.emit('beat', { beat: beatInBar, accent: beatInBar === 0, beats: this.beatsPerBar }), delay);
    } else if (this.subdivision > 1 && sub % (PPQ / this.subdivision) === 0) {
      this._subClick(time);
    }
  }

  _trainerBar() {
    const tr = this.trainer;
    tr.bars++;
    if (tr.bars % tr.every !== 0) return;
    const dir = Math.sign(tr.target - this.bpm);
    if (!dir) return;
    const next = this.bpm + dir * Math.min(tr.step, Math.abs(tr.target - this.bpm));
    this.setBpm(next);
    this.emit('trainer', next);
  }

  /** Schedules a count-in of n clicks; returns the AudioContext time of the downbeat. */
  countIn(n = 4, bpm = this.bpm) {
    const spb = 60 / bpm;
    const t0 = this.ctx.currentTime + 0.1;
    for (let i = 0; i < n; i++) {
      this.click(t0 + i * spb, i === 0);
      setTimeout(() => this.emit('countin', { left: n - i }), (t0 + i * spb - this.ctx.currentTime) * 1000);
    }
    return t0 + n * spb;
  }
}
