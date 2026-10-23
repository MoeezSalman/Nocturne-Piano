// Compact song notation used by the built-in library.
//
//   E4:q  D#5:e.  C4+E4+G4:h  r:e  C3:s>h  |
//
//   NOTE        C4, F#3, Bb5 (C4 = middle C). Chords join notes with "+".
//   :DUR        w h q e s (whole … sixteenth), t = triplet eighth, x = triplet quarter; each "." adds a dot.
//               The duration carries over to following tokens until changed.
//   >HOLD       how long the note sounds, if different from how far time advances (arpeggios).
//   r           rest.   |  bar line (checked by scripts/check-songs.js, otherwise ignored).
import { parseNote } from './notes.js';

const BASE = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25, t: 1 / 3, x: 2 / 3, z: 0.125 };

export function parseDur(str) {
  const m = /^([whqestxz])(\.*)$/.exec(str);
  if (!m) throw new Error(`Bad duration "${str}"`);
  let v = BASE[m[1]];
  let add = v;
  for (let i = 0; i < m[2].length; i++) {
    add /= 2;
    v += add;
  }
  return v;
}

/**
 * Parses one voice. Returns { notes: [{ beat, beats, midi }], bars: [beats per bar], total }.
 */
export function parseVoice(text) {
  const notes = [];
  const bars = [];
  let beat = 0;
  let barStart = 0;
  let dur = 1;
  for (const tok of text.trim().split(/\s+/)) {
    if (!tok) continue;
    if (tok === '|') {
      bars.push(beat - barStart);
      barStart = beat;
      continue;
    }
    const m = /^([^:>]+)(?::([^>]+))?(?:>(.+))?$/.exec(tok);
    if (!m) throw new Error(`Bad token "${tok}"`);
    if (m[2]) dur = parseDur(m[2]);
    const hold = m[3] ? parseDur(m[3]) : dur;
    if (m[1] !== 'r') {
      for (const part of m[1].split('+')) {
        const midi = parseNote(part);
        if (midi == null) throw new Error(`Bad note "${part}" in "${tok}"`);
        notes.push({ beat, beats: hold, midi });
      }
    }
    beat += dur;
  }
  if (beat > barStart) bars.push(beat - barStart);
  return { notes, bars, total: beat };
}

/**
 * Turns a song definition into playable events in seconds:
 * [{ t, dur, midi, hand: 'R'|'L' }] sorted by time.
 */
export function songEvents(song) {
  if (song.events) return song.events;
  const spb = 60 / song.bpm;
  const events = [];
  const beatNotes = song.build ? song.build() : song.voices.flatMap((v) => parseVoice(v.notes).notes.map((n) => ({ ...n, hand: v.hand })));
  for (const n of beatNotes) {
    events.push({ t: n.beat * spb, dur: Math.max(0.08, n.beats * spb * 0.98), midi: n.midi, hand: n.hand || 'R' });
  }
  events.sort((a, b) => a.t - b.t || a.midi - b.midi);
  song.events = events;
  return events;
}

export const songDuration = (events) => events.reduce((m, e) => Math.max(m, e.t + e.dur), 0);
