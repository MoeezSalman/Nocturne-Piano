// MIDI keyboard input (Web MIDI) and .mid file import.
import { Emitter } from './util.js';

export class MidiInput extends Emitter {
  constructor() {
    super();
    this.access = null;
    this.selected = 'all'; // 'all' | 'none' | input id
    this.supported = !!navigator.requestMIDIAccess;
  }

  async init() {
    if (!this.supported) return;
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
    } catch {
      this.supported = false;
      return;
    }
    this.access.onstatechange = () => {
      this._bind();
      this.emit('devices', this.devices());
    };
    this._bind();
    this.emit('devices', this.devices());
  }

  devices() {
    if (!this.access) return [];
    return [...this.access.inputs.values()].map((i) => ({ id: i.id, name: i.name || 'MIDI device', state: i.state }));
  }

  select(id) {
    this.selected = id;
    this._bind();
    this.emit('devices', this.devices());
  }

  _bind() {
    if (!this.access) return;
    for (const input of this.access.inputs.values()) {
      const on = this.selected === 'all' || this.selected === input.id;
      input.onmidimessage = on ? (e) => this._message(e.data) : null;
    }
  }

  _message([status, d1, d2]) {
    const cmd = status & 0xf0;
    if (cmd === 0x90 && d2 > 0) this.emit('noteon', { midi: d1, velocity: d2 / 127 });
    else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) this.emit('noteoff', { midi: d1 });
    else if (cmd === 0xb0 && d1 === 64) this.emit('sustain', d2 >= 64);
    else if (cmd === 0xb0 && d1 === 1) this.emit('mod', d2 / 127);
    else if (cmd === 0xe0) this.emit('bend', Math.max(-1, Math.min(1, ((d2 << 7) | d1) / 8192 - 1)));
    else if (cmd === 0xb0 && (d1 === 120 || d1 === 123)) this.emit('allnotesoff');
  }
}

const clampToPiano = (m) => {
  while (m < 21) m += 12;
  while (m > 108) m -= 12;
  return m;
};

/** Converts a Standard MIDI File into a song for the Songs library. */
export function midiFileToSong(fileName, bytes) {
  if (!window.Midi) throw new Error('MIDI support is not loaded');
  const midi = new window.Midi(bytes);
  const tracks = midi.tracks.filter((t) => t.notes.length && t.channel !== 9);
  if (!tracks.length) throw new Error('This MIDI file has no melodic notes');
  const avg = tracks.map((t) => t.notes.reduce((s, n) => s + n.midi, 0) / t.notes.length);
  const top = avg.indexOf(Math.max(...avg));
  const events = [];
  tracks.forEach((t, i) => {
    for (const n of t.notes) {
      const hand = tracks.length > 1 ? (i === top ? 'R' : 'L') : n.midi >= 60 ? 'R' : 'L';
      events.push({ t: n.time, dur: Math.max(0.06, n.duration), midi: clampToPiano(n.midi), hand, vel: n.velocity });
    }
  });
  const t0 = Math.min(...events.map((e) => e.t));
  for (const e of events) e.t -= t0;
  events.sort((a, b) => a.t - b.t || a.midi - b.midi);
  const sig = midi.header.timeSignatures[0]?.timeSignature;
  const title = (midi.name && midi.name.trim()) || fileName.replace(/\.midi?$/i, '');
  return {
    id: `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    composer: 'Imported MIDI',
    genre: 'Imported',
    level: Math.min(5, Math.max(1, Math.round(events.length / 250) + 1)),
    bpm: Math.round(midi.header.tempos[0]?.bpm || 120),
    timeSig: sig ? `${sig[0]}/${sig[1]}` : '4/4',
    events,
    imported: true,
  };
}
