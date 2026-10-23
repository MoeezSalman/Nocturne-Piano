// Small reusable controls. Each returns { el, set(value) } so panels can refresh without rebuilding.
import { h } from '../util.js';
import { icon } from './icons.js';

export function segmented(options, value, onChange) {
  const el = h('div.seg');
  const buttons = options.map(([v, label, title]) => {
    const b = h('button', { onclick: () => onChange(v), title }, label);
    b.dataset.v = String(v);
    el.append(b);
    return b;
  });
  const set = (val) => buttons.forEach((b) => b.classList.toggle('on', b.dataset.v === String(val)));
  set(value);
  return { el, set };
}

export function stepper(value, format, onStep) {
  const val = h('span.val');
  const el = h('div.stepper', {},
    h('button', { html: icon('minus'), onclick: () => onStep(-1), title: 'Decrease' }),
    val,
    h('button', { html: icon('plus'), onclick: () => onStep(1), title: 'Increase' }),
  );
  const set = (v) => (val.textContent = format(v));
  set(value);
  return { el, set };
}

export function toggle(on, onChange, label = '') {
  const el = h('button.switch', { role: 'switch', 'aria-label': label, onclick: () => onChange(!el.classList.contains('on')) });
  const set = (v) => {
    el.classList.toggle('on', !!v);
    el.setAttribute('aria-checked', String(!!v));
  };
  set(on);
  return { el, set };
}

export function slider({ min, max, step = 1, value, format = (v) => v, onInput }) {
  const input = h('input', { type: 'range', min, max, step });
  const out = h('output');
  const paint = () => {
    const f = ((Number(input.value) - min) / (max - min)) * 100;
    input.style.setProperty('--fill', `${f}%`);
    out.textContent = format(Number(input.value));
  };
  input.addEventListener('input', () => {
    paint();
    onInput(Number(input.value));
  });
  const el = h('div.range-wrap', {}, input, out);
  const set = (v) => {
    input.value = v;
    paint();
  };
  set(value);
  return { el, set, input };
}

export const row = (label, control, hint) =>
  h('div.row', {}, h('div.label', {}, label, hint ? h('span.hint', {}, hint) : null), control);

export const card = (title, iconName, ...children) => h('section.card', {}, h('h5', { html: `${icon(iconName)}${title}` }), ...children);

/** A card whose title row carries an on/off switch. */
export function switchCard(title, iconName, on, onChange, ...children) {
  const sw = toggle(on, onChange, title);
  const el = h('section.card.switch-card', {},
    h('div.card-head', {}, h('h5', { html: `${icon(iconName)}${title}` }), sw.el),
    h('div.card-body', {}, ...children),
  );
  const set = (v) => {
    sw.set(v);
    el.classList.toggle('off', !v);
  };
  set(on);
  return { el, set };
}

/** Tab strip + pages. tabs: [[id, label, element]] */
export function tabs(defs, initial, onChange = () => {}) {
  const strip = h('div.tabs');
  const body = h('div.tab-pages');
  const buttons = new Map();
  const pages = new Map();
  for (const [id, label, page] of defs) {
    const b = h('button.tab', { onclick: () => select(id) }, label);
    buttons.set(id, b);
    pages.set(id, page);
    strip.append(b);
    page.hidden = true;
    body.append(page);
  }
  function select(id) {
    for (const [k, b] of buttons) b.classList.toggle('on', k === id);
    for (const [k, p] of pages) p.hidden = k !== id;
    onChange(id);
  }
  select(initial ?? defs[0][0]);
  return { strip, body, select };
}

/** <select> of sound presets grouped by family. */
export function presetSelect(presets, value, onChange) {
  const el = h('select.select.preset-select', { onchange: () => onChange(el.value) });
  const groups = new Map();
  for (const p of presets) {
    if (!groups.has(p.group)) groups.set(p.group, h('optgroup', { label: p.group }));
    groups.get(p.group).append(h('option', { value: p.id }, `${String(p.number).padStart(3, '0')}  ${p.label}`));
  }
  el.append(...groups.values());
  el.value = value;
  return { el, set: (v) => (el.value = v) };
}

export function selectBox(options, value, onChange) {
  const el = h('select.select', { onchange: () => onChange(el.value) }, ...options.map(([v, label]) => h('option', { value: v }, label)));
  el.value = String(value);
  return { el, set: (v) => (el.value = String(v)) };
}
