// Routes every way of playing (PC keyboard, mouse/touch, MIDI keyboard) into the engine.
// Each key press flows through:  transpose → scale lock → one-finger / smart chords → arpeggiator
// → split and layer sounds → engine. Sustain, octave shift and transpose work like the original.
import { Emitter, isTypingTarget } from './util.js';
import { buildBindings, labelsFor, RESERVED_CODES } from './keybinds.js';
import { halfPedalRelease } from './audio-engine.js';
import { chordNotes, detectChord, diatonicChords, snapToScale } from './theory.js';

const ARP_RELEASE = 0.12;

export class Performance extends Emitter {
  constructor(engine, piano, store) {
    super();
    this.engine = engine;
    this.piano = piano;
    this.store = store;
    this.held = new Map(); // key midi → { sounding, zone, notes, parts, sources:Set }
    this.pressedCodes = new Map(); // KeyboardEvent.code → key midi
    this.bindEdit = null; // { pending: midi|null } while editing custom bindings
    this.arp = null;
    this.band = null;
    this.captureNext = null;
    this.rebuildBindings();
    for (const k of ['keybinds', 'customBindings', 'octaveShift']) store.on(k, () => this.rebuildBindings());

    piano.on('down', ({ midi, velocity }) => {
      if (this.bindEdit) return this._pickBindTarget(midi);
      this.down(midi, { via: 'mouse', velocity, mouse: true });
    });
    piano.on('up', ({ midi }) => this.up(midi, 'mouse'));
    window.addEventListener('keydown', (e) => this._keydown(e));
    window.addEventListener('keyup', (e) => this._keyup(e));
    window.addEventListener('blur', () => this.releaseAllHeld());
  }

  attachArp(arp) {
    this.arp = arp;
    arp.play = (midi, time, dur, vel) => this._playArpNote(midi, time, dur, vel);
  }

  attachBand(band) {
    this.band = band;
  }

  rebuildBindings() {
    this.bindings = buildBindings(this.store.get('keybinds'), this.store.get('customBindings'));
    const labels = this.store.get('keybinds') === 'off' ? new Map() : labelsFor(this.bindings, this.store.get('octaveShift'));
    this.labels = labels;
    this.piano.setCapLabels(labels);
    this.emit('bindings', labels);
  }

  /** Sounding pitch for a key on the on-screen piano. */
  sounding(keyMidi) {
    let m = keyMidi + this.store.get('transpose');
    if (this.store.get('scaleLock')) m = snapToScale(m, this.store.get('theoryRoot'), this.store.get('theoryScale'));
    return m;
  }

  get bandZoneActive() {
    return !!this.band?.enabled && this.store.get('bandZone') === 'left';
  }

  zoneOf(keyMidi) {
    const split = this.store.get('splitOn') || this.bandZoneActive;
    return split && keyMidi < this.store.get('splitPoint') ? 'left' : 'right';
  }

  /** One-finger chords: a single key plays a whole chord. */
  expand(midi) {
    const mode = this.store.get('chordMode');
    if (!mode || mode === 'off') return [midi];
    let type = mode;
    if (mode === 'smart') {
      const chords = diatonicChords(this.store.get('theoryRoot'), this.store.get('theoryScale'));
      type = chords.find((c) => c.pc === ((midi % 12) + 12) % 12)?.type || 'maj';
    }
    return chordNotes(midi, type);
  }

  /** The sounds a note triggers: main or split voice, plus the layer. */
  parts(midi, zone) {
    const s = this.store;
    const out = [];
    if (zone === 'left' && s.get('splitOn')) {
      out.push({ inst: this.engine.instruments.get(s.get('splitInst')), midi: midi + s.get('splitOctave') * 12, gain: s.get('splitVolume') });
    } else {
      out.push({ inst: this.engine.current, midi, gain: 1 });
    }
    if (s.get('layerOn') && zone !== 'left') {
      out.push({ inst: this.engine.instruments.get(s.get('layerInst')), midi: midi + s.get('layerOctave') * 12, gain: s.get('layerVolume') });
    }
    return out.filter((p) => p.inst && p.midi >= 21 && p.midi <= 108);
  }

  down(keyMidi, { via = 'mouse', velocity = 1 } = {}) {
    if (this.captureNext) {
      // A panel asked for the next key (e.g. "set split point by key").
      const cb = this.captureNext;
      this.captureNext = null;
      cb(keyMidi);
      return;
    }
    const existing = this.held.get(keyMidi);
    if (existing) {
      existing.sources.add(via);
      return;
    }
    const sounding = this.sounding(keyMidi);
    if (sounding < 21 || sounding > 108) return;
    const zone = this.zoneOf(keyMidi);
    const notes = this.expand(sounding);
    const h = { sounding, zone, notes, parts: [], arp: false, sources: new Set([via]) };
    this.held.set(keyMidi, h);
    this.piano.press(keyMidi, 'live');

    const silentZone = zone === 'left' && this.bandZoneActive && !this.store.get('bandLeftSound');
    const arpZone = this.store.get('arpZone') === 'all' || zone === 'right';
    if (silentZone) {
      // The left hand only tells the band which chord to play.
    } else if (this.arp?.enabled && arpZone) {
      h.arp = true;
      for (const n of notes) this.arp.noteDown(n);
    } else {
      for (const n of notes) {
        for (const p of this.parts(n, zone)) {
          this.engine.noteOn(p.midi, { inst: p.inst, velocity, gain: p.gain });
          h.parts.push(p.midi);
        }
      }
    }
    this.emit('down', { keyMidi, sounding, velocity, via });
    this._updateChord();
  }

  up(keyMidi, via = 'mouse') {
    const h = this.held.get(keyMidi);
    if (!h) return;
    h.sources.delete(via);
    if (h.sources.size) return;
    this.held.delete(keyMidi);
    this.piano.release(keyMidi, 'live');
    this._releaseHeld(h);
    this.emit('up', { keyMidi, sounding: h.sounding, via });
    this._updateChord();
  }

  _releaseHeld(h) {
    if (h.arp) for (const n of h.notes) this.arp?.noteUp(n);
    for (const m of h.parts) this._releaseSound(m);
  }

  _releaseSound(midi) {
    if (!this.store.get('sustain')) this.engine.noteOff(midi);
    else if (this.store.get('sustainMode') === 'half') this.engine.noteOff(midi, { release: halfPedalRelease(this.engine.currentId) });
    // Full pedal: the note rings until it fades naturally or the pedal is lifted.
  }

  _playArpNote(midi, time, dur, vel) {
    const keyMidi = midi - this.store.get('transpose');
    const zone = this.zoneOf(keyMidi);
    for (const p of this.parts(midi, zone)) {
      this.engine.noteOnAt(p.midi, time, { inst: p.inst, velocity: vel, gain: p.gain });
      this.engine.noteOffAt(p.midi, time + dur, { release: ARP_RELEASE });
    }
    this.emit('arpnote', { keyMidi, time, dur, velocity: vel });
  }

  _updateChord() {
    const all = [...this.held.values()];
    const display = detectChord(all.flatMap((h) => h.notes));
    const zoneNotes = (this.bandZoneActive ? all.filter((h) => h.zone === 'left') : all).flatMap((h) => h.notes);
    const forBand = detectChord(zoneNotes, { singleAsMajor: true });
    this.emit('chord', { display, band: forBand });
  }

  releaseAllHeld() {
    this.pressedCodes.clear();
    for (const [keyMidi, h] of [...this.held]) {
      this.held.delete(keyMidi);
      this.piano.release(keyMidi, 'live');
      this._releaseHeld(h);
      this.emit('up', { keyMidi, sounding: h.sounding, via: 'all' });
    }
    this._updateChord();
  }

  // ——— Sustain ———
  setSustain(on) {
    this.store.set('sustain', on);
    if (!on) this.engine.releaseAllExcept('live', new Set([...this.held.values()].flatMap((h) => h.parts)));
  }

  toggleSustain() {
    this.setSustain(!this.store.get('sustain'));
  }

  /** Toolbar button: full pedal → half pedal → off → full pedal. */
  cycleSustain() {
    const on = this.store.get('sustain');
    const mode = this.store.get('sustainMode');
    if (on && mode === 'full') this.store.set('sustainMode', 'half');
    else if (on && mode === 'half') this.setSustain(false);
    else {
      this.store.set('sustainMode', 'full');
      this.setSustain(true);
    }
  }

  // ——— Octave / transpose ———
  shiftOctave(d) {
    const v = Math.max(-3, Math.min(3, this.store.get('octaveShift') + d));
    this.releaseAllHeld();
    this.store.set('octaveShift', v);
  }

  shiftTranspose(d) {
    const v = Math.max(-12, Math.min(12, this.store.get('transpose') + d));
    this.releaseAllHeld();
    this.store.set('transpose', v);
  }

  // ——— PC keyboard ———
  _keydown(e) {
    if (isTypingTarget(e.target)) return;
    if (this.bindEdit) return this._bindKey(e);
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.code;
    if (code === 'Space') {
      e.preventDefault();
      if (!e.repeat) this.toggleSustain();
      return;
    }
    if (code === 'Escape') {
      this.emit('escape');
      return;
    }
    let mapped = e.shiftKey ? this.bindings.shiftCodeToMidi.get(code) : undefined;
    if (mapped == null) mapped = this.bindings.codeToMidi.get(code);
    if (mapped != null) {
      e.preventDefault();
      if (e.repeat || this.pressedCodes.has(code)) return;
      const km = mapped + this.store.get('octaveShift') * 12;
      this.pressedCodes.set(code, km);
      this.down(km, { via: `kbd:${code}` });
      return;
    }
    if (e.repeat) return;
    if (code === 'BracketLeft') this.shiftOctave(-1);
    else if (code === 'BracketRight') this.shiftOctave(1);
    else if (code === 'Minus') this.shiftTranspose(-1);
    else if (code === 'Equal') this.shiftTranspose(1);
    else if (code === 'ArrowLeft') this.emit('instrument-step', -1);
    else if (code === 'ArrowRight') this.emit('instrument-step', 1);
    else return;
    e.preventDefault();
  }

  _keyup(e) {
    const km = this.pressedCodes.get(e.code);
    if (km == null) return;
    this.pressedCodes.delete(e.code);
    this.up(km, `kbd:${e.code}`);
  }

  // ——— MIDI keyboard ———
  attachMidi(midi) {
    midi.on('noteon', ({ midi: m, velocity }) => this.down(m + this.store.get('octaveShift') * 12, { via: 'midi', velocity }));
    midi.on('noteoff', ({ midi: m }) => this.up(m + this.store.get('octaveShift') * 12, 'midi'));
    midi.on('sustain', (on) => {
      if (on !== this.store.get('sustain')) this.setSustain(on);
    });
    midi.on('allnotesoff', () => this.releaseAllHeld());
  }

  // ——— Custom key binding editor ———
  startBindEdit() {
    this.releaseAllHeld();
    this.bindEdit = { pending: null };
    this.emit('bind-edit', this.bindEdit);
  }

  stopBindEdit() {
    if (this.bindEdit?.pending != null) this.piano.setGuide(this.bindEdit.pending, null);
    this.bindEdit = null;
    this.emit('bind-edit', null);
  }

  _pickBindTarget(midi) {
    if (this.bindEdit.pending != null) this.piano.setGuide(this.bindEdit.pending, null);
    this.bindEdit.pending = midi;
    this.piano.setGuide(midi, 'wait');
    this.emit('bind-edit', this.bindEdit);
  }

  _bindKey(e) {
    if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(e.code)) return;
    e.preventDefault();
    if (e.code === 'Escape') return this.stopBindEdit();
    const target = this.bindEdit.pending;
    if (target == null) return;
    if (RESERVED_CODES.has(e.code)) {
      this.emit('bind-reserved', e.code);
      return;
    }
    const key = e.shiftKey ? `Shift+${e.code}` : e.code;
    const custom = { ...this.store.get('customBindings') };
    // One key → one note: drop any older use of this key and any older key for this note.
    const base = target - this.store.get('octaveShift') * 12;
    for (const [k, m] of Object.entries(custom)) if (k === key || m === base) delete custom[k];
    custom[key] = base;
    this.store.set('customBindings', custom);
    this.piano.setGuide(target, null);
    this.bindEdit.pending = null;
    this.emit('bind-edit', this.bindEdit);
  }
}
