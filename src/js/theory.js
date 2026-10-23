// Music theory helpers: chord recognition, chord shapes, scales and keys.

export const ROOT_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export const CHORD_TYPES = [
  { id: 'maj', label: 'Major', sym: '', iv: [0, 4, 7] },
  { id: 'min', label: 'Minor', sym: 'm', iv: [0, 3, 7] },
  { id: 'dim', label: 'Diminished', sym: 'dim', iv: [0, 3, 6] },
  { id: 'aug', label: 'Augmented', sym: 'aug', iv: [0, 4, 8] },
  { id: 'sus2', label: 'Suspended 2nd', sym: 'sus2', iv: [0, 2, 7] },
  { id: 'sus4', label: 'Suspended 4th', sym: 'sus4', iv: [0, 5, 7] },
  { id: '5', label: 'Power chord', sym: '5', iv: [0, 7] },
  { id: '6', label: 'Major 6th', sym: '6', iv: [0, 4, 7, 9] },
  { id: 'm6', label: 'Minor 6th', sym: 'm6', iv: [0, 3, 7, 9] },
  { id: '7', label: 'Dominant 7th', sym: '7', iv: [0, 4, 7, 10] },
  { id: 'maj7', label: 'Major 7th', sym: 'maj7', iv: [0, 4, 7, 11] },
  { id: 'm7', label: 'Minor 7th', sym: 'm7', iv: [0, 3, 7, 10] },
  { id: 'mMaj7', label: 'Minor-major 7th', sym: 'm(maj7)', iv: [0, 3, 7, 11] },
  { id: 'm7b5', label: 'Half-diminished', sym: 'm7♭5', iv: [0, 3, 6, 10] },
  { id: 'dim7', label: 'Diminished 7th', sym: 'dim7', iv: [0, 3, 6, 9] },
  { id: '7sus4', label: '7 sus 4', sym: '7sus4', iv: [0, 5, 7, 10] },
  { id: 'aug7', label: 'Augmented 7th', sym: '7♯5', iv: [0, 4, 8, 10] },
  { id: 'add9', label: 'Add 9', sym: 'add9', iv: [0, 2, 4, 7] },
  { id: 'madd9', label: 'Minor add 9', sym: 'm(add9)', iv: [0, 2, 3, 7] },
  { id: '9', label: 'Dominant 9th', sym: '9', iv: [0, 2, 4, 7, 10] },
  { id: 'maj9', label: 'Major 9th', sym: 'maj9', iv: [0, 2, 4, 7, 11] },
  { id: 'm9', label: 'Minor 9th', sym: 'm9', iv: [0, 2, 3, 7, 10] },
  { id: '6/9', label: '6/9', sym: '6/9', iv: [0, 2, 4, 7, 9] },
  { id: '13', label: 'Dominant 13th', sym: '13', iv: [0, 2, 4, 7, 9, 10] },
];
export const CHORD_BY_ID = new Map(CHORD_TYPES.map((c) => [c.id, c]));

// Templates also match with the fifth left out (very common in real voicings).
const TEMPLATES = [];
CHORD_TYPES.forEach((c, rank) => {
  TEMPLATES.push({ c, rank, set: c.iv });
  if (c.iv.includes(7) && c.iv.length >= 4) TEMPLATES.push({ c, rank: rank + 0.5, set: c.iv.filter((x) => x !== 7) });
});

const INTERVALS = ['Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th', 'Octave'];
export const intervalName = (semis) => (semis % 12 === 0 && semis > 0 ? 'Octave' : INTERVALS[semis % 12]);

const pcOf = (m) => ((m % 12) + 12) % 12;

/**
 * Names the chord formed by a set of MIDI notes.
 * @returns {{ name, root, type, bass, label } | null}
 */
export function detectChord(midis, { singleAsMajor = false } = {}) {
  const notes = [...new Set(midis)].sort((a, b) => a - b);
  if (!notes.length) return null;
  const pcs = [...new Set(notes.map(pcOf))];
  const bass = pcOf(notes[0]);
  if (pcs.length === 1) {
    if (singleAsMajor) return chordResult(bass, CHORD_BY_ID.get('maj'), bass);
    return { name: ROOT_NAMES[bass], root: bass, type: null, bass, label: notes.length > 1 ? 'Octave' : 'Note' };
  }
  if (pcs.length === 2) {
    const low = notes[0];
    const other = notes.find((m) => pcOf(m) !== bass);
    const semis = other - low;
    // Root + 5th = power chord; root + 3rd reads as a major/minor chord (helps one-hand play).
    const rel = ((pcOf(other) - bass) + 12) % 12;
    if (rel === 7) return chordResult(bass, CHORD_BY_ID.get('5'), bass);
    if (singleAsMajor && (rel === 4 || rel === 3)) return chordResult(bass, CHORD_BY_ID.get(rel === 4 ? 'maj' : 'min'), bass);
    return { name: `${ROOT_NAMES[bass]}–${ROOT_NAMES[pcOf(other)]}`, root: bass, type: null, bass, label: intervalName(semis) };
  }
  let best = null;
  for (const root of pcs) {
    const rel = pcs.map((p) => (p - root + 12) % 12).sort((a, b) => a - b);
    for (const t of TEMPLATES) {
      if (t.set.length !== rel.length || !t.set.every((x, i) => x === rel[i])) continue;
      const score = t.rank + (root === bass ? 0 : 6);
      if (!best || score < best.score) best = { score, root, type: t.c };
    }
  }
  if (!best) return { name: ROOT_NAMES[bass], root: bass, type: null, bass, label: `${pcs.length} notes` };
  return chordResult(best.root, best.type, bass);
}

function chordResult(root, type, bass) {
  const base = `${ROOT_NAMES[root]}${type.sym}`;
  const name = bass !== root ? `${base}/${ROOT_NAMES[bass]}` : base;
  return { name, root, type: type.id, bass, label: type.label, intervals: type.iv };
}

/** MIDI notes for a chord, rooted near `rootMidi`, in the given inversion. */
export function chordNotes(rootMidi, typeId, inversion = 0) {
  const t = CHORD_BY_ID.get(typeId) || CHORD_BY_ID.get('maj');
  const notes = t.iv.map((i) => rootMidi + i);
  for (let k = 0; k < inversion % notes.length; k++) notes.push(notes.shift() + 12);
  return notes;
}

/** Voice a chord close to a target pitch, keeping it compact (for the band and chord mode). */
export function voiceChord(rootPc, intervals, center = 60) {
  const pcs = intervals.map((i) => (rootPc + i) % 12);
  let best = null;
  for (let low = center - 9; low <= center + 3; low++) {
    if (!pcs.includes(pcOf(low))) continue;
    const notes = [];
    let m = low;
    const need = new Set(pcs);
    while (need.size && m < low + 14) {
      if (need.has(pcOf(m))) {
        notes.push(m);
        need.delete(pcOf(m));
      }
      m++;
    }
    if (need.size) continue;
    const mid = (notes[0] + notes.at(-1)) / 2;
    const cost = Math.abs(mid - center) + (notes.at(-1) - notes[0]) * 0.3;
    if (!best || cost < best.cost) best = { cost, notes };
  }
  return best ? best.notes : intervals.map((i) => center + i);
}

export const SCALES = [
  { id: 'major', label: 'Major (Ionian)', iv: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minor', label: 'Natural minor (Aeolian)', iv: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'harmonic', label: 'Harmonic minor', iv: [0, 2, 3, 5, 7, 8, 11] },
  { id: 'melodic', label: 'Melodic minor', iv: [0, 2, 3, 5, 7, 9, 11] },
  { id: 'pentaMaj', label: 'Major pentatonic', iv: [0, 2, 4, 7, 9] },
  { id: 'pentaMin', label: 'Minor pentatonic', iv: [0, 3, 5, 7, 10] },
  { id: 'blues', label: 'Blues', iv: [0, 3, 5, 6, 7, 10] },
  { id: 'dorian', label: 'Dorian', iv: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'phrygian', label: 'Phrygian', iv: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'lydian', label: 'Lydian', iv: [0, 2, 4, 6, 7, 9, 11] },
  { id: 'mixolydian', label: 'Mixolydian', iv: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'locrian', label: 'Locrian', iv: [0, 1, 3, 5, 6, 8, 10] },
  { id: 'whole', label: 'Whole tone', iv: [0, 2, 4, 6, 8, 10] },
  { id: 'yaman', label: 'Raag Yaman', iv: [0, 2, 4, 6, 7, 9, 11] },
  { id: 'bhairav', label: 'Raag Bhairav', iv: [0, 1, 4, 5, 7, 8, 11] },
  { id: 'bhairavi', label: 'Raag Bhairavi', iv: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'kafi', label: 'Raag Kafi', iv: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'hijaz', label: 'Maqam Hijaz', iv: [0, 1, 4, 5, 7, 8, 10] },
  { id: 'hirajoshi', label: 'Hirajoshi (Japanese)', iv: [0, 2, 3, 7, 8] },
];
export const SCALE_BY_ID = new Map(SCALES.map((s) => [s.id, s]));

export function inScale(midi, rootPc, scaleId) {
  const s = SCALE_BY_ID.get(scaleId);
  return !!s && s.iv.includes((pcOf(midi) - rootPc + 12) % 12);
}

/** Nearest note of the scale (ties go up). */
export function snapToScale(midi, rootPc, scaleId) {
  for (let d = 0; d <= 6; d++) {
    if (inScale(midi + d, rootPc, scaleId)) return midi + d;
    if (inScale(midi - d, rootPc, scaleId)) return midi - d;
  }
  return midi;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
/** The triads built on each degree of a 7-note scale. */
export function diatonicChords(rootPc, scaleId) {
  const s = SCALE_BY_ID.get(scaleId);
  if (!s || s.iv.length !== 7) return [];
  return s.iv.map((deg, i) => {
    const third = (s.iv[(i + 2) % 7] - deg + 12) % 12;
    const fifth = (s.iv[(i + 4) % 7] - deg + 12) % 12;
    let type = 'maj';
    if (third === 3 && fifth === 7) type = 'min';
    else if (third === 3 && fifth === 6) type = 'dim';
    else if (third === 4 && fifth === 8) type = 'aug';
    const pc = (rootPc + deg) % 12;
    const roman = type === 'min' || type === 'dim' ? ROMAN[i].toLowerCase() : ROMAN[i];
    return { degree: i, pc, type, roman: roman + (type === 'dim' ? '°' : type === 'aug' ? '+' : ''), name: `${ROOT_NAMES[pc]}${CHORD_BY_ID.get(type).sym}` };
  });
}
