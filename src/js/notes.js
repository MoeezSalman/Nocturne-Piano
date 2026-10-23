export const A0 = 21;
export const C8 = 108;
export const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const SOLFEGE = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

const BLACK = new Set([1, 3, 6, 8, 10]);
export const isBlack = (midi) => BLACK.has(((midi % 12) + 12) % 12);
export const octaveOf = (midi) => Math.floor(midi / 12) - 1;

export function noteName(midi, style = 'cde', withOctave = true) {
  const pc = ((midi % 12) + 12) % 12;
  const base = style === 'solfege' ? SOLFEGE[pc] : SHARPS[pc];
  return withOctave ? `${base}${octaveOf(midi)}` : base;
}

const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SOLFEGE_BASE = { do: 0, re: 2, mi: 4, fa: 5, sol: 7, so: 7, la: 9, si: 11, ti: 11 };

/**
 * Parses "C4", "F#3", "Bb5", "Eb", "Sol4", "do#" … Returns a MIDI number or null.
 * Missing octave means octave 4 (the middle-C octave).
 */
export function parseNote(token, defaultOctave = 4) {
  const m = /^(do|re|mi|fa|sol|so|la|si|ti|[A-Ga-g])(#|b|♯|♭|s)?(-?\d)?$/i.exec(token.trim());
  if (!m) return null;
  const head = m[1];
  let pc = head.length === 1 ? LETTER[head.toUpperCase()] : SOLFEGE_BASE[head.toLowerCase()];
  if (pc === undefined) return null;
  const acc = m[2];
  if (acc === '#' || acc === '♯' || acc === 's') pc += 1;
  else if (acc === 'b' || acc === '♭') pc -= 1;
  const octave = m[3] !== undefined ? Number(m[3]) : defaultOctave;
  const midi = (octave + 1) * 12 + pc;
  return midi >= 0 && midi <= 127 ? midi : null;
}

export const midiToFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);
