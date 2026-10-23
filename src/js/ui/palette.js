// Command palette (Ctrl+K): search every sound, song and action and run it from the keyboard.
import { h, pad3 } from '../util.js';
import { icon } from './icons.js';

export function createPalette(app, buildItems) {
  let open = false;
  let items = [];
  let shown = [];
  let index = 0;
  const input = h('input.palette-input', { placeholder: 'Search sounds, songs, styles and actions…', spellcheck: 'false' });
  const list = h('div.palette-list');
  const box = h('div.palette', {},
    h('div.palette-search', { html: icon('search') }, input, h('span.kbd', {}, 'Esc')),
    list,
    h('div.palette-foot', {}, h('span', {}, h('span.kbd', {}, '↑'), h('span.kbd', {}, '↓'), ' move'), h('span', {}, h('span.kbd', {}, 'Enter'), ' run'), h('span.muted', {}, 'Ctrl+K opens this anywhere')),
  );
  const host = h('div.palette-host', { hidden: true }, box);
  host.addEventListener('pointerdown', (e) => e.target === host && close());
  document.body.append(host);

  const score = (item, q) => {
    if (!q) return 1;
    const text = `${item.title} ${item.kind} ${item.keywords || ''}`.toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    let total = 0;
    for (const w of words) {
      const i = text.indexOf(w);
      if (i < 0) return 0;
      total += i === 0 ? 3 : text[i - 1] === ' ' ? 2 : 1;
    }
    return total + (item.title.toLowerCase().startsWith(q) ? 4 : 0);
  };

  function render() {
    const q = input.value.trim().toLowerCase();
    shown = items
      .map((it) => ({ it, s: score(it, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 60)
      .map((x) => x.it);
    index = Math.min(index, Math.max(0, shown.length - 1));
    list.textContent = '';
    shown.forEach((it, i) => {
      const row = h(`button.palette-item${i === index ? '.on' : ''}`, { onclick: () => run(it) },
        h('span.palette-icon', { html: icon(it.icon || 'sparkle') }),
        h('span.palette-title', {}, it.title),
        it.hint ? h('span.palette-hint', {}, it.hint) : null,
        h('span.palette-kind', {}, it.kind),
      );
      row.addEventListener('pointermove', () => {
        if (index === i) return;
        index = i;
        [...list.children].forEach((c, j) => c.classList.toggle('on', j === i));
      });
      list.append(row);
    });
    if (!shown.length) list.append(h('div.muted', { style: { padding: '18px' } }, 'Nothing found.'));
  }

  function run(it) {
    close();
    it.run();
  }

  function show() {
    if (open) return;
    open = true;
    items = buildItems();
    input.value = '';
    index = 0;
    host.hidden = false;
    render();
    input.focus();
  }

  function close() {
    if (!open) return;
    open = false;
    host.hidden = true;
    input.blur();
  }

  input.addEventListener('input', () => {
    index = 0;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      index = (index + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % Math.max(1, shown.length);
      [...list.children].forEach((c, j) => c.classList.toggle('on', j === index));
      list.children[index]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (shown[index]) run(shown[index]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') {
      e.preventDefault();
      if (open) close();
      else show();
    }
  }, true);

  return { show, close, get open() {
    return open;
  } };
}

export const soundItem = (p, select) => ({
  kind: 'Sound',
  title: p.label,
  hint: `${pad3(p.number)} · ${p.group}`,
  keywords: p.group,
  icon: 'sounds',
  run: () => select(p.id),
});
