// Practice dashboard: today's time, streak, a two-week chart, a key heat map and favourites.
import { h } from '../util.js';
import { icon } from './icons.js';
import { showModal, confirmDialog } from './feedback.js';
import { PRESET_BY_ID } from '../instruments.js';
import { isBlack, noteName } from '../notes.js';

const mins = (sec) => Math.round(sec / 60);
const fmtDuration = (sec) => (sec >= 3600 ? `${(sec / 3600).toFixed(1)} h` : `${mins(sec)} min`);

export function showStats(app) {
  const st = app.stats;
  const today = st.today();
  const days = st.lastDays(14);
  const maxMin = Math.max(5, ...days.map((d) => d.seconds / 60));

  const tile = (value, label, iconName) => h('div.stat-tile', {}, h('span.stat-icon', { html: icon(iconName) }), h('b', {}, value), h('span', {}, label));

  // Two-week bar chart
  const W = 640;
  const H = 150;
  const bw = W / days.length;
  const bars = days
    .map((d, i) => {
      const v = d.seconds / 60;
      const bh = Math.max(v > 0 ? 3 : 0, (v / maxMin) * (H - 36));
      const x = i * bw + bw * 0.18;
      const isToday = i === days.length - 1;
      return `<g><rect x="${x}" y="${H - 22 - bh}" width="${bw * 0.64}" height="${bh}" rx="4" class="${isToday ? 'bar today' : 'bar'}"><title>${d.key}: ${Math.round(v)} min · ${d.notes} notes</title></rect>
        <text x="${x + bw * 0.32}" y="${H - 6}" class="axis">${d.label.slice(0, 2)}</text>${v >= 1 ? `<text x="${x + bw * 0.32}" y="${H - 27 - bh}" class="val">${Math.round(v)}</text>` : ''}</g>`;
    })
    .join('');
  const chart = h('div.stat-chart', { html: `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Minutes practised per day">${bars}</svg>` });

  // Key heat map across the 88 keys
  const counts = st.data.keys.slice(21, 109);
  const peak = Math.max(1, ...counts);
  const heat = h('div.heat-keys');
  counts.forEach((c, i) => {
    const m = i + 21;
    const k = h(`i.${isBlack(m) ? 'b' : 'w'}`, { title: `${noteName(m)} · ${c} notes` });
    k.style.setProperty('--heat', (c / peak).toFixed(3));
    heat.append(k);
  });
  const fav = Object.entries(st.data.keys).map(([m, c]) => [Number(m), c]).sort((a, b) => b[1] - a[1])[0];

  // Favourite sounds and songs
  const sounds = Object.entries(st.data.sounds).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const songs = Object.entries(st.data.songs).sort((a, b) => b[1].plays - a[1].plays).slice(0, 5);
  const list = (rows, empty) => (rows.length ? h('div.stat-list', {}, ...rows) : h('div.muted', {}, empty));

  const content = h('div.stats', {},
    h('div.panel-head', {}, h('div', {}, h('div.panel-title', {}, 'Your practice'), h('div.panel-sub', {}, 'Every note you play counts')), h('div.spacer'), h('button.icon-btn.ghost', { html: icon('close'), 'data-close': '' })),
    h('div.stat-tiles', {},
      tile(`${mins(today.seconds)}`, 'minutes today', 'metronome'),
      tile(today.notes.toLocaleString(), 'notes today', 'music'),
      tile(`${st.streak()}`, st.streak() === 1 ? 'day streak' : 'day streak', 'sparkle'),
      tile(fmtDuration(st.data.totalSeconds), `${st.data.totalNotes.toLocaleString()} notes in total`, 'piano'),
    ),
    h('h6.subhead', {}, 'Last two weeks (minutes)'),
    chart,
    h('h6.subhead', {}, 'Keys you play most', fav && fav[1] ? h('span.muted', {}, ` — favourite: ${noteName(fav[0])}`) : null),
    heat,
    h('div.stat-cols', {},
      h('div', {}, h('h6.subhead', {}, 'Favourite sounds'), list(sounds.map(([id, sec]) => h('div', {}, h('span', {}, PRESET_BY_ID.get(id)?.label || id), h('b', {}, fmtDuration(sec)))), 'Play a while to see your favourites.')),
      h('div', {}, h('h6.subhead', {}, 'Songs'), list(songs.map(([, v]) => h('div', {}, h('span', {}, v.title), h('b', {}, v.best ? `best ${v.best}%` : `${v.plays}×`))), 'Finish a song in Play Along or Practice.')),
    ),
    h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '14px' } },
      h('button.btn.small.ghost', {
        onclick: async () => {
          if (await confirmDialog('Reset **all practice statistics**?', { ok: 'Reset', danger: true })) {
            st.reset();
            document.getElementById('modal-host').textContent = '';
          }
        },
      }, 'Reset statistics'),
    ),
  );
  showModal(content, { wide: true });
}
