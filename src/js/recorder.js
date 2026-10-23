// Four-track recorder. Tracks store the exact engine events (note on/off, release times, instrument)
// so playback and exports sound identical to what was played, including sustain behaviour.
import { Emitter, loadJSON, saveJSON } from './util.js';
import { Sequencer } from './sequencer.js';
import { buildChain, VoiceBank } from './audio-engine.js';
import { PRESET_BY_ID } from './instruments.js';

export const MAX_TRACKS = 4;
export const TRACK_COLORS = ['#e4b964', '#58c9dc', '#f07393', '#a98bff'];
const STORE_KEY = 'nocturne.tracks.v1';
const TAIL = 7; // longest sample ring-out in seconds

let nextId = Date.now();
const newTrack = (i) => ({ id: nextId++, name: `Track ${i + 1}`, include: true, vol: 1, events: [], length: 0, instIds: [] });
const CAPTURED = new Set(['live', 'band']);
export const QUANTIZE = [
  ['1/4', 1],
  ['1/8', 0.5],
  ['1/8T', 1 / 3],
  ['1/16', 0.25],
  ['1/16T', 1 / 6],
];

export class Recorder extends Emitter {
  constructor(engine, metronome, piano) {
    super();
    this.engine = engine;
    this.metronome = metronome;
    this.piano = piano;
    const saved = loadJSON(STORE_KEY, null);
    this.tracks = Array.isArray(saved) && saved.length ? saved.slice(0, MAX_TRACKS) : [newTrack(0)];
    this.state = 'idle'; // idle | armed | countin | recording | playing
    this.recIndex = -1;
    this.t0 = 0;
    this.pending = [];
    this.countInEnabled = true;
    this.visualTimers = new Set();
    this.player = new Sequencer(engine.ctx, (ev, at) => this._playEvent(ev, at));
    this.player.on('time', (t) => this.emit('time', t));
    this.player.on('state', (s) => {
      if (s === 'ended' && this.state === 'playing') this._finishPlayback();
    });
    engine.on('noteon', (e) => this._capture(e, 'on'));
    engine.on('noteoff', (e) => this._capture(e, 'off'));
  }

  save() {
    saveJSON(STORE_KEY, this.tracks);
    this.emit('change');
  }

  get hasContent() {
    return this.tracks.some((t) => t.events.length);
  }

  addTrack() {
    if (this.tracks.length >= MAX_TRACKS) return;
    this.tracks.push(newTrack(this.tracks.length));
    this.save();
  }

  deleteTrack(i) {
    if (this.state !== 'idle') this.stop();
    this.tracks.splice(i, 1);
    if (!this.tracks.length) this.tracks.push(newTrack(0));
    this.tracks.forEach((t, j) => {
      if (/^Track \d+$/.test(t.name)) t.name = `Track ${j + 1}`;
    });
    this.save();
  }

  clearTrack(i) {
    Object.assign(this.tracks[i], { events: [], length: 0, instIds: [] });
    this.save();
  }

  clearAll() {
    this.stop();
    this.tracks = [newTrack(0)];
    this.save();
  }

  toggleInclude(i) {
    this.tracks[i].include = !this.tracks[i].include;
    this.save();
  }

  setVolume(i, v) {
    this.tracks[i].vol = v;
    saveJSON(STORE_KEY, this.tracks);
  }

  /** Snaps note starts to a grid (in beats at the metronome tempo), keeping each note's length. */
  quantize(i, beats) {
    const tr = this.tracks[i];
    if (!tr?.events.length) return;
    tr.undo = tr.events.map((e) => ({ ...e }));
    const grid = (60 / this.metronome.bpm) * beats;
    const shift = new Map();
    tr.events = tr.events
      .map((e) => {
        if (e.type === 'on') {
          const t = Math.max(0, Math.round(e.t / grid) * grid);
          shift.set(`${e.src || ''}${e.midi}`, t - e.t);
          return { ...e, t };
        }
        const d = shift.get(`${e.src || ''}${e.midi}`) ?? 0;
        return { ...e, t: Math.max(0, e.t + d) };
      })
      .sort((a, b) => a.t - b.t);
    this.save();
  }

  undoQuantize(i) {
    const tr = this.tracks[i];
    if (!tr?.undo) return;
    tr.events = tr.undo;
    delete tr.undo;
    this.save();
  }

  _setState(s) {
    this.state = s;
    this.emit('state', s);
  }

  // ——— Recording ———
  async record(i) {
    if (this.state !== 'idle') this.stop();
    this.recIndex = i;
    this.pending = [];
    const backing = this._mergedEvents((t, j) => j !== i && t.include);
    if (backing.length) {
      await this._ensureInstruments(backing);
      this._setState('countin');
      const beats = this.countInEnabled ? this.metronome.beatsPerBar : 0;
      const downbeat = beats ? this.metronome.countIn(beats) : this.engine.now + 0.1;
      this.t0 = downbeat;
      this.player.load(backing, this._lengthOf(backing));
      this.player.playAt(downbeat);
      const wait = Math.max(0, (downbeat - this.engine.now) * 1000 - 30);
      setTimeout(() => this.state === 'countin' && this._setState('recording'), wait);
    } else {
      this._setState('armed'); // starts on the first note
    }
  }

  _capture(e, type) {
    if (!CAPTURED.has(e.channel)) return;
    if (this.state === 'armed' && type === 'on') {
      this.t0 = e.time;
      this._setState('recording');
    }
    if (this.state !== 'recording' && this.state !== 'countin') return;
    const t = e.time - this.t0;
    if (t < -0.25) return;
    const ev = type === 'on'
      ? { t: Math.max(0, t), type, midi: e.midi, vel: e.velocity, g: e.gain, inst: e.instId }
      : { t: Math.max(0, t), type, midi: e.midi, rel: e.release };
    if (e.channel === 'band') ev.src = 'band';
    this.pending.push(ev);
    this.emit('captured', ev);
  }

  recordingTime() {
    return this.state === 'recording' ? Math.max(0, this.engine.now - this.t0) : 0;
  }

  _commitRecording() {
    const tr = this.tracks[this.recIndex];
    if (!tr) return;
    const stopT = Math.max(0, this.engine.now - this.t0);
    if (this.pending.length) {
      // Notes still sounding at the stop point keep ringing on playback, as they did live.
      const events = this.pending;
      tr.events = events.sort((a, b) => a.t - b.t);
      tr.length = Math.max(stopT, tr.events.at(-1).t);
      tr.instIds = [...new Set(events.filter((e) => e.type === 'on').map((e) => e.inst))];
    }
    this.pending = [];
    this.recIndex = -1;
    this.save();
  }

  // ——— Playback ———
  _mergedEvents(filter = (t) => t.include) {
    const out = [];
    this.tracks.forEach((tr, j) => {
      if (!filter(tr, j)) return;
      for (const ev of tr.events) out.push({ ...ev, ch: `track${j}${ev.src === 'band' ? 'b' : ''}`, trackIndex: j, vol: tr.vol ?? 1 });
    });
    return out.sort((a, b) => a.t - b.t);
  }

  _lengthOf(events) {
    return events.reduce((m, e) => Math.max(m, e.t), 0) + 0.5;
  }

  async _ensureInstruments(events) {
    const ids = [...new Set(events.filter((e) => e.type === 'on').map((e) => e.inst))].filter((id) => PRESET_BY_ID.has(id));
    ids.forEach((id) => this.engine.pinned.add(id));
    await Promise.all(ids.map((id) => this.engine.load(id)));
  }

  _playEvent(ev, at) {
    const ctx = this.engine.ctx;
    if (ev.type === 'on') {
      const inst = this.engine.instruments.get(ev.inst) || this.engine.current;
      if (!inst) return null;
      this.engine.bank.noteOn(inst, ev.midi, at, this._gain(ev), ev.ch);
      if (ev.src !== 'band') this._visual(ev.midi, at, true, ev.trackIndex);
    } else {
      this.engine.bank.noteOff(ev.midi, at, ev.rel ?? 0.35, ev.ch);
      if (ev.src !== 'band') this._visual(ev.midi, at, false, ev.trackIndex);
    }
    return { until: at + TAIL, cancel: () => {} };
  }

  _gain(ev) {
    return (ev.g ?? this.engine.velocityGain(ev.vel ?? 1)) * (ev.vol ?? 1);
  }

  _visual(midi, at, on, trackIndex) {
    const delay = Math.max(0, (at - this.engine.now) * 1000);
    const id = setTimeout(() => {
      this.visualTimers.delete(id);
      if (on) {
        this.piano.press(midi, 'track');
        this.emit('visual', { midi, on: true, trackIndex });
      } else if (this.piano.isDown(midi)) {
        this.piano.release(midi, 'track');
        this.emit('visual', { midi, on: false, trackIndex });
      }
    }, delay);
    this.visualTimers.add(id);
  }

  async play() {
    if (this.state !== 'idle') this.stop();
    const events = this._mergedEvents();
    if (!events.length) return;
    await this._ensureInstruments(events);
    this.player.load(events, this._lengthOf(events) + 1.5);
    this._setState('playing');
    this.player.play();
  }

  _silencePlayback() {
    this.player.stop();
    for (const id of this.visualTimers) clearTimeout(id);
    this.visualTimers.clear();
    for (let j = 0; j < MAX_TRACKS; j++) {
      this.engine.bank.killChannel(`track${j}`, this.engine.now, 0.2);
      this.engine.bank.killChannel(`track${j}b`, this.engine.now, 0.2);
    }
    this.piano.releaseSource('track');
    this.emit('visual-clear');
  }

  _finishPlayback() {
    for (const id of this.visualTimers) clearTimeout(id);
    this.visualTimers.clear();
    this.piano.releaseSource('track');
    this._setState('idle');
  }

  stop() {
    const was = this.state;
    if (was === 'recording' || was === 'countin' || was === 'armed') this._commitRecording();
    this._silencePlayback();
    this.recIndex = -1;
    this._setState('idle');
  }

  // ——— Export ———
  async renderMix(onProgress = () => {}) {
    const events = this._mergedEvents();
    if (!events.length) throw new Error('Nothing recorded yet');
    await this._ensureInstruments(events);
    onProgress(0.05);
    const sr = this.engine.ctx.sampleRate;
    const lead = 0.05;
    const length = Math.ceil((this._lengthOf(events) + TAIL + lead) * sr);
    const off = new OfflineAudioContext(2, length, sr);
    const chain = buildChain(off, { ...this.engine.sound, volume: 1 }, this.engine.impulse, off.destination);
    const bank = new VoiceBank(off, chain.input, () => this.engine.sound.tuningCents);
    for (const ev of events) {
      if (ev.type === 'on') {
        const inst = this.engine.instruments.get(ev.inst);
        if (inst) bank.noteOn(inst, ev.midi, ev.t + lead, this._gain(ev), ev.ch);
      } else {
        bank.noteOff(ev.midi, ev.t + lead, ev.rel ?? 0.35, ev.ch);
      }
    }
    onProgress(0.15);
    const rendered = await off.startRendering();
    onProgress(0.45);
    return finishMix(rendered);
  }

  exportMidi(bpm = 120) {
    if (!window.Midi) throw new Error('MIDI library missing');
    const midi = new window.Midi();
    midi.header.setTempo(bpm);
    this.tracks.forEach((tr) => {
      if (!tr.include || !tr.events.length) return;
      const track = midi.addTrack();
      track.name = tr.name;
      const first = tr.instIds[0] && PRESET_BY_ID.get(tr.instIds[0]);
      track.instrument.number = gmProgramFor(first);
      const open = new Map();
      for (const ev of tr.events) {
        if (ev.type === 'on') {
          if (!open.has(ev.midi)) open.set(ev.midi, []);
          open.get(ev.midi).push(ev);
        } else {
          for (const on of open.get(ev.midi) || []) {
            track.addNote({ midi: ev.midi, time: on.t, duration: Math.max(0.05, ev.t - on.t), velocity: Math.min(1, on.vel ?? 0.8) });
          }
          open.delete(ev.midi);
        }
      }
      for (const [m, list] of open) {
        for (const on of list) track.addNote({ midi: m, time: on.t, duration: Math.max(0.2, Math.min(4, tr.length - on.t)), velocity: on.vel ?? 0.8 });
      }
    });
    return midi.toArray();
  }
}

/** Trims trailing silence and keeps the peak under 0 dBFS. */
function finishMix(buf) {
  const chans = [...Array(buf.numberOfChannels)].map((_, c) => buf.getChannelData(c));
  let last = 0;
  let peak = 0;
  for (const d of chans) {
    for (let i = 0; i < d.length; i++) {
      const v = Math.abs(d[i]);
      if (v > peak) peak = v;
      if (v > 0.0008 && i > last) last = i;
    }
  }
  const end = Math.min(buf.length, last + Math.round(buf.sampleRate * 0.6));
  const gain = peak > 0.98 ? 0.98 / peak : 1;
  return {
    sampleRate: buf.sampleRate,
    channels: chans.map((d) => {
      const out = d.slice(0, end);
      if (gain !== 1) for (let i = 0; i < out.length; i++) out[i] *= gain;
      return out;
    }),
  };
}

export function encodeWav({ sampleRate, channels }) {
  const n = channels[0].length;
  const nc = channels.length;
  const buf = new ArrayBuffer(44 + n * nc * 2);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * nc * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, nc, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * nc * 2, true);
  v.setUint16(32, nc * 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * nc * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nc; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Uint8Array(buf);
}

export function encodeMp3(mix, kbps = 192, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('js/mp3-worker.js');
    worker.onmessage = (e) => {
      if (e.data.progress != null) onProgress(e.data.progress);
      if (e.data.done) {
        worker.terminate();
        resolve(e.data.bytes);
      }
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
    const [left, right = left] = mix.channels;
    worker.postMessage({ left, right, sampleRate: mix.sampleRate, kbps });
  });
}

const GM_NAMES = ['acoustic_grand_piano', 'bright_acoustic_piano', 'electric_grand_piano', 'honkytonk_piano', 'electric_piano_1', 'electric_piano_2', 'harpsichord', 'clavinet', 'celesta', 'glockenspiel', 'music_box', 'vibraphone', 'marimba', 'xylophone', 'tubular_bells', 'dulcimer', 'drawbar_organ', 'percussive_organ', 'rock_organ', 'church_organ', 'reed_organ', 'accordion', 'harmonica', 'tango_accordion', 'acoustic_guitar_nylon', 'acoustic_guitar_steel', 'electric_guitar_jazz', 'electric_guitar_clean', 'electric_guitar_muted', 'overdriven_guitar', 'distortion_guitar', 'guitar_harmonics', 'acoustic_bass', 'electric_bass_finger', 'electric_bass_pick', 'fretless_bass', 'slap_bass_1', 'slap_bass_2', 'synth_bass_1', 'synth_bass_2', 'violin', 'viola', 'cello', 'contrabass', 'tremolo_strings', 'pizzicato_strings', 'orchestral_harp', 'timpani', 'string_ensemble_1', 'string_ensemble_2', 'synth_strings_1', 'synth_strings_2', 'choir_aahs', 'voice_oohs', 'synth_choir', 'orchestra_hit', 'trumpet', 'trombone', 'tuba', 'muted_trumpet', 'french_horn', 'brass_section', 'synth_brass_1', 'synth_brass_2', 'soprano_sax', 'alto_sax', 'tenor_sax', 'baritone_sax', 'oboe', 'english_horn', 'bassoon', 'clarinet', 'piccolo', 'flute', 'recorder', 'pan_flute', 'blown_bottle', 'shakuhachi', 'whistle', 'ocarina', 'lead_1_square', 'lead_2_sawtooth', 'lead_3_calliope', 'lead_4_chiff', 'lead_5_charang', 'lead_6_voice', 'lead_7_fifths', 'lead_8_bass__lead', 'pad_1_new_age', 'pad_2_warm', 'pad_3_polysynth', 'pad_4_choir', 'pad_5_bowed', 'pad_6_metallic', 'pad_7_halo', 'pad_8_sweep', 'fx_1_rain', 'fx_2_soundtrack', 'fx_3_crystal', 'fx_4_atmosphere', 'fx_5_brightness', 'fx_6_goblins', 'fx_7_echoes', 'fx_8_scifi', 'sitar', 'banjo', 'shamisen', 'koto', 'kalimba', 'bagpipe', 'fiddle', 'shanai', 'tinkle_bell', 'agogo', 'steel_drums', 'woodblock', 'taiko_drum', 'melodic_tom', 'synth_drum', 'reverse_cymbal', 'guitar_fret_noise', 'breath_noise', 'seashore', 'bird_tweet', 'telephone_ring', 'helicopter', 'applause', 'gunshot'];
const STUDIO_GM = { harmonium: 20, violin: 40, cello: 42, contrabass: 43, harp: 46, 'guitar-nylon': 24, 'guitar-acoustic': 25, 'guitar-electric': 27, 'bass-electric': 33, flute: 73, clarinet: 71, saxophone: 65, bassoon: 70, trumpet: 56, 'french-horn': 60, trombone: 57, tuba: 58, organ: 19, xylophone: 13, piano: 0 };

export function gmProgramFor(preset) {
  if (!preset) return 0;
  if (preset.src.type === 'gm') return Math.max(0, GM_NAMES.indexOf(preset.src.name));
  if (preset.src.type === 'studio') return STUDIO_GM[preset.src.name] ?? 0;
  if (preset.src.type === 'synth') return { chip: 80, supersaw: 81, fm_bell: 98, fm_epiano: 5, sub_bass: 38, theremin: 79, glass_pad: 88, pluck: 25 }[preset.src.kind] ?? 0;
  return 0;
}

export { GM_NAMES };
