export class Emitter {
  constructor() {
    this._handlers = new Map();
  }
  on(type, fn) {
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add(fn);
    return () => this._handlers.get(type)?.delete(fn);
  }
  emit(type, payload) {
    const set = this._handlers.get(type);
    if (set) for (const fn of [...set]) fn(payload);
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Tiny element builder: h('button.btn.primary', { onclick }, 'Label', child) */
export function h(spec, props = {}, ...children) {
  const [tag, ...classes] = spec.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable */
  }
}

const TEXT_INPUTS = new Set(['text', 'search', 'number', 'email', 'password', 'url', 'tel']);
/** True when keystrokes should go to a text field instead of the piano. */
export const isTypingTarget = (el) =>
  !!el && ((el.tagName === 'INPUT' && TEXT_INPUTS.has(el.type || 'text')) || el.tagName === 'TEXTAREA' || el.isContentEditable);

export const pad3 = (n) => String(n).padStart(3, '0');

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Save through the desktop shell when available, else a browser download. */
export async function saveFile(name, data, filters) {
  if (window.native?.saveFile) return window.native.saveFile({ defaultName: name, filters, data });
  downloadBlob(new Blob([data]), name);
  return name;
}

/** Open files through the desktop shell, else a hidden file input. Resolves [{ name, data:Uint8Array }]. */
export function openFiles(filters) {
  if (window.native?.openFiles) return window.native.openFiles({ filters });
  return new Promise((resolve) => {
    const input = h('input', {
      type: 'file',
      multiple: true,
      accept: filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(','),
    });
    input.onchange = async () => {
      const files = await Promise.all(
        [...input.files].map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) })),
      );
      resolve(files);
    };
    input.click();
  });
}
