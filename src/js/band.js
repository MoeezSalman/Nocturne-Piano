// Auto-accompaniment: a drummer, bassist and keyboard player who follow the chords you play.
// Patterns are written on a step grid; each character is one step:
//   drums  X accent · x hit · o ghost · . rest
//   bass   1 root · 3 third · 5 fifth · 7 seventh · 6 sixth · 8 octave · a leading tone · . hold
//   chord  X / x full chord · s short stab · . hold
import { Emitter } from './util.js';
import { PPQ } from './metronome.js';
import { voiceChord } from './theory.js';

// Synth drum kit notes (see synth.js): one sound per pitch class around middle C.
const DRUM = { kick: 60, rim: 61, snare: 62, clap: 63, snare2: 64, tomL: 65, hat: 66, tomM: 67, pedal: 68, tomH: 69, open: 70, crash: 71, bell: 59 };
const VEL = { X: 1, x: 0.78, o: 0.42 };

const S16 = PPQ / 4; // sixteenth notes
const T8 = PPQ / 3; // triplet eighths

export const STYLES = [
  {
    id: 'pop', name: 'Pop Ballad', bpm: 84, sig: '4/4', grid: S16, steps: 16,
    inst: { bass: 'electric_bass_finger_fb', chord: 'electric1', pad: 'string_ensemble_1_mk' },
    A: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: '1.......5.......', chord: 'x.....x.x.......', pad: 'x...............' },
    B: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.xox.x.x.xox.x.', bass: '1.....1.5...3.5.', chord: 'x..x..x.x..x..x.', pad: 'x...............' },
  },
  {
    id: 'rock', name: 'Pop Rock', bpm: 118, sig: '4/4', grid: S16, steps: 16,
    inst: { bass: 'electric_bass_pick_mk', chord: 'guitar_clean_mk' },
    A: { kick: 'x.....x.x.......', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.', bass: '1.1.1.1.1.1.5.5.', chord: 'x..x..x...x..x..' },
    B: { kick: 'x.....x.x.x.....', snare: '....X.......X..o', hat: 'xxxxxxxxxxxxxxxx', open: '..............x.', bass: '1.1.1.1.5.5.8.8.', chord: 'x.xx.x.xx.xx.x.x' },
  },
  {
    id: 'disco', name: 'Disco', bpm: 118, sig: '4/4', grid: S16, steps: 16,
    inst: { bass: 'electric_bass_pick_mk', chord: 'electric2', pad: 'string_ensemble_2_mk' },
    A: { kick: 'x...x...x...x...', clap: '....x.......x...', hat: 'x...x...x...x...', open: '..x...x...x...x.', bass: '1.8.1.8.1.8.1.8.', chord: '..s...s...s...s.', pad: 'x...............' },
    B: { kick: 'x...x...x...x...', clap: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', open: '..x...x...x...x.', bass: '1.8.1.8.5.8.5.8.', chord: '..s.s.s...s.s.s.', pad: 'x.......x.......' },
  },
  {
    id: 'funk', name: 'Funk', bpm: 102, sig: '4/4', grid: S16, steps: 16,
    inst: { bass: 'slap_bass_1_fb', chord: 'clavinet_mk' },
    A: { kick: 'x..x..x...x..x..', snare: '....X..o.o..X...', hat: 'xoxoxoxoxoxoxoxo', bass: '1..18..1.5.7.8..', chord: '..s..s.s..s...s.' },
    B: { kick: 'x..x..x...xx.x..', snare: '....X..o.o..X.oo', hat: 'xoxoxoxoxoxoxoxo', open: '......x.......x.', bass: '1.81..71.5.7.8.a', chord: 's.s..s.s.ss..ss.' },
  },
  {
    id: 'bossa', name: 'Bossa Nova', bpm: 128, sig: '4/4', grid: S16, steps: 16,
    inst: { bass: 'acoustic_bass_mk', chord: 'guitar_nylon_fb' },
    A: { kick: 'x.....x.x.....x.', rim: 'x..x..x...x..x..', hat: 'o.o.o.o.o.o.o.o.', bass: '1.....5.5.....1.', chord: 'x..x..x...x..x..' },
    B: { kick: 'x.....x.x.....x.', rim: '..x..x...x..x...', hat: 'o.o.o.o.o.o.o.o.', bass: '1.....5.5...3.5.', chord: '..x..x...x..x...' },
  },
  {
    id: 'jazz', name: 'Jazz Swing', bpm: 140, sig: '4/4', grid: T8, steps: 12,
    inst: { bass: 'acoustic_bass_mk', chord: 'grand_piano' },
    A: { hat: 'x..x.xx..x.x', pedal: '...x.....x..', kick: 'o.....o.....', bass: '1..3..5..a..', chord: 'x....x......' },
    B: { hat: 'x..x.xx..x.x', pedal: '...x.....x..', kick: 'o.....o..o..', snare: '.....o.....o', bass: '1..5..6..a..', chord: '.....x.....x' },
  },
  {
    id: 'waltz', name: 'Waltz', bpm: 156, sig: '3/4', grid: S16, steps: 12,
    inst: { bass: 'acoustic_bass_mk', chord: 'pizzicato_strings', pad: 'string_ensemble_2_mk' },
    A: { kick: 'x...........', hat: '....o...o...', bass: '1...........', chord: '....s...s...', pad: 'x...........' },
    B: { kick: 'x...........', hat: '....o...o...', bass: '5...........', chord: '....s...s...', pad: 'x...........' },
  },
  {
    id: 'reggae', name: 'Reggae', bpm: 76, sig: '4/4', grid: S16, steps: 16,
    inst: { bass: 'electric_bass_finger_fb', chord: 'rock_organ_fb' },
    A: { kick: '........x.......', rim: '........x.......', hat: 'x.x.x.x.x.x.x.x.', bass: '1.....1...5.8...', chord: '....s.......s...' },
    B: { kick: '........x.......', rim: '....x...x.......', hat: 'x.xxx.x.x.xxx.x.', bass: '1..1..1...5.3...', chord: '..s.s...s.s.s...' },
  },
  {
    id: 'lofi', name: 'Lo-fi Hip-Hop', bpm: 80, sig: '4/4', grid: S16, steps: 16, swing: 0.28,
    inst: { bass: 'electric_bass_finger_fb', chord: 'electric1_mk' },
    A: { kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: '1.........1.5...', chord: 'x...............' },
    B: { kick: 'x......x..x..x..', snare: '....x.......x..o', hat: 'x.xxx.x.x.xxx.x.', bass: '1.......5...3...', chord: 'x.......x.......' },
  },
  {
    id: 'house', name: 'EDM / House', bpm: 124, sig: '4/4', grid: S16, steps: 16,
    inst: { bass: 'synth_sub_bass', chord: 'synth_supersaw', pad: 'pad_2_warm_fb' },
    A: { kick: 'x...x...x...x...', clap: '....x.......x...', open: '..x...x...x...x.', hat: 'oooooooooooooooo', bass: '..1...1...1...1.', chord: '..s...s...s...s.', pad: 'x...............' },
    B: { kick: 'x...x...x...x...', clap: '....x.......x...', open: '..x...x...x...x.', hat: 'xoxoxoxoxoxoxoxo', bass: '..1.1.1...8.1.5.', chord: 's..s..s...s..s..', pad: 'x...............' },
  },
  {
    id: 'country', name: 'Country', bpm: 104, sig: '4/4', grid: S16, steps: 16,
    inst: { bass: 'acoustic_bass_mk', chord: 'guitar_steel_fb' },
    A: { kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.', bass: '1.......5.......', chord: '....x.......x...' },
    B: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: '1.......5...3.5.', chord: '..x.x...x.x.x...' },
  },
  {
    id: 'bhangra', name: 'Bhangra', bpm: 150, sig: '4/4', grid: S16, steps: 16,
    inst: { bass: 'electric_bass_finger_fb', chord: 'studio_harmonium' },
    A: { tomL: 'x.....x...x.....', tomH: '..x.x...x...x.x.', clap: '....x.......x...', bass: '1.....1...5.....', chord: 'x.......x.......' },
    B: { tomL: 'x..x..x...x..x..', tomH: '..x.x.xx..x.x.xx', clap: '....x.......x...', bell: 'x...x...x...x...', bass: '1..1..1...5..8..', chord: 'x...x...x...x...' },
  },
];
export const STYLE_BY_ID = new Map(STYLES.map((s) => [s.id, s]));

/** A drum fill: the groove for half a bar, then a roll down the toms. Bass and chords carry on. */
function fillFor(style) {
  const n = style.steps;
  const half = Math.floor(n / 2);
  const out = {};
  for (const [part, pattern] of Object.entries(style.A)) {
    out[part] = ['bass', 'chord', 'pad'].includes(part) ? pattern : pattern.slice(0, half).padEnd(n, '.');
  }
  const roll = ['snare', 'tomH', 'tomM', 'tomL'];
  for (const part of roll) out[part] = (out[part] || '').slice(0, half).padEnd(n, '.').split('');
  for (let i = 0; i < n - half; i++) out[roll[Math.floor((i * roll.length) / (n - half))]][half + i] = i === 0 ? 'X' : 'x';
  for (const part of roll) out[part] = out[part].join('');
  return out;
}

export class Band extends Emitter {
  constructor(engine, transport, metronome) {
    super();
    this.engine = engine;
    this.transport = transport;
    this.metronome = metronome;
    this.enabled = false; // accompaniment mode on (left hand drives the band)
    this.playing = false;
    this.armed = false; // waiting for the first chord (sync start)
    this.styleId = 'pop';
    this.variation = 'A';
    this.volume = 0.8;
    this.syncStart = true;
    this.chord = null;
    this.pendingFill = false;
    this.ending = false;
    this.crashNext = true;
    this.waitingForBar = true;
    this.step = -1;
    transport.on('tick', (t) => this._onTick(t));
  }

  get style() {
    return STYLE_BY_ID.get(this.styleId) || STYLES[0];
  }

  instrumentIds() {
    return [...new Set(['synth_drums', ...Object.values(this.style.inst)])];
  }

  async prepare() {
    const ids = this.instrumentIds();
    ids.forEach((id) => this.engine.pinned.add(id));
    await Promise.all(ids.map((id) => this.engine.load(id)));
  }

  async setStyle(id, { applyTempo = true } = {}) {
    this.styleId = id;
    const st = this.style;
    if (applyTempo) this.metronome.setBpm(st.bpm);
    this.metronome.setTimeSig(st.sig);
    this.emit('change');
    await this.prepare();
  }

  setChord(chord) {
    if (!chord?.intervals) return;
    const changed = !this.chord || this.chord.name !== chord.name;
    this.chord = chord;
    if (changed) this.emit('chord', chord);
    if (this.armed && this.enabled) this.start();
  }

  async start() {
    if (this.playing) return;
    await this.prepare();
    this.armed = false;
    this.playing = true;
    this.ending = false;
    this.crashNext = true;
    this.waitingForBar = this.transport.running;
    this.transport.hold('band');
    this.emit('state');
  }

  /** Start now, or arm to start with the first chord. */
  async play() {
    if (this.playing) return;
    if (this.syncStart && !this.chord) {
      this.armed = true;
      await this.prepare();
      this.emit('state');
      return;
    }
    if (!this.chord) this.chord = { name: 'C', root: 0, intervals: [0, 4, 7] };
    this.start();
  }

  /** Stop at the end of the bar with a final hit, or immediately. */
  stop(immediate = false) {
    this.armed = false;
    if (!this.playing) {
      this.emit('state');
      return;
    }
    if (immediate) this._halt();
    else this.ending = true;
    this.emit('state');
  }

  _halt() {
    this.playing = false;
    this.ending = false;
    this.step = -1;
    this.transport.release('band');
    this.engine.bank.killChannel('band', this.engine.now, 0.3);
    this.emit('state');
  }

  fill() {
    if (this.playing) this.pendingFill = true;
  }

  _onTick({ time, sub, beatInBar, spt }) {
    if (!this.playing) return;
    if (this.waitingForBar) {
      if (sub !== 0 || beatInBar !== 0) return;
      this.waitingForBar = false;
    }
    const st = this.style;
    const pos = beatInBar * PPQ + sub;
    if (pos % st.grid !== 0) return;
    const step = pos / st.grid;
    if (step >= st.steps) return;
    const stepSec = st.grid * spt;
    if (step === 0) {
      if (this.ending) return this._finale(time, stepSec);
      this.barPattern = this.pendingFill ? fillFor(st) : st[this.variation] || st.A;
      this.isFill = this.pendingFill;
      this.pendingFill = false;
    }
    if (!this.barPattern || !this.chord) return;
    this.step = step;
    const swing = st.swing && step % 2 === 1 ? st.swing * stepSec : 0;
    const at = time + swing;
    this._playStep(this.barPattern, step, at, stepSec, st);
    if (step === 0) this.emit('bar', { fill: this.isFill });
    if (step === st.steps - 1 && this.isFill) this.crashNext = true;
  }

  _hit(midi, at, dur, vel, instId) {
    const inst = this.engine.instruments.get(instId);
    if (!inst) return;
    const human = (Math.random() - 0.5) * 0.008;
    const v = Math.max(0.05, vel * this.volume * (0.94 + Math.random() * 0.12));
    this.engine.scheduleNote(midi, at + Math.max(0, human), dur, { inst, velocity: v, release: 0.18, channel: 'band', record: true });
  }

  _holdSteps(pattern, step, steps) {
    let n = 1;
    while (step + n < steps && pattern[step + n] === '.') n++;
    return n;
  }

  _playStep(p, step, at, stepSec, st) {
    // Drums
    for (const [part, midi] of Object.entries(DRUM)) {
      const ch = p[part]?.[step];
      if (ch && ch !== '.') this._hit(midi, at, 0.4, VEL[ch] ?? 0.7, 'synth_drums');
    }
    if (step === 0 && this.crashNext) {
      this._hit(DRUM.crash, at, 1.5, 0.55, 'synth_drums');
      this.crashNext = false;
    }
    const chord = this.chord;
    // Bass
    const b = p.bass?.[step];
    if (b && b !== '.') {
      const midi = this._bassNote(b, chord);
      const dur = this._holdSteps(p.bass, step, st.steps) * stepSec * 0.92;
      this._hit(midi, at, dur, 0.9, st.inst.bass);
    }
    // Chords
    const c = p.chord?.[step];
    if (c && c !== '.') {
      const notes = voiceChord(chord.root, chord.intervals.filter((i) => i < 12), 61);
      const dur = c === 's' ? stepSec * 0.9 : this._holdSteps(p.chord, step, st.steps) * stepSec * 0.95;
      notes.forEach((m, i) => this._hit(m, at + i * 0.004, dur, (VEL[c] ?? 0.7) * 0.62, st.inst.chord));
    }
    const pad = p.pad?.[step];
    if (pad && pad !== '.' && st.inst.pad) {
      const notes = voiceChord(chord.root, chord.intervals.filter((i) => i < 12), 67);
      const dur = this._holdSteps(p.pad, step, st.steps) * stepSec;
      notes.forEach((m) => this._hit(m, at, dur, 0.32, st.inst.pad));
    }
  }

  _bassNote(ch, chord) {
    const root = 28 + ((chord.root - 4 + 12) % 12); // E1 … D♯2
    const iv = chord.intervals;
    const pick = (cands, fallback) => cands.find((x) => iv.includes(x)) ?? fallback;
    switch (ch) {
      case '3':
        return root + pick([4, 3], 4);
      case '5':
        return root + pick([7, 6, 8], 7);
      case '7':
        return root + pick([10, 11, 9], 10);
      case '6':
        return root + 9;
      case '8':
        return root + 12;
      case 'a':
        return root + 11; // leading tone back into the root
      default:
        return root;
    }
  }

  _finale(time, stepSec) {
    const st = this.style;
    this._hit(DRUM.kick, time, 0.5, 1, 'synth_drums');
    this._hit(DRUM.crash, time, 2, 0.8, 'synth_drums');
    if (this.chord) {
      this._hit(this._bassNote('1', this.chord), time, stepSec * st.steps, 0.9, st.inst.bass);
      voiceChord(this.chord.root, this.chord.intervals.filter((i) => i < 12), 61).forEach((m) =>
        this._hit(m, time, stepSec * st.steps, 0.6, st.inst.chord),
      );
    }
    this.playing = false;
    this.ending = false;
    this.transport.release('band');
    this.emit('state');
  }
}
