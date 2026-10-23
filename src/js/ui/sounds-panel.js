import { h, pad3 } from '../util.js';
import { icon } from './icons.js';
import { PRESETS, GROUPS, soundFiles } from '../instruments.js';

export function createSoundsPanel(app) {
  const { store } = app;
  let filter = 'all';
  let query = '';
  let cached = new Set();

  const search = h('input', { placeholder: 'Search sounds…', spellcheck: 'false' });
  search.addEventListener('input', () => {
    query = search.value.trim().toLowerCase();
    renderList();
  });
  const pills = h('div.chip-row');
  const FILTERS = [
    ['all', 'All'],
    ['original', 'Original 95'],
    ['extra', 'Extra'],
    ['fav', 'Favorites'],
    ['offline', 'Downloaded'],
  ];
  const renderPills = () => {
    pills.textContent = '';
    for (const [id, label] of FILTERS) {
      pills.append(h(`button.pill${filter === id ? '.on' : ''}`, { onclick: () => ((filter = id), renderPills(), renderList()) }, label));
    }
  };
  const list = h('div.sound-groups');
  const el = h('div', {},
    h('div.panel-head', {},
      h('div', {}, h('div.panel-title', {}, 'Sounds'), h('div.panel-sub', {}, `${PRESETS.length} instruments · the original 95 plus ${PRESETS.length - 95} extra`)),
      h('div.spacer'),
      h('div.field', {}, h('span', { html: icon('search') }), search),
    ),
    h('div.sounds-tools', {}, pills),
    list,
  );

  const isAvailable = (p) => p.src.type === 'synth' || cached.has(p.id);

  function renderList() {
    list.textContent = '';
    const favs = new Set(store.get('favorites'));
    const current = store.get('instrument');
    for (const group of GROUPS) {
      const items = PRESETS.filter((p) => {
        if (p.group !== group) return false;
        if (filter === 'original' && p.extra) return false;
        if (filter === 'extra' && !p.extra) return false;
        if (filter === 'fav' && !favs.has(p.id)) return false;
        if (filter === 'offline' && !isAvailable(p)) return false;
        if (query && !`${p.label} ${p.group} ${p.number}`.toLowerCase().includes(query)) return false;
        return true;
      });
      if (!items.length) continue;
      const groupEl = h('div.sound-group', {},
        h('h4', {}, group, items[0].extra ? h('span.extra', {}, 'Extra') : null),
      );
      for (const p of items) {
        const fav = h(`span.fav${favs.has(p.id) ? '.on' : ''}`, { html: icon(favs.has(p.id) ? 'starFill' : 'star'), title: 'Favorite' });
        fav.addEventListener('click', (e) => {
          e.stopPropagation();
          const f = new Set(store.get('favorites'));
          if (f.has(p.id)) f.delete(p.id);
          else f.add(p.id);
          store.set('favorites', [...f]);
          renderList();
        });
        const status = app.loadingId === p.id ? h('span.spin') : isAvailable(p) ? h('span.dl', { title: 'Available offline' }) : null;
        groupEl.append(
          h(`button.sound-item${p.id === current ? '.active' : ''}`, { onclick: () => app.selectInstrument(p.id), title: p.label },
            h('span.num', {}, pad3(p.number)),
            h('span.name', {}, p.label),
            status,
            fav,
          ),
        );
      }
      list.append(groupEl);
    }
    if (!list.children.length) list.append(h('div.muted', { style: { padding: '20px 8px' } }, 'No sounds match.'));
  }

  async function refreshCache() {
    if (!window.native?.soundsHave) return;
    const all = PRESETS.flatMap((p) => soundFiles(p).map((f) => [p.id, f]));
    const have = new Set(await window.native.soundsHave(all.map(([, f]) => f)));
    const missing = new Set(all.filter(([, f]) => !have.has(f)).map(([id]) => id));
    cached = new Set(PRESETS.filter((p) => p.src.type !== 'synth' && !missing.has(p.id)).map((p) => p.id));
  }

  store.on('instrument', renderList);
  app.on('loading', renderList);

  return {
    el,
    async onOpen() {
      renderPills();
      renderList();
      await refreshCache();
      renderList();
    },
    refreshCache,
    availableCount: () => cached.size,
  };
}
