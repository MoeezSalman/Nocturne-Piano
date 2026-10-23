// Studio: layer and split sounds, effects rack, arpeggiator, chord modes, the band and memory slots.
import { h } from '../util.js';
import { icon } from './icons.js';
import { segmented, stepper, toggle, slider, row, card, switchCard, tabs, presetSelect, selectBox } from './controls.js';
import { PRESETS, PRESET_BY_ID } from '../instruments.js';
import { ROOMS, DELAY_DIVS } from '../fx.js';
import { ARP_PATTERNS, ARP_RATES } from '../arpeggiator.js';
import { STYLES } from '../band.js';
import { ROOT_NAMES, SCALES } from '../theory.js';
import { noteName } from '../notes.js';
import { toast } from './feedback.js';

const FX_KEYS = ['room', 'reverbOn', 'reverbWet', 'toneOn', 'toneHz', 'eqOn', 'eqLow', 'eqMid', 'eqHigh', 'driveOn', 'drive', 'chorusOn', 'chorusDepth', 'chorusRate', 'tremoloOn', 'tremoloMode', 'tremoloRate', 'tremoloDepth', 'delayOn', 'delayDiv', 'delayFeedback', 'delayMix', 'limiterOn'];
export const MEMORY_KEYS = ['instrument', 'layerOn', 'layerInst', 'layerOctave', 'layerVolume', 'splitOn', 'splitPoint', 'splitInst', 'splitOctave', 'splitVolume', 'transpose', 'octaveShift', 'chordMode', 'arpOn', 'arpPattern', 'arpRate', 'arpOctaves', 'arpGate', 'arpSwing', 'arpLatch', 'arpZone', 'bandStyle', 'sustain', 'sustainMode', ...FX_KEYS];

const OFF = { eqOn: false, driveOn: false, chorusOn: false, tremoloOn: false, delayOn: false, limiterOn: false };
export const FX_PRESETS = [
  ['Original', { ...OFF, room: 'original', reverbOn: true, reverbWet: 0.15, toneOn: true, toneHz: 5500, eqLow: 0, eqMid: 0, eqHigh: 0 }],
  ['Concert hall', { ...OFF, room: 'hall', reverbOn: true, reverbWet: 0.28, toneOn: true, toneHz: 7000 }],
  ['Cathedral', { ...OFF, room: 'cathedral', reverbOn: true, reverbWet: 0.36, toneOn: true, toneHz: 6000, eqOn: true, eqLow: 2, eqMid: 0, eqHigh: -1 }],
  ['Lo-fi tape', { ...OFF, room: 'room', reverbOn: true, reverbWet: 0.2, toneOn: true, toneHz: 3200, chorusOn: true, chorusDepth: 0.7, chorusRate: 0.45, driveOn: true, drive: 0.15, eqOn: true, eqLow: 3, eqMid: 0, eqHigh: -6 }],
  ['Dreamy', { ...OFF, room: 'space', reverbOn: true, reverbWet: 0.4, toneOn: true, toneHz: 8000, chorusOn: true, chorusDepth: 0.6, chorusRate: 0.7, delayOn: true, delayDiv: '1/8.', delayFeedback: 0.45, delayMix: 0.3 }],
  ['Stadium', { ...OFF, room: 'hall', reverbOn: true, reverbWet: 0.3, toneOn: false, delayOn: true, delayDiv: '1/4', delayFeedback: 0.3, delayMix: 0.18, limiterOn: true, eqOn: true, eqLow: 3, eqMid: 0, eqHigh: 2 }],
  ['Vintage keys', { ...OFF, room: 'room', reverbOn: true, reverbWet: 0.2, toneOn: true, toneHz: 6000, tremoloOn: true, tremoloMode: 'pan', tremoloRate: 4, tremoloDepth: 0.6, chorusOn: true, chorusDepth: 0.4, chorusRate: 0.8, driveOn: true, drive: 0.2 }],
  ['Rock amp', { ...OFF, room: 'room', reverbOn: true, reverbWet: 0.18, toneOn: true, toneHz: 9000, driveOn: true, drive: 0.7, eqOn: true, eqLow: 1, eqMid: 4, eqHigh: 2, limiterOn: true }],
];

const OCTAVE_FMT = (v) => (v > 0 ? `+${v} oct` : v < 0 ? `${v} oct` : '0 oct');
const pct = (v) => `${Math.round(v * 100)}%`;

export function createStudioPanel(app) {
  const { store, performance: perf, band, arp } = app;
  const s = (k) => store.get(k);
  const syncers = [];
  const bind = (key, ctrl, map = (v) => v) => {
    syncers.push(() => ctrl.set(map(s(key))));
    return ctrl.el;
  };

  // ——— Layer & split ———
  const layer = switchCard('Layer', 'sounds', s('layerOn'), (v) => store.set('layerOn', v),
    h('p.hint', {}, 'Play a second sound together with your main sound, like piano with strings.'),
    row('Sound', bind('layerInst', presetSelect(PRESETS, s('layerInst'), (v) => store.set('layerInst', v)))),
    row('Octave', bind('layerOctave', stepper(s('layerOctave'), OCTAVE_FMT, (d) => store.set('layerOctave', Math.max(-2, Math.min(2, s('layerOctave') + d)))))),
    row('Level', bind('layerVolume', slider({ min: 0, max: 1.2, step: 0.01, value: s('layerVolume'), format: pct, onInput: (v) => store.set('layerVolume', v) }))),
  );
  syncers.push(() => layer.set(s('layerOn')));

  const splitLabel = h('b.split-note');
  const setByKey = h('button.btn.small', {
    onclick: () => {
      setByKey.textContent = 'Press a key…';
      perf.captureNext = (midi) => {
        store.set('splitPoint', midi);
        setByKey.textContent = 'Set by key';
      };
    },
  }, 'Set by key');
  const split = switchCard('Split', 'piano', s('splitOn'), (v) => store.set('splitOn', v),
    h('p.hint', {}, 'Give your left hand its own sound — bass on the left, piano on the right.'),
    row('Split point', h('div.inline', {}, bind('splitPoint', stepper(s('splitPoint'), (v) => noteName(v), (d) => store.set('splitPoint', Math.max(28, Math.min(96, s('splitPoint') + d))))), setByKey)),
    row('Left sound', bind('splitInst', presetSelect(PRESETS, s('splitInst'), (v) => store.set('splitInst', v)))),
    row('Octave', bind('splitOctave', stepper(s('splitOctave'), OCTAVE_FMT, (d) => store.set('splitOctave', Math.max(-2, Math.min(2, s('splitOctave') + d)))))),
    row('Level', bind('splitVolume', slider({ min: 0, max: 1.2, step: 0.01, value: s('splitVolume'), format: pct, onInput: (v) => store.set('splitVolume', v) }))),
  );
  syncers.push(() => {
    split.set(s('splitOn'));
    splitLabel.textContent = noteName(s('splitPoint'));
  });

  const wheels = card('Wheels & touch', 'wave',
    row('Pitch bend range', bind('bendRange', segmented([[1, '±1'], [2, '±2'], [7, '±7'], [12, '±12']], s('bendRange'), (v) => store.set('bendRange', v)))),
    row('Show wheels', bind('showWheels', toggle(s('showWheels'), (v) => store.set('showWheels', v)))),
    row('Touch sensitivity', bind('velocity', toggle(s('velocity'), (v) => store.set('velocity', v))), 'Louder when you play harder (MIDI) or lower on a key'),
  );

  const layersPage = h('div.studio-grid', {}, layer.el, split.el, wheels);

  // ——— Effects ———
  const presetRow = h('div.chip-row.fx-presets');
  FX_PRESETS.forEach(([name, patch]) => presetRow.append(h('button.pill', { onclick: () => (store.update(patch), toast(`Effects: ${name}`)) }, name)));
  const fxCard = (title, iconName, key, ...children) => {
    const c = switchCard(title, iconName, s(key), (v) => store.set(key, v), ...children);
    syncers.push(() => c.set(s(key)));
    return c.el;
  };
  const sl = (key, opts) => bind(key, slider({ ...opts, value: s(key), onInput: (v) => store.set(key, v) }));
  const db = (v) => `${v > 0 ? '+' : ''}${v} dB`;
  const effectsPage = h('div', {},
    h('div.fx-preset-bar', {}, h('span.muted', {}, 'Presets'), presetRow),
    h('div.studio-grid', {},
      fxCard('Room reverb', 'sparkle', 'reverbOn',
        row('Room', bind('room', selectBox(Object.entries(ROOMS).map(([id, r]) => [id, r.label]), s('room'), (v) => store.set('room', v)))),
        row('Amount', sl('reverbWet', { min: 0, max: 0.6, step: 0.01, format: (v) => `${Math.round((v / 0.15) * 100)}%` }), '100% = original'),
      ),
      fxCard('Equalizer', 'settings', 'eqOn',
        row('Bass', sl('eqLow', { min: -12, max: 12, step: 1, format: db })),
        row('Middle', sl('eqMid', { min: -12, max: 12, step: 1, format: db })),
        row('Treble', sl('eqHigh', { min: -12, max: 12, step: 1, format: db })),
      ),
      fxCard('Echo', 'restart', 'delayOn',
        row('Time', bind('delayDiv', segmented(Object.keys(DELAY_DIVS).map((k) => [k, k]), s('delayDiv'), (v) => store.set('delayDiv', v))), 'Follows the metronome tempo'),
        row('Repeats', sl('delayFeedback', { min: 0, max: 0.85, step: 0.01, format: pct })),
        row('Mix', sl('delayMix', { min: 0, max: 0.8, step: 0.01, format: pct })),
      ),
      fxCard('Chorus', 'wave', 'chorusOn',
        row('Depth', sl('chorusDepth', { min: 0, max: 1, step: 0.01, format: pct })),
        row('Speed', sl('chorusRate', { min: 0.1, max: 4, step: 0.05, format: (v) => `${v.toFixed(2)} Hz` })),
      ),
      fxCard('Tremolo / auto-pan', 'sounds', 'tremoloOn',
        row('Mode', bind('tremoloMode', segmented([['volume', 'Tremolo'], ['pan', 'Auto-pan']], s('tremoloMode'), (v) => store.set('tremoloMode', v)))),
        row('Speed', sl('tremoloRate', { min: 0.5, max: 12, step: 0.1, format: (v) => `${v.toFixed(1)} Hz` })),
        row('Depth', sl('tremoloDepth', { min: 0, max: 1, step: 0.01, format: pct })),
      ),
      fxCard('Drive', 'sparkle', 'driveOn', row('Amount', sl('drive', { min: 0, max: 1, step: 0.01, format: pct }))),
      fxCard('Warm tone filter', 'wave', 'toneOn', row('Cutoff', sl('toneHz', { min: 1200, max: 16000, step: 100, format: (v) => `${(v / 1000).toFixed(1)}k` })), 'Original is 5.5k'),
      fxCard('Limiter', 'sustain', 'limiterOn', h('p.hint', {}, 'Keeps loud chords, layers and the band from clipping.')),
    ),
  );

  // ——— Arpeggiator & chords ———
  const arpCard = switchCard('Arpeggiator', 'music', s('arpOn'), (v) => store.set('arpOn', v),
    h('p.hint', {}, 'Hold a chord and it plays as a pattern, in time with the metronome tempo.'),
    row('Pattern', bind('arpPattern', selectBox(ARP_PATTERNS, s('arpPattern'), (v) => store.set('arpPattern', v)))),
    row('Rate', bind('arpRate', segmented(ARP_RATES.map(([id]) => [id, id]), s('arpRate'), (v) => store.set('arpRate', v)))),
    row('Octaves', bind('arpOctaves', stepper(s('arpOctaves'), (v) => `${v}`, (d) => store.set('arpOctaves', Math.max(1, Math.min(4, s('arpOctaves') + d)))))),
    row('Gate', sl('arpGate', { min: 0.1, max: 1, step: 0.01, format: pct })),
    row('Swing', sl('arpSwing', { min: 0, max: 0.6, step: 0.01, format: pct })),
    row('Latch', bind('arpLatch', toggle(s('arpLatch'), (v) => store.set('arpLatch', v))), 'Keeps playing after you let go'),
    row('Keys', bind('arpZone', segmented([['right', 'Right of split'], ['all', 'Whole keyboard']], s('arpZone'), (v) => store.set('arpZone', v)))),
  );
  syncers.push(() => arpCard.set(s('arpOn')));

  const keySel = () => selectBox(ROOT_NAMES.map((n, i) => [i, n]), s('theoryRoot'), (v) => store.set('theoryRoot', Number(v)));
  const scaleSel = () => selectBox(SCALES.map((x) => [x.id, x.label]), s('theoryScale'), (v) => store.set('theoryScale', v));
  const chordCard = card('Chord modes', 'piano',
    h('p.hint', {}, 'One finger plays a whole chord. Smart mode picks the right chord for each note of your key.'),
    row('One-finger chord', bind('chordMode', selectBox([['off', 'Off'], ['maj', 'Major'], ['min', 'Minor'], ['7', 'Seventh'], ['maj7', 'Major 7th'], ['m7', 'Minor 7th'], ['sus4', 'Sus 4'], ['5', 'Power chord'], ['smart', 'Smart (in key)']], s('chordMode'), (v) => store.set('chordMode', v)))),
    row('Key', h('div.inline', {}, bind('theoryRoot', keySel(), String), bind('theoryScale', scaleSel()))),
    row('Scale lock', bind('scaleLock', toggle(s('scaleLock'), (v) => store.set('scaleLock', v))), 'Wrong notes slide to the nearest note of the key'),
    row('Show scale on keys', bind('showScale', toggle(s('showScale'), (v) => store.set('showScale', v)))),
  );
  const arpPage = h('div.studio-grid', {}, arpCard.el, chordCard);

  // ——— Band ———
  const styleGrid = h('div.style-grid');
  const renderStyles = () => {
    styleGrid.textContent = '';
    for (const st of STYLES) {
      styleGrid.append(
        h(`button.style-card${s('bandStyle') === st.id ? '.on' : ''}`, { onclick: () => store.set('bandStyle', st.id) },
          h('b', {}, st.name),
          h('span', {}, `${st.bpm} BPM · ${st.sig}`),
        ),
      );
    }
  };
  syncers.push(renderStyles);
  const bandPlay = h('button.btn.primary.big', { onclick: () => (band.playing || band.armed ? band.stop() : band.play()) });
  const bandFill = h('button.btn', { onclick: () => band.fill(), html: `${icon('sparkle')}Fill` });
  const bandBeats = h('div.beats');
  const bandChord = h('div.band-chord', {}, '—');
  const bandStatus = h('div.rec-status');
  const enableBand = toggle(band.enabled, (v) => app.setBandMode(v), 'Accompaniment');
  const bandPage = h('div', {},
    h('div.band-top', {},
      h('div.band-power', {}, enableBand.el, h('span', {}, 'Accompaniment')),
      bandPlay,
      bandFill,
      bind('bandVariation', segmented([['A', 'Variation A'], ['B', 'Variation B']], s('bandVariation'), (v) => store.set('bandVariation', v))),
      h('div.band-display', {}, bandChord, bandBeats, bandStatus),
    ),
    h('p.hint', { style: { margin: '10px 0' } }, 'Turn on Accompaniment, play a chord with your left hand (below the split) and the band follows. One key = major chord; add the minor third for minor.'),
    styleGrid,
    h('div.studio-grid', { style: { marginTop: '14px' } },
      card('Band options', 'settings',
        row('Sync start', bind('bandSync', toggle(s('bandSync'), (v) => store.set('bandSync', v))), 'Starts with your first chord'),
        row('Chord keys', bind('bandZone', segmented([['left', 'Left hand'], ['all', 'Whole keyboard']], s('bandZone'), (v) => store.set('bandZone', v)))),
        row('Left hand sounds', bind('bandLeftSound', toggle(s('bandLeftSound'), (v) => store.set('bandLeftSound', v))), 'Also hear the chord you hold'),
        row('Split point', h('div.inline', {}, splitLabel, h('span.muted', {}, 'set it in Layer & split'))),
        row('Band volume', sl('bandVolume', { min: 0, max: 1.2, step: 0.01, format: pct })),
        row('Tempo', h('div.inline', {}, h('button.btn.small', { onclick: () => app.metronome.setBpm(app.metronome.bpm - 4) }, '−'), h('b.tempo-readout'), h('button.btn.small', { onclick: () => app.metronome.setBpm(app.metronome.bpm + 4) }, '+'))),
      ),
    ),
  );
  const syncBand = () => {
    enableBand.set(band.enabled);
    bandPlay.innerHTML = band.playing ? `${icon('stop')}${band.ending ? 'Ending…' : 'Stop'}` : band.armed ? `${icon('stop')}Waiting for chord…` : `${icon('play')}Start band`;
    bandStatus.textContent = band.playing ? (band.ending ? 'Ending' : 'Playing') : band.armed ? 'Armed' : band.enabled ? 'Ready' : 'Off';
    bandStatus.className = `rec-status${band.playing ? ' ready' : ''}`;
    if (bandBeats.children.length !== app.metronome.beatsPerBar) {
      bandBeats.textContent = '';
      for (let i = 0; i < app.metronome.beatsPerBar; i++) bandBeats.append(h(`i${i === 0 ? '.accent' : ''}`));
    }
    el.querySelectorAll('.tempo-readout').forEach((t) => (t.textContent = `${app.metronome.bpm} BPM`));
  };
  band.on('state', syncBand);
  band.on('chord', (c) => (bandChord.textContent = c.name));
  app.metronome.on('change', syncBand);
  app.transport.on('tick', ({ sub, beatInBar, time }) => {
    if (sub !== 0 || !band.playing) return;
    setTimeout(() => [...bandBeats.children].forEach((b, i) => b.classList.toggle('hit', i === beatInBar)), Math.max(0, (time - app.engine.now) * 1000));
  });

  // ——— Memory ———
  const memGrid = h('div.memory-grid');
  const renderMemory = () => {
    memGrid.textContent = '';
    const slots = s('memory');
    for (let i = 0; i < 8; i++) {
      const m = slots[i];
      memGrid.append(
        h(`div.memory-slot${m ? '' : '.empty'}`, {},
          h('div.slot-num', {}, String(i + 1)),
          h('div.slot-text', {}, h('b', {}, m ? memoryTitle(m) : 'Empty'), h('span', {}, m ? memorySub(m) : 'Store your current setup here')),
          h('div.slot-actions', {},
            m ? h('button.btn.small.primary', { onclick: () => app.recallMemory(i) }, 'Recall') : null,
            h('button.btn.small', { onclick: () => app.storeMemory(i) }, m ? 'Replace' : 'Store'),
          ),
        ),
      );
    }
  };
  syncers.push(renderMemory);
  const memoryPage = h('div', {}, h('p.hint', { style: { marginBottom: '12px' } }, 'Each slot saves your sound, layer, split, effects, arpeggiator, chord mode and band style. Shortcuts: Ctrl+1…8 to recall, Ctrl+Shift+1…8 to store.'), memGrid);

  const t = tabs([
    ['layers', 'Layer & split', layersPage],
    ['fx', 'Effects', effectsPage],
    ['arp', 'Arpeggiator & chords', arpPage],
    ['band', 'Band', bandPage],
    ['memory', 'Memory', memoryPage],
  ], 'layers');

  const el = h('div', {},
    h('div.panel-head', {},
      h('div', {}, h('div.panel-title', {}, 'Studio'), h('div.panel-sub', {}, 'Shape your sound, add a band and save your setups')),
      h('div.spacer'),
      t.strip,
    ),
    t.body,
  );

  const sync = () => {
    for (const f of syncers) f();
    syncBand();
  };
  store.on('*', sync);
  sync();
  return { el, onOpen: sync, select: t.select };
}

export function memoryTitle(m) {
  const main = PRESET_BY_ID.get(m.instrument)?.short || 'Piano';
  const layer = m.layerOn ? ` + ${PRESET_BY_ID.get(m.layerInst)?.short || ''}` : '';
  const split = m.splitOn ? ` | ${PRESET_BY_ID.get(m.splitInst)?.short || ''}` : '';
  return `${main}${layer}${split}`;
}

export function memorySub(m) {
  const bits = [ROOMS[m.room]?.label || 'Original'];
  if (m.arpOn) bits.push(`Arp ${m.arpPattern}`);
  if (m.chordMode && m.chordMode !== 'off') bits.push('Chords');
  if (m.transpose) bits.push(`Transpose ${m.transpose > 0 ? '+' : ''}${m.transpose}`);
  return bits.join(' · ');
}

