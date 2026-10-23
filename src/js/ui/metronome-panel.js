import { h } from '../util.js';
import { icon } from './icons.js';
import { toggle, stepper, slider, segmented } from './controls.js';
import { TIME_SIGNATURES, METRO_SOUNDS, BPM_MIN, BPM_MAX, SUBDIVISIONS } from '../metronome.js';

const TEMPO_NAMES = [
  [40, 'Grave'], [60, 'Largo'], [66, 'Larghetto'], [76, 'Adagio'], [108, 'Andante'], [121, 'Moderato'],
  [168, 'Allegro'], [176, 'Vivace'], [200, 'Presto'], [Infinity, 'Prestissimo'],
];
const tempoName = (bpm) => TEMPO_NAMES.find(([max]) => bpm < max)[1];

export function createMetronomePanel(app) {
  const { store, metronome } = app;

  const power = toggle(metronome.running, (v) => (v ? metronome.start() : metronome.stop()), 'Metronome');
  const powerLabel = h('span.label');
  const bpmNum = h('div.num');
  const bpmName = h('div.tempo-name');
  const setBpm = (v) => {
    metronome.setBpm(v);
    store.set('metroBpm', metronome.bpm);
  };
  const bpmSlider = slider({ min: BPM_MIN, max: BPM_MAX, step: 1, value: metronome.bpm, format: () => '', onInput: setBpm });
  bpmSlider.el.style.width = '220px';
  bpmSlider.el.querySelector('output').remove();

  let taps = [];
  const tap = h('button.btn', {
    onclick: () => {
      const now = performance.now();
      taps = taps.filter((t) => now - t < 2500);
      taps.push(now);
      if (taps.length >= 2) {
        const gaps = taps.slice(1).map((t, i) => t - taps[i]);
        setBpm(Math.round(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length)));
      }
    },
    html: `${icon('tap')}Tap`,
  });

  const sig = stepper(metronome.timeSig, (v) => v, (d) => {
    const i = TIME_SIGNATURES.indexOf(metronome.timeSig);
    const next = TIME_SIGNATURES[(i + d + TIME_SIGNATURES.length) % TIME_SIGNATURES.length];
    metronome.setTimeSig(next);
    store.set('metroSig', next);
  });
  const soundSel = h('select.select', { onchange: () => (metronome.setSound(soundSel.value), store.set('metroSound', soundSel.value)) },
    ...METRO_SOUNDS.map((s) => h('option', { value: s.id }, s.label)),
  );
  soundSel.value = metronome.sound;
  const vol = slider({ min: 0, max: 1.5, step: 0.01, value: store.get('metroVolume'), format: (v) => `${Math.round(v * 100)}%`, onInput: (v) => (metronome.setVolume(v), store.set('metroVolume', v)) });
  vol.el.style.width = '150px';

  const subSeg = segmented(SUBDIVISIONS.map(([n, label]) => [n, label]), store.get('metroSub'), (v) => {
    metronome.setSubdivision(v);
    store.set('metroSub', v);
    subSeg.set(v);
  });
  const accent = toggle(store.get('metroAccent'), (v) => {
    metronome.accent = v;
    store.set('metroAccent', v);
    accent.set(v);
  });
  const flash = toggle(store.get('beatFlash'), (v) => {
    store.set('beatFlash', v);
    flash.set(v);
  });
  const tr = metronome.trainer;
  const trainerOn = toggle(tr.on, (v) => {
    metronome.setTrainer({ on: v });
    trainerOn.set(v);
    if (v && !metronome.running) metronome.start();
  });
  const trainerStep = stepper(tr.step, (v) => `+${v}`, (d) => (metronome.setTrainer({ step: Math.max(1, Math.min(20, tr.step + d)) }), trainerStep.set(tr.step)));
  const trainerEvery = stepper(tr.every, (v) => `${v}`, (d) => (metronome.setTrainer({ every: Math.max(1, Math.min(16, tr.every + d)) }), trainerEvery.set(tr.every)));
  const trainerTarget = stepper(tr.target, (v) => `${v}`, (d) => (metronome.setTrainer({ target: Math.max(BPM_MIN, Math.min(BPM_MAX, tr.target + d * 5)) }), trainerTarget.set(tr.target)));

  const beats = h('div.beats');
  const arm = h('div.arm');
  const pendulum = h('div.pendulum', {}, h('div.base'), arm);

  const el = h('div', {},
    h('div.panel-head', {},
      h('div', {}, h('div.panel-title', {}, 'Metronome'), h('div.panel-sub', {}, 'Change tempo and time signature on the fly')),
    ),
    h('div.metro', {},
      h('div.metro-power', {}, power.el, powerLabel),
      pendulum,
      h('div.metro-block', {},
        h('div.label', {}, 'Tempo'),
        h('div.bpm-big', {},
          h('button.icon-btn', { html: icon('minus'), onclick: () => setBpm(metronome.bpm - 1), title: 'Slower' }),
          h('div', {}, bpmNum, h('div.unit', {}, 'BPM')),
          h('button.icon-btn', { html: icon('plus'), onclick: () => setBpm(metronome.bpm + 1), title: 'Faster' }),
        ),
        bpmName,
      ),
      h('div.metro-block', {}, h('div.label', {}, 'Fine tempo'), bpmSlider.el, h('div', { style: { display: 'flex', gap: '6px' } }, tap,
        h('button.btn', { onclick: () => setBpm(metronome.bpm - 10) }, '−10'),
        h('button.btn', { onclick: () => setBpm(metronome.bpm + 10) }, '+10'),
      )),
      h('div.metro-block', {}, h('div.label', {}, 'Time sig'), sig.el, beats),
      h('div.metro-block', {}, h('div.label', {}, 'Sound'), soundSel, vol.el),
    ),
    h('div.metro-extras', {},
      h('div.metro-block', {}, h('div.label', {}, 'Subdivide'), subSeg.el),
      h('div.metro-block', {}, h('div.label', {}, 'Accent beat 1'), accent.el),
      h('div.metro-block', {}, h('div.label', {}, 'Flash on beat'), flash.el),
      h('div.metro-block.trainer', {},
        h('div.label', {}, 'Speed trainer'),
        h('div.inline', {}, trainerOn.el,
          h('span.muted', {}, 'add'), trainerStep.el,
          h('span.muted', {}, 'BPM every'), trainerEvery.el,
          h('span.muted', {}, 'bars, up to'), trainerTarget.el),
      ),
    ),
  );

  const renderBeats = () => {
    beats.textContent = '';
    for (let i = 0; i < metronome.beatsPerBar; i++) beats.append(h(`i${i === 0 ? '.accent' : ''}`));
  };
  const sync = () => {
    power.set(metronome.running);
    powerLabel.textContent = metronome.running ? 'ON' : 'OFF';
    bpmNum.textContent = metronome.bpm;
    bpmName.textContent = tempoName(metronome.bpm);
    bpmSlider.set(metronome.bpm);
    sig.set(metronome.timeSig);
    if (beats.children.length !== metronome.beatsPerBar) renderBeats();
    if (!metronome.running) arm.style.transform = 'rotate(0deg)';
  };
  let swing = 1;
  metronome.on('change', sync);
  metronome.on('state', sync);
  metronome.on('beat', ({ beat }) => {
    [...beats.children].forEach((b, i) => b.classList.toggle('hit', i === beat));
    swing = -swing;
    arm.style.transition = `transform ${metronome.beatSeconds}s cubic-bezier(.45,0,.55,1)`;
    arm.style.transform = `rotate(${swing * 24}deg)`;
    setTimeout(() => beats.children[beat]?.classList.remove('hit'), Math.min(160, metronome.beatSeconds * 500));
  });
  renderBeats();
  sync();

  return { el, onOpen: sync };
}
