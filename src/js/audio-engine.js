// Audio engine. The signal chain, gains and envelopes reproduce onlinepianist.com's Virtual Piano:
//
//   voice ─► low-pass 5.5 kHz (Q 0.5) ─┬──────────────────────────► master (0.4) ─► volume ─► speakers
//                                      └─► convolver 1.8 s ─► wet 0.15 ─┘
//
//   • no attack ramp, every note at full level (piano ×1, soundfonts ×6)
//   • key release fades out in 0.35 s; half pedal in 3 s (1.2 s for held tones)
//   • the last 0.8 s of every sample fades to silence; max 8 overlapping voices per key
//   • the Concert Grand uses Salamander samples trimmed and level-matched exactly like the site
import { Emitter } from './util.js';
import { PRESET_BY_ID, SALAMANDER_ROOTS, salamanderName, soundFiles } from './instruments.js';
import { createSynthInstrument } from './synth.js';
import { FLATS, SHARPS } from './notes.js';
import { buildChain, makeImpulse, DEFAULT_FX, MASTER_GAIN, REVERB_WET, LOWPASS_Q } from './fx.js';

export { buildChain, makeImpulse, MASTER_GAIN, REVERB_WET, LOWPASS_Q };
export const SOUNDFONT_BOOST = 6;
export const RELEASE = 0.35;
export const FAST_RELEASE = 0.02;
export const MAX_VOICES_PER_KEY = 8;
export const TAIL_FADE = 0.8;
export const LOWPASS_HZ = 5500;
export const HALF_PEDAL_RELEASE = 3;
export const HALF_PEDAL_RELEASE_SUSTAINED = 1.2;

// Measured from the original site's grand piano files: [trimmed length s, peak level] per sample.
const SALAMANDER_CAL = {
  21: [7, 0.6706], 24: [7, 0.8683], 27: [7, 0.6658], 30: [7, 0.854], 33: [7, 0.6844], 36: [7, 0.7922],
  39: [7, 0.7066], 42: [7, 0.6812], 45: [7, 0.6711], 48: [7, 0.6768], 51: [7, 0.6748], 54: [7, 0.6885],
  57: [7, 0.673], 60: [6.5, 0.6997], 63: [6.5, 0.6577], 66: [6.5, 0.6763], 69: [6.5, 0.6952],
  72: [5.5, 0.6714], 75: [5.5, 0.663], 78: [5.5, 0.7476], 81: [5.5, 0.7371], 84: [4, 0.6562],
  87: [4, 0.7986], 90: [4, 0.6208], 93: [4, 0.5879], 96: [3, 0.6642], 99: [3, 0.7308], 102: [3, 0.7391],
  105: [3, 0.7274], 108: [3, 0.7705],
};
const SALAMANDER_ROOT_GAIN_DB = { 48: 1.5 };
const STUDIO_PEAK = 0.7;

export const DEFAULT_SOUND = {
  volume: 0.8,
  reverbOn: true,
  reverbWet: REVERB_WET,
  toneOn: true,
  toneHz: LOWPASS_HZ,
  tuningCents: 0,
  velocity: false,
  bendRange: 2,
  ...DEFAULT_FX,
};

const dbToGain = (db) => 10 ** (db / 20);

// ——— Voices ———
class SampleVoice {
  constructor(ctx, src, gain, mods = null) {
    this.ctx = ctx;
    this.src = src;
    this.gain = gain;
    this.released = false;
    this.onended = null;
    if (mods) for (const m of mods) m.connect(src.detune);
    src.onended = () => {
      gain.disconnect();
      if (mods) for (const m of mods) m.disconnect(src.detune);
      this.onended?.();
    };
  }
  release(at, sec) {
    if (this.released) return;
    this.released = true;
    const p = this.gain.gain;
    const t = Math.max(at, this.ctx.currentTime);
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
    else {
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
    }
    p.linearRampToValueAtTime(0, t + sec);
    try {
      this.src.stop(t + sec + 0.01);
    } catch {
      /* already stopped */
    }
  }
  /** Silences the voice quickly even if a release is already scheduled (pause, seek, stop). */
  kill(at) {
    this.released = true;
    const p = this.gain.gain;
    const t = Math.max(at, this.ctx.currentTime);
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
    else {
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
    }
    p.linearRampToValueAtTime(0, t + FAST_RELEASE);
    try {
      this.src.stop(t + FAST_RELEASE + 0.01);
    } catch {
      /* already stopped */
    }
  }
}

class SampleInstrument {
  constructor(preset, buffers, gainFactor, rootGainDb = {}) {
    this.preset = preset;
    this.kind = 'sample';
    this.buffers = buffers; // Map<midi, AudioBuffer>
    this.roots = [...buffers.keys()].sort((a, b) => a - b);
    this.gainFactor = gainFactor;
    this.rootGainDb = rootGainDb;
    this.nearestCache = new Map();
  }
  nearest(midi) {
    let r = this.nearestCache.get(midi);
    if (r !== undefined) return r;
    r = this.roots[0];
    let best = Math.abs(midi - r);
    for (const root of this.roots) {
      const d = Math.abs(midi - root);
      if (d < best) {
        best = d;
        r = root;
      }
    }
    this.nearestCache.set(midi, r);
    return r;
  }
  start(ctx, dest, midi, t, vel, cents = 0, mods = null) {
    const root = this.nearest(midi);
    const buffer = this.buffers.get(root);
    const rate = 2 ** ((midi - root) / 12 + cents / 1200);
    const peak = this.gainFactor * dbToGain(this.rootGainDb[root] || 0) * vel;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(peak, t);
    g.connect(dest);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    src.connect(g);
    src.start(t);
    const dur = buffer.duration / rate;
    if (dur > TAIL_FADE) {
      g.gain.setValueAtTime(peak, t + dur - TAIL_FADE);
      g.gain.linearRampToValueAtTime(0, t + dur);
    }
    return new SampleVoice(ctx, src, g, mods);
  }
}

/**
 * Tracks the voices sounding per (channel, key). Used by the live engine and by the offline
 * renderer so exported audio matches what was heard.
 */
export class VoiceBank {
  constructor(ctx, input, getCents = () => 0) {
    this.ctx = ctx;
    this.input = input;
    this.getCents = getCents;
    this.voices = new Map();
    this.mods = null; // pitch modulation sources for live voices
  }
  noteOn(inst, midi, t, vel = 1, channel = 'live') {
    const key = `${channel}|${midi}`;
    const list = this.voices.get(key) || [];
    if (list.length >= MAX_VOICES_PER_KEY) list.shift().kill(Math.max(t, this.ctx.currentTime));
    const mods = channel === 'live' ? this.mods : null;
    const voice = inst.start(this.ctx, this.input, midi, t, vel, this.getCents(), mods);
    voice.onended = () => {
      const l = this.voices.get(key);
      if (!l) return;
      const i = l.indexOf(voice);
      if (i !== -1) l.splice(i, 1);
      if (!l.length) this.voices.delete(key);
    };
    list.push(voice);
    this.voices.set(key, list);
    return voice;
  }
  noteOff(midi, t, releaseSec = RELEASE, channel = 'live') {
    const key = `${channel}|${midi}`;
    const list = this.voices.get(key);
    if (!list) return false;
    for (const v of list) v.release(t, releaseSec);
    this.voices.delete(key);
    return true;
  }
  channelKeys(channel) {
    const out = [];
    for (const key of this.voices.keys()) {
      const [ch, midi] = key.split('|');
      if (ch === channel) out.push(Number(midi));
    }
    return out;
  }
  killChannel(channel, t, releaseSec = 0) {
    for (const [key, list] of this.voices) {
      if (!key.startsWith(`${channel}|`)) continue;
      for (const v of list) (releaseSec ? v.release(t, releaseSec) : v.kill(t));
      this.voices.delete(key);
    }
  }
}

// ——— Loading helpers ———
async function fetchArrayBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return res.arrayBuffer();
}

function peakOf(buf) {
  let p = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const v = d[i] < 0 ? -d[i] : d[i];
      if (v > p) p = v;
    }
  }
  return p;
}

/** Trim, level-match and fade a sample: how the site prepared its Salamander files. */
function reshape(ctx, buf, seconds, targetPeak, fadeSec = 0.12) {
  const len = seconds ? Math.min(buf.length, Math.round(seconds * buf.sampleRate)) : buf.length;
  const peak = peakOf(buf) || 1;
  const gain = targetPeak / peak;
  const fade = Math.min(len, Math.round(fadeSec * buf.sampleRate));
  const out = ctx.createBuffer(buf.numberOfChannels, len, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0; i < len; i++) dst[i] = src[i] * gain;
    if (seconds && len < buf.length) for (let i = len - fade; i < len; i++) dst[i] *= (len - i) / fade;
  }
  return out;
}

const NOTE_INDEX = new Map();
for (let m = 0; m < 128; m++) {
  const o = Math.floor(m / 12) - 1;
  NOTE_INDEX.set(`${FLATS[m % 12]}${o}`, m);
  NOTE_INDEX.set(`${SHARPS[m % 12]}${o}`, m);
}
const studioNoteToMidi = (n) => NOTE_INDEX.get(n.replace('s', '#'));

// ——— Engine ———
export class AudioEngine extends Emitter {
  constructor(sound = DEFAULT_SOUND) {
    super();
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.sound = { ...DEFAULT_SOUND };
    for (const k of Object.keys(DEFAULT_SOUND)) if (sound[k] !== undefined) this.sound[k] = sound[k];
    this.chain = buildChain(this.ctx, this.sound, makeImpulse(this.ctx, this.sound.room));
    this.bank = new VoiceBank(this.ctx, this.chain.input, () => this.sound.tuningCents);
    // Pitch wheel and modulation wheel act on live voices through their detune.
    this.bend = this.ctx.createConstantSource();
    this.bend.offset.value = 0;
    this.bend.start();
    this.vibrato = this.ctx.createOscillator();
    this.vibrato.frequency.value = 5.6;
    this.vibratoDepth = this.ctx.createGain();
    this.vibratoDepth.gain.value = 0;
    this.vibrato.connect(this.vibratoDepth);
    this.vibrato.start();
    this.bank.mods = [this.bend, this.vibratoDepth];
    this.instruments = new Map(); // presetId → instrument
    this.loading = new Map(); // presetId → Promise
    this.lru = [];
    this.current = null;
    this.currentId = null;
    this.pinned = new Set(); // instruments that must stay in memory (recorder tracks, songs)
    const resume = () => this.ctx.state !== 'running' && this.ctx.resume().catch(() => {});
    window.addEventListener('pointerdown', resume, { capture: true });
    window.addEventListener('keydown', resume, { capture: true });
    resume();
  }

  get now() {
    return this.ctx.currentTime;
  }

  get impulse() {
    return this.chain.reverb.buffer;
  }

  /** Pitch wheel: -1 … 1 of the bend range. */
  setBend(amount) {
    this.bend.offset.setTargetAtTime(amount * this.sound.bendRange * 100, this.ctx.currentTime, 0.008);
  }

  /** Modulation wheel: 0 … 1 adds vibrato. */
  setMod(amount) {
    this.vibratoDepth.gain.setTargetAtTime(amount * 45, this.ctx.currentTime, 0.03);
  }

  // ——— Sound settings ———
  setSound(patch) {
    Object.assign(this.sound, patch);
    this.chain.apply(this.sound);
  }

  // ——— Instruments ———
  isLoaded(id) {
    return this.instruments.has(id);
  }

  async load(id, onProgress = () => {}) {
    if (this.instruments.has(id)) {
      this._touch(id);
      return this.instruments.get(id);
    }
    if (this.loading.has(id)) return this.loading.get(id);
    const preset = PRESET_BY_ID.get(id);
    if (!preset) throw new Error(`Unknown sound ${id}`);
    const job = this._load(preset, onProgress)
      .then((inst) => {
        this.instruments.set(id, inst);
        this._touch(id);
        this._evict();
        return inst;
      })
      .finally(() => this.loading.delete(id));
    this.loading.set(id, job);
    return job;
  }

  async _load(preset, onProgress) {
    const src = preset.src;
    if (src.type === 'synth') {
      onProgress(1);
      return createSynthInstrument(preset);
    }
    const files = soundFiles(preset);
    let done = 0;
    const tick = () => onProgress(++done / Math.max(1, files.length));

    if (src.type === 'salamander') {
      const buffers = new Map();
      await Promise.all(
        SALAMANDER_ROOTS.map(async (midi) => {
          const raw = await this.ctx.decodeAudioData(await fetchArrayBuffer(`sounds/salamander/${salamanderName(midi)}.mp3`));
          const [secs, peak] = SALAMANDER_CAL[midi];
          buffers.set(midi, reshape(this.ctx, raw, secs, peak));
          tick();
        }),
      );
      return new SampleInstrument(preset, buffers, 1, SALAMANDER_ROOT_GAIN_DB);
    }

    if (src.type === 'studio') {
      const buffers = new Map();
      await Promise.all(
        src.notes.map(async (note) => {
          const midi = studioNoteToMidi(note);
          const raw = await this.ctx.decodeAudioData(await fetchArrayBuffer(`sounds/studio/${src.name}/${note}.mp3`));
          buffers.set(midi, reshape(this.ctx, raw, 0, STUDIO_PEAK));
          tick();
        }),
      );
      return new SampleInstrument(preset, buffers, 1);
    }

    // MIDI.js soundfont bundle: a JS file holding one base64 audio clip per note.
    const res = await fetch(`sounds/${files[0]}`);
    if (!res.ok) throw new Error(`Could not load ${preset.label} (${res.status})`);
    const text = await res.text();
    onProgress(0.5);
    const start = text.search(/= \{[\r\n]/);
    if (start < 0) throw new Error(`${preset.label}: unexpected soundfont format`);
    const json = text.slice(text.indexOf('{', start), text.lastIndexOf('}') + 1).replace(/,\s*\}$/, '}');
    const notes = JSON.parse(json);
    const buffers = new Map();
    const entries = Object.entries(notes).filter(([name]) => NOTE_INDEX.has(name));
    let decoded = 0;
    await Promise.all(
      entries.map(async ([name, dataUrl]) => {
        const midi = NOTE_INDEX.get(name);
        if (midi < 21 || midi > 108) return;
        const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        buffers.set(midi, await this.ctx.decodeAudioData(bytes.buffer));
        onProgress(0.5 + (0.5 * ++decoded) / entries.length);
      }),
    );
    return new SampleInstrument(preset, buffers, SOUNDFONT_BOOST);
  }

  _touch(id) {
    this.lru = this.lru.filter((x) => x !== id);
    this.lru.push(id);
  }

  _evict() {
    const keep = 4; // decoded samples are large; keep the current sound and a few recent ones
    while (this.lru.length > keep) {
      const victim = this.lru.find((id) => id !== this.currentId && !this.pinned.has(id));
      if (!victim) break;
      this.lru = this.lru.filter((x) => x !== victim);
      this.instruments.delete(victim);
    }
  }

  async setInstrument(id, onProgress) {
    const inst = await this.load(id, onProgress);
    // Switching sounds fades what is still ringing, like the original.
    if (this.currentId && this.currentId !== id) this.bank.killChannel('live', this.ctx.currentTime, RELEASE);
    this.current = inst;
    this.currentId = id;
    this.emit('instrument', id);
    return inst;
  }

  // ——— Playing ———
  velocityGain(v) {
    if (!this.sound.velocity || v >= 1) return 1;
    return Math.max(0.06, v ** 1.35);
  }

  /** Live note from keyboard, mouse or MIDI. `gain` scales layered and split parts. */
  noteOn(midi, opts = {}) {
    return this.noteOnAt(midi, this.ctx.currentTime, opts);
  }

  noteOnAt(midi, time, { velocity = 1, channel = 'live', inst = this.current, gain = 1 } = {}) {
    if (!inst || midi < 21 || midi > 108) return null;
    const t = Math.max(time, this.ctx.currentTime);
    const g = this.velocityGain(velocity) * gain;
    const voice = this.bank.noteOn(inst, midi, t, g, channel);
    this.emit('noteon', { midi, channel, time: t, velocity, gain: g, instId: inst.preset.id });
    return voice;
  }

  noteOff(midi, opts = {}) {
    this.noteOffAt(midi, this.ctx.currentTime, opts);
  }

  noteOffAt(midi, time, { channel = 'live', release = RELEASE } = {}) {
    const t = Math.max(time, this.ctx.currentTime);
    if (this.bank.noteOff(midi, t, release, channel)) this.emit('noteoff', { midi, channel, time: t, release });
  }

  releaseAllExcept(channel, keep, release = RELEASE) {
    for (const midi of this.bank.channelKeys(channel)) if (!keep.has(midi)) this.noteOff(midi, { channel, release });
  }

  killChannel(channel) {
    this.bank.killChannel(channel, this.ctx.currentTime);
  }

  /** Scheduled note for songs, playback and the notepad. Returns the voice. */
  scheduleNote(midi, time, duration, { inst = this.current, velocity = 1, release = RELEASE, channel = 'song', record = false } = {}) {
    if (!inst || midi < 21 || midi > 108) return null;
    const t = Math.max(time, this.ctx.currentTime);
    const voice = inst.start(this.ctx, this.chain.input, midi, t, velocity, this.sound.tuningCents);
    if (duration != null) voice.release(t + duration, release);
    if (record) {
      this.emit('noteon', { midi, channel, time: t, velocity: 1, gain: velocity, instId: inst.preset.id, scheduled: true });
      if (duration != null) this.emit('noteoff', { midi, channel, time: t + duration, release, scheduled: true });
    }
    return voice;
  }
}

/** Does the preset's hold behaviour match a sustained (organ, strings, wind) instrument? */
export const halfPedalRelease = (presetId) =>
  PRESET_BY_ID.get(presetId)?.sustained ? HALF_PEDAL_RELEASE_SUSTAINED : HALF_PEDAL_RELEASE;
