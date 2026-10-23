import { h, formatTime, saveFile } from '../util.js';
import { icon } from './icons.js';
import { toggle, slider } from './controls.js';
import { confirmDialog, toast } from './feedback.js';
import { MAX_TRACKS, TRACK_COLORS, QUANTIZE, encodeMp3, encodeWav } from '../recorder.js';
import { PRESET_BY_ID } from '../instruments.js';

export function createRecorderPanel(app) {
  const { recorder, store } = app;

  const timeEl = h('div.rec-time', {}, '0:00');
  const statusEl = h('div.rec-status', {}, 'Ready');
  const playBtn = h('button.btn', { onclick: () => (recorder.state === 'playing' ? recorder.stop() : recorder.play()) });
  const stopBtn = h('button.btn', { onclick: () => recorder.stop(), html: `${icon('stop')}Stop` });
  const addBtn = h('button.btn', { onclick: () => recorder.addTrack(), html: `${icon('plus')}Add track` });
  const countIn = toggle(store.get('countIn'), (v) => store.set('countIn', v), 'Count-in');
  const exportSel = h('select.select', { title: 'Export format' },
    h('option', { value: 'mp3' }, 'MP3'),
    h('option', { value: 'wav' }, 'WAV'),
    h('option', { value: 'mid' }, 'MIDI'),
  );
  const exportBtn = h('button.btn.primary', { onclick: () => doExport(), html: `${icon('download')}Download` });
  const clearBtn = h('button.btn.ghost', {
    onclick: async () => {
      if (await confirmDialog('Clear **all recordings**? This cannot be undone.', { ok: 'Clear', danger: true })) recorder.clearAll();
    },
    html: `${icon('trash')}Clear all`,
  });
  const tracksEl = h('div.tracks');

  // ——— Video ———
  const video = app.video;
  const videoTime = h('span.rec-time.small', {}, '0:00');
  const videoBtn = h('button.btn', { onclick: () => toggleVideo() });
  const videoBlock = h('div.video-block', {},
    h('div', {}, h('b', {}, 'Record a video'), h('div.hint', {}, 'Captures the app with its light show and sound — perfect for sharing.')),
    h('div', { style: { flex: 1 } }),
    videoTime,
    videoBtn,
  );
  async function toggleVideo() {
    if (!video.supported) return toast('Video recording is not available here', { error: true });
    if (!video.recording) {
      try {
        await video.start();
        toast('Recording video — play away!');
      } catch (err) {
        console.warn(err);
        toast('Video recording was cancelled', { error: true });
      }
      return;
    }
    const res = await video.stop();
    if (!res) return;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const name = `Nocturne performance ${stamp}.${res.ext}`;
    const saved = await saveFile(name, new Uint8Array(await res.blob.arrayBuffer()), [{ name: 'Video', extensions: [res.ext] }]);
    if (saved) toast(`Saved ${saved.split(/[\\/]/).pop()}`, window.native?.revealFile && saved !== name ? { action: { label: 'Show', run: () => window.native.revealFile(saved) } } : {});
  }
  const syncVideo = () => {
    videoBtn.innerHTML = video.recording ? `${icon('stop')}Stop & save` : `${icon('record')}Start video`;
    videoBtn.classList.toggle('danger', video.recording);
    videoBlock.classList.toggle('live', video.recording);
  };
  video.on('state', syncVideo);
  setInterval(() => video.recording && (videoTime.textContent = formatTime(video.elapsed())), 500);
  syncVideo();

  const el = h('div', {},
    h('div.panel-head', {},
      h('div', {}, h('div.panel-title', {}, 'Recorder'), h('div.panel-sub', {}, 'Record up to four layered tracks, mix them and export')),
    ),
    h('div.rec-transport', {},
      playBtn, stopBtn, timeEl, statusEl,
      h('div', { style: { flex: 1 } }),
      h('span.muted', {}, 'Count-in'), countIn.el,
      addBtn, clearBtn, exportSel, exportBtn,
    ),
    tracksEl,
    videoBlock,
  );

  async function doExport() {
    if (!recorder.hasContent) return toast('Record something first');
    if (recorder.state !== 'idle') recorder.stop();
    const fmt = exportSel.value;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const name = `Nocturne ${stamp}.${fmt}`;
    exportBtn.disabled = true;
    const label = exportBtn.innerHTML;
    const setLabel = (t) => (exportBtn.textContent = t);
    try {
      let bytes;
      if (fmt === 'mid') {
        bytes = recorder.exportMidi(store.get('metroBpm'));
      } else {
        setLabel('Preparing…');
        const mix = await recorder.renderMix((p) => setLabel(`Mixing ${Math.round(p * 100)}%`));
        if (fmt === 'wav') bytes = encodeWav(mix);
        else bytes = await encodeMp3(mix, 192, (p) => setLabel(`Encoding ${Math.round(p * 100)}%`));
      }
      setLabel('Finalizing…');
      const filters = { mp3: [{ name: 'MP3 audio', extensions: ['mp3'] }], wav: [{ name: 'WAV audio', extensions: ['wav'] }], mid: [{ name: 'MIDI file', extensions: ['mid'] }] }[fmt];
      const saved = await saveFile(name, bytes, filters);
      if (saved) {
        toast(`Saved ${saved.split(/[\\/]/).pop()}`, window.native?.revealFile && saved !== name ? { action: { label: 'Show', run: () => window.native.revealFile(saved) } } : {});
      }
    } catch (err) {
      console.error(err);
      toast('Export failed — try again', { error: true });
    } finally {
      exportBtn.disabled = false;
      exportBtn.innerHTML = label;
    }
  }

  function drawRoll(canvas, track, color) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 400;
    const hgt = canvas.clientHeight || 40;
    canvas.width = w * dpr;
    canvas.height = hgt * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, hgt);
    const evs = track.events;
    if (!evs.length) {
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.font = '600 11px Manrope, sans-serif';
      ctx.fillText('Empty — press record and play', 10, hgt / 2 + 4);
      return;
    }
    const len = Math.max(track.length, 1);
    const ons = evs.filter((e) => e.type === 'on');
    const lo = Math.min(...ons.map((e) => e.midi)) - 2;
    const hi = Math.max(...ons.map((e) => e.midi)) + 2;
    ctx.fillStyle = color;
    const open = new Map();
    const bars = [];
    for (const e of evs) {
      if (e.type === 'on') open.set(e.midi, [...(open.get(e.midi) || []), e]);
      else {
        for (const on of open.get(e.midi) || []) bars.push([on, e.t]);
        open.delete(e.midi);
      }
    }
    for (const [, list] of open) for (const on of list) bars.push([on, Math.min(len, on.t + 1.5)]);
    for (const [on, end] of bars) {
      const x = (on.t / len) * (w - 8) + 4;
      const x2 = (end / len) * (w - 8) + 4;
      const y = hgt - 4 - ((on.midi - lo) / Math.max(1, hi - lo)) * (hgt - 8);
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y - 1.5, Math.max(2, x2 - x), 3);
    }
  }

  function render() {
    tracksEl.textContent = '';
    recorder.tracks.forEach((tr, i) => {
      const color = TRACK_COLORS[i % TRACK_COLORS.length];
      const isRec = recorder.recIndex === i && ['armed', 'countin', 'recording'].includes(recorder.state);
      const insts = tr.instIds.map((id) => PRESET_BY_ID.get(id)?.label).filter(Boolean);
      const canvas = h('canvas');
      const recBtn = h('button.track-rec', {
        title: isRec ? 'Stop recording' : tr.events.length ? 'Record again (replace)' : 'Record',
        html: icon(isRec ? 'stop' : 'record'),
        onclick: async () => {
          if (isRec) return recorder.stop();
          if (tr.events.length && !(await confirmDialog(`Replace **${tr.name}**?`, { ok: 'Replace', danger: true }))) return;
          recorder.countInEnabled = store.get('countIn');
          recorder.record(i);
        },
      });
      const lane = h(`div.track${isRec ? '.recording' : ''}${tr.include ? '' : '.excluded'}`, {},
        recBtn,
        h('div.track-name', {},
          h('b', {}, h('i', { style: { background: color } }), tr.name),
          h('span', {}, tr.events.length ? `${formatTime(tr.length)} · ${insts.join(', ') || 'Piano'}` : 'Empty'),
        ),
        canvas,
        h('div.track-actions', {},
          trackVolume(i, tr),
          tr.events.length ? quantizeSelect(i, tr) : null,
          h(`button.icon-btn.ghost${tr.include ? '' : '.on'}`, {
            title: tr.include ? 'Exclude from mix' : 'Include in mix',
            html: icon(tr.include ? 'eye' : 'eyeOff'),
            onclick: () => recorder.toggleInclude(i),
          }),
          h('button.icon-btn.ghost', {
            title: 'Delete track',
            html: icon('trash'),
            onclick: async () => {
              if (!tr.events.length || (await confirmDialog(`Delete **${tr.name}**?`, { ok: 'Delete', danger: true }))) recorder.deleteTrack(i);
            },
          }),
        ),
      );
      tracksEl.append(lane);
      requestAnimationFrame(() => drawRoll(canvas, tr, color));
    });
    addBtn.disabled = recorder.tracks.length >= MAX_TRACKS;
    syncTransport();
  }

  function trackVolume(i, tr) {
    const sl = slider({ min: 0, max: 1.5, step: 0.01, value: tr.vol ?? 1, format: (v) => `${Math.round(v * 100)}%`, onInput: (v) => recorder.setVolume(i, v) });
    sl.el.classList.add('track-vol');
    sl.el.title = 'Track volume';
    return sl.el;
  }

  function quantizeSelect(i, tr) {
    const sel = h('select.select.small', {
      title: 'Snap the notes to the beat',
      onchange: () => {
        const v = sel.value;
        if (v === 'undo') recorder.undoQuantize(i);
        else if (v) {
          recorder.quantize(i, Number(v));
          toast(`${tr.name} quantized`, { action: { label: 'Undo', run: () => recorder.undoQuantize(i) } });
        }
      },
    },
      h('option', { value: '' }, 'Quantize'),
      ...QUANTIZE.map(([label, beats]) => h('option', { value: beats }, `Snap to ${label}`)),
      tr.undo ? h('option', { value: 'undo' }, 'Undo quantize') : null,
    );
    return sel;
  }

  function syncTransport() {
    const st = recorder.state;
    playBtn.innerHTML = st === 'playing' ? `${icon('pause')}Stop` : `${icon('play')}Play mix`;
    playBtn.disabled = !recorder.hasContent || ['armed', 'countin', 'recording'].includes(st);
    stopBtn.disabled = st === 'idle';
    exportBtn.disabled = !recorder.hasContent || st !== 'idle';
    statusEl.className = 'rec-status';
    if (st === 'armed') {
      statusEl.textContent = 'Get ready… play any key';
      statusEl.classList.add('ready');
    } else if (st === 'countin') {
      statusEl.textContent = 'Get ready…';
      statusEl.classList.add('ready');
    } else if (st === 'recording') {
      statusEl.textContent = '● Recording';
      statusEl.classList.add('live');
    } else if (st === 'playing') statusEl.textContent = 'Playing';
    else statusEl.textContent = recorder.hasContent ? 'Ready' : 'Nothing recorded yet';
  }

  let raf = 0;
  const tick = () => {
    if (recorder.state === 'recording') timeEl.textContent = formatTime(recorder.recordingTime());
    else if (recorder.state === 'playing') timeEl.textContent = formatTime(recorder.player.time());
    if (recorder.state !== 'idle') raf = requestAnimationFrame(tick);
  };
  recorder.on('state', (st) => {
    render();
    cancelAnimationFrame(raf);
    if (st !== 'idle') tick();
    else timeEl.textContent = formatTime(recorder.tracks.reduce((m, t) => Math.max(m, t.include ? t.length : 0), 0));
  });
  recorder.on('change', render);
  metronomeCountIn(app, statusEl);
  render();

  return { el, onOpen: render };
}

function metronomeCountIn(app, statusEl) {
  app.metronome.on('countin', ({ left }) => {
    if (app.recorder.state === 'countin') statusEl.textContent = `Get ready… ${left}`;
  });
}
