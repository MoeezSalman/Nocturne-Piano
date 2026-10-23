// Built-in song library: public-domain classical, folk, hymn and holiday music, arranged for this app.
// Notation is described in song-format.js. Run `npm run check-songs` after editing.
import { parseNote } from './notes.js';

const R = (notes) => ({ hand: 'R', notes });
const L = (notes) => ({ hand: 'L', notes });

// ——— Für Elise pieces ———
const FE_A = 'E5:s D#5 E5 B4 D5 C5 | A4:e r:s C4 E4 A4 | B4:e r:s E4 G#4 B4 | C5:e r:s E4 E5 D#5 | E5:s D#5 E5 B4 D5 C5 | A4:e r:s C4 E4 A4 | B4:e r:s E4 C5 B4 |';
const FE_AL = 'r:q. | A2:s E3 A3 r:s r:e | E2:s E3 G#3 r:s r:e | A2:s E3 A3 r:s r:e | r:q. | A2:s E3 A3 r:s r:e | E2:s E3 G#3 r:s r:e |';

// ——— Bach, Prelude in C major BWV 846: five-note chord shapes, one per bar ———
const PRELUDE = [
  'C4 E4 G4 C5 E5', 'C4 D4 A4 D5 F5', 'B3 D4 G4 D5 F5', 'C4 E4 G4 C5 E5',
  'C4 E4 A4 E5 A5', 'C4 D4 F#4 A4 D5', 'B3 D4 G4 D5 G5', 'B3 C4 E4 G4 C5',
  'A3 C4 E4 G4 C5', 'D3 A3 D4 F#4 C5', 'G3 B3 D4 G4 B4', 'G3 Bb3 E4 G4 C#5',
  'F3 A3 D4 A4 D5', 'F3 Ab3 D4 F4 B4', 'E3 G3 C4 G4 C5', 'E3 F3 A3 C4 F4',
  'D3 F3 A3 C4 F4', 'G2 D3 G3 B3 F4', 'C3 E3 G3 C4 E4',
];

// ——— Gymnopédie No. 1 accompaniment ———
const GYM_G = 'G2:q B3+D4+F#4:h';
const GYM_D = 'D2:q A3+C#4+F#4:h';
const gymLH = (bars) => Array.from({ length: bars }, (_, i) => (i % 2 ? GYM_D : GYM_G)).join(' | ') + ' |';
const GYM_MELODY = 'r:q F#5 A5 | G5 F#5 C#5 | B4 C#5 D5 | A4:h. | F#4:h.>w. | r:h. | r:h. | r:h. |';

// ——— Canon in D bass ———
const CANON_LH = 'D3+A3:h A2+E3 | B2+F#3:h F#2+C#3 | G2+D3:h D2+A2 | G2+D3:h A2+E3 |';

// ——— Turkish March ———
const TM_HEAD = 'C5:e r D5:s C5 B4 C5 | E5:e r F5:s E5 D#5 E5 | B5:s A5 G#5 A5 B5 A5 G#5 A5 |';
const TM_HEAD_L = 'A3:e C4+E4 C4+E4 C4+E4 | A3:e C4+E4 C4+E4 C4+E4 | A3:e C4+E4 A3 C4+E4 |';

// ——— Hall of the Mountain King ———
const HALL = (o) => {
  const n = (s) => s.replace(/([A-G]#?)(\d)/g, (_, p, oct) => `${p}${Number(oct) + o}`);
  return n('B3:e C#4 D4 E4 F#4 D4 F#4:q | F4:e C#4 F4:q E4:e C4 E4:q | B3:e C#4 D4 E4 F#4 D4 F#4 B4 | A4:e F#4 D4 F#4 A4:h |');
};
const HALL_L = 'B2:q F#2 B2 F#2 | B2:q F#2 B2 F#2 | B2:q F#2 B2 F#2 | F#2:q C#3 F#2:h |';

// ——— Can-Can ———
const CANCAN = 'C4:q D4:e F4 | E4:e D4 G4:q | G4:q G4:e A4 | E4:e F4 D4:q | D4:q D4:e F4 | E4:e D4 C4 C5 | B4:e A4 G4 F4 | E4:e D4 C4:q |';
const CANCAN_L = 'C3:e E3+G3 C3 E3+G3 | G2:e B2+F3 G2 B2+F3 | C3:e E3+G3 C3 E3+G3 | G2:e B2+F3 G2 B2+F3 | G2:e B2+F3 G2 B2+F3 | C3:e E3+G3 C3 E3+G3 | G2:e B2+F3 G2 B2+F3 | C3:e E3+G3 C3:q |';

// ——— Carol of the Bells ———
const COB_OST = 'Bb4:q A4:e Bb4 G4:q |';
const COB_HI = 'D5:q C5:e D5 Bb4:q |';
const COB_BASS = 'G2+D3:h. | F2+C3:h. | Eb2+Bb2:h. | D2+A2:h. |';

// ——— Auld Lang Syne verse (bars 1–7) ———
const ALS = 'C5:q. C5:e C5:q E5 | D5:q. C5:e D5:q E5:e D5 | C5:q. C5:e E5:q G5 | A5:h. A5:q | G5:q. E5:e E5:q C5 | D5:q. C5:e D5:q E5:e D5 | C5:q. A4:e A4:q G4 |';
const ALS_L = 'C3+G3:w | G2+F3:w | C3+G3:w | F2+C3:w | C3+G3:w | G2+F3:w | A2+E3:h F2+C3:q G2+F3 |';

const rep = (s, n) => Array(n).fill(s).join(' ');

export const SONGS = [
  // ——— Beginner / kids ———
  {
    id: 'twinkle', title: 'Twinkle, Twinkle, Little Star', composer: 'Traditional', genre: 'Kids', level: 1, bpm: 100, timeSig: '4/4',
    voices: [
      R('C4:q C4 G4 G4 | A4 A4 G4:h | F4:q F4 E4 E4 | D4 D4 C4:h | G4:q G4 F4 F4 | E4 E4 D4:h | G4:q G4 F4 F4 | E4 E4 D4:h | C4:q C4 G4 G4 | A4 A4 G4:h | F4:q F4 E4 E4 | D4 D4 C4:h |'),
      L('C3+G3:h C3+G3 | F3+A3:h C3+G3 | F3+A3:h C3+G3 | G2+G3:h C3+G3 | C3+G3:h G2+F3 | C3+G3:h G2+G3 | C3+G3:h G2+F3 | C3+G3:h G2+G3 | C3+G3:h C3+G3 | F3+A3:h C3+G3 | F3+A3:h C3+G3 | G2+G3:h C3+G3 |'),
    ],
  },
  {
    id: 'mary-lamb', title: 'Mary Had a Little Lamb', composer: 'Traditional', genre: 'Kids', level: 1, bpm: 110, timeSig: '4/4',
    voices: [
      R('E4:q D4 C4 D4 | E4 E4 E4:h | D4:q D4 D4:h | E4:q G4 G4:h | E4:q D4 C4 D4 | E4 E4 E4 E4 | D4 D4 E4 D4 | C4:w |'),
      L('C3+G3:w | C3+G3:w | G2+G3:w | C3+G3:w | C3+G3:w | C3+G3:w | G2+G3:w | C3+G3:w |'),
    ],
  },
  {
    id: 'hot-cross-buns', title: 'Hot Cross Buns', composer: 'Traditional', genre: 'Kids', level: 1, bpm: 100, timeSig: '4/4',
    voices: [
      R('E4:h D4 | C4:w | E4:h D4 | C4:w | C4:e C4 C4 C4 D4 D4 D4 D4 | E4:h D4 | C4:w |'),
      L('C3+G3:h G2+G3 | C3+G3:w | C3+G3:h G2+G3 | C3+G3:w | C3+G3:h G2+G3 | C3+G3:h G2+G3 | C3+G3:w |'),
    ],
  },
  {
    id: 'row-boat', title: 'Row, Row, Row Your Boat', composer: 'Traditional', genre: 'Kids', level: 1, bpm: 150, timeSig: '6/8',
    voices: [
      R('C4:q. C4 | C4:q D4:e E4:q. | E4:q D4:e E4:q F4:e | G4:h. | C5:e C5 C5 G4 G4 G4 | E4 E4 E4 C4 C4 C4 | G4:q F4:e E4:q D4:e | C4:h. |'),
      L('C3+G3:h. | C3+G3:h. | C3+G3:h. | C3+G3:h. | C3+G3:h. | C3+G3:h. | G2+G3:h. | C3+G3:h. |'),
    ],
  },
  {
    id: 'frere-jacques', title: 'Frère Jacques', composer: 'Traditional', genre: 'Kids', level: 1, bpm: 112, timeSig: '4/4',
    voices: [
      R('C4:q D4 E4 C4 | C4 D4 E4 C4 | E4 F4 G4:h | E4:q F4 G4:h | G4:e A4 G4 F4 E4:q C4 | G4:e A4 G4 F4 E4:q C4 | C4 G3 C4:h | C4:q G3 C4:h |'),
      L('C3+G3:w | C3+G3:w | C3+G3:w | C3+G3:w | C3+G3:w | C3+G3:w | C3:q G2 C3:h | C3:q G2 C3:h |'),
    ],
  },
  {
    id: 'london-bridge', title: 'London Bridge Is Falling Down', composer: 'Traditional', genre: 'Kids', level: 1, bpm: 112, timeSig: '4/4',
    voices: [
      R('G4:q. A4:e G4:q F4 | E4 F4 G4:h | D4:q E4 F4:h | E4:q F4 G4:h | G4:q. A4:e G4:q F4 | E4 F4 G4:h | D4:h G4 | E4:q C4:h. |'),
      L('C3+G3:w | C3+G3:w | G2+F3:w | C3+G3:w | C3+G3:w | C3+G3:w | G2+F3:w | C3+G3:w |'),
    ],
  },
  {
    id: 'old-macdonald', title: 'Old MacDonald Had a Farm', composer: 'Traditional', genre: 'Kids', level: 1, bpm: 120, timeSig: '4/4',
    voices: [
      R('G4:q G4 G4 D4 | E4 E4 D4:h | B4:q B4 A4 A4 | G4:h. D4:q | G4 G4 G4 D4 | E4 E4 D4:h | B4:q B4 A4 A4 | G4:w |'),
      L('G2+D3:w | C3+G3:w | G2+D3:h D3+A3 | G2+D3:w | G2+D3:w | C3+G3:w | G2+D3:h D3+A3 | G2+D3:w |'),
    ],
  },
  {
    id: 'yankee-doodle', title: 'Yankee Doodle', composer: 'Traditional', genre: 'Folk', level: 1, bpm: 120, timeSig: '4/4',
    voices: [
      R(rep('C4:e C4 D4 E4 C4 E4 D4 G3 | C4:e C4 D4 E4 C4:q B3 | C4:e C4 D4 E4 F4 E4 D4 C4 | B3:e G3 A3 B3 C4:q C4 |', 2)),
      L(rep('C3+G3:h C3+G3 | C3+G3:h G2+G3 | C3+G3:h F2+C3 | G2+F3:h C3+G3 |', 2)),
    ],
  },
  {
    id: 'happy-birthday', title: 'Happy Birthday', composer: 'Mildred & Patty Hill', genre: 'Celebration', level: 1, bpm: 100, timeSig: '3/4',
    voices: [
      R('G4:e. G4:s | A4:q G4 C5 | B4:h G4:e. G4:s | A4:q G4 D5 | C5:h G4:e. G4:s | G5:q E5 C5 | B4 A4 F5:e. F5:s | E5:q C5 D5 | C5:h. |'),
      L('r:q | C3+G3:h. | G2+F3:h. | G2+F3:h. | C3+G3:h. | C3+E3:h. | F2+C3:h. | C3+G3:q G2+F3:h | C3+G3:h. |'),
    ],
  },
  {
    id: 'chopsticks', title: 'Chopsticks', composer: 'Euphemia Allen', genre: 'Kids', level: 1, bpm: 190, timeSig: '3/4',
    voices: [
      R(rep('F4+G4:q F4+G4 F4+G4 | F4+G4 F4+G4 F4+G4 | E4+G4 E4+G4 E4+G4 | E4+G4 E4+G4 E4+G4 | D4+B4 D4+B4 D4+B4 | D4+B4 C4+C5 C4+C5 | C4+C5 D4+B4 E4+A4 | F4+G4:h. |', 2)),
    ],
  },

  // ——— Folk & hymns ———
  {
    id: 'ode-to-joy', title: 'Ode to Joy', composer: 'Ludwig van Beethoven', genre: 'Classical', level: 1, bpm: 108, timeSig: '4/4',
    voices: [
      R('E4:q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:q. D4:e D4:h | E4:q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:q. C4:e C4:h | D4:q D4 E4 C4 | D4 E4:e F4 E4:q C4 | D4 E4:e F4 E4:q D4 | C4 D4 G3:h | E4:q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:q. C4:e C4:h |'),
      L('C3:h G2 | G2:h B2 | C3:h E3 | G2:h G2 | C3:h G2 | G2:h B2 | C3:h E3 | G2:h C3 | G2:h C3 | G2:h C3 | G2:h B2 | C3:h G2 | C3:h G2 | G2:h B2 | C3:h E3 | G2:h C3:h |'),
    ],
  },
  {
    id: 'amazing-grace', title: 'Amazing Grace', composer: 'Traditional (New Britain)', genre: 'Hymn', level: 2, bpm: 80, timeSig: '3/4',
    voices: [
      R('D4:q | G4:h B4:e G4 | B4:h A4:q | G4:h E4:q | D4:h D4:q | G4:h B4:e G4 | B4:h A4:q | D5:h B4:q | D5:h B4:e G4 | B4:h A4:q | G4:h E4:q | D4:h D4:q | G4:h B4:e G4 | B4:h A4:q | G4:h. |'),
      L('r:q | G2+D3:h. | G2+D3:h. | C3+G3:h. | G2+D3:h. | G2+D3:h. | G2+D3:h. | D3+A3:h. | G2+D3:h. | G2+D3:h. | C3+G3:h. | G2+D3:h. | G2+D3:h. | D3+A3:h. | G2+D3:h. |'),
    ],
  },
  {
    id: 'greensleeves', title: 'Greensleeves', composer: 'Traditional English', genre: 'Folk', level: 2, bpm: 110, timeSig: '6/8',
    voices: [
      R('A4:e | C5:q D5:e E5:e. F5:s E5:e | D5:q B4:e G4:e. A4:s B4:e | C5:q A4:e A4:e. G#4:s A4:e | B4:q G#4:e E4:q A4:e | C5:q D5:e E5:e. F5:s E5:e | D5:q B4:e G4:e. A4:s B4:e | C5:e. B4:s A4:e G#4:e. F#4:s G#4:e | A4:h. | G5:q. G5:e. F#5:s E5:e | D5:q B4:e G4:e. A4:s B4:e | C5:q A4:e A4:e. G#4:s A4:e | B4:q G#4:e E4:q. | G5:q. G5:e. F#5:s E5:e | D5:q B4:e G4:e. A4:s B4:e | C5:e. B4:s A4:e G#4:e. F#4:s G#4:e | A4:h. |'),
      L('r:e | A2+E3:h. | G2+D3:h. | A2+E3:h. | E2+B2:h. | A2+E3:h. | G2+D3:h. | A2+E3:q. E2+B2 | A2+E3:h. | C3+G3:h. | G2+D3:h. | A2+E3:h. | E2+B2:h. | C3+G3:h. | G2+D3:h. | A2+E3:q. E2+B2 | A2+E3:h. |'),
    ],
  },
  {
    id: 'scarborough-fair', title: 'Scarborough Fair', composer: 'Traditional English', genre: 'Folk', level: 2, bpm: 100, timeSig: '3/4',
    voices: [
      R('D4:h D4:q | A4:h A4:q | E4:q. F4:e E4:q | D4:h. | r:q A4 C5 | D5:h C5:q | A4:q B4 G4 | A4:h. | r:h D5:q | D5:h D5:q | C5:h A4:q | A4:q G4 F4 | E4:q C4:h | D4:h A4:q | G4:h F4:q | E4:q D4 C4 | D4:h. |'),
      L('D3+A3:h. | D3+A3:h. | C3+G3:h. | D3+A3:h. | D3+A3:h. | D3+A3:h. | G2+D3:h. | D3+A3:h. | D3+A3:h. | D3+A3:h. | F2+C3:h. | D3+A3:h. | C3+G3:h. | D3+A3:h. | G2+D3:h. | C3+G3:h. | D3+A3:h. |'),
    ],
  },
  {
    id: 'auld-lang-syne', title: 'Auld Lang Syne', composer: 'Traditional Scottish', genre: 'Folk', level: 2, bpm: 84, timeSig: '4/4',
    voices: [
      R(`G4:q | ${ALS} C5:h. G4:q | ${ALS} C5:h. r:q |`),
      L(`r:q | ${ALS_L} C3+G3:h. r:q | ${ALS_L} C3+G3:h. r:q |`),
    ],
  },
  {
    id: 'sakura', title: 'Sakura Sakura', composer: 'Traditional Japanese', genre: 'Folk', level: 2, bpm: 76, timeSig: '4/4',
    voices: [
      R('A4:q A4 B4:h | A4:q A4 B4:h | A4:q B4 C5 B4 | A4 B4:e A4 F4:h | E4:q C4 E4 F4 | E4 E4:e C4 B3:h | A4:q B4 C5 B4 | A4 B4:e A4 F4:h | E4:q C4 E4 F4 | E4 E4:e C4 B3:h | A4:q A4 B4:h | A4:q A4 B4:h | E4:q F4 B4:e A4 F4:q | E4:w |'),
      L('A2+E3:w | A2+E3:w | A2+E3:w | D3+A3:w | E2+B2:w | E2+B2:w | A2+E3:w | D3+A3:w | E2+B2:w | E2+B2:w | A2+E3:w | A2+E3:w | D3+A3:w | E2+B2:w |'),
    ],
    instrument: 'koto_fb',
  },
  {
    id: 'saints', title: 'When the Saints Go Marching In', composer: 'Traditional Spiritual', genre: 'Folk', level: 1, bpm: 132, timeSig: '4/4',
    voices: [
      R('r:q C4 E4 F4 | G4:w | r:q C4 E4 F4 | G4:w | r:q C4 E4 F4 | G4:h E4 | C4:h E4 | D4:w | r:q E4 E4 D4 | C4:h. C4:q | E4:h G4 | G4:q F4:h. | r:q E4 F4 G4 | E4:h C4 | D4:w | C4:w |'),
      L('C3+G3:w | C3+G3:w | C3+G3:w | C3+G3:w | C3+G3:w | C3+G3:w | C3+G3:w | G2+F3:w | C3+G3:w | C3+G3:w | C3+Bb3:w | F2+C3:w | C3+G3:w | C3+G3:w | G2+F3:w | C3+G3:w |'),
    ],
  },

  // ——— Holiday ———
  {
    id: 'jingle-bells', title: 'Jingle Bells', composer: 'James Lord Pierpont', genre: 'Holiday', level: 1, bpm: 120, timeSig: '4/4',
    voices: [
      R('E4:q E4 E4:h | E4:q E4 E4:h | E4:q G4 C4:q. D4:e | E4:w | F4:q F4 F4:q. F4:e | F4:q E4 E4 E4:e E4 | E4:q D4 D4 E4 | D4:h G4:h | E4:q E4 E4:h | E4:q E4 E4:h | E4:q G4 C4:q. D4:e | E4:w | F4:q F4 F4 F4 | F4 E4 E4 E4:e E4 | G4:q G4 F4 D4 | C4:w |'),
      L('C3+G3:h C3+G3 | C3+G3:h C3+G3 | C3+G3:h C3+G3 | C3+G3:w | F2+C3:h F2+C3 | C3+G3:h C3+G3 | D3+A3:h D3+A3 | G2+G3:h G2+F3 | C3+G3:h C3+G3 | C3+G3:h C3+G3 | C3+G3:h C3+G3 | C3+G3:w | F2+C3:h F2+C3 | C3+G3:h C3+G3 | G2+F3:h G2+F3 | C3+G3:w |'),
    ],
    instrument: 'grand_piano',
  },
  {
    id: 'silent-night', title: 'Silent Night', composer: 'Franz Xaver Gruber', genre: 'Holiday', level: 2, bpm: 96, timeSig: '6/8',
    voices: [
      R('G4:q. A4:e G4:q | E4:h. | G4:q. A4:e G4:q | E4:h. | D5:h D5:q | B4:h. | C5:h C5:q | G4:h. | A4:h A4:q | C5:q. B4:e A4:q | G4:q. A4:e G4:q | E4:h. | A4:h A4:q | C5:q. B4:e A4:q | G4:q. A4:e G4:q | E4:h. | D5:h D5:q | F5:q. D5:e B4:q | C5:h. | E5:h. | C5:q. G4:e E4:q | G4:q. F4:e D4:q | C4:h. | C4:h. |'),
      L('C3+G3:h. | C3+G3:h. | C3+G3:h. | C3+G3:h. | G2+F3:h. | G2+G3:h. | C3+G3:h. | C3+G3:h. | F2+C3:h. | F2+C3:h. | C3+G3:h. | C3+G3:h. | F2+C3:h. | F2+C3:h. | C3+G3:h. | C3+G3:h. | G2+F3:h. | G2+F3:h. | C3+G3:h. | C3+E3:h. | C3+G3:h. | G2+F3:h. | C3+G3:h. | C3+G3:h. |'),
    ],
  },
  {
    id: 'merry-christmas', title: 'We Wish You a Merry Christmas', composer: 'Traditional English', genre: 'Holiday', level: 1, bpm: 150, timeSig: '3/4',
    voices: [
      R('G4:q | C5 C5:e D5 C5 B4 | A4:q A4 A4 | D5 D5:e E5 D5 C5 | B4:q G4 G4 | E5 E5:e F5 E5 D5 | C5:q A4 G4:e G4 | A4:q D5 B4 | C5:h |'),
      L('r:q | C3+G3:h. | F2+C3:h. | D3+A3:h. | G2+D3:h. | C3+G3:h. | F2+C3:h. | G2+F3:h. | C3+G3:h |'),
    ],
  },
  {
    id: 'carol-bells', title: 'Carol of the Bells', composer: 'Mykola Leontovych', genre: 'Holiday', level: 2, bpm: 150, timeSig: '3/4',
    voices: [
      R(`${rep(COB_OST, 4)} ${rep(COB_HI, 4)} G5:q G5:e G5 F5 Eb5 | D5:q D5:e D5 C5 Bb4 | C5:q C5:e C5 D5 C5 | G4:q G4:e G4 G4:q | ${rep(COB_OST, 4)} G4:h. |`),
      L(`${COB_BASS} ${COB_BASS} Eb2+Bb2:h. | Bb1+F2:h. | F2+C3:h. | G2+D3:h. | ${COB_BASS} G2+D3+G3:h. |`),
    ],
  },

  // ——— Classical ———
  {
    id: 'fur-elise', title: 'Für Elise', composer: 'Ludwig van Beethoven', genre: 'Classical', level: 3, bpm: 68, timeSig: '3/8',
    voices: [
      R(`E5:s D#5 | ${FE_A} A4:e r E5:s D#5 | ${FE_A} A4:e r:s B4 C5 D5 | E5:e. G4:s F5 E5 | D5:e. F4:s E5 D5 | C5:e. E4:s D5 C5 | B4:e r E5:s D#5 | ${FE_A} A4:q. |`),
      L(`r:e | ${FE_AL} A2:s E3 A3 r:s r:e | ${FE_AL} A2:s E3 A3 r:s r:e | C3:s G3 C4 r:s r:e | G2:s G3 B3 r:s r:e | A2:s E3 A3 r:s r:e | E2:s E3 r r r:e | ${FE_AL} A2:s E3 A3:q |`),
    ],
    note: 'Main theme and first episode',
  },
  {
    id: 'canon-in-d', title: 'Canon in D', composer: 'Johann Pachelbel', genre: 'Classical', level: 3, bpm: 66, timeSig: '4/4',
    voices: [
      R('F#5:h E5 | D5:h C#5 | B4:h A4 | B4:h C#5 | D5:h C#5 | B4:h A4 | G4:h F#4 | G4:h E4 | D4:q F#4 A4 G4 | F#4 D4 F#4 E4 | D4 B3 D4 A4 | G4 B4 A4 G4 | F#4:q D4 E4 C#5 | D5 F#5 A5 A4 | B4 G4 A4 F#4 | D4 D5 D5:q. C#5:e | D5:w |'),
      L(`${rep(CANON_LH, 4)} D2+D3+A3:w |`),
    ],
  },
  {
    id: 'minuet-g', title: 'Minuet in G', composer: 'Christian Petzold (attr. J. S. Bach)', genre: 'Classical', level: 2, bpm: 112, timeSig: '3/4',
    voices: [
      R('D5:q G4:e A4 B4 C5 | D5:q G4 G4 | E5:q C5:e D5 E5 F#5 | G5:q G4 G4 | C5:q D5:e C5 B4 A4 | B4:q C5:e B4 A4 G4 | F#4:q G4:e A4 B4 G4 | A4:h. | D5:q G4:e A4 B4 C5 | D5:q G4 G4 | E5:q C5:e D5 E5 F#5 | G5:q G4 G4 | C5:q D5:e C5 B4 A4 | B4:q C5:e B4 A4 G4 | A4:q B4:e A4 G4 F#4 | G4:h. |'),
      L('G3+B3+D4:h A3:q | B3:h. | C4:h. | B3:h. | A3:h. | G3:h. | D4:q B3 G3 | D3:q F#3 A3 | G3+B3+D4:h A3:q | B3:h. | C4:h. | B3:h. | A3:h. | G3:h. | D3:h. | G2+G3:h. |'),
    ],
  },
  {
    id: 'prelude-c', title: 'Prelude in C Major (BWV 846)', composer: 'Johann Sebastian Bach', genre: 'Classical', level: 3, bpm: 66, timeSig: '4/4',
    build() {
      const out = [];
      PRELUDE.forEach((shape, bar) => {
        const [a, b, c, d, e] = shape.split(' ').map((n) => parseNote(n));
        for (const half of [0, 2]) {
          const t = bar * 4 + half;
          out.push({ beat: t, beats: 2, midi: a, hand: 'L' });
          out.push({ beat: t + 0.25, beats: 1.75, midi: b, hand: 'L' });
          [c, d, e, c, d, e].forEach((m, i) => out.push({ beat: t + 0.5 + i * 0.25, beats: 0.3, midi: m, hand: 'R' }));
        }
      });
      const end = PRELUDE.length * 4;
      for (const n of ['C2', 'C3']) out.push({ beat: end, beats: 4, midi: parseNote(n), hand: 'L' });
      for (const n of ['E4', 'G4', 'C5']) out.push({ beat: end, beats: 4, midi: parseNote(n), hand: 'R' });
      return out;
    },
    note: 'Bars 1–19 and final chord',
  },
  {
    id: 'gymnopedie', title: 'Gymnopédie No. 1', composer: 'Erik Satie', genre: 'Classical', level: 2, bpm: 72, timeSig: '3/4',
    voices: [
      R(`r:h. | r:h. | r:h. | r:h. | ${GYM_MELODY} ${GYM_MELODY} r:h. |`),
      L(`${gymLH(20)} G2+D3+B3+F#4:h. |`),
    ],
    note: 'Opening theme',
  },
  {
    id: 'turkish-march', title: 'Rondo alla Turca', composer: 'Wolfgang Amadeus Mozart', genre: 'Classical', level: 4, bpm: 116, timeSig: '2/4',
    voices: [
      R(`B4:s A4 G#4 A4 | ${TM_HEAD} C6:q A5:e C6 | B5:e A5 G5 A5 | B5:e A5 G5 A5 | B5:e A5 G5 F#5 | E5:q B4:s A4 G#4 A4 | ${TM_HEAD} C6:q A5:e B5 | C6:e B5 A5 G#5 | A5:e E5 F5 D5 | C5:q B4 | A4:h |`),
      L(`r:q | ${TM_HEAD_L} A3:e C4+E4 C4+E4 C4+E4 | E3:e G3+B3 G3+B3 G3+B3 | E3:e G3+B3 G3+B3 G3+B3 | B2:e F#3+A3 F#3+A3 F#3+A3 | E3:q r | ${TM_HEAD_L} A3:e C4+E4 C4+E4 C4+E4 | A3:e C4+E4 E3 G#3+B3 | A3:e C4+E4 D3 F3+A3 | E3:e G#3+B3 E3 G#3+B3 | A2+A3:h |`),
    ],
    note: 'Opening theme',
  },
  {
    id: 'brahms-lullaby', title: 'Lullaby (Wiegenlied)', composer: 'Johannes Brahms', genre: 'Classical', level: 2, bpm: 80, timeSig: '3/4',
    voices: [
      R('A4:e A4 | C5:h A4:e A4 | C5:h A4:e C5 | F5:q E5:q. D5:e | D5:q C5 G4:e A4 | Bb4:q G4 G4:e A4 | Bb4:h G4:e Bb4 | E5:e D5 C5:q E5 | F5:h F4:e F4 | F5:h D5:e Bb4 | C5:h A4:e F4 | Bb4:q C5 D5 | C5:h F4:e F4 | F5:h D5:e Bb4 | C5:h A4:e F4 | Bb4:q A4 G4 | F4:h. |'),
      L('r:q | F2+C3:h. | F2+C3:h. | Bb2+F3:h. | C3+E3:h. | C3+G3:h. | C3+G3:h. | C3+G3:h. | F2+C3:h. | Bb2+F3:h. | F2+C3:h. | C3+G3:h. | F2+C3:h. | Bb2+F3:h. | F2+C3:h. | C3+G3:h. | F2+C3:h. |'),
    ],
    instrument: 'music_box',
  },
  {
    id: 'mountain-king', title: 'In the Hall of the Mountain King', composer: 'Edvard Grieg', genre: 'Classical', level: 2, bpm: 116, timeSig: '4/4',
    voices: [R(`${HALL(0)} ${HALL(1)}`), L(`${HALL_L} ${HALL_L}`)],
  },
  {
    id: 'can-can', title: 'Can-Can (Galop Infernal)', composer: 'Jacques Offenbach', genre: 'Classical', level: 2, bpm: 144, timeSig: '2/4',
    voices: [R(rep(CANCAN, 2)), L(rep(CANCAN_L, 2))],
  },
  {
    id: 'new-world-largo', title: 'Largo (“Goin’ Home”)', composer: 'Antonín Dvořák', genre: 'Classical', level: 1, bpm: 60, timeSig: '4/4',
    voices: [
      R('E4:q. G4:e G4:h | E4:q. D4:e C4:h | D4:q E4 G4 E4 | D4:w | E4:q. G4:e G4:h | E4:q. D4:e C4:h | D4:q E4 D4 C4 | C4:w |'),
      L('C3+G3:w | C3+G3:h A2+E3 | G2+D3:h C3+G3 | G2+D3:w | C3+G3:w | C3+G3:h A2+E3 | G2+F3:w | C3+G3:w |'),
    ],
    instrument: 'english_horn',
  },
  {
    id: 'toccata', title: 'Toccata in D minor (Opening)', composer: 'Johann Sebastian Bach', genre: 'Classical', level: 2, bpm: 58, timeSig: '4/4',
    voices: [
      R('A5:s G5 A5:h.. | G5:s F5 E5 D5 C#5:h D5:q | r:w | A4:s G4 A4:h.. | E4:s F4 C#4 D4:h. r:s | r:w | A3:s G3 A3:h.. | G3:s F3 E3 D3 C#3:h D3:q | C#4+E4+G4+Bb4:w | D4+F4+A4+D5:w |'),
      L('r:w | r:w | r:w | r:w | r:w | r:w | r:w | r:w | D2+D3:w | D2+D3:w |'),
    ],
    instrument: 'church_organ_fb',
  },
];

export const GENRES = ['All', ...new Set(SONGS.map((s) => s.genre))];
