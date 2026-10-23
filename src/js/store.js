// Persistent settings with change notifications.
import { Emitter, loadJSON, saveJSON } from './util.js';
import { DEFAULT_SOUND } from './audio-engine.js';
import { DEFAULT_PRESET } from './instruments.js';

const KEY = 'nocturne.settings.v1';

export const DEFAULTS = {
  instrument: DEFAULT_PRESET,
  ...DEFAULT_SOUND,
  sustain: true, // on by default, like the original
  sustainMode: 'full', // 'full' | 'half'
  keybinds: 'real', // off | real | full | custom
  customBindings: {},
  noteLabels: 'off', // off | cde | solfege
  visibleKeys: 'focus', // focus (5 octaves) | max (88 keys)
  focusStart: 36, // lowest key in focus view (C2)
  octaveShift: 0,
  transpose: 0,
  accent: 'gold',
  keyColor: 'accent', // accent | rainbow
  visualizer: true,
  uiSounds: true,
  metroBpm: 120,
  metroSig: '4/4',
  metroSound: 'beep',
  metroVolume: 1,
  countIn: true,
  favorites: [],
  recentSongs: [],
  songMode: 'along',
  songHands: 'both',
  songSpeed: 1,
  songDisplay: 'letters',
  songLabels: 'qwerty',
  notepadText: '',
  notepadBpm: 120,
  notepadCapture: true,
  notepadStyle: 'notes',
  notepadLayout: 'full', // which key layout PC-key scripts are written for
  notepadRead: 'auto',
  midiDevice: 'all',
  // ——— v2: studio ———
  splitOn: false,
  splitPoint: 54, // F♯3: keys below it are the left hand
  splitInst: 'electric_bass_finger_fb',
  splitOctave: 0,
  splitVolume: 1,
  layerOn: false,
  layerInst: 'string_ensemble_1_mk',
  layerOctave: 0,
  layerVolume: 0.55,
  chordMode: 'off', // off | maj | min | 7 | maj7 | m7 | sus4 | 5 | smart
  scaleLock: false,
  showScale: false,
  theoryRoot: 0,
  theoryScale: 'major',
  arpOn: false,
  arpPattern: 'up',
  arpRate: '1/16',
  arpOctaves: 1,
  arpGate: 0.6,
  arpSwing: 0,
  arpLatch: false,
  arpZone: 'right',
  bandStyle: 'pop',
  bandVariation: 'A',
  bandSync: true,
  bandVolume: 0.8,
  bandLeftSound: false,
  bandZone: 'left',
  memory: [],
  // ——— v2: look & feel ———
  theme: 'midnight', // midnight | ivory | rosewood | neon
  keySkin: 'classic', // classic | vintage | ebony | glass
  vizStyle: 'ribbons', // ribbons | spectrum | wave | aurora | galaxy
  pianoHeight: 'normal', // compact | normal | tall
  showChords: true,
  showWheels: true,
  beatFlash: false,
  metroSub: 1,
  metroAccent: true,
  earBest: 0,
};

class Store extends Emitter {
  constructor() {
    super();
    this.state = { ...DEFAULTS, ...loadJSON(KEY, {}) };
    this._t = null;
  }
  get(k) {
    return this.state[k];
  }
  set(k, v) {
    if (this.state[k] === v && typeof v !== 'object') return;
    this.state[k] = v;
    this.emit(k, v);
    this.emit('*', { key: k, value: v });
    this._persist();
  }
  update(patch) {
    for (const [k, v] of Object.entries(patch)) this.set(k, v);
  }
  _persist() {
    clearTimeout(this._t);
    this._t = setTimeout(() => saveJSON(KEY, this.state), 250);
  }
}

export const store = new Store();
