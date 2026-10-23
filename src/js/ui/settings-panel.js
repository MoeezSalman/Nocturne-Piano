import { h } from '../util.js';
import { icon } from './icons.js';
import { segmented, stepper, toggle, slider, row, card } from './controls.js';
import { LAYOUTS, toCustom } from '../keybinds.js';
import { LOWPASS_HZ, REVERB_WET } from '../audio-engine.js';
import { PRESETS, soundFiles } from '../instruments.js';
import { confirmDialog, toast } from './feedback.js';
import { VIZ_STYLES } from '../visualizer.js';

const ACCENTS = [
  ['gold', '#dcb46a', 'Gold'],
  ['teal', '#2fc2b0', 'Teal'],
  ['rose', '#f27596', 'Rose'],
  ['violet', '#a88dff', 'Violet'],
  ['ice', '#6cc8ff', 'Ice'],
  ['emerald', '#4fd494', 'Emerald'],
];

export function createSettingsPanel(app) {
  const { store, performance: perf, midi } = app;
  const s = (k) => store.get(k);

  // ——— PC keyboard ———
  const layoutHint = h('span.hint');
  const layoutSeg = segmented(
    Object.entries(LAYOUTS).map(([id, l]) => [id, l.name, l.hint]),
    s('keybinds'),
    (v) => {
      if (v === 'custom' && !Object.keys(s('customBindings')).length) store.set('customBindings', toCustom('real'));
      store.set('keybinds', v);
    },
  );
  const customTools = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '8px' } },
    h('button.btn.small', { onclick: () => perf.startBindEdit() }, 'Edit bindings'),
    h('button.btn.small.ghost', { onclick: () => store.set('customBindings', toCustom('real')) }, 'Copy Real'),
    h('button.btn.small.ghost', { onclick: () => store.set('customBindings', toCustom('full')) }, 'Copy Full'),
    h('button.btn.small.ghost', {
      onclick: async () => {
        if (await confirmDialog('Reset **all custom bindings**?', { ok: 'Reset', danger: true })) store.set('customBindings', {});
      },
    }, 'Start blank'),
  );
  const bindBanner = h('div.bind-banner', { hidden: true });
  perf.on('bind-edit', (st) => {
    bindBanner.hidden = !st;
    if (!st) return;
    bindBanner.textContent = '';
    bindBanner.append(
      h('span', { style: { flex: 1 } }, st.pending == null ? 'Click a piano key to rebind it' : 'Now press any keyboard key (Esc to cancel)'),
      h('button.btn.small.primary', { onclick: () => perf.stopBindEdit() }, 'Done'),
    );
  });
  perf.on('bind-reserved', () => toast('Space, arrows, [ ] and - = are reserved shortcuts'));

  // ——— View ———
  const labelsSeg = segmented([['off', 'Off'], ['cde', 'CDE'], ['solfege', 'Do Re Mi']], s('noteLabels'), (v) => store.set('noteLabels', v));
  const keysSeg = segmented([['focus', 'Focus'], ['max', 'Max']], s('visibleKeys'), (v) => store.set('visibleKeys', v));
  const colorSeg = segmented([['accent', 'Classic'], ['rainbow', 'Rainbow']], s('keyColor'), (v) => store.set('keyColor', v));

  // ——— Pitch ———
  const octave = stepper(s('octaveShift'), (v) => (v > 0 ? `+${v}` : `${v}`), (d) => perf.shiftOctave(d));
  const transpose = stepper(s('transpose'), (v) => (v > 0 ? `+${v}` : `${v}`), (d) => perf.shiftTranspose(d));
  const tuning = slider({
    min: -50, max: 50, step: 1, value: s('tuningCents'),
    format: (v) => `${(440 * 2 ** (v / 1200)).toFixed(1)}Hz`,
    onInput: (v) => store.set('tuningCents', v),
  });

  // ——— Sound ———
  const reverbOn = toggle(s('reverbOn'), (v) => store.set('reverbOn', v), 'Reverb');
  const reverbAmt = slider({ min: 0, max: 0.6, step: 0.01, value: s('reverbWet'), format: (v) => `${Math.round((v / REVERB_WET) * 100)}%`, onInput: (v) => store.set('reverbWet', v) });
  const toneOn = toggle(s('toneOn'), (v) => store.set('toneOn', v), 'Warm tone filter');
  const toneHz = slider({
    min: 0, max: 100, step: 1, value: hzToPos(s('toneHz')),
    format: (p) => `${(posToHz(p) / 1000).toFixed(1)}k`,
    onInput: (p) => store.set('toneHz', Math.round(posToHz(p))),
  });
  const sustainSeg = segmented([['full', 'Full pedal'], ['half', 'Half pedal'], ['off', 'Off']], sustainValue(), (v) => {
    if (v === 'off') perf.setSustain(false);
    else {
      store.set('sustainMode', v);
      perf.setSustain(true);
    }
  });
  const velocity = toggle(s('velocity'), (v) => store.set('velocity', v), 'Touch sensitivity');

  // ——— MIDI ———
  const midiSelect = h('select.select', { onchange: () => store.set('midiDevice', midiSelect.value) });
  const midiStatus = h('span.hint');
  const renderMidi = () => {
    const devices = midi.devices();
    midiSelect.textContent = '';
    midiSelect.append(h('option', { value: 'all' }, 'All devices'), h('option', { value: 'none' }, 'None'));
    for (const d of devices) midiSelect.append(h('option', { value: d.id }, d.name));
    midiSelect.value = [...midiSelect.options].some((o) => o.value === s('midiDevice')) ? s('midiDevice') : 'all';
    midiStatus.textContent = !midi.supported ? 'MIDI is not available' : devices.length ? `${devices.length} device${devices.length > 1 ? 's' : ''} connected` : 'Plug in a MIDI keyboard to play';
  };
  midi.on('devices', renderMidi);

  // ——— Appearance ———
  const swatches = h('div.swatches');
  const renderSwatches = () => {
    swatches.textContent = '';
    for (const [id, color, name] of ACCENTS) {
      swatches.append(h(`button.swatch${s('accent') === id ? '.on' : ''}`, { style: { background: color }, title: name, onclick: () => store.set('accent', id) }));
    }
  };
  const vizToggle = toggle(s('visualizer'), (v) => store.set('visualizer', v), 'Visualizer');
  const uiSounds = toggle(s('uiSounds'), (v) => store.set('uiSounds', v), 'Interface sounds');
  const themeSeg = segmented([['midnight', 'Midnight'], ['ivory', 'Ivory'], ['rosewood', 'Rosewood'], ['neon', 'Neon']], s('theme'), (v) => store.set('theme', v));
  const skinSeg = segmented([['classic', 'Classic'], ['vintage', 'Vintage'], ['ebony', 'Ebony'], ['glass', 'Glass']], s('keySkin'), (v) => store.set('keySkin', v));
  const vizSel = h('select.select', { onchange: () => store.set('vizStyle', vizSel.value) }, ...VIZ_STYLES.map(([id, label]) => h('option', { value: id }, label)));
  const heightSeg = segmented([['compact', 'Compact'], ['normal', 'Normal'], ['tall', 'Tall']], s('pianoHeight'), (v) => store.set('pianoHeight', v));
  const chordsToggle = toggle(s('showChords'), (v) => store.set('showChords', v), 'Chord names');

  // ——— Offline library ———
  const offlineText = h('span.hint');
  const offlineBar = h('div.progress', {}, h('span'));
  const dlBtn = h('button.btn.small.primary', { onclick: () => downloadAll() }, icon('download'), 'Download all');
  dlBtn.innerHTML = `${icon('download')}Download all`;
  let downloading = false;
  async function refreshOffline() {
    await app.soundsPanel.refreshCache();
    const total = PRESETS.filter((p) => p.src.type !== 'synth').length;
    const have = app.soundsPanel.availableCount();
    offlineText.textContent = window.native?.soundsHave ? `${have} of ${total} sampled instruments stored on this PC` : 'Sounds are cached as you use them';
    offlineBar.firstChild.style.width = `${(have / total) * 100}%`;
  }
  async function downloadAll() {
    if (downloading) return;
    downloading = true;
    dlBtn.disabled = true;
    const files = [...new Set(PRESETS.flatMap(soundFiles))];
    let done = 0;
    let failed = 0;
    const queue = [...files];
    const worker = async () => {
      while (queue.length) {
        const f = queue.shift();
        try {
          const r = await fetch(`sounds/${f}`);
          if (!r.ok) failed++;
          await r.arrayBuffer();
        } catch {
          failed++;
        }
        done++;
        offlineBar.firstChild.style.width = `${(done / files.length) * 100}%`;
        offlineText.textContent = `Downloading… ${done} / ${files.length} files`;
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    downloading = false;
    dlBtn.disabled = false;
    await refreshOffline();
    toast(failed ? `${failed} files could not be downloaded — check your internet and try again` : 'Every sound is now available offline', { error: !!failed });
  }

  const resetSound = h('button.btn.small', {
    onclick: () => {
      store.update({ reverbOn: true, reverbWet: REVERB_WET, toneOn: true, toneHz: LOWPASS_HZ, tuningCents: 0, velocity: false });
      toast('Sound reset to the original settings');
    },
  }, 'Reset to original');

  const el = h('div', {},
    h('div.panel-head', {},
      h('div', {}, h('div.panel-title', {}, 'Settings'), h('div.panel-sub', {}, 'Keyboard, labels, pitch, sound and more')),
      h('div.spacer'),
      h('button.btn.small', { onclick: () => app.showHelp() }, h('span', { html: icon('help') }), 'Shortcuts & credits'),
    ),
    h('div.settings-grid', {},
      card('PC keyboard', 'keyboard',
        row('Key binds', layoutSeg.el),
        h('div', { style: { paddingBottom: '4px' } }, layoutHint),
        customTools,
        bindBanner,
      ),
      card('Keyboard view', 'piano',
        row('Note labels', labelsSeg.el),
        row('Visible keys', keysSeg.el, 'Focus: 5 octaves · Max: all 88 keys'),
        row('Key glow', colorSeg.el),
      ),
      card('Pitch', 'music',
        row('Octave shift', octave.el, 'Also [ and ]'),
        row('Transpose', transpose.el, 'Semitones · also - and ='),
        row('Tuning (A4)', tuning.el),
      ),
      card('Sound', 'wave',
        row('Sustain pedal', sustainSeg.el, 'Space toggles it on and off'),
        row(h('span', {}, 'Reverb'), h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, reverbAmt.el, reverbOn.el)),
        row(h('span', {}, 'Warm tone filter'), h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, toneHz.el, toneOn.el)),
        row('Touch sensitivity', velocity.el, 'MIDI velocity and click position'),
        h('div', { style: { display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' } }, resetSound),
      ),
      card('MIDI keyboard', 'midi', row(h('span', {}, 'Input', h('br'), midiStatus), midiSelect)),
      card('Appearance', 'sparkle',
        row('Theme', themeSeg.el),
        row('Accent', swatches),
        row('Key style', skinSeg.el),
        row('Keyboard size', heightSeg.el),
        row('Light show', h('div.inline', {}, vizSel, vizToggle.el), 'Ribbons, spectrum, waveform, aurora or galaxy'),
        row('Chord names', chordsToggle.el, 'Shows the chord you play above the keys'),
        row('Interface sounds', uiSounds.el),
      ),
      card('Offline sounds', 'folder',
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
          offlineText,
          offlineBar,
          h('div', { style: { display: 'flex', gap: '6px' } }, dlBtn, window.native?.openSoundsFolder ? h('button.btn.small.ghost', { onclick: () => window.native.openSoundsFolder() }, 'Open folder') : null),
        ),
      ),
    ),
  );

  function sustainValue() {
    return s('sustain') ? s('sustainMode') : 'off';
  }

  const sync = () => {
    layoutSeg.set(s('keybinds'));
    layoutHint.textContent = LAYOUTS[s('keybinds')]?.hint || '';
    customTools.hidden = s('keybinds') !== 'custom';
    labelsSeg.set(s('noteLabels'));
    keysSeg.set(s('visibleKeys'));
    colorSeg.set(s('keyColor'));
    octave.set(s('octaveShift'));
    transpose.set(s('transpose'));
    tuning.set(s('tuningCents'));
    reverbOn.set(s('reverbOn'));
    reverbAmt.set(s('reverbWet'));
    toneOn.set(s('toneOn'));
    toneHz.set(hzToPos(s('toneHz')));
    sustainSeg.set(sustainValue());
    velocity.set(s('velocity'));
    vizToggle.set(s('visualizer'));
    uiSounds.set(s('uiSounds'));
    themeSeg.set(s('theme'));
    skinSeg.set(s('keySkin'));
    vizSel.value = s('vizStyle');
    heightSeg.set(s('pianoHeight'));
    chordsToggle.set(s('showChords'));
    renderSwatches();
  };
  store.on('*', sync);
  sync();
  renderMidi();

  return {
    el,
    onOpen() {
      sync();
      renderMidi();
      refreshOffline();
    },
  };
}

// Log scale for the tone filter: 1.2 kHz … 18 kHz.
const LO = Math.log(1200);
const HI = Math.log(18000);
const hzToPos = (hz) => ((Math.log(hz) - LO) / (HI - LO)) * 100;
const posToHz = (p) => Math.exp(LO + (p / 100) * (HI - LO));
