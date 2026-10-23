// The on-screen keyboard: 88 keys (or a focused range), mouse/touch glissando, highlights and labels.
import { Emitter, h } from './util.js';
import { isBlack, noteName, A0, C8 } from './notes.js';

// Black keys sit off-centre on a real piano (C# leans left, D# right, …).
const BLACK_OFFSET = { 1: -0.13, 3: 0.13, 6: -0.16, 8: 0, 10: 0.16 };
const BLACK_WIDTH = 0.62; // relative to a white key

export class PianoView extends Emitter {
  constructor(root) {
    super();
    this.root = root;
    this.lo = A0;
    this.hi = C8;
    this.keys = new Map(); // midi → element
    this.down = new Map(); // midi → Map<source, count>
    this.guides = new Map(); // midi → kind
    this.marks = new Map(); // midi → 'scale' | 'root' | 'chord' (learning marks)
    this.split = null;
    this.capLabels = new Map();
    this.noteStyle = 'off';
    this.colorMode = 'accent';
    this.pointers = new Map(); // pointerId → midi
    this._bindPointer();
  }

  setRange(lo, hi) {
    // Snap to white keys at both ends.
    while (isBlack(lo) && lo > A0) lo--;
    while (isBlack(hi) && hi < C8) hi++;
    this.lo = lo;
    this.hi = hi;
    this.render();
  }

  whiteKeys() {
    const out = [];
    for (let m = this.lo; m <= this.hi; m++) if (!isBlack(m)) out.push(m);
    return out;
  }

  /** Horizontal geometry of a key in 0…1 of the keyboard width. */
  geometry(midi) {
    if (midi < this.lo || midi > this.hi) return null;
    const whites = this._whiteIndex;
    const w = 1 / this._whiteCount;
    if (!isBlack(midi)) return { x: whites.get(midi) * w, w, black: false };
    const below = whites.get(midi - 1);
    if (below === undefined) return null;
    const bw = w * BLACK_WIDTH;
    return { x: (below + 1) * w - bw / 2 + BLACK_OFFSET[midi % 12] * bw, w: bw, black: true };
  }

  render() {
    const whites = this.whiteKeys();
    this._whiteCount = whites.length;
    this._whiteIndex = new Map(whites.map((m, i) => [m, i]));
    this.root.textContent = '';
    this.root.style.setProperty('--white-count', whites.length);
    this.keys.clear();
    const frag = document.createDocumentFragment();
    for (let m = this.lo; m <= this.hi; m++) {
      const g = this.geometry(m);
      if (!g) continue;
      const el = h(`div.key.${g.black ? 'black' : 'white'}`, { dataset: { midi: m } },
        h('span.k-shine'),
        h('span.k-mark'),
        h('span.k-note'),
        h('span.k-cap'),
      );
      el.style.left = `${g.x * 100}%`;
      el.style.width = `${g.w * 100}%`;
      el.style.setProperty('--hue', ((m % 12) * 30 + 200) % 360);
      if (m === 60) el.classList.add('middle-c');
      this.keys.set(m, el);
      frag.append(el);
    }
    this.root.append(frag);
    this._applyLabels();
    this._applyMarks();
    this._applySplit();
    for (const [m] of this.down) this._paint(m);
    for (const [m] of this.guides) this._paint(m);
    this.emit('layout');
  }

  setMarks(map) {
    this.marks = map || new Map();
    this._applyMarks();
  }

  _applyMarks() {
    for (const [m, el] of this.keys) el.dataset.mark = this.marks.get(m) || '';
  }

  setSplit(midi) {
    this.split = midi;
    this._applySplit();
  }

  _applySplit() {
    for (const [m, el] of this.keys) {
      el.classList.toggle('left-zone', this.split != null && m < this.split);
      el.classList.toggle('split-start', this.split != null && m === this.split);
    }
  }

  setCapLabels(map) {
    this.capLabels = map;
    this._applyLabels();
  }

  setNoteStyle(style) {
    this.noteStyle = style;
    this._applyLabels();
  }

  setColorMode(mode) {
    this.colorMode = mode;
    this.root.dataset.color = mode;
  }

  _applyLabels() {
    for (const [m, el] of this.keys) {
      const cap = el.querySelector('.k-cap');
      const note = el.querySelector('.k-note');
      const label = this.capLabels.get(m);
      cap.textContent = label ?? '';
      cap.hidden = !label;
      if (this.noteStyle === 'off') {
        note.textContent = m % 12 === 0 && !isBlack(m) ? `C${Math.floor(m / 12) - 1}` : '';
        note.classList.toggle('octave-only', true);
      } else {
        note.textContent = noteName(m, this.noteStyle === 'solfege' ? 'solfege' : 'cde', !isBlack(m) && m % 12 === 0);
        note.classList.toggle('octave-only', false);
      }
    }
  }

  // ——— Highlights ———
  press(midi, source = 'live') {
    let s = this.down.get(midi);
    if (!s) this.down.set(midi, (s = new Map()));
    s.set(source, (s.get(source) || 0) + 1);
    this._paint(midi);
  }

  release(midi, source = 'live') {
    const s = this.down.get(midi);
    if (!s) return;
    const n = (s.get(source) || 0) - 1;
    if (n > 0) s.set(source, n);
    else s.delete(source);
    if (!s.size) this.down.delete(midi);
    this._paint(midi);
  }

  releaseSource(source) {
    for (const [m, s] of [...this.down]) {
      if (s.delete(source)) {
        if (!s.size) this.down.delete(m);
        this._paint(m);
      }
    }
  }

  setGuide(midi, kind) {
    if (kind) this.guides.set(midi, kind);
    else this.guides.delete(midi);
    this._paint(midi);
  }

  clearGuides() {
    const ms = [...this.guides.keys()];
    this.guides.clear();
    ms.forEach((m) => this._paint(m));
  }

  flash(midi, kind = 'wrong') {
    const el = this.keys.get(midi);
    if (!el) return;
    el.classList.remove(`flash-${kind}`);
    void el.offsetWidth;
    el.classList.add(`flash-${kind}`);
  }

  _paint(midi) {
    const el = this.keys.get(midi);
    if (!el) return;
    const s = this.down.get(midi);
    el.classList.toggle('down', !!s);
    el.dataset.src = s ? [...s.keys()].at(-1) : '';
    const g = this.guides.get(midi);
    el.dataset.guide = g || '';
  }

  isDown(midi) {
    return this.down.has(midi);
  }

  // ——— Pointer input with glissando ———
  _midiAt(x, y) {
    const el = document.elementFromPoint(x, y)?.closest?.('.key');
    return el && this.root.contains(el) ? Number(el.dataset.midi) : null;
  }

  _bindPointer() {
    const r = this.root;
    r.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const m = this._midiAt(e.clientX, e.clientY);
      if (m == null) return;
      e.preventDefault();
      r.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, m);
      this.emit('down', { midi: m, pointer: true, velocity: this._velocityAt(e, m) });
    });
    r.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      const prev = this.pointers.get(e.pointerId);
      const m = this._midiAt(e.clientX, e.clientY);
      if (m === prev) return;
      if (prev != null) this.emit('up', { midi: prev, pointer: true });
      this.pointers.set(e.pointerId, m);
      if (m != null) this.emit('down', { midi: m, pointer: true, velocity: this._velocityAt(e, m) });
    });
    const end = (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      const m = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (m != null) this.emit('up', { midi: m, pointer: true });
    };
    r.addEventListener('pointerup', end);
    r.addEventListener('pointercancel', end);
    r.addEventListener('lostpointercapture', end);
    r.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Playing nearer the front edge of a key is louder, like a real key. */
  _velocityAt(e, midi) {
    const el = this.keys.get(midi);
    if (!el) return 1;
    const rect = el.getBoundingClientRect();
    const f = (e.clientY - rect.top) / rect.height;
    return Math.min(1, 0.55 + f * 0.55);
  }
}
