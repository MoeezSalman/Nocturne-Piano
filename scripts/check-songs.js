// Validates the built-in song library: every bar must fill its time signature (pickup and final bar
// excepted), voices must line up in length, and every note must be on the 88-key piano.
import { SONGS } from '../src/js/songs-data.js';
import { parseVoice, songEvents, songDuration } from '../src/js/song-format.js';

let problems = 0;
const fail = (song, msg) => {
  problems++;
  console.log(`  ✗ ${song.id}: ${msg}`);
};

for (const song of SONGS) {
  const [num, den] = song.timeSig.split('/').map(Number);
  const barBeats = (num * 4) / den;
  if (song.voices) {
    const totals = [];
    song.voices.forEach((v, vi) => {
      let parsed;
      try {
        parsed = parseVoice(v.notes);
      } catch (e) {
        fail(song, `voice ${vi}: ${e.message}`);
        return;
      }
      totals.push(parsed.total);
      parsed.bars.forEach((b, i) => {
        const edge = i === 0 || i === parsed.bars.length - 1;
        if (Math.abs(b - barBeats) > 1e-6 && !(edge && b < barBeats)) fail(song, `voice ${vi} (${v.hand}) bar ${i + 1} has ${b} beats, expected ${barBeats}`);
      });
      for (const n of parsed.notes) if (n.midi < 21 || n.midi > 108) fail(song, `note ${n.midi} off the keyboard`);
    });
    if (totals.length > 1 && totals.some((t) => Math.abs(t - totals[0]) > 1e-6)) fail(song, `voice lengths differ: ${totals.join(', ')}`);
  }
  const ev = songEvents(song);
  console.log(`✓ ${song.title.padEnd(42)} ${String(ev.length).padStart(4)} notes  ${songDuration(ev).toFixed(1)}s`);
}

console.log(problems ? `\n${problems} problem(s) found` : `\nAll ${SONGS.length} songs look good.`);
process.exit(problems ? 1 : 0);
