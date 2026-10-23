// Arpeggiator: turns held chords into rhythmic patterns locked to the shared clock.
import { Emitter } from './util.js';
import { PPQ } from './metronome.js';

export const ARP_PATTERNS = [
  ['up', 'Up'],
  ['down', 'Down'],
  ['updown', 'Up & down'],
  ['downup', 'Down & up'],
  ['converge', 'Converge'],
  ['random', 'Random'],
  ['order', 'As played'],
  ['chord', 'Chord stabs'],
];
export const ARP_RATES = [
  ['1/4', PPQ],
  ['1/8', PPQ / 2],
  ['1/8T', PPQ / 3],
  ['1/16', PPQ / 4],
  ['1/16T', PPQ / 6],
  ['1/32', PPQ / 8],
];

export class Arpeggiator extends Emitter {
  /**
   * @param transport shared clock
   * @param play (midi, time, durationSeconds, velocity) schedules one note
   */
  constructor(transport, play) {
    super();
    this.transport = transport;
    this.play = play;
    this.enabled = false;
    this.pattern = 'up';
    this.rate = '1/16';
    this.octaves = 1;
    this.gate = 0.6;
    this.latch = false;
    this.swing = 0;
    this.held = []; // in the order pressed
    this.latched = [];
    this.step = 0;
    this.physical = new Set();
    transport.on('tick', (t) => this._onTick(t));
  }

  set(patch) {
    Object.assign(this, patch);
    if (!this.enabled) this.clear();
    this.emit('change');
  }

  get active() {
    return this.enabled && this.notes().length > 0;
  }

  notes() {
    return this.latch && !this.physical.size ? this.latched : this.held;
  }

  noteDown(midi) {
    if (this.latch && !this.physical.size) {
      // A fresh chord after letting go replaces the latched one.
      this.latched = [];
      this.held = [];
    }
    this.physical.add(midi);
    if (!this.held.includes(midi)) this.held.push(midi);
    this.latched = [...this.held];
    if (this.held.length === 1 && !this.latch) this.step = 0;
    this.transport.hold('arp');
  }

  noteUp(midi) {
    this.physical.delete(midi);
    if (!this.latch) this.held = this.held.filter((m) => m !== midi);
    else if (!this.physical.size) this.held = [];
    if (!this.notes().length) {
      this.step = 0;
      this.transport.release('arp');
    }
  }

  clear() {
    this.held = [];
    this.latched = [];
    this.physical.clear();
    this.step = 0;
    this.transport.release('arp');
  }

  sequence() {
    const base = [...this.notes()];
    if (!base.length) return [];
    const sorted = [...base].sort((a, b) => a - b);
    const span = (list) => {
      const out = [];
      for (let o = 0; o < this.octaves; o++) for (const m of list) out.push(m + o * 12);
      return out;
    };
    const up = span(sorted);
    switch (this.pattern) {
      case 'down':
        return [...up].reverse();
      case 'updown':
        return up.length > 1 ? [...up, ...up.slice(1, -1).reverse()] : up;
      case 'downup': {
        const d = [...up].reverse();
        return d.length > 1 ? [...d, ...d.slice(1, -1).reverse()] : d;
      }
      case 'converge': {
        const out = [];
        let lo = 0;
        let hi = up.length - 1;
        while (lo <= hi) {
          out.push(up[lo++]);
          if (lo <= hi) out.push(up[hi--]);
        }
        return out;
      }
      case 'order':
        return span(base);
      default:
        return up;
    }
  }

  _onTick({ tick, time, spt }) {
    if (!this.enabled) return;
    const notes = this.notes();
    if (!notes.length) return;
    const rateTicks = ARP_RATES.find(([id]) => id === this.rate)?.[1] ?? PPQ / 4;
    if (tick % rateTicks !== 0) return;
    const stepIndex = Math.round(tick / rateTicks);
    const stepLen = rateTicks * spt;
    const offbeat = stepIndex % 2 === 1;
    const at = time + (offbeat ? this.swing * stepLen * 0.5 : 0);
    const dur = Math.max(0.03, stepLen * this.gate);
    if (this.pattern === 'chord') {
      for (const m of notes) this.play(m, at, dur, offbeat ? 0.75 : 1);
      this.emit('step');
      return;
    }
    const seq = this.sequence();
    const midi = this.pattern === 'random' ? seq[Math.floor(Math.random() * seq.length)] : seq[this.step % seq.length];
    this.step++;
    this.play(midi, at, dur, offbeat ? 0.82 : 1);
    this.emit('step', midi);
  }
}
