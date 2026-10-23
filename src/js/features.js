// Wires the v2 features into the app: arpeggiator, band, layers and split, wheels, chord names,
// learning marks, memory slots, beat flash, practice stats and the command palette.
import { $, clamp } from './util.js';
import { store } from './store.js';
import { PRESETS, PRESET_BY_ID } from './instruments.js';
import { SONGS } from './songs-data.js';
import { STYLES } from './band.js';
import { inScale } from './theory.js';
import { VIZ_STYLES } from './visualizer.js';
import { FX_PRESETS, MEMORY_KEYS, memoryTitle } from './ui/studio-panel.js';
import { createPalette, soundItem } from './ui/palette.js';
import { showStats } from './ui/stats-panel.js';
import { toast } from './ui/feedback.js';

const THEMES = [
  ['midnight', 'Midnight'],
  ['ivory', 'Ivory (white grand)'],
  ['rosewood', 'Rosewood'],
  ['neon', 'Neon'],
];
const ACCENTS = ['gold', 'teal', 'rose', 'violet', 'ice', 'emerald'];

export function installFeatures(app) {
  const { engine, performance: perf, arp, band, metronome, piano, visualizer, stats } = app;

  // ——— Tempo drives the echo and is remembered ———
  const syncTempo = () => {
    engine.setSound({ bpm: metronome.bpm });
    store.set('metroBpm', metronome.bpm);
    store.set('metroSig', metronome.timeSig);
  };
  metronome.on('change', syncTempo);
  syncTempo();

  if (engine.chain.analyser) visualizer.attachAnalyser(engine.chain.analyser);

  // ——— Arpeggiator ———
  const ARP_KEYS = ['arpOn', 'arpPattern', 'arpRate', 'arpOctaves', 'arpGate', 'arpSwing', 'arpLatch'];
  const syncArp = () =>
    arp.set({
      enabled: store.get('arpOn'),
      pattern: store.get('arpPattern'),
      rate: store.get('arpRate'),
      octaves: store.get('arpOctaves'),
      gate: store.get('arpGate'),
      swing: store.get('arpSwing'),
      latch: store.get('arpLatch'),
    });
  for (const k of ARP_KEYS) store.on(k, syncArp);
  store.on('arpOn', () => {
    perf.releaseAllHeld();
    app._syncTools();
  });
  syncArp();
  perf.on('arpnote', ({ keyMidi, time, dur, velocity }) => {
    const delay = Math.max(0, (time - engine.now) * 1000);
    setTimeout(() => {
      piano.press(keyMidi, 'arp');
      visualizer.noteOn(keyMidi, 'arp', velocity);
    }, delay);
    setTimeout(() => {
      piano.release(keyMidi, 'arp');
      visualizer.noteOff(keyMidi, 'arp');
    }, delay + dur * 1000);
  });

  // ——— Band ———
  band.styleId = store.get('bandStyle');
  band.variation = store.get('bandVariation');
  band.syncStart = store.get('bandSync');
  band.volume = store.get('bandVolume');
  store.on('bandStyle', (v) => band.setStyle(v).catch(() => toast('Could not load the band sounds', { error: true })));
  store.on('bandVariation', (v) => (band.variation = v));
  store.on('bandSync', (v) => (band.syncStart = v));
  store.on('bandVolume', (v) => (band.volume = v));
  app.setBandMode = async (on) => {
    perf.releaseAllHeld();
    band.enabled = on;
    if (on) {
      toast('Accompaniment on — play a chord with your left hand');
      try {
        await band.setStyle(store.get('bandStyle'), { applyTempo: !band.playing });
      } catch {
        toast('Could not load the band sounds', { error: true });
      }
      if (store.get('bandSync') && band.enabled) band.play();
    } else {
      band.stop(true);
    }
    updateSplitMarks();
    band.emit('state');
  };
  band.on('state', () => {
    app._syncTools();
    updateSplitMarks();
  });
  store.on('bandZone', updateSplitMarks);

  // ——— Layer and split sounds stay loaded ———
  const partPins = new Set();
  async function syncParts() {
    const need = new Set();
    if (store.get('layerOn')) need.add(store.get('layerInst'));
    if (store.get('splitOn')) need.add(store.get('splitInst'));
    for (const id of partPins) {
      if (!need.has(id) && !band.instrumentIds().includes(id)) engine.pinned.delete(id);
    }
    partPins.clear();
    for (const id of need) {
      partPins.add(id);
      engine.pinned.add(id);
      engine.load(id).catch(() => toast(`Couldn't load ${PRESET_BY_ID.get(id)?.label}`, { error: true }));
    }
    updateSplitMarks();
    app._syncTools();
  }
  for (const k of ['layerOn', 'layerInst', 'splitOn', 'splitInst', 'chordMode']) store.on(k, syncParts);
  store.on('splitPoint', updateSplitMarks);
  syncParts();

  function updateSplitMarks() {
    const zone = store.get('splitOn') || (band.enabled && store.get('bandZone') === 'left');
    piano.setSplit(zone ? store.get('splitPoint') : null);
  }

  // ——— Chord names ———
  const cd = $('#chord-display');
  const cdName = $('#cd-name');
  const cdLabel = $('#cd-label');
  let cdTimer = null;
  const hideChord = (ms) => {
    clearTimeout(cdTimer);
    cdTimer = setTimeout(() => cd.classList.remove('show'), ms);
  };
  perf.on('chord', ({ display, band: forBand }) => {
    if (band.enabled && forBand?.intervals) band.setChord(forBand);
    if (!store.get('showChords') || app.songPlayer?.song) return cd.classList.remove('show');
    if (!display || (!display.type && display.label === 'Note')) return hideChord(700);
    clearTimeout(cdTimer);
    cdName.textContent = display.name;
    cdLabel.textContent = display.label || '';
    cd.classList.add('show');
  });
  band.on('chord', (c) => {
    if (!store.get('showChords') || perf.held.size) return;
    cdName.textContent = c.name;
    cdLabel.textContent = 'Band';
    cd.classList.add('show');
    hideChord(1800);
  });
  app.flashChordName = (name) => {
    cdName.textContent = name;
    cdLabel.textContent = '';
    cd.classList.add('show');
    hideChord(1600);
  };

  // ——— Learning marks on the keys ———
  let learnMarks = null;
  const refreshMarks = () => {
    if (learnMarks) return piano.setMarks(learnMarks);
    if (!store.get('showScale')) return piano.setMarks(null);
    const root = store.get('theoryRoot');
    const scale = store.get('theoryScale');
    const marks = new Map();
    for (let m = 21; m <= 108; m++) if (inScale(m, root, scale)) marks.set(m, m % 12 === root ? 'root' : 'scale');
    piano.setMarks(marks);
  };
  app.setLearnMarks = (map) => {
    learnMarks = map;
    refreshMarks();
  };
  for (const k of ['showScale', 'theoryRoot', 'theoryScale']) store.on(k, refreshMarks);
  refreshMarks();

  // ——— Pitch and modulation wheels ———
  const wheels = $('#wheels');
  const setWheelsVisible = () => (wheels.hidden = !store.get('showWheels'));
  store.on('showWheels', setWheelsVisible);
  setWheelsVisible();
  const pitch = makeWheel($('#wheel-pitch'), { spring: true, onChange: (v) => engine.setBend(v) });
  const mod = makeWheel($('#wheel-mod'), { spring: false, onChange: (v) => engine.setMod(v) });
  app.midi.on('bend', (v) => {
    engine.setBend(v);
    pitch.show(v);
  });
  app.midi.on('mod', (v) => {
    engine.setMod(v);
    mod.show(v);
  });

  // ——— Memory slots ———
  app.storeMemory = (i) => {
    const snap = {};
    for (const k of MEMORY_KEYS) snap[k] = store.get(k);
    const mem = [...store.get('memory')];
    mem[i] = snap;
    store.set('memory', mem);
    toast(`Saved to memory ${i + 1}`);
  };
  app.recallMemory = (i) => {
    const m = store.get('memory')[i];
    if (!m) return toast(`Memory ${i + 1} is empty — store a setup first`);
    const { instrument, ...rest } = m;
    perf.releaseAllHeld();
    store.update(rest);
    if (instrument) app.selectInstrument(instrument);
    toast(`Memory ${i + 1}: ${memoryTitle(m)}`);
  };
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || !/^Digit[1-8]$/.test(e.code)) return;
    e.preventDefault();
    const i = Number(e.code.slice(5)) - 1;
    if (e.shiftKey) app.storeMemory(i);
    else app.recallMemory(i);
  }, true);

  // ——— Beat flash ———
  const flash = $('#beat-flash');
  metronome.on('beat', ({ accent }) => {
    if (!store.get('beatFlash')) return;
    flash.classList.remove('go', 'accent');
    void flash.offsetWidth;
    flash.classList.add('go');
    if (accent) flash.classList.add('accent');
  });

  // ——— Practice statistics ———
  perf.on('down', ({ sounding }) => stats.note(sounding, engine.currentId));
  stats.on('change', () => app._renderStatus?.());
  app.songPlayer.on('result', ({ song, score }) => stats.songResult(song.id, song.title, score));
  app.showStats = () => showStats(app);

  app.openStudio = (tab) => {
    app.openDrawer('studio');
    app.panels.get('studio').select?.(tab);
  };

  // ——— Command palette ———
  app.palette = createPalette(app, () => {
    const items = [];
    const add = (kind, title, iconName, run, hint = '', keywords = '') => items.push({ kind, title, icon: iconName, run, hint, keywords });
    const open = (id, label, iconName, keywords) => add('Panel', `Open ${label}`, iconName, () => app.openDrawer(id), '', keywords);
    open('songs', 'Songs', 'songs', 'library play along practice');
    open('sounds', 'Sounds', 'sounds', 'instruments');
    open('studio', 'Studio', 'studio', 'effects layer split arpeggiator band memory');
    open('learn', 'Learn', 'learn', 'scales ragas chords ear training');
    open('settings', 'Settings', 'settings', 'options preferences');
    open('recorder', 'Recorder', 'recorder', 'record mp3 export');
    open('metronome', 'Metronome', 'metronome', 'tempo bpm click');
    add('Action', metronome.running ? 'Stop the metronome' : 'Start the metronome', 'metronome', () => metronome.toggle(), `${metronome.bpm} BPM`, 'click tempo');
    add('Action', band.enabled ? 'Turn accompaniment off' : 'Turn accompaniment on', 'band', () => app.setBandMode(!band.enabled), '', 'band drums bass auto');
    add('Action', store.get('arpOn') ? 'Turn the arpeggiator off' : 'Turn the arpeggiator on', 'music', () => store.set('arpOn', !store.get('arpOn')), '', 'arp');
    add('Action', store.get('layerOn') ? 'Remove the layer sound' : 'Layer a second sound', 'sounds', () => {
      store.set('layerOn', !store.get('layerOn'));
      app.openStudio('layers');
    }, '', 'dual');
    add('Action', store.get('splitOn') ? 'Turn the split off' : 'Split the keyboard', 'piano', () => {
      store.set('splitOn', !store.get('splitOn'));
      app.openStudio('layers');
    }, '', 'left hand bass');
    add('Action', 'Toggle the sustain pedal', 'sustain', () => perf.toggleSustain(), 'Space', 'pedal');
    add('Action', 'Open the notepad', 'notepad', () => app.toggleNotepad(true), '', 'paste play script');
    add('Action', 'Ear training', 'learn', () => {
      app.openDrawer('learn');
      app.panels.get('learn').select?.('ear');
    }, '', 'quiz game interval');
    add('Action', 'Record a video', 'video', () => app.openDrawer('recorder'), '', 'screen capture share');
    add('Action', 'Practice statistics', 'stats', () => app.showStats(), '', 'streak minutes progress');
    add('Action', 'Shortcuts and help', 'help', () => app.showHelp(), '', 'keys keyboard');
    for (const [name, patch] of FX_PRESETS) add('Effects', name, 'sparkle', () => (store.update(patch), toast(`Effects: ${name}`)), '', 'reverb preset');
    for (const st of STYLES) {
      add('Band style', st.name, 'band', () => {
        store.set('bandStyle', st.id);
        if (!band.enabled) app.setBandMode(true);
        app.openStudio('band');
      }, `${st.bpm} BPM`, 'rhythm accompaniment');
    }
    for (const [id, label] of THEMES) add('Theme', label, 'sparkle', () => store.set('theme', id), '', 'look colour');
    for (const a of ACCENTS) add('Accent colour', a[0].toUpperCase() + a.slice(1), 'sparkle', () => store.set('accent', a), '', 'color');
    for (const [id, label] of VIZ_STYLES) add('Light show', label, 'wave', () => (store.set('visualizer', true), store.set('vizStyle', id)), '', 'visualizer');
    store.get('memory').forEach((m, i) => m && add('Memory', `Recall ${i + 1}: ${memoryTitle(m)}`, 'studio', () => app.recallMemory(i), `Ctrl+${i + 1}`));
    for (const p of PRESETS) items.push(soundItem(p, (id) => app.selectInstrument(id)));
    for (const song of SONGS) add('Song', song.title, 'songs', () => app.openSong(song), song.composer, song.genre);
    return items;
  });
}

/** A spring-loaded (pitch) or free (mod) wheel controlled by dragging. */
function makeWheel(el, { spring, onChange }) {
  const knob = el.querySelector('span');
  let value = 0;
  const show = (v) => {
    value = v;
    const pos = spring ? 0.5 - v / 2 : 1 - v;
    knob.style.top = `${clamp(pos, 0, 1) * 100}%`;
    el.classList.toggle('active', Math.abs(v) > 0.01);
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const startY = e.clientY;
    const start = value;
    const move = (ev) => {
      const d = ((startY - ev.clientY) / rect.height) * (spring ? 2 : 1.2);
      const v = clamp(start + d, spring ? -1 : 0, 1);
      onChange(v);
      show(v);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (spring) {
        onChange(0);
        show(0);
      }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
  el.addEventListener('dblclick', () => {
    onChange(0);
    show(0);
  });
  show(0);
  return { show };
}
