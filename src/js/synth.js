// Generated instruments for the "Synth Lab" group and the drum kit. They share the
// voice interface used by sampled instruments: start(...) returns { release(at, sec), kill(at), onended }.

const freqOf = (midi, cents = 0) => 440 * 2 ** ((midi - 69) / 12 + cents / 1200);
const MAX_RING = 9; // seconds a held synth note may ring before fading on its own

class SynthVoice {
  constructor(ctx, out, sources, { tail = 0.25, natural = null } = {}) {
    this.ctx = ctx;
    this.out = out; // the voice's final GainNode (envelope)
    this.sources = sources; // nodes that need stop()
    this.tail = tail;
    this.released = false;
    this.onended = null;
    this.endAt = natural;
    const last = sources[0];
    if (last) {
      last.onended = () => {
        this.out.disconnect();
        this.onended?.();
      };
    }
  }
  _stopAll(at) {
    for (const s of this.sources) {
      try {
        s.stop(at);
      } catch {
        /* already stopped */
      }
    }
  }
  release(at, sec) {
    if (this.released) return;
    this.released = true;
    const p = this.out.gain;
    const t = Math.max(at, this.ctx.currentTime);
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
    else {
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
    }
    const len = sec <= 0.05 ? Math.max(0.01, sec) : Math.max(sec, this.tail);
    p.linearRampToValueAtTime(0, t + len);
    this._stopAll(t + len + 0.02);
  }
  kill(at) {
    this.released = true;
    const p = this.out.gain;
    const t = Math.max(at, this.ctx.currentTime);
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
    else p.cancelScheduledValues(t);
    p.linearRampToValueAtTime(0, t + 0.02);
    this._stopAll(t + 0.04);
  }
}

function envGain(ctx, dest, t, level, attack = 0.005) {
  const g = ctx.createGain();
  g.gain.value = 0;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + attack);
  g.connect(dest);
  return g;
}

function fadeOutAt(param, t, len = 1.2) {
  param.setTargetAtTime(0, t, len / 4);
}

// ——— Karplus–Strong pluck, rendered once per note and cached ———
const pluckCache = new Map();
function pluckBuffer(ctx, midi) {
  const key = `${ctx.sampleRate}:${midi}`;
  if (pluckCache.has(key)) return pluckCache.get(key);
  const sr = ctx.sampleRate;
  const f = freqOf(midi);
  const len = Math.floor(sr * Math.min(4, 1.2 + 180 / f));
  const buf = ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const period = sr / f;
  const n = Math.max(2, Math.floor(period));
  const frac = period - n;
  const ring = new Float32Array(n + 2);
  for (let i = 0; i < ring.length; i++) ring[i] = Math.random() * 2 - 1;
  const decay = 0.996 + Math.min(0.0035, f / 400000);
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const a = ring[idx];
    const b = ring[(idx + 1) % ring.length];
    const v = (a * (1 - frac) + b * frac + a) * 0.5 * decay;
    out[i] = a;
    ring[idx] = v;
    idx = (idx + 1) % n;
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = 0.8 / (peak || 1);
  const fade = Math.floor(sr * 0.05);
  for (let i = 0; i < len; i++) out[i] *= g * (i > len - fade ? (len - i) / fade : 1);
  pluckCache.set(key, buf);
  return buf;
}

// ——— Drum kit (one-shots) ———
let noiseBuf = null;
function noise(ctx) {
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function drumHit(ctx, dest, midi, t, vel) {
  const pc = midi % 12;
  const oct = Math.floor(midi / 12) - 5; // around middle C = 0
  const pitch = 2 ** (oct * 0.25);
  const out = ctx.createGain();
  out.gain.value = vel;
  out.connect(dest);
  const sources = [];
  const tone = (type, f0, f1, dur, level, sweep = 0.06) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
    sources.push(o);
  };
  const hiss = (type, freq, q, dur, level, attack = 0.001) => {
    const s = ctx.createBufferSource();
    s.buffer = noise(ctx);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
    sources.push(s);
  };
  switch (pc) {
    case 0: // kick
      tone('sine', 160 * pitch, 42 * pitch, 0.5, 1.1, 0.12);
      hiss('lowpass', 1200, 0.7, 0.02, 0.25);
      break;
    case 1: // rim / side stick
      tone('triangle', 1700 * pitch, 900 * pitch, 0.05, 0.5, 0.02);
      hiss('bandpass', 3500, 2, 0.04, 0.3);
      break;
    case 2: // snare
      tone('triangle', 200 * pitch, 150 * pitch, 0.14, 0.6);
      hiss('highpass', 1400, 0.7, 0.22, 0.7);
      break;
    case 3: // clap
      for (let i = 0; i < 3; i++) {
        const s = ctx.createBufferSource();
        s.buffer = noise(ctx);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1300;
        f.Q.value = 1.2;
        const g = ctx.createGain();
        const st = t + i * 0.012;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.setValueAtTime(0.8, st);
        g.gain.exponentialRampToValueAtTime(0.001, st + (i === 2 ? 0.25 : 0.03));
        s.connect(f).connect(g).connect(out);
        s.start(t, Math.random());
        s.stop(t + 0.35);
        sources.push(s);
      }
      break;
    case 4: // tight snare
      tone('triangle', 240 * pitch, 180 * pitch, 0.1, 0.5);
      hiss('bandpass', 4200, 0.8, 0.14, 0.8);
      break;
    case 5: // low tom
    case 7: // mid tom
    case 9: {
      // high tom
      const base = { 5: 95, 7: 130, 9: 175 }[pc] * pitch;
      tone('sine', base * 1.6, base, 0.45, 0.9, 0.08);
      hiss('lowpass', 900, 0.6, 0.05, 0.15);
      break;
    }
    case 6: // closed hat
      hiss('highpass', 7500, 0.8, 0.05, 0.5);
      break;
    case 8: // pedal hat
      hiss('highpass', 6500, 0.8, 0.09, 0.4, 0.004);
      break;
    case 10: // open hat
      hiss('highpass', 7000, 0.7, 0.45, 0.45);
      break;
    case 11: // crash / ride by octave
      if (oct >= 0) {
        hiss('highpass', 5200, 0.5, 1.6, 0.5);
        hiss('bandpass', 3000, 0.6, 0.9, 0.2);
      } else {
        tone('square', 540, 540, 0.25, 0.12, 0.01);
        tone('square', 800, 800, 0.25, 0.12, 0.01);
      }
      break;
    default:
      break;
  }
  const v = new SynthVoice(ctx, out, sources, { tail: 0.3 });
  v.release = () => {}; // drums always ring out
  v.kill = (at) => {
    out.gain.setTargetAtTime(0, at, 0.01);
  };
  return v;
}

// ——— Tonal synths ———
const RECIPES = {
  chip(ctx, dest, f, t, vel) {
    const g = envGain(ctx, dest, t, 0.16 * vel, 0.003);
    g.gain.setTargetAtTime(0.11 * vel, t + 0.01, 0.08);
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(f, t);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f * 0.01, t + 0.35);
    lfo.connect(depth).connect(o.frequency);
    o.connect(g);
    o.start(t);
    lfo.start(t);
    fadeOutAt(g.gain, t + MAX_RING - 1.2);
    o.stop(t + MAX_RING);
    lfo.stop(t + MAX_RING);
    return new SynthVoice(ctx, g, [o, lfo], { tail: 0.08 });
  },
  supersaw(ctx, dest, f, t, vel) {
    const g = envGain(ctx, dest, t, 0.075 * vel, 0.012);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(Math.min(16000, f * 14), t);
    lp.frequency.setTargetAtTime(Math.min(9000, f * 5), t + 0.02, 0.4);
    lp.connect(g);
    const oscs = [-19, -11, -5, 0, 5, 11, 19].map((cents) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = cents;
      o.connect(lp);
      o.start(t, Math.random() * 0.01);
      o.stop(t + MAX_RING);
      return o;
    });
    fadeOutAt(g.gain, t + MAX_RING - 1.2);
    return new SynthVoice(ctx, g, oscs, { tail: 0.3 });
  },
  fm_bell(ctx, dest, f, t, vel) {
    const g = envGain(ctx, dest, t, 0.32 * vel, 0.002);
    g.gain.setTargetAtTime(0, t + 0.01, 1.1);
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * 3.5;
    const idx = ctx.createGain();
    idx.gain.setValueAtTime(f * 5, t);
    idx.gain.setTargetAtTime(f * 0.4, t, 0.6);
    mod.connect(idx).connect(car.frequency);
    car.connect(g);
    car.start(t);
    mod.start(t);
    car.stop(t + 6);
    mod.stop(t + 6);
    return new SynthVoice(ctx, g, [car, mod], { tail: 0.6 });
  },
  fm_epiano(ctx, dest, f, t, vel) {
    const g = envGain(ctx, dest, t, 0.36 * vel, 0.002);
    g.gain.setTargetAtTime(0.0, t + 0.02, 1.6);
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f;
    const idx = ctx.createGain();
    idx.gain.setValueAtTime(f * 1.8 * vel, t);
    idx.gain.setTargetAtTime(f * 0.25, t, 0.35);
    mod.connect(idx).connect(car.frequency);
    const tine = ctx.createOscillator();
    tine.frequency.value = f * 14;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.08 * vel, t);
    tg.gain.exponentialRampToValueAtTime(0.0005, t + 0.12);
    tine.connect(tg).connect(g);
    car.connect(g);
    for (const o of [car, mod, tine]) {
      o.start(t);
      o.stop(t + 7);
    }
    return new SynthVoice(ctx, g, [car, mod, tine], { tail: 0.25 });
  },
  sub_bass(ctx, dest, f, t, vel) {
    const g = envGain(ctx, dest, t, 0.45 * vel, 0.006);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.connect(g);
    const a = ctx.createOscillator();
    a.frequency.value = f;
    const b = ctx.createOscillator();
    b.type = 'triangle';
    b.frequency.value = f * 2;
    const bg = ctx.createGain();
    bg.gain.value = 0.25;
    a.connect(lp);
    b.connect(bg).connect(lp);
    for (const o of [a, b]) {
      o.start(t);
      o.stop(t + MAX_RING);
    }
    fadeOutAt(g.gain, t + MAX_RING - 1.2);
    return new SynthVoice(ctx, g, [a, b], { tail: 0.12 });
  },
  theremin(ctx, dest, f, t, vel) {
    const g = envGain(ctx, dest, t, 0.28 * vel, 0.09);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f * 0.985, t);
    o.frequency.setTargetAtTime(f, t, 0.05);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.6;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f * 0.012, t + 0.6);
    lfo.connect(depth).connect(o.frequency);
    o.connect(g);
    o.start(t);
    lfo.start(t);
    o.stop(t + MAX_RING);
    lfo.stop(t + MAX_RING);
    fadeOutAt(g.gain, t + MAX_RING - 1.2);
    return new SynthVoice(ctx, g, [o, lfo], { tail: 0.35 });
  },
  glass_pad(ctx, dest, f, t, vel) {
    const g = envGain(ctx, dest, t, 0.11 * vel, 0.7);
    const oscs = [
      ['triangle', 1, -7],
      ['triangle', 1, 7],
      ['sine', 2, 3],
      ['triangle', 0.5, 0],
    ].map(([type, mul, cents]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * mul;
      o.detune.value = cents;
      const og = ctx.createGain();
      og.gain.value = mul === 2 ? 0.35 : mul === 0.5 ? 0.4 : 1;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + MAX_RING);
      return o;
    });
    fadeOutAt(g.gain, t + MAX_RING - 1.2);
    return new SynthVoice(ctx, g, oscs, { tail: 1.2 });
  },
  pluck(ctx, dest, f, t, vel, midi, cents) {
    const g = ctx.createGain();
    g.gain.value = 0.6 * vel;
    g.connect(dest);
    const s = ctx.createBufferSource();
    s.buffer = pluckBuffer(ctx, midi);
    s.playbackRate.value = 2 ** (cents / 1200);
    s.connect(g);
    s.start(t);
    return new SynthVoice(ctx, g, [s], { tail: 0.15 });
  },
};

export function createSynthInstrument(preset) {
  const kind = preset.src.kind;
  return {
    preset,
    kind: 'synth',
    start(ctx, dest, midi, t, vel, cents = 0, mods = null) {
      const v = kind === 'drums' ? drumHit(ctx, dest, midi, t, vel) : RECIPES[kind](ctx, dest, freqOf(midi, cents), t, vel, midi, cents);
      if (mods && v.sources.length) {
        // Pitch wheel and vibrato reach every oscillator of the voice.
        const params = v.sources.map((n) => n.detune).filter(Boolean);
        for (const m of mods) for (const p of params) m.connect(p);
        const first = v.sources[0];
        const ended = first.onended;
        first.onended = (e) => {
          for (const m of mods) for (const p of params) m.disconnect(p);
          ended?.(e);
        };
      }
      return v;
    },
  };
}
