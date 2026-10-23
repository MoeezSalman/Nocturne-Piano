import { h, formatTime, openFiles, loadJSON, saveJSON } from '../util.js';
import { icon } from './icons.js';
import { SONGS } from '../songs-data.js';
import { songEvents, songDuration } from '../song-format.js';
import { midiFileToSong } from '../midi-io.js';
import { parseScript } from '../notepad-script.js';
import { confirmDialog, toast } from './feedback.js';

const IMPORT_KEY = 'nocturne.importedSongs.v1';

export function createSongsPanel(app) {
  const { store } = app;
  let imported = loadJSON(IMPORT_KEY, []);
  let filter = 'All';
  let query = '';

  const allSongs = () => [...imported, ...SONGS];
  const saveImported = () => saveJSON(IMPORT_KEY, imported);

  const search = h('input', { placeholder: 'Search songs or composers…', spellcheck: 'false' });
  search.addEventListener('input', () => {
    query = search.value.trim().toLowerCase();
    renderGrid();
  });
  const pills = h('div.chip-row');
  const grid = h('div.song-grid');
  const importBtn = h('button.btn', { onclick: () => importFiles(), html: `${icon('upload')}Import MIDI / notes` });

  const el = h('div', {},
    h('div.panel-head', {},
      h('div', {}, h('div.panel-title', {}, 'Songs'), h('div.panel-sub', {}, 'Pick a song, then play along with Demo, Play Along or Practice')),
      h('div.spacer'),
      h('div.field', { style: { width: '280px' } }, h('span', { html: icon('search') }), search),
      importBtn,
    ),
    h('div.sounds-tools', {}, pills),
    grid,
  );

  function filters() {
    const genres = [...new Set(SONGS.map((s) => s.genre))];
    return ['All', 'Recent', ...genres, ...(imported.length ? ['Imported'] : [])];
  }

  function renderPills() {
    pills.textContent = '';
    for (const f of filters()) {
      pills.append(h(`button.pill${filter === f ? '.on' : ''}`, { onclick: () => ((filter = f), renderPills(), renderGrid()) }, f));
    }
  }

  function renderGrid() {
    grid.textContent = '';
    const recent = store.get('recentSongs');
    let list = allSongs();
    if (filter === 'Recent') list = recent.map((id) => list.find((s) => s.id === id)).filter(Boolean);
    else if (filter !== 'All') list = list.filter((s) => s.genre === filter);
    if (query) list = list.filter((s) => `${s.title} ${s.composer} ${s.genre}`.toLowerCase().includes(query));
    if (!list.length) {
      grid.append(h('div.muted', { style: { padding: '20px 4px' } }, filter === 'Recent' ? 'Songs you open will appear here.' : 'No songs match.'));
      return;
    }
    for (const s of list) {
      const evs = songEvents(s);
      const level = h('span.level', {}, ...[1, 2, 3, 4, 5].map((i) => h(`i${i <= s.level ? '.on' : ''}`)));
      const card = h('button.song-card', { onclick: () => app.openSong(s), title: s.title },
        h(`div.song-art${s.imported ? '.alt' : ''}`, {}, s.title.replace(/^[^A-Za-z]+/, '')[0] || '♪'),
        h('div.song-meta', {},
          h('b', {}, s.title),
          h('span', {}, `${s.composer} · ${formatTime(songDuration(evs))}`),
          level,
        ),
      );
      if (s.imported) {
        const del = h('span.icon-btn.tiny.ghost.del', { html: icon('trash'), title: 'Remove imported song' });
        del.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!(await confirmDialog(`Remove **${s.title}** from your songs?`, { ok: 'Remove', danger: true }))) return;
          imported = imported.filter((x) => x.id !== s.id);
          saveImported();
          if (filter === 'Imported' && !imported.length) filter = 'All';
          renderPills();
          renderGrid();
        });
        card.append(del);
      }
      grid.append(card);
    }
  }

  async function importFiles() {
    const files = await openFiles([{ name: 'MIDI files and note scripts', extensions: ['mid', 'midi', 'txt'] }]);
    let added = 0;
    for (const f of files) {
      try {
        let song;
        if (/\.midi?$/i.test(f.name)) song = midiFileToSong(f.name, f.data);
        else song = scriptToSong(f.name.replace(/\.txt$/i, ''), new TextDecoder().decode(f.data), store);
        imported.unshift(song);
        added++;
      } catch (err) {
        toast(`${f.name}: ${err.message}`, { error: true, ms: 4000 });
      }
    }
    if (added) {
      saveImported();
      filter = 'Imported';
      renderPills();
      renderGrid();
      toast(`Imported ${added} song${added > 1 ? 's' : ''}`);
    }
  }

  return {
    el,
    onOpen() {
      renderPills();
      renderGrid();
    },
    addSong(song) {
      imported.unshift(song);
      saveImported();
    },
  };
}

/** Turns a notepad script into a song. */
export function scriptToSong(title, text, store) {
  const bpm = store.get('notepadBpm');
  const { events, warnings } = parseScript(text, { bpm, layout: store.get('notepadLayout'), custom: store.get('customBindings') });
  if (!events.length) throw new Error(warnings[0] || 'No notes found');
  return {
    id: `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title: title || 'My notepad song',
    composer: 'Notepad',
    genre: 'Imported',
    level: 1,
    bpm,
    timeSig: '4/4',
    events: events.map((e) => ({ ...e, hand: e.midi >= 60 ? 'R' : 'L' })),
    imported: true,
  };
}
