import { Emitter, h, $, pad3 } from './util.js';
import { store } from './store.js';
import { AudioEngine } from './audio-engine.js';
import { PRESETS, PRESET_BY_ID, DEFAULT_PRESET } from './instruments.js';
import { PianoView } from './piano-view.js';
import { Performance } from './performance.js';
import { Visualizer } from './visualizer.js';
import { Metronome, Transport, uiClick } from './metronome.js';
import { Arpeggiator } from './arpeggiator.js';
import { Band } from './band.js';
import { Stats } from './stats.js';
import { VideoRecorder } from './video.js';
import { installFeatures } from './features.js';
import { createStudioPanel } from './ui/studio-panel.js';
import { createLearnPanel } from './ui/learn-panel.js';
import { Recorder } from './recorder.js';
import { MidiInput } from './midi-io.js';
import { SongPlayer } from './song-player.js';
import { SONGS } from './songs-data.js';
import { LAYOUTS } from './keybinds.js';
import { icon } from './ui/icons.js';
import { toast, showModal } from './ui/feedback.js';
import { createSoundsPanel } from './ui/sounds-panel.js';
import { createSettingsPanel } from './ui/settings-panel.js';
import { createMetronomePanel } from './ui/metronome-panel.js';
import { createRecorderPanel } from './ui/recorder-panel.js';
import { createSongsPanel } from './ui/songs-panel.js';
import { createNotepad } from './ui/notepad-panel.js';

const TOOLS = [
  { id: 'songs', label: 'Songs', drawer: true },
  { id: 'sounds', label: 'Sounds', drawer: true },
  { id: 'studio', label: 'Studio', drawer: true },
  { id: 'sustain', label: 'Sustain' },
  { id: 'notepad', label: 'Notepad' },
  { id: 'learn', label: 'Learn', drawer: true },
  { id: 'settings', label: 'Settings', drawer: true },
  { id: 'recorder', label: 'Recorder', drawer: true },
  { id: 'metronome', label: 'Metronome', drawer: true, compact: true },
];

class App extends Emitter {
  constructor() {
    super();
    this.store = store;
    this.loadingId = null;
    this.requestedId = null;
    this.openId = null;
    this.drawers = new Map();
    this.panels = new Map();
    this.tools = new Map();
  }

  async init() {
    document.documentElement.dataset.accent = store.get('accent');
    if (window.native?.isDesktop) document.body.classList.add('desktop');

    this.engine = new AudioEngine(store.state);
    this.piano = new PianoView($('#keybed'));
    this.performance = new Performance(this.engine, this.piano, store);
    this.visualizer = new Visualizer($('#viz'), this.piano, $('#keybed'));
    this.transport = new Transport(this.engine.ctx);
    this.metronome = new Metronome(this.engine, this.transport, {
      bpm: store.get('metroBpm'),
      timeSig: store.get('metroSig'),
      sound: store.get('metroSound'),
      volume: store.get('metroVolume'),
      subdivision: store.get('metroSub'),
      accent: store.get('metroAccent'),
    });
    this.arp = new Arpeggiator(this.transport, () => {});
    this.performance.attachArp(this.arp);
    this.band = new Band(this.engine, this.transport, this.metronome);
    this.performance.attachBand(this.band);
    this.stats = new Stats();
    this.video = new VideoRecorder(this.engine);
    this.recorder = new Recorder(this.engine, this.metronome, this.piano);
    this.midi = new MidiInput();
    this.performance.attachMidi(this.midi);

    this._applyView();
    this._bindStore();
    const setStageH = () => document.documentElement.style.setProperty('--stage-h', `${$('#stage').clientHeight}px`);
    new ResizeObserver(setStageH).observe($('#stage'));
    window.addEventListener('resize', setStageH);
    setStageH();
    this._bindPlayVisuals();
    this._buildToolbar();
    this._buildTopActions();
    this._buildVolume();
    this._buildLcd();
    this._buildStatus();

    this.soundsPanel = createSoundsPanel(this);
    this.songsPanel = createSongsPanel(this);
    this._mountDrawer('sounds', this.soundsPanel);
    this._mountDrawer('songs', this.songsPanel);
    this._mountDrawer('settings', createSettingsPanel(this));
    this._mountDrawer('metronome', createMetronomePanel(this));
    this._mountDrawer('recorder', createRecorderPanel(this));
    this._mountDrawer('studio', createStudioPanel(this));
    installFeatures(this);
    this._mountDrawer('learn', createLearnPanel(this));
    this.notepad = createNotepad(this);
    this.songPlayer = new SongPlayer(this);
    this.songPlayer.on('open', () => this._syncHero());
    this.songPlayer.on('close', () => this._syncHero());

    this._bindKeys();
    this._syncHero();
    await this._loadFirstInstrument();
    this.midi.init().then(() => this.midi.select(store.get('midiDevice')));
  }

  // ——— Instruments ———
  async _loadFirstInstrument() {
    const bar = $('#loader-bar');
    const note = $('#loader-note');
    const want = PRESET_BY_ID.has(store.get('instrument')) ? store.get('instrument') : DEFAULT_PRESET;
    note.textContent = `Loading ${PRESET_BY_ID.get(want).label}…`;
    try {
      await this.engine.setInstrument(want, (p) => (bar.style.width = `${Math.round(p * 100)}%`));
      store.set('instrument', want);
    } catch (err) {
      console.warn(err);
      await this.engine.setInstrument('synth_fm_epiano');
      store.set('instrument', 'synth_fm_epiano');
      toast('Could not load the piano samples. Connect to the internet once to download them — using a built-in synth for now.', { error: true, ms: 7000 });
    }
    this._renderLcd();
    $('#loader').classList.add('done');
    setTimeout(() => $('#loader').remove(), 700);
  }

  async selectInstrument(id) {
    const preset = PRESET_BY_ID.get(id);
    if (!preset) return;
    this.requestedId = id;
    if (this.engine.currentId === id) return;
    this.loadingId = id;
    this.emit('loading', id);
    const bar = $('#lcd-load');
    this._renderLcd(id);
    try {
      await this.engine.load(id, (p) => this.requestedId === id && (bar.style.width = `${p * 100}%`));
      if (this.requestedId !== id) return;
      await this.engine.setInstrument(id);
      store.set('instrument', id);
    } catch (err) {
      console.warn(err);
      if (this.requestedId === id) {
        toast(`Couldn't load ${preset.label}. It downloads once — check your internet connection.`, { error: true, ms: 4500 });
        this._renderLcd();
      }
    } finally {
      if (this.loadingId === id) this.loadingId = null;
      if (this.requestedId === id) bar.style.width = '0';
      this.emit('loading', null);
    }
  }

  stepInstrument(d) {
    const cur = PRESETS.findIndex((p) => p.id === (this.requestedId || store.get('instrument')));
    const next = PRESETS[(cur + d + PRESETS.length) % PRESETS.length];
    this.selectInstrument(next.id);
  }

  // ——— Drawers & panels ———
  _mountDrawer(id, panel) {
    const tool = TOOLS.find((t) => t.id === id);
    const drawer = h(`section.drawer${tool?.compact ? '.compact' : ''}`, { hidden: true });
    drawer.append(panel.el);
    $('#drawers').append(drawer);
    this.drawers.set(id, drawer);
    this.panels.set(id, panel);
  }

  openDrawer(id) {
    if (this.openId === id) return;
    if (this.openId) {
      this.panels.get(this.openId).onClose?.();
      this.drawers.get(this.openId).hidden = true;
    }
    this.openId = id;
    this.drawers.get(id).hidden = false;
    this.panels.get(id).onOpen?.();
    this._click('open');
    this._syncTools();
  }

  closeDrawer() {
    if (!this.openId) return;
    this.panels.get(this.openId).onClose?.();
    this.drawers.get(this.openId).hidden = true;
    this.openId = null;
    this._click('close');
    this._syncTools();
  }

  toggleDrawer(id) {
    if (this.openId === id) this.closeDrawer();
    else this.openDrawer(id);
  }

  toggleNotepad(force) {
    const el = $('#notepad');
    const show = force ?? el.hidden;
    el.hidden = !show;
    if (!show) this.notepad.stop();
    this._click(show ? 'open' : 'close');
    this._syncTools();
    this._syncHero();
  }

  openSong(song) {
    this.closeDrawer();
    if (!$('#notepad').hidden) this.toggleNotepad(false);
    this.songPlayer.open(song);
  }

  _click(kind) {
    if (store.get('uiSounds')) uiClick(this.engine.ctx, this.engine.chain.output, kind);
  }

  // ——— Top bar ———
  _buildToolbar() {
    const bar = $('#toolbar');
    for (const t of TOOLS) {
      const led = h('span.led', { hidden: !['sustain', 'recorder', 'metronome', 'studio'].includes(t.id) });
      const btn = h('button.tool', { title: t.label, 'aria-label': t.label },
        h('span.tool-cap', { html: icon(t.id) }, led),
        h('span.tool-label', {}, t.label),
      );
      btn.querySelector('.tool-cap').append(led);
      btn.addEventListener('click', () => {
        if (t.id === 'sustain') this.performance.cycleSustain();
        else if (t.id === 'notepad') this.toggleNotepad();
        else this.toggleDrawer(t.id);
      });
      bar.append(btn);
      this.tools.set(t.id, { btn, led });
    }
    this.metronome.on('beat', ({ accent }) => {
      const { led } = this.tools.get('metronome');
      led.classList.add('beat');
      if (accent) led.style.background = '#fff';
      setTimeout(() => {
        led.classList.remove('beat');
        led.style.background = '';
      }, 90);
    });
    this.metronome.on('state', () => this._syncTools());
    this.recorder.on('state', () => this._syncTools());
    this._syncTools();
  }

  _syncTools() {
    for (const [id, { btn, led }] of this.tools) {
      let active = this.openId === id;
      if (id === 'notepad') active = !$('#notepad').hidden;
      if (id === 'sustain') {
        active = store.get('sustain');
        led.className = `led${store.get('sustain') ? (store.get('sustainMode') === 'half' ? ' half' : ' on') : ''}`;
        btn.title = store.get('sustain') ? (store.get('sustainMode') === 'half' ? 'Half pedal (click for off)' : 'Full pedal (click for half pedal)') : 'Sustain off (click for full pedal)';
      }
      if (id === 'metronome') led.className = `led${this.metronome.running ? ' on' : ''}`;
      if (id === 'studio') {
        const busy = this.band.playing || this.band.armed;
        const on = this.band.enabled || store.get('arpOn') || store.get('layerOn') || store.get('splitOn') || store.get('chordMode') !== 'off';
        led.className = `led${busy ? ' beat' : on ? ' on' : ''}`;
      }
      if (id === 'recorder') {
        const st = this.recorder.state;
        led.className = `led${st === 'recording' || st === 'countin' || st === 'armed' ? ' rec' : st === 'playing' ? ' on' : ''}`;
      }
      btn.classList.toggle('active', active);
    }
    this._renderStatus?.();
    this._renderFallboard?.();
  }

  _buildTopActions() {
    const wrap = $('#topbar-actions');
    const fs = h('button.icon-btn.ghost', { title: 'Full screen (F11)', html: icon('fullscreen') });
    fs.addEventListener('click', async () => {
      if (window.native?.toggleFullscreen) window.native.toggleFullscreen();
      else if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    });
    const setFs = (on) => (fs.innerHTML = icon(on ? 'exitFullscreen' : 'fullscreen'));
    window.native?.onFullscreen?.(setFs);
    document.addEventListener('fullscreenchange', () => setFs(!!document.fullscreenElement));
    wrap.append(
      h('button.icon-btn.ghost', { title: 'Search everything (Ctrl+K)', html: icon('search'), onclick: () => this.palette?.show() }),
      fs,
      h('button.icon-btn.ghost', { title: 'Shortcuts & help', html: icon('help'), onclick: () => this.showHelp() }),
    );
  }

  _buildVolume() {
    const el = $('#volume');
    const fill = $('#volume-fill');
    const value = $('#volume-value');
    const set = (v) => {
      v = Math.max(0, Math.min(1, v));
      store.set('volume', v);
    };
    const paint = () => {
      const v = store.get('volume');
      fill.style.height = `${v * 100}%`;
      value.textContent = Math.round(v * 100);
      el.setAttribute('aria-valuenow', Math.round(v * 100));
    };
    const fromY = (y) => {
      const r = el.querySelector('.volume-track').getBoundingClientRect();
      set(1 - (y - r.top) / r.height);
    };
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      fromY(e.clientY);
      const move = (ev) => fromY(ev.clientY);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', () => el.removeEventListener('pointermove', move), { once: true });
    });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      set(store.get('volume') - Math.sign(e.deltaY) * 0.05);
    }, { passive: false });
    el.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.1 : 0.05;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(store.get('volume') + step);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(store.get('volume') - step);
      else return;
      e.preventDefault();
      e.stopPropagation();
    });
    store.on('volume', paint);
    paint();
  }

  _buildLcd() {
    $('#inst-prev').innerHTML = icon('prev');
    $('#inst-next').innerHTML = icon('next');
    $('#inst-prev').addEventListener('click', () => this.stepInstrument(-1));
    $('#inst-next').addEventListener('click', () => this.stepInstrument(1));
    $('#lcd-screen').addEventListener('click', () => this.toggleDrawer('sounds'));
    $('#lcd-screen').addEventListener('wheel', (e) => {
      e.preventDefault();
      this.stepInstrument(Math.sign(e.deltaY));
    }, { passive: false });
    store.on('instrument', () => this._renderLcd());
  }

  _renderLcd(id = this.requestedId || store.get('instrument')) {
    const i = Math.max(0, PRESETS.findIndex((p) => p.id === id));
    const row = (p) => [h('b', {}, pad3(p.number)), h('span', {}, p.label)];
    const set = (sel, p) => {
      const el = $(sel);
      el.textContent = '';
      el.append(...row(p));
    };
    set('#lcd-prev', PRESETS[(i - 1 + PRESETS.length) % PRESETS.length]);
    set('#lcd-cur', PRESETS[i]);
    set('#lcd-next', PRESETS[(i + 1) % PRESETS.length]);
    this._syncHero();
  }

  // ——— Status bar & fallboard ———
  _buildStatus() {
    const bar = $('#statusbar');
    const chip = (onclick) => h(onclick ? 'button.chip' : 'span.chip', onclick ? { onclick } : {});
    const c = {
      keys: chip(() => this.openDrawer('settings')),
      octave: chip(() => this.openDrawer('settings')),
      transpose: chip(() => this.openDrawer('settings')),
      sustain: chip(() => this.performance.cycleSustain()),
      midi: chip(() => this.openDrawer('settings')),
      metro: chip(() => this.metronome.toggle()),
      band: chip(() => this.openStudio('band')),
      streak: chip(() => this.showStats()),
      palette: chip(() => this.palette?.show()),
      info: h('span.chip', {}, `${PRESETS.length} sounds · ${SONGS.length} songs`),
    };
    bar.append(c.keys, c.octave, c.transpose, c.sustain, c.midi, c.metro, c.band, h('span.grow'), c.palette, c.streak, c.info);
    const fill = (el, ...parts) => {
      el.textContent = '';
      el.append(...parts);
    };
    this._renderStatus = () => {
      const oct = store.get('octaveShift');
      const tr = store.get('transpose');
      fill(c.keys, h('span', { html: icon('keyboard') }), 'Keys ', h('b', {}, LAYOUTS[store.get('keybinds')].name));
      c.keys.querySelector('svg').setAttribute('width', 13);
      fill(c.octave, 'Octave ', h('b', {}, oct > 0 ? `+${oct}` : `${oct}`));
      fill(c.transpose, 'Transpose ', h('b', {}, tr > 0 ? `+${tr}` : `${tr}`));
      fill(c.sustain, h(`span.dot${store.get('sustain') ? '.accent' : ''}`), 'Sustain ', h('b', {}, store.get('sustain') ? (store.get('sustainMode') === 'half' ? 'Half' : 'Full') : 'Off'));
      const devices = this.midi.devices();
      fill(c.midi, h(`span.dot${devices.length ? '.on' : ''}`), 'MIDI ', h('b', {}, devices.length ? devices[0].name.slice(0, 22) : 'None'));
      fill(c.metro, h(`span.dot${this.metronome.running ? '.accent' : ''}`), 'Metronome ', h('b', {}, `${this.metronome.bpm} · ${this.metronome.timeSig}`));
      const b = this.band;
      fill(c.band, h(`span.dot${b.playing ? '.on' : b.enabled ? '.accent' : ''}`), 'Band ', h('b', {}, b.playing ? b.style.name : b.armed ? 'Waiting…' : b.enabled ? 'Ready' : 'Off'));
      const streak = this.stats.streak();
      fill(c.streak, h('span', { html: icon('flame') }), h('b', {}, String(streak)), streak === 1 ? ' day' : ' days');
      c.streak.querySelector('svg').setAttribute('width', 13);
      c.streak.title = 'Your practice streak — click for statistics';
      fill(c.palette, h('span', { html: icon('search') }), 'Search ', h('b', {}, 'Ctrl+K'));
      c.palette.querySelector('svg').setAttribute('width', 12);
    };
    this._renderFallboard = () => {
      const oct = store.get('octaveShift');
      const tr = store.get('transpose');
      fill($('#fb-left'),
        h('span.lamp', {}, 'Oct ', h('b', {}, oct > 0 ? `+${oct}` : `${oct}`)),
        h('span.lamp', {}, 'Trans ', h('b', {}, tr > 0 ? `+${tr}` : `${tr}`)),
        h('span.lamp', {}, 'Keys ', h('b', {}, LAYOUTS[store.get('keybinds')].name)),
      );
      const rec = this.recorder.state;
      fill($('#fb-right'),
        h(`span.lamp${rec === 'recording' || rec === 'countin' || rec === 'armed' ? '.rec' : ''}`, {}, h('i'), 'Rec'),
        h(`span.lamp${this.metronome.running ? '.on' : ''}`, {}, h('i'), 'Metro'),
        h(`span.lamp${store.get('arpOn') ? '.on' : ''}`, {}, h('i'), 'Arp'),
        h(`span.lamp${this.band.playing ? '.on' : this.band.enabled ? '.half' : ''}`, {}, h('i'), 'Band'),
        h(`span.lamp${this.midi.devices().length ? '.on' : ''}`, {}, h('i'), 'MIDI'),
        h(`span.lamp${store.get('sustain') ? (store.get('sustainMode') === 'half' ? '.half' : '.on') : ''}`, {}, h('i'), 'Sustain'),
      );
    };
    this.midi.on('devices', () => this._syncTools());
    this.metronome.on('change', () => this._renderStatus());
    this._renderStatus();
    this._renderFallboard();
  }

  // ——— Hero ———
  _syncHero() {
    const hero = $('#hero');
    const id = this.requestedId || store.get('instrument');
    const p = PRESET_BY_ID.get(id);
    $('#hero-title').textContent = p ? p.label : '';
    $('#hero-kicker').textContent = this.loadingId ? 'Loading…' : p?.extra ? `${p.group} · extra sound` : p ? p.group : '';
    const hint = $('#hero-hint');
    const range = { real: ['Q', '/'], full: ['1', 'M'] }[store.get('keybinds')];
    hint.textContent = '';
    hint.append(
      range
        ? h('span', {}, h('span.kbd', {}, range[0]), '…', h('span.kbd', {}, range[1]), ' play')
        : h('span', {}, 'Click the keys or use a MIDI keyboard'),
      h('span', {}, h('span.kbd', {}, 'Space'), ' sustain'),
      h('span', {}, h('span.kbd', {}, '['), h('span.kbd', {}, ']'), ' octave'),
      h('span', {}, h('span.kbd', {}, '←'), h('span.kbd', {}, '→'), ' change sound'),
    );
    const busy = !!this.songPlayer?.song || !$('#notepad').hidden;
    hero.classList.toggle('gone', busy);
  }

  _bindPlayVisuals() {
    let idle = null;
    this.performance.on('down', ({ keyMidi, velocity }) => {
      this.visualizer.noteOn(keyMidi, 'live', velocity);
      $('#hero').classList.add('dim');
      clearTimeout(idle);
      idle = setTimeout(() => $('#hero').classList.remove('dim'), 3500);
    });
    this.performance.on('up', ({ keyMidi }) => this.visualizer.noteOff(keyMidi, 'live'));
    this.recorder.on('visual', ({ midi, on }) => (on ? this.visualizer.noteOn(midi, 'track') : this.visualizer.noteOff(midi, 'track')));
    this.recorder.on('visual-clear', () => this.visualizer.clear('track'));
  }

  // ——— View / store wiring ———
  _applyView() {
    if (store.get('visibleKeys') === 'max') this.piano.setRange(21, 108);
    else {
      const s = store.get('focusStart');
      this.piano.setRange(s, s + 60);
    }
    this.piano.root.classList.toggle('compact', store.get('visibleKeys') === 'max');
    const focus = store.get('visibleKeys') === 'focus';
    $('#range-left').classList.toggle('show', focus && store.get('focusStart') > 24);
    $('#range-right').classList.toggle('show', focus && store.get('focusStart') < 48);
    this.piano.setNoteStyle(store.get('noteLabels'));
    this.piano.setColorMode(store.get('keyColor'));
    this.visualizer.rainbow = store.get('keyColor') === 'rainbow';
    this.visualizer.enabled = store.get('visualizer');
    this.visualizer.setStyle(store.get('vizStyle'));
    const root = document.documentElement;
    root.dataset.theme = store.get('theme');
    this.piano.root.dataset.skin = store.get('keySkin');
    root.style.setProperty('--piano-h', { compact: 'clamp(140px, 26vh, 230px)', normal: 'clamp(170px, 34vh, 320px)', tall: 'clamp(200px, 44vh, 420px)' }[store.get('pianoHeight')]);
    requestAnimationFrame(() => {
      const cs = getComputedStyle(document.documentElement);
      this.visualizer.setAccent(cs.getPropertyValue('--accent').trim(), cs.getPropertyValue('--accent-hi').trim());
    });
  }

  /** In the focus view, slide the 5-octave window to show lo…hi (e.g. a song's range). */
  ensureVisible(lo, hi) {
    if (store.get('visibleKeys') !== 'focus') return;
    const starts = [24, 36, 48];
    const cur = store.get('focusStart');
    const cover = (s) => Math.min(hi, s + 60) - Math.max(lo, s);
    if (lo >= cur && hi <= cur + 60) return;
    const best = starts.reduce((a, b) => (cover(b) > cover(a) ? b : a), cur);
    if (hi - lo > 60) store.set('visibleKeys', 'max');
    else store.set('focusStart', best);
  }

  _bindStore() {
    const sound = ['volume', 'reverbOn', 'reverbWet', 'toneOn', 'toneHz', 'tuningCents', 'velocity', 'bendRange', 'room', 'eqOn', 'eqLow', 'eqMid', 'eqHigh', 'driveOn', 'drive', 'chorusOn', 'chorusDepth', 'chorusRate', 'tremoloOn', 'tremoloMode', 'tremoloRate', 'tremoloDepth', 'delayOn', 'delayDiv', 'delayFeedback', 'delayMix', 'limiterOn'];
    for (const k of sound) store.on(k, (v) => this.engine.setSound({ [k]: v }));
    for (const k of ['visibleKeys', 'focusStart', 'noteLabels', 'keyColor', 'visualizer', 'vizStyle', 'theme', 'keySkin', 'pianoHeight']) store.on(k, () => this._applyView());
    store.on('accent', (v) => {
      document.documentElement.dataset.accent = v;
      this._applyView();
    });
    for (const k of ['sustain', 'sustainMode', 'keybinds', 'octaveShift', 'transpose']) store.on(k, () => this._syncTools());
    store.on('midiDevice', (v) => this.midi.select(v));
    const keepBindingsVisible = () => {
      const ms = [...this.performance.labels.keys()];
      if (ms.length) this.ensureVisible(Math.min(...ms), Math.max(...ms));
    };
    store.on('octaveShift', keepBindingsVisible);
    store.on('keybinds', keepBindingsVisible);
    store.on('keybinds', () => this._syncHero());
    $('#range-left').innerHTML = icon('left');
    $('#range-right').innerHTML = icon('right');
    $('#range-left').addEventListener('click', () => store.set('focusStart', Math.max(24, store.get('focusStart') - 12)));
    $('#range-right').addEventListener('click', () => store.set('focusStart', Math.min(48, store.get('focusStart') + 12)));
  }

  _bindKeys() {
    this.performance.on('escape', () => {
      if (this.performance.bindEdit) return this.performance.stopBindEdit();
      if (this.openId) return this.closeDrawer();
      if (!$('#notepad').hidden) return this.toggleNotepad(false);
      if (this.songPlayer.song) this.songPlayer.close(false);
    });
    this.performance.on('instrument-step', (d) => this.stepInstrument(d));
    // Controls give focus back to the piano once used, so the PC keyboard keeps playing notes.
    document.addEventListener('change', (e) => e.target.matches?.('select, input[type=range]') && e.target.blur());
    document.addEventListener('pointerup', (e) => {
      const el = e.target.closest?.('button, input[type=range]');
      if (el) setTimeout(() => el.blur(), 0);
    });
    window.addEventListener('keyup', (e) => e.code === 'Space' && e.target.tagName === 'BUTTON' && e.preventDefault(), true);
    // Clicking the empty stage closes an open drawer.
    $('#stage').addEventListener('pointerdown', (e) => {
      if (e.target === $('#stage') || e.target === $('#viz') || e.target.closest('.hero')) this.closeDrawer();
    });
  }

  showHelp() {
    const rows = [
      ['Play notes', 'PC keys shown on the piano'],
      ['Sustain pedal on / off', 'Space'],
      ['Octave down / up', '[   ]'],
      ['Transpose down / up', '-   ='],
      ['Previous / next sound', '←   →'],
      ['Close panel', 'Esc'],
      ['Full screen', 'F11'],
      ['Play notepad', 'Ctrl + Enter'],
      ['Sharps (Full layout)', 'Shift + key'],
      ['Louder / softer click', 'Click lower / higher on a key (touch sensitivity on)'],
    ];
    const content = h('div', {},
      h('div.panel-head', {}, h('div.panel-title', {}, 'Shortcuts'), h('div.spacer'), h('button.icon-btn.ghost', { html: icon('close'), 'data-close': '' })),
      h('div.help-grid', {}, ...rows.map(([a, b]) => h('div', {}, h('span', {}, a), h('b', {}, b)))),
      h('div.credits', {},
        h('b', {}, 'Nocturne Piano 1.0'), ' — sounds from open-source sample libraries: ',
        'Salamander Grand Piano by Alexander Holm (CC-BY 3.0); FluidR3 GM (CC-BY 3.0), MusyngKite (CC-BY-SA 3.0) and FatBoy soundfonts, packaged by Benjamin Gleitzman’s midi-js-soundfonts; ',
        'tonejs-instruments by Nicholaus Brosowsky (CC-BY 3.0). Songs are public-domain works arranged for this app. ',
        'MP3 encoding by lamejs, MIDI files by @tonejs/midi.',
      ),
    );
    showModal(content, { wide: true });
  }
}

const app = new App();
window.nocturne = app;
app.init().catch((err) => {
  console.error(err);
  const note = document.getElementById('loader-note');
  if (note) note.textContent = `Something went wrong: ${err.message}`;
});
