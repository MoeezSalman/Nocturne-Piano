// Notepad scripts: note names ("C D E [C E G] - | G4 A4") or PC-key sheets ("[tu] y t | 8 w e").
//   note mode   C, C#4, Bb3, Do/Re/Mi… · [chord] · "-" holds the previous step · "." rests · "|" bar line
//   key mode    each character is a key of the chosen layout · [chord] · letters written together
//               play quickly inside one step · "|" or "." rests · "-" holds
import { parseNote, noteName } from './notes.js';
import { buildBindings, charToCode } from './keybinds.js';

const NOTE_RE = /(do|re|mi|fa|sol|so|la|si|ti|[A-G])(#|b|♯|♭)?(-?\d)?/gi;
const NOTE_TOKEN = /^((do|re|mi|fa|sol|so|la|si|ti|[A-G])(#|b|♯|♭)?(-?\d)?)+$/i;

function tokenize(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '[') {
      const j = text.indexOf(']', i);
      const body = j < 0 ? text.slice(i + 1) : text.slice(i + 1, j);
      out.push({ text: body, chord: true });
      i = j < 0 ? text.length : j + 1;
      continue;
    }
    let j = i;
    while (j < text.length && !/\s/.test(text[j]) && text[j] !== '[') j++;
    out.push({ text: text.slice(i, j), chord: false });
    i = j;
  }
  return out;
}

const splitNotes = (s) => [...s.matchAll(NOTE_RE)].map((m) => m[0]);
// Uppercase note letters only, so lowercase key sheets are not mistaken for note names.
const looksLikeNotes = (s) => NOTE_TOKEN.test(s) && /^[A-GDRMFSLT]/.test(s);

export function detectMode(text) {
  let notes = 0;
  let other = 0;
  for (const tok of tokenize(text)) {
    if (tok.text === '|' || tok.text === '-' || tok.text === '.') continue;
    const body = tok.chord ? tok.text.replace(/\s+/g, '') : tok.text;
    if (looksLikeNotes(body)) notes++;
    else other++;
  }
  return notes > 0 && notes >= other * 2 ? 'notes' : 'keys';
}

/**
 * @returns {{ events: {t, dur, midi}[], warnings: string[], mode: string, steps: number }}
 */
export function parseScript(text, { bpm = 120, layout = 'full', custom = {}, mode = 'auto' } = {}) {
  const bindings = buildBindings(layout === 'off' ? 'full' : layout, custom);
  const step = 60 / bpm;
  const events = [];
  const warnings = [];
  let t = 0;
  let last = []; // events of the previous step, for "-" holds

  const keyToMidi = (ch) => {
    const k = charToCode(ch);
    if (!k) return null;
    return (k.shift ? bindings.shiftCodeToMidi.get(k.code) : bindings.codeToMidi.get(k.code)) ?? null;
  };

  // Each line is read on its own, so note names and key letters can be mixed line by line.
  const modes = new Set();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const tokens = [];
  for (const line of lines) {
    const lineMode = mode === 'auto' ? detectMode(line) : mode;
    modes.add(lineMode);
    for (const tok of tokenize(line)) tokens.push({ ...tok, mode: lineMode });
  }
  const useMode = modes.size > 1 ? 'mixed' : [...modes][0] || 'notes';

  for (const tok of tokens) {
    const s = tok.text;
    if (s === '-' || /^-+$/.test(s)) {
      for (const e of last) e.dur += step * s.length;
      t += step * s.length;
      continue;
    }
    if (s === '|' || s === '.' || s === '/') {
      if (tok.mode === 'keys' && s !== '/') t += step;
      last = [];
      continue;
    }
    let groups; // array of simultaneous-note arrays, played in sequence inside this step
    if (tok.mode === 'notes') {
      const parts = tok.chord ? tok.text.split(/[\s,]+/).flatMap(splitNotes) : splitNotes(s);
      const ms = parts.map((p) => parseNote(p)).filter((m) => m != null);
      if (!ms.length) {
        warnings.push(`Unknown note "${s}"`);
        continue;
      }
      groups = tok.chord ? [ms] : ms.map((m) => [m]);
    } else {
      const chars = [...s.replace(/\s+/g, '')];
      const ms = [];
      for (const ch of chars) {
        const m = keyToMidi(ch);
        if (m == null) warnings.push(`No key for "${ch}"`);
        else ms.push(m);
      }
      if (!ms.length) continue;
      groups = tok.chord ? [ms] : ms.map((m) => [m]);
    }
    const sub = step / groups.length;
    last = [];
    groups.forEach((g, i) => {
      for (const midi of g) {
        const ev = { t: t + i * sub, dur: sub * 0.95, midi };
        events.push(ev);
        if (i === groups.length - 1) last.push(ev);
      }
    });
    t += step;
  }
  return { events, warnings: [...new Set(warnings)].slice(0, 12), mode: useMode, steps: Math.round(t / step) };
}

/** Formats a group of simultaneously played notes for the notepad. */
export function formatNotes(midis, style = 'notes', labels = new Map()) {
  const sorted = [...midis].sort((a, b) => a - b);
  const one = (m) => {
    if (style === 'keys') return labels.get(m) ?? noteName(m);
    const octave = Math.floor(m / 12) - 1;
    return noteName(m, 'cde', octave !== 4);
  };
  if (sorted.length === 1) return one(sorted[0]);
  return style === 'keys' ? `[${sorted.map(one).join('')}]` : `[${sorted.map(one).join(' ')}]`;
}
