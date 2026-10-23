// PC keyboard layouts. Codes are KeyboardEvent.code values so layouts work on any keyboard language.

// Real: piano-shaped, two rows (q…/ are white keys, the row above/home row are the black keys). i = middle C.
const REAL_WHITE = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'];
const REAL_BLACK = [
  ['Digit2', 49], ['Digit3', 51], ['Digit5', 54], ['Digit6', 56], ['Digit7', 58],
  ['Digit9', 61], ['Digit0', 63], ['KeyS', 66], ['KeyD', 68], ['KeyF', 70],
  ['KeyH', 73], ['KeyJ', 75], ['KeyL', 78], ['Semicolon', 80], ['Quote', 82],
];

// Full: the classic 36-key sheet-music layout (C2–C7), Shift + key plays the sharp above.
const FULL_WHITE = [
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',
  'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP',
  'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL',
  'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM',
];

const WHITE_STEPS = [0, 2, 4, 5, 7, 9, 11];
function whiteKeysFrom(startMidi, count) {
  const out = [];
  let octave = Math.floor(startMidi / 12);
  let i = WHITE_STEPS.indexOf(startMidi % 12);
  while (out.length < count) {
    out.push(octave * 12 + WHITE_STEPS[i]);
    i++;
    if (i === 7) {
      i = 0;
      octave++;
    }
  }
  return out;
}

function realLayout() {
  const codeToMidi = new Map();
  whiteKeysFrom(48, REAL_WHITE.length).forEach((m, i) => codeToMidi.set(REAL_WHITE[i], m));
  for (const [code, m] of REAL_BLACK) codeToMidi.set(code, m);
  return { codeToMidi, shiftCodeToMidi: new Map() };
}

function fullLayout() {
  const codeToMidi = new Map();
  const shiftCodeToMidi = new Map();
  whiteKeysFrom(36, FULL_WHITE.length).forEach((m, i) => {
    codeToMidi.set(FULL_WHITE[i], m);
    const pc = m % 12;
    if (pc !== 4 && pc !== 11 && m < 96) shiftCodeToMidi.set(FULL_WHITE[i], m + 1);
  });
  return { codeToMidi, shiftCodeToMidi };
}

export const LAYOUTS = {
  off: { name: 'Off', hint: 'Mouse and MIDI only' },
  real: { name: 'Real', hint: 'Piano-style key positions', build: realLayout },
  full: { name: 'Full', hint: 'Wider range, Shift key for sharps', build: fullLayout },
  custom: { name: 'Custom', hint: 'Bind every key yourself' },
};

const SHIFT_SYMBOL = { Digit1: '!', Digit2: '@', Digit3: '#', Digit4: '$', Digit5: '%', Digit6: '^', Digit7: '&', Digit8: '*', Digit9: '(', Digit0: ')' };
const CODE_CHAR = {
  Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
  Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`', Tab: 'Tab', Enter: '↵', Backspace: '⌫',
};

export function codeLabel(code, shift = false) {
  if (code.startsWith('Key')) {
    const ch = code.slice(3);
    return shift ? ch.toUpperCase() : ch.toLowerCase();
  }
  if (code.startsWith('Digit')) return shift ? SHIFT_SYMBOL[code] || `⇧${code.slice(5)}` : code.slice(5);
  if (code.startsWith('Numpad')) return `n${code.slice(6)}`;
  const base = CODE_CHAR[code] || code;
  return shift ? `⇧${base}` : base;
}

/** Character typed → { code, shift } for the US layout (used by notepad scripts). */
export function charToCode(ch) {
  if (/^[a-z]$/.test(ch)) return { code: `Key${ch.toUpperCase()}`, shift: false };
  if (/^[A-Z]$/.test(ch)) return { code: `Key${ch}`, shift: true };
  if (/^\d$/.test(ch)) return { code: `Digit${ch}`, shift: false };
  for (const [code, sym] of Object.entries(SHIFT_SYMBOL)) if (sym === ch) return { code, shift: true };
  for (const [code, sym] of Object.entries(CODE_CHAR)) if (sym === ch) return { code, shift: false };
  return null;
}

/**
 * Builds the active bindings. Custom bindings are stored as { "KeyQ": 48, "Shift+KeyQ": 49 }.
 * Returned maps are in "unshifted" key-midi space; octave shift is applied by the caller.
 */
export function buildBindings(layoutId, custom = {}) {
  if (layoutId === 'custom') {
    const codeToMidi = new Map();
    const shiftCodeToMidi = new Map();
    for (const [k, m] of Object.entries(custom)) {
      if (k.startsWith('Shift+')) shiftCodeToMidi.set(k.slice(6), m);
      else codeToMidi.set(k, m);
    }
    return { codeToMidi, shiftCodeToMidi };
  }
  const layout = LAYOUTS[layoutId];
  if (!layout?.build) return { codeToMidi: new Map(), shiftCodeToMidi: new Map() };
  return layout.build();
}

/** midi → label (first binding wins) */
export function labelsFor(bindings, octaveShift = 0) {
  const labels = new Map();
  for (const [code, m] of bindings.codeToMidi) {
    const mm = m + octaveShift * 12;
    if (!labels.has(mm)) labels.set(mm, codeLabel(code, false));
  }
  for (const [code, m] of bindings.shiftCodeToMidi) {
    const mm = m + octaveShift * 12;
    if (!labels.has(mm)) labels.set(mm, codeLabel(code, true));
  }
  return labels;
}

/** Custom map seeded from a preset layout ("Edit current"). */
export function toCustom(layoutId) {
  const b = buildBindings(layoutId);
  const out = {};
  for (const [code, m] of b.codeToMidi) out[code] = m;
  for (const [code, m] of b.shiftCodeToMidi) out[`Shift+${code}`] = m;
  return out;
}

export const RESERVED_CODES = new Set(['Space', 'Escape', 'BracketLeft', 'BracketRight', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Minus', 'Equal']);
