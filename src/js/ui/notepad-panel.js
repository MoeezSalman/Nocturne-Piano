// Notepad: every key you play is written down; paste or type notes and hear them played back.
import { h } from '../util.js';
import { icon } from './icons.js';
import { segmented, toggle, stepper } from './controls.js';
import { parseScript, formatNotes } from '../notepad-script.js';
import { Sequencer, scheduledHandle } from '../sequencer.js';
import { toast } from './feedback.js';
import { scriptToSong } from './songs-panel.js';

const EXAMPLE = '| C  C  G  G | A  A  G  - | F  F  E  E | D  D  C  - |';

export function createNotepad(app) {
  const { store, engine, piano, visualizer } = app;
  const root = document.getElementById('notepad');

  const text = h('textarea', { spellcheck: 'false', placeholder: `Paste a script or type notes (e.g.  ${EXAMPLE} )` });
  text.value = store.get('notepadText');
  let saveT = null;
  text.addEventListener('input', () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => store.set('notepadText', text.value), 300);
    validate();
  });
  text.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') text.blur();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      togglePlay();
    }
  });

  const capture = toggle(store.get('notepadCapture'), (v) => store.set('notepadCapture', v), 'Write what I play');
  const recDot = h('span.rec-dot');
  const styleSeg = segmented([['notes', 'Notes'], ['keys', 'Keys']], store.get('notepadStyle'), (v) => store.set('notepadStyle', v));
  const readSeg = segmented([['auto', 'Auto'], ['notes', 'Notes'], ['keys', 'Keys']], store.get('notepadRead'), (v) => {
    store.set('notepadRead', v);
    validate();
  });
  const layoutSeg = segmented([['full', 'Full'], ['real', 'Real']], store.get('notepadLayout'), (v) => {
    store.set('notepadLayout', v);
    validate();
  });
  const bpm = stepper(store.get('notepadBpm'), (v) => `${v} BPM`, (d) => {
    const v = Math.max(30, Math.min(300, store.get('notepadBpm') + d * 5));
    store.set('notepadBpm', v);
    bpm.set(v);
  });
  const playBtn = h('button.btn.primary', { onclick: () => togglePlay() });
  const warn = h('div.np-warn');
  const info = h('span.muted');

  root.append(
    h('div.panel-head', { style: { marginBottom: '2px' } },
      h('div', {}, h('div.panel-title', {}, 'Notepad'), h('div.panel-sub', {}, 'Paste & Play — every key you play is written down')),
      h('div.spacer'),
      h('button.icon-btn.ghost', { html: icon('close'), title: 'Close', onclick: () => app.toggleNotepad(false) }),
    ),
    h('div.np-row', {},
      recDot, h('span', {}, 'Write what I play'), capture.el,
      h('span.muted', { style: { marginLeft: '8px' } }, 'as'), styleSeg.el,
      h('div', { style: { flex: 1 } }),
      h('button.btn.small', { onclick: () => insert(' | '), title: 'Insert bar line' }, '|'),
      h('button.btn.small', { onclick: () => insert(' - '), title: 'Insert hold' }, '–'),
      h('button.btn.small', {
        html: `${icon('clipboard')}Paste`,
        onclick: async () => {
          try {
            const t = await navigator.clipboard.readText();
            if (t) insert(t);
          } catch {
            toast('Clipboard is not available — press Ctrl+V in the notepad');
          }
        },
      }),
      h('button.btn.small.ghost', { onclick: () => ((text.value = ''), store.set('notepadText', ''), validate()), html: `${icon('trash')}Clear` }),
    ),
    text,
    h('div.np-row', {},
      playBtn,
      bpm.el,
      h('span.muted', {}, 'Read as'), readSeg.el,
      h('span.muted', {}, 'Key layout'), layoutSeg.el,
      h('div', { style: { flex: 1 } }),
      info,
      h('button.btn.small', { onclick: () => saveAsSong(), html: `${icon('music')}Save as song` }),
    ),
    warn,
  );

  function insert(str) {
    const { selectionStart: a, selectionEnd: b, value } = text;
    const focused = document.activeElement === text;
    const at = focused ? a : value.length;
    const end = focused ? b : value.length;
    text.value = value.slice(0, at) + str + value.slice(end);
    text.selectionStart = text.selectionEnd = at + str.length;
    store.set('notepadText', text.value);
    validate();
  }

  // ——— Capture ———
  let chord = [];
  let chordTimer = null;
  let lastWrite = 0;
  app.performance.on('down', ({ keyMidi, sounding }) => {
    if (root.hidden || !store.get('notepadCapture') || seq.playing || document.activeElement === text) return;
    chord.push(store.get('notepadStyle') === 'keys' ? keyMidi : sounding);
    clearTimeout(chordTimer);
    chordTimer = setTimeout(flushChord, 70);
    recDot.classList.add('on');
  });
  function flushChord() {
    const notes = [...new Set(chord)];
    chord = [];
    if (!notes.length) return;
    const token = formatNotes(notes, store.get('notepadStyle'), app.performance.labels);
    const now = performance.now();
    const gap = now - lastWrite;
    lastWrite = now;
    let sep = text.value && !/\s$/.test(text.value) ? ' ' : '';
    if (text.value && gap > 3000) sep = '\n';
    else if (text.value && gap > 1200) sep = ' - ';
    text.value += sep + token;
    text.scrollTop = text.scrollHeight;
    store.set('notepadText', text.value);
    setTimeout(() => recDot.classList.remove('on'), 300);
    validate();
  }

  // ——— Playback ———
  const seq = new Sequencer(engine.ctx, (ev, at, rate) => {
    const dur = ev.dur / rate;
    const voice = engine.scheduleNote(ev.midi, at, dur, { channel: 'notepad' });
    const delay = Math.max(0, (at - engine.now) * 1000);
    let on = false;
    const t1 = setTimeout(() => {
      on = true;
      piano.press(ev.midi, 'song');
      visualizer.noteOn(ev.midi, 'song');
    }, delay);
    const t2 = setTimeout(() => {
      if (!on) return;
      on = false;
      piano.release(ev.midi, 'song');
      visualizer.noteOff(ev.midi, 'song');
    }, delay + dur * 1000);
    return scheduledHandle(engine.ctx, voice, at + dur + 0.4, [t1, t2], () => {
      if (on) {
        piano.release(ev.midi, 'song');
        visualizer.noteOff(ev.midi, 'song');
      }
    });
  });
  seq.on('state', () => syncPlay());

  function parse() {
    return parseScript(text.value, {
      bpm: store.get('notepadBpm'),
      layout: store.get('notepadLayout'),
      custom: store.get('customBindings'),
      mode: store.get('notepadRead'),
    });
  }

  function validate() {
    const { events, warnings, mode, steps } = parse();
    warn.textContent = warnings.length ? `⚠ ${warnings.join(' · ')}` : '';
    info.textContent = events.length ? `${events.length} notes · ${steps} steps · read as ${mode}` : '';
  }

  function togglePlay() {
    if (seq.playing) {
      seq.stop();
      return;
    }
    const { events } = parse();
    if (!events.length) {
      toast('Type or paste some notes first');
      return;
    }
    seq.load(events);
    seq.play();
  }

  function syncPlay() {
    playBtn.innerHTML = seq.playing ? `${icon('stop')}Stop` : `${icon('play')}Play`;
  }

  function saveAsSong() {
    try {
      const firstLine = text.value.trim().split('\n')[0].slice(0, 24);
      const song = scriptToSong(`Notepad — ${firstLine}`, text.value, store);
      app.songsPanel.addSong(song);
      toast('Saved to Songs → Imported', { action: { label: 'Open', run: () => app.openSong(song) } });
    } catch (err) {
      toast(err.message, { error: true });
    }
  }

  store.on('notepadStyle', (v) => styleSeg.set(v));
  store.on('notepadCapture', (v) => capture.set(v));
  syncPlay();
  validate();

  return {
    stop: () => seq.stop(),
    focus: () => text.focus(),
  };
}
