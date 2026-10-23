// Learn: scales and ragas, a chord finder with famous progressions, and ear training.
import { h } from '../util.js';
import { icon } from './icons.js';
import { segmented, toggle, row, card, tabs, selectBox } from './controls.js';
import { ROOT_NAMES, SCALES, SCALE_BY_ID, CHORD_TYPES, CHORD_BY_ID, chordNotes, diatonicChords, intervalName } from '../theory.js';

const PROGRESSIONS = [
  ['Pop (I–V–vi–IV)', [0, 4, 5, 3]],
  ['Fifties (I–vi–IV–V)', [0, 5, 3, 4]],
  ['Sad / epic (vi–IV–I–V)', [5, 3, 0, 4]],
  ['Jazz (ii–V–I)', [1, 4, 0]],
  ['Canon (I–V–vi–iii–IV–I–IV–V)', [0, 4, 5, 2, 3, 0, 3, 4]],
  ['Blues (I–IV–I–V–IV–I)', [0, 3, 0, 4, 3, 0]],
];
const INTERVAL_SHORT = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'];
const EAR_CHORDS = {
  easy: ['maj', 'min'],
  medium: ['maj', 'min', 'dim', 'aug'],
  hard: ['maj', 'min', 'dim', 'aug', '7', 'maj7', 'm7', 'sus4'],
};
const EAR_INTERVALS = { easy: [2, 4, 5, 7, 12], medium: [1, 2, 3, 4, 5, 7, 9, 12], hard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };

export function createLearnPanel(app) {
  const { store, engine } = app;
  const s = (k) => store.get(k);
  const syncers = [];

  // Plays notes on their own channel and lights the keys.
  function playNotes(notes, { spacing = 0, dur = 1.2, delay = 0.05 } = {}) {
    const t0 = engine.now + delay;
    notes.forEach((m, i) => {
      const at = t0 + i * spacing;
      engine.scheduleNote(m, at, dur, { channel: 'learn' });
      setTimeout(() => {
        app.piano.press(m, 'song');
        app.visualizer.noteOn(m, 'song');
      }, (at - engine.now) * 1000);
      setTimeout(() => {
        app.piano.release(m, 'song');
        app.visualizer.noteOff(m, 'song');
      }, (at - engine.now + dur) * 1000);
    });
  }

  // ——— Scales ———
  const scaleNotes = h('div.note-chips');
  const diatonic = h('div.chip-row');
  const progressRow = h('div.chip-row');
  const keySel = selectBox(ROOT_NAMES.map((n, i) => [i, n]), s('theoryRoot'), (v) => store.set('theoryRoot', Number(v)));
  const scaleSel = selectBox(SCALES.map((x) => [x.id, x.label]), s('theoryScale'), (v) => store.set('theoryScale', v));
  const showScale = toggle(s('showScale'), (v) => store.set('showScale', v));
  const scaleLock = toggle(s('scaleLock'), (v) => store.set('scaleLock', v));
  const scaleMidis = (down = false) => {
    const sc = SCALE_BY_ID.get(s('theoryScale'));
    const base = 60 + s('theoryRoot');
    const notes = [...sc.iv.map((i) => base + i), base + 12];
    return down ? notes.reverse() : notes;
  };
  const renderScale = () => {
    keySel.set(s('theoryRoot'));
    scaleSel.set(s('theoryScale'));
    showScale.set(s('showScale'));
    scaleLock.set(s('scaleLock'));
    const sc = SCALE_BY_ID.get(s('theoryScale'));
    scaleNotes.textContent = '';
    sc.iv.forEach((iv, i) => scaleNotes.append(h(`span.note-chip${i === 0 ? '.root' : ''}`, {}, ROOT_NAMES[(s('theoryRoot') + iv) % 12])));
    diatonic.textContent = '';
    progressRow.textContent = '';
    const chords = diatonicChords(s('theoryRoot'), s('theoryScale'));
    if (!chords.length) {
      diatonic.append(h('span.muted', {}, 'Chords are shown for seven-note scales.'));
      return;
    }
    for (const c of chords) {
      diatonic.append(h('button.chord-chip', { onclick: () => showChord(48 + c.pc + (c.pc < 5 ? 12 : 0), c.type) }, h('small', {}, c.roman), c.name));
    }
    for (const [name, degrees] of PROGRESSIONS) {
      progressRow.append(h('button.pill', { onclick: () => playProgression(degrees.map((d) => chords[d])) }, name));
    }
  };
  syncers.push(renderScale);

  function showChord(rootMidi, type, play = true) {
    const notes = chordNotes(rootMidi, type);
    app.setLearnMarks(new Map(notes.map((m, i) => [m, i === 0 ? 'root' : 'chord'])));
    if (play) playNotes(notes, { dur: 1.4 });
    return notes;
  }

  let progTimer = null;
  function playProgression(chords) {
    clearTimeout(progTimer);
    const spb = 60 / app.metronome.bpm;
    let i = 0;
    const next = () => {
      if (i >= chords.length) {
        progTimer = setTimeout(() => app.setLearnMarks(null), spb * 2000);
        return;
      }
      const c = chords[i++];
      const root = 48 + c.pc + (c.pc < 5 ? 12 : 0);
      const notes = showChord(root, c.type, false);
      playNotes([root - 12, ...notes], { dur: spb * 1.9 });
      app.flashChordName(c.name);
      progTimer = setTimeout(next, spb * 2000);
    };
    next();
  }

  const scalesPage = h('div.studio-grid', {},
    card('Scale or raga', 'music',
      row('Key', keySel.el),
      row('Scale', scaleSel.el),
      h('div', { style: { padding: '8px 0' } }, scaleNotes),
      h('div.inline', {},
        h('button.btn.small', { onclick: () => playNotes(scaleMidis(), { spacing: 0.28, dur: 0.4 }), html: `${icon('play')}Play up` }),
        h('button.btn.small', { onclick: () => playNotes(scaleMidis(true), { spacing: 0.28, dur: 0.4 }), html: `${icon('play')}Play down` }),
      ),
    ),
    card('On the keyboard', 'piano',
      row('Show scale on keys', showScale.el, 'Gold dots mark the notes; the root is brighter'),
      row('Scale lock', scaleLock.el, 'Wrong notes slide to the nearest scale note — you cannot play a wrong note!'),
    ),
    card('Chords in this key', 'sparkle',
      h('p.hint', {}, 'Click a chord to hear it and see it on the keys.'),
      diatonic,
      h('h6.subhead', {}, 'Famous progressions'),
      progressRow,
    ),
  );

  // ——— Chord finder ———
  let chordRoot = 0;
  let chordType = 'maj';
  let inversion = 0;
  const chordInfo = h('div.chord-info');
  const rootSeg = h('div.root-grid');
  ROOT_NAMES.forEach((n, i) => rootSeg.append(h('button.pill', { onclick: () => ((chordRoot = i), renderChord(true)) }, n)));
  const typeSel = selectBox(CHORD_TYPES.map((c) => [c.id, `${c.label}${c.sym ? ` (${c.sym})` : ''}`]), chordType, (v) => ((chordType = v), renderChord(true)));
  const invSeg = segmented([[0, 'Root'], [1, '1st inv.'], [2, '2nd inv.'], [3, '3rd inv.']], 0, (v) => ((inversion = v), invSeg.set(v), renderChord(true)));
  function renderChord(play) {
    [...rootSeg.children].forEach((b, i) => b.classList.toggle('on', i === chordRoot));
    const t = CHORD_BY_ID.get(chordType);
    const notes = chordNotes(60 + chordRoot - (chordRoot > 6 ? 12 : 0), chordType, inversion);
    app.setLearnMarks(new Map(notes.map((m) => [m, (m - (60 + chordRoot)) % 12 === 0 ? 'root' : 'chord'])));
    chordInfo.textContent = '';
    chordInfo.append(
      h('div.chord-big', {}, `${ROOT_NAMES[chordRoot]}${t.sym}`),
      h('div', {}, h('b', {}, t.label), h('div.muted', {}, `Notes: ${notes.map((m) => ROOT_NAMES[m % 12]).join(' – ')}`), h('div.muted', {}, `Intervals: ${t.iv.map((i) => INTERVAL_SHORT[i] || i).join(' · ')}`)),
    );
    if (play) playNotes(notes, { dur: 1.4 });
    return notes;
  }
  const chordsPage = h('div.studio-grid', {},
    card('Chord finder', 'piano',
      rootSeg,
      row('Type', typeSel.el),
      row('Inversion', invSeg.el),
      h('div.inline', { style: { marginTop: '8px' } },
        h('button.btn.small.primary', { onclick: () => renderChord(true), html: `${icon('play')}Play` }),
        h('button.btn.small', { onclick: () => playNotes(renderChord(false), { spacing: 0.18, dur: 1 }), html: `${icon('music')}Arpeggiate` }),
        h('button.btn.small.ghost', { onclick: () => app.setLearnMarks(null) }, 'Clear keys'),
      ),
    ),
    card('This chord', 'sparkle', chordInfo),
  );

  // ——— Ear training ———
  let earMode = 'notes';
  let level = 'easy';
  let q = null;
  let score = { right: 0, total: 0, streak: 0 };
  const earPrompt = h('div.ear-prompt', {}, 'Press Start to hear your first question.');
  const earResult = h('div.ear-result');
  const earScore = h('div.ear-score');
  const answers = h('div.answer-grid');
  const renderScore = () => {
    earScore.textContent = '';
    earScore.append(
      h('div', {}, h('b', {}, `${score.right}/${score.total}`), h('span', {}, 'Correct')),
      h('div', {}, h('b', {}, String(score.streak)), h('span', {}, 'Streak')),
      h('div', {}, h('b', {}, String(s('earBest'))), h('span', {}, 'Best streak')),
    );
  };
  const rand = (list) => list[Math.floor(Math.random() * list.length)];
  function newQuestion() {
    app.setLearnMarks(null);
    earResult.textContent = '';
    earResult.className = 'ear-result';
    if (earMode === 'notes') {
      const pool = level === 'easy' ? [0, 2, 4, 5, 7, 9, 11] : [...Array(12).keys()];
      const pc = rand(pool);
      const octave = level === 'hard' ? rand([48, 60, 72]) : 60;
      q = { kind: 'notes', midi: octave + pc, answer: pc };
      earPrompt.textContent = 'Which note is this? Play it on the keyboard or pick it below.';
    } else if (earMode === 'intervals') {
      const semis = rand(EAR_INTERVALS[level]);
      const base = 55 + Math.floor(Math.random() * 8);
      q = { kind: 'intervals', base, semis, answer: semis };
      earPrompt.textContent = 'Which interval do you hear?';
    } else {
      const type = rand(EAR_CHORDS[level]);
      const root = 55 + Math.floor(Math.random() * 7);
      q = { kind: 'chords', root, type, answer: type };
      earPrompt.textContent = 'Which kind of chord is this?';
    }
    renderAnswers();
    replay();
  }
  function replay() {
    if (!q) return;
    if (q.kind === 'notes') playNotes([q.midi], { dur: 1.2 });
    else if (q.kind === 'intervals') playNotes([q.base, q.base + q.semis], { spacing: 0.7, dur: 1 });
    else playNotes(chordNotes(q.root, q.type), { dur: 1.6 });
  }
  function renderAnswers() {
    answers.textContent = '';
    let opts;
    if (earMode === 'notes') opts = (level === 'easy' ? [0, 2, 4, 5, 7, 9, 11] : [...Array(12).keys()]).map((pc) => [pc, ROOT_NAMES[pc]]);
    else if (earMode === 'intervals') opts = EAR_INTERVALS[level].map((x) => [x, intervalName(x)]);
    else opts = EAR_CHORDS[level].map((id) => [id, CHORD_BY_ID.get(id).label]);
    for (const [v, label] of opts) answers.append(h('button.btn.answer', { onclick: () => answer(v) }, label));
  }
  function answer(v) {
    if (!q || q.done) return;
    q.done = true;
    const ok = String(v) === String(q.answer);
    score.total++;
    if (ok) {
      score.right++;
      score.streak++;
      if (score.streak > s('earBest')) store.set('earBest', score.streak);
    } else score.streak = 0;
    let correct;
    if (q.kind === 'notes') {
      correct = ROOT_NAMES[q.answer];
      app.setLearnMarks(new Map([[q.midi, 'root']]));
    } else if (q.kind === 'intervals') {
      correct = intervalName(q.semis);
      app.setLearnMarks(new Map([[q.base, 'root'], [q.base + q.semis, 'chord']]));
    } else {
      correct = CHORD_BY_ID.get(q.type).label;
      app.setLearnMarks(new Map(chordNotes(q.root, q.type).map((m, i) => [m, i ? 'chord' : 'root'])));
    }
    earResult.className = `ear-result ${ok ? 'ok' : 'bad'}`;
    earResult.textContent = ok ? `Correct — ${correct}!` : `Not quite — it was ${correct}.`;
    renderScore();
    setTimeout(() => q?.done && newQuestion(), ok ? 1300 : 2400);
  }
  const modeSeg = segmented([['notes', 'Notes'], ['intervals', 'Intervals'], ['chords', 'Chords']], earMode, (v) => {
    earMode = v;
    modeSeg.set(v);
    q = null;
    renderAnswers();
  });
  const levelSeg = segmented([['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], level, (v) => {
    level = v;
    levelSeg.set(v);
    q = null;
    renderAnswers();
  });
  const earPage = h('div.studio-grid', {},
    card('Ear trainer', 'sounds',
      row('Practice', modeSeg.el),
      row('Level', levelSeg.el),
      h('div.inline', { style: { marginTop: '8px' } },
        h('button.btn.primary', { onclick: () => newQuestion(), html: `${icon('play')}Start / next` }),
        h('button.btn', { onclick: () => replay(), html: `${icon('restart')}Hear again` }),
      ),
      earScore,
    ),
    card('Your answer', 'music', earPrompt, answers, earResult),
  );
  // Answer note questions by playing the key.
  app.performance.on('down', ({ sounding }) => {
    if (app.openId !== 'learn' || earPage.hidden || !q || q.done || q.kind !== 'notes') return;
    answer(sounding % 12);
  });
  renderAnswers();
  renderScore();

  const t = tabs([
    ['scales', 'Scales & ragas', scalesPage],
    ['chords', 'Chord finder', chordsPage],
    ['ear', 'Ear training', earPage],
  ], 'scales', () => app.setLearnMarks(null));

  const el = h('div', {},
    h('div.panel-head', {},
      h('div', {}, h('div.panel-title', {}, 'Learn'), h('div.panel-sub', {}, 'Scales, ragas, chords and ear training')),
      h('div.spacer'),
      t.strip,
    ),
    t.body,
  );

  const sync = () => syncers.forEach((f) => f());
  for (const k of ['theoryRoot', 'theoryScale', 'showScale', 'scaleLock']) store.on(k, sync);
  sync();
  renderChord(false);
  app.setLearnMarks(null);
  return {
    el,
    onOpen: sync,
    onClose: () => app.setLearnMarks(null),
    select: t.select,
  };
}
