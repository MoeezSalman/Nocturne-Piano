// Plays a song on the stage in three modes (like the original):
//   Demo        the app plays everything and shows the keys
//   Play Along  the song runs at tempo; you play your hand's notes and get a score
//   Practice    the song waits until you press the right keys
// Two displays: a scrolling strip of key letters / note names, or falling notes onto the keys.
import { Emitter, h, formatTime } from './util.js';
import { icon } from './ui/icons.js';
import { segmented } from './ui/controls.js';
import { Sequencer, scheduledHandle } from './sequencer.js';
import { songEvents, songDuration } from './song-format.js';
import { noteName } from './notes.js';
import { roundRect } from './visualizer.js';
import { PRESET_BY_ID } from './instruments.js';

const HIT_WINDOW = 0.3; // seconds of song time either side of a note
const STRIP_PPS = 170; // letters strip, pixels per second
const FALL_PPS = 190; // waterfall, pixels per second
const SPEEDS = [0.25, 0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5];

export class SongPlayer extends Emitter {
  constructor(app) {
    super();
    this.app = app;
    this.engine = app.engine;
    this.store = app.store;
    this.song = null;
    this.notes = [];
    this.groups = [];
    this.pending = 0;
    this.stats = { hit: 0, missed: 0, extra: 0 };
    this.raf = 0;
    this.seq = new Sequencer(this.engine.ctx, (ev, at, rate) => this._onEvent(ev, at, rate));
    this.seq.on('state', (s) => this._onState(s));
    this.hud = document.getElementById('song-hud');
    this._buildHud();
    app.performance.on('down', (e) => this._userDown(e.keyMidi));
  }

  get mode() {
    return this.store.get('songMode');
  }

  // ——— HUD ———
  _buildHud() {
    const st = this.store;
    this.playBtn = h('button.play-btn', { title: 'Play / pause', onclick: () => this.togglePlay() });
    this.titleEl = h('div.title', {}, h('b'), h('span'));
    this.modeSeg = segmented([['demo', 'Demo'], ['along', 'Play Along'], ['practice', 'Practice']], st.get('songMode'), (v) => this.setMode(v));
    this.handsSeg = segmented([['both', 'Both'], ['right', 'Right'], ['left', 'Left']], st.get('songHands'), (v) => {
      st.set('songHands', v);
      this.handsSeg.set(v);
      this.restart(false);
    });
    this.speedSel = h('select.select', { title: 'Speed', onchange: () => this.setSpeed(Number(this.speedSel.value)) },
      ...SPEEDS.map((s) => h('option', { value: s }, s === 1 ? 'Original' : `${Math.round(s * 100)}%`)),
    );
    this.speedSel.value = String(st.get('songSpeed'));
    this.displaySeg = segmented([['letters', 'Letters'], ['waterfall', 'Waterfall']], st.get('songDisplay'), (v) => {
      st.set('songDisplay', v);
      this.displaySeg.set(v);
      this._applyDisplay();
    });
    this.labelSeg = segmented([['qwerty', 'QWERTY'], ['cde', 'CDE']], st.get('songLabels'), (v) => {
      st.set('songLabels', v);
      this.labelSeg.set(v);
    });
    this.curTime = h('span', {}, '0:00');
    this.endTime = h('span', {}, '0:00');
    this.fill = h('div.fill');
    this.knob = h('div.knob');
    const line = h('div.track-line', {}, this.fill, this.knob);
    const seekTo = (e) => {
      const r = line.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      this.seek(f * this.seq.duration);
    };
    line.addEventListener('pointerdown', (e) => {
      line.setPointerCapture(e.pointerId);
      seekTo(e);
      const move = (ev) => seekTo(ev);
      line.addEventListener('pointermove', move);
      line.addEventListener('pointerup', () => line.removeEventListener('pointermove', move), { once: true });
    });

    this.bar = h('div.song-bar', {},
      h('button.icon-btn', { html: icon('back'), title: 'Back to songs', onclick: () => this.close(true) }),
      this.playBtn,
      h('button.icon-btn', { html: icon('restart'), title: 'Restart', onclick: () => this.restart(true) }),
      this.titleEl,
      this.modeSeg.el,
      this.handsSeg.el,
      this.speedSel,
      h('div.timeline', {}, this.curTime, line, this.endTime),
      this.displaySeg.el,
      this.labelSeg.el,
    );
    this.canvas = h('canvas');
    this.canvasWrap = h('div.song-canvas', {}, this.canvas);
    this.waitBadge = h('div.waiting', { hidden: true }, 'Waiting for note…');
    this.intro = h('div.song-intro');
    this.result = h('div.song-result', { hidden: true });
    this.canvasWrap.append(this.waitBadge);
    this.hud.append(this.bar, this.canvasWrap, this.intro, this.result);
    new ResizeObserver(() => this._sizeCanvas()).observe(this.canvasWrap);
  }

  _sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvasWrap.getBoundingClientRect();
    this.cw = r.width;
    this.ch = r.height;
    this.canvas.width = Math.max(1, r.width * dpr);
    this.canvas.height = Math.max(1, r.height * dpr);
    this.canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _renderIntro() {
    const s = this.song;
    const suggested = s.instrument && PRESET_BY_ID.get(s.instrument);
    const evs = this.events;
    const modeSeg = segmented([['demo', 'Demo'], ['along', 'Play Along'], ['practice', 'Practice']], this.mode, (v) => {
      this.setMode(v);
      modeSeg.set(v);
    });
    const handsSeg = segmented([['both', 'Both hands'], ['right', 'Right'], ['left', 'Left']], this.store.get('songHands'), (v) => {
      this.store.set('songHands', v);
      handsSeg.set(v);
      this.handsSeg.set(v);
    });
    const hasLeft = evs.some((e) => e.hand === 'L');
    this.intro.textContent = '';
    this.intro.append(
      h('div.song-intro-card', {},
        h('div.big-art', {}, s.title.replace(/^[^A-Za-z]+/, '')[0] || '♪'),
        h('div', {},
          h('h2', {}, s.title),
          h('div.by', {}, s.composer),
          h('div.facts', {},
            h('span', {}, `${formatTime(songDuration(evs))}`),
            h('span', {}, `${evs.length} notes`),
            h('span', {}, `${s.bpm} BPM · ${s.timeSig}`),
            h('span', {}, `Level ${s.level}`),
            s.note ? h('span', {}, s.note) : null,
          ),
        ),
        h('div.opts', {},
          h('div.opt', {}, h('span', {}, 'Mode'), modeSeg.el),
          hasLeft ? h('div.opt', {}, h('span', {}, 'Your part'), handsSeg.el) : null,
          suggested && this.engine.currentId !== suggested.id
            ? h('div.opt', {}, h('span', {}, 'Suggested sound'), h('button.btn', { onclick: (e) => (this.app.selectInstrument(suggested.id), e.currentTarget.remove()) }, suggested.label))
            : null,
          h('div', { style: { flex: 1 } }),
          h('button.btn.primary', { style: { height: '42px', padding: '0 22px' }, onclick: () => this.start(), html: `${icon('play')}Play Song` }),
        ),
      ),
    );
    this.intro.hidden = false;
  }

  // ——— Lifecycle ———
  open(song) {
    this.close(false);
    this.song = song;
    this.events = songEvents(song);
    this.seq.load(this.events, songDuration(this.events) + 0.8);
    this.seq.setRate(this.store.get('songSpeed'));
    this.titleEl.querySelector('b').textContent = song.title;
    this.titleEl.querySelector('span').textContent = song.composer;
    this.endTime.textContent = formatTime(this.seq.duration);
    this.modeSeg.set(this.mode);
    this.handsSeg.set(this.store.get('songHands'));
    this.hud.hidden = false;
    this.result.hidden = true;
    const lo = Math.min(...this.events.map((e) => e.midi));
    const hi = Math.max(...this.events.map((e) => e.midi));
    this.app.ensureVisible(lo, hi);
    this._prepare();
    this._renderIntro();
    this._applyDisplay();
    this._sizeCanvas();
    this._loop();
    const recent = [song.id, ...this.store.get('recentSongs').filter((id) => id !== song.id)].slice(0, 20);
    this.store.set('recentSongs', recent);
    this.emit('open', song);
  }

  close(backToLibrary) {
    if (!this.song) return;
    this.seq.stop();
    this._cleanupVisuals();
    this.song = null;
    this.hud.hidden = true;
    this.app.visualizer.overlay = null;
    cancelAnimationFrame(this.raf);
    this.emit('close');
    if (backToLibrary) this.app.openDrawer('songs');
  }

  start() {
    this.intro.hidden = true;
    this.result.hidden = true;
    if (this.seq.pos >= this.seq.duration - 0.01) this.restart(false);
    this.seq.play();
  }

  togglePlay() {
    if (!this.song) return;
    if (this.seq.playing) this.seq.pause();
    else this.start();
  }

  restart(play = true) {
    const was = this.seq.playing || play;
    this.seq.stop();
    this._cleanupVisuals();
    this._prepare();
    this.result.hidden = true;
    if (was && this.song) {
      this.intro.hidden = true;
      this.seq.play();
    }
  }

  seek(t) {
    this._cleanupVisuals();
    for (const n of this.notes) {
      if (n.t >= t - 0.01) {
        n.hit = false;
        n.missed = false;
      }
    }
    this.pending = this.groups.findIndex((g) => g.t >= t - 0.01);
    if (this.pending < 0) this.pending = this.groups.length;
    this.seq.holdAt = this.mode === 'practice' ? this.groups[this.pending]?.t ?? null : null;
    this.seq.seek(t);
  }

  setMode(v) {
    this.store.set('songMode', v);
    this.modeSeg.set(v);
    if (this.song) this.restart(false);
  }

  setSpeed(v) {
    this.store.set('songSpeed', v);
    this.seq.setRate(v);
  }

  _isUser(n) {
    if (this.mode === 'demo') return false;
    const hands = this.store.get('songHands');
    return hands === 'both' || (hands === 'right' && n.hand === 'R') || (hands === 'left' && n.hand === 'L');
  }

  _prepare() {
    this.notes = this.events.map((e, i) => ({ ...e, id: i, user: false, hit: false, missed: false }));
    for (const n of this.notes) n.user = this._isUser(n);
    this.seq.events = this.notes;
    this.groups = [];
    for (const n of this.notes) {
      if (!n.user) continue;
      const g = this.groups.at(-1);
      if (g && n.t - g.t < 0.04) g.notes.push(n);
      else this.groups.push({ t: n.t, notes: [n] });
    }
    this.pending = 0;
    this.stats = { hit: 0, missed: 0, extra: 0 };
    this.seq.holdAt = this.mode === 'practice' && this.groups.length ? this.groups[0].t : null;
    this.app.piano.clearGuides();
  }

  // ——— Scheduling ———
  _onEvent(n, at, rate) {
    const ctx = this.engine.ctx;
    const dur = n.dur / rate;
    const delay = Math.max(0, (at - ctx.currentTime) * 1000);
    const piano = this.app.piano;
    const viz = this.app.visualizer;
    const ribbons = this.store.get('songDisplay') !== 'waterfall';
    if (!n.user) {
      const voice = this.engine.scheduleNote(n.midi, at, dur, { channel: 'song', velocity: 1 });
      let pressed = false;
      const t1 = setTimeout(() => {
        pressed = true;
        piano.press(n.midi, 'song');
        if (ribbons) viz.noteOn(n.midi, 'song');
      }, delay);
      const t2 = setTimeout(() => {
        if (!pressed) return;
        pressed = false;
        piano.release(n.midi, 'song');
        viz.noteOff(n.midi, 'song');
      }, delay + dur * 1000);
      return scheduledHandle(ctx, voice, at + dur + 0.4, [t1, t2], () => {
        if (pressed) {
          piano.release(n.midi, 'song');
          viz.noteOff(n.midi, 'song');
        }
      });
    }
    if (this.mode === 'along') {
      let on = false;
      const kind = n.hand === 'L' ? 'left' : 'next';
      const t1 = setTimeout(() => {
        on = true;
        piano.setGuide(n.midi, kind);
      }, Math.max(0, delay - 120));
      const t2 = setTimeout(() => {
        on = false;
        piano.setGuide(n.midi, null);
      }, delay + Math.max(150, dur * 1000));
      return scheduledHandle(ctx, null, at + dur + 0.4, [t1, t2], () => on && piano.setGuide(n.midi, null));
    }
    return null;
  }

  _cleanupVisuals() {
    this.app.piano.releaseSource('song');
    this.app.piano.clearGuides();
    this.app.visualizer.clear('song');
    this.waitBadge.hidden = true;
  }

  _onState(s) {
    this.playBtn.innerHTML = icon(s === 'playing' ? 'pause' : 'play');
    if (s === 'ended' && this.song) this._showResult();
  }

  _showResult() {
    this._cleanupVisuals();
    const user = this.notes.filter((n) => n.user);
    const card = h('div.card');
    if (this.mode === 'demo' || !user.length) {
      card.append(h('div.panel-title', {}, 'Bravo!'), h('p.muted', {}, `${this.song.title} — finished`));
      this.emit('result', { song: this.song, score: null });
    } else {
      const hits = user.filter((n) => n.hit).length;
      const pct = Math.round((hits / user.length) * 100);
      this.emit('result', { song: this.song, score: pct });
      card.append(
        h('div.muted', {}, this.mode === 'practice' ? 'Practice complete' : 'Your score'),
        h('div.score', {}, `${pct}%`),
        h('p.muted', {}, `${hits} of ${user.length} notes${this.stats.extra ? ` · ${this.stats.extra} extra` : ''}`),
      );
    }
    card.append(
      h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '14px' } },
        h('button.btn.primary', { onclick: () => this.restart(true), html: `${icon('restart')}Play again` }),
        h('button.btn', { onclick: () => this.close(true) }, 'More songs'),
      ),
    );
    this.result.textContent = '';
    this.result.append(card);
    this.result.hidden = false;
  }

  // ——— Your playing ———
  _userDown(midi) {
    if (!this.song || !this.seq.playing || this.mode === 'demo') return;
    const now = this.seq.time();
    if (this.mode === 'practice') {
      const g = this.groups[this.pending];
      if (!g) return;
      if (now < g.t - 0.35) return;
      const n = g.notes.find((x) => x.midi === midi && !x.hit);
      if (n) {
        n.hit = true;
        this.app.piano.setGuide(midi, null);
        if (g.notes.every((x) => x.hit)) {
          this.pending++;
          this.waitBadge.hidden = true;
          const next = this.groups[this.pending];
          this.seq.setHold(next ? next.t : null);
        }
      } else if (!g.notes.some((x) => x.midi === midi)) {
        this.stats.extra++;
        this.app.piano.flash(midi);
      }
      return;
    }
    // Play Along
    let best = null;
    for (const n of this.notes) {
      if (!n.user || n.hit || n.midi !== midi) continue;
      const d = Math.abs(n.t - now);
      if (d <= HIT_WINDOW && (!best || d < Math.abs(best.t - now))) best = n;
      if (n.t > now + HIT_WINDOW) break;
    }
    if (best) {
      best.hit = true;
      best.missed = false;
    } else {
      this.stats.extra++;
      this.app.piano.flash(midi);
    }
  }

  // ——— Drawing ———
  _applyDisplay() {
    const fall = this.store.get('songDisplay') === 'waterfall';
    this.canvas.style.visibility = fall ? 'hidden' : 'visible';
    this.app.visualizer.overlay = fall && this.song ? (ctx, viz) => this._drawWaterfall(ctx, viz) : null;
    this.app.visualizer.kick();
  }

  _loop() {
    cancelAnimationFrame(this.raf);
    const frame = () => {
      if (!this.song) return;
      const now = this.seq.time();
      const dur = this.seq.duration || 1;
      this.curTime.textContent = formatTime(now);
      const f = Math.min(1, now / dur);
      this.fill.style.width = `${f * 100}%`;
      this.knob.style.left = `${f * 100}%`;
      if (this.mode === 'along') {
        for (const n of this.notes) {
          if (n.t > now) break;
          if (n.user && !n.hit && !n.missed && n.t < now - HIT_WINDOW) n.missed = true;
        }
      }
      if (this.mode === 'practice' && this.seq.playing) {
        const g = this.groups[this.pending];
        const waiting = g && now >= g.t - 0.02;
        this.waitBadge.hidden = !waiting;
        if (g && now >= g.t - 0.25) for (const n of g.notes) if (!n.hit) this.app.piano.setGuide(n.midi, n.hand === 'L' ? 'left' : 'wait');
      }
      if (this.store.get('songDisplay') === 'letters') this._drawLetters(now);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  _label(midi) {
    if (this.store.get('songLabels') === 'qwerty') {
      const l = this.app.performance.labels.get(midi);
      if (l) return { main: l, sub: '' };
    }
    const style = this.store.get('noteLabels') === 'solfege' ? 'solfege' : 'cde';
    return { main: noteName(midi, style, false), sub: String(Math.floor(midi / 12) - 1), dim: this.store.get('songLabels') === 'qwerty' };
  }

  _drawLetters(now) {
    const ctx = this.canvas.getContext('2d');
    const w = this.cw;
    const hgt = this.ch;
    ctx.clearRect(0, 0, w, hgt);
    if (!w || !hgt) return;
    const playX = Math.round(w * 0.3);
    const cy = hgt / 2;
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--accent').trim();
    const danger = styles.getPropertyValue('--danger').trim();
    const song = styles.getPropertyValue('--song').trim();
    const size = Math.max(20, Math.min(34, hgt / 7));
    // Group notes that start together into one column.
    const cols = [];
    for (const n of this.notes) {
      const x = playX + (n.t - now) * STRIP_PPS;
      if (x < -60) continue;
      if (x > w + 60) break;
      const c = cols.at(-1);
      if (c && Math.abs(c.t - n.t) < 0.04) c.notes.push(n);
      else cols.push({ t: n.t, x, notes: [n] });
    }
    // Playhead
    const grad = ctx.createLinearGradient(0, 0, 0, hgt);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, accent);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(playX - 1, hgt * 0.12, 2, hgt * 0.76);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const c of cols) {
      const notes = [...c.notes].sort((a, b) => b.midi - a.midi);
      const userNotes = this.mode === 'demo' ? notes : notes.filter((n) => n.user);
      const shown = userNotes.length ? userNotes : notes;
      const auto = !userNotes.length && this.mode !== 'demo';
      const lineH = size * 1.05;
      const top = cy - ((shown.length - 1) * lineH) / 2;
      shown.forEach((n, i) => {
        const y = top + i * lineH;
        const past = n.t <= now + 0.01;
        const near = Math.abs(n.t - now) < 0.12;
        let color = 'rgba(240,235,224,.92)';
        if (auto) color = 'rgba(240,235,224,.22)';
        else if (this.mode === 'demo') color = past ? song : 'rgba(240,235,224,.92)';
        else if (n.hit) color = accent;
        else if (n.missed) color = danger;
        else if (past) color = 'rgba(240,235,224,.55)';
        const { main, sub, dim } = this._label(n.midi);
        const fs = auto ? size * 0.62 : size;
        ctx.font = `800 ${fs}px Manrope, sans-serif`;
        ctx.fillStyle = color;
        ctx.globalAlpha = dim && !auto ? 0.6 : 1;
        if (near && !auto) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 18;
        }
        ctx.fillText(main, c.x, y);
        ctx.shadowBlur = 0;
        if (sub) {
          ctx.font = `700 ${fs * 0.42}px Manrope, sans-serif`;
          ctx.fillText(sub, c.x + ctx.measureText(main).width / 2 + fs * 0.35, y + fs * 0.28);
        }
        ctx.globalAlpha = 1;
      });
    }
    // Fade edges
    ctx.globalCompositeOperation = 'destination-out';
    const fadeL = ctx.createLinearGradient(0, 0, 80, 0);
    fadeL.addColorStop(0, 'rgba(0,0,0,1)');
    fadeL.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fadeL;
    ctx.fillRect(0, 0, 80, hgt);
    const fadeR = ctx.createLinearGradient(w - 120, 0, w, 0);
    fadeR.addColorStop(0, 'rgba(0,0,0,0)');
    fadeR.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = fadeR;
    ctx.fillRect(w - 120, 0, 120, hgt);
    ctx.globalCompositeOperation = 'source-over';
  }

  _drawWaterfall(ctx, viz) {
    if (!this.song) return false;
    const now = this.seq.time();
    const bottom = viz.h;
    const horizon = now + bottom / FALL_PPS;
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--accent').trim();
    const left = '#ffb35c';
    const danger = styles.getPropertyValue('--danger').trim();
    // Beat grid lines
    ctx.save();
    const spb = 60 / (this.song.bpm || 120);
    const beatsPerBar = Number((this.song.timeSig || '4/4').split('/')[0]) * (4 / Number((this.song.timeSig || '4/4').split('/')[1]));
    const barLen = spb * beatsPerBar;
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    for (let t = Math.ceil(now / barLen) * barLen; t < horizon; t += barLen) {
      const y = bottom - (t - now) * FALL_PPS;
      ctx.beginPath();
      ctx.moveTo(viz.kx, y);
      ctx.lineTo(viz.kx + viz.kw, y);
      ctx.stroke();
    }
    for (const n of this.notes) {
      if (n.t > horizon) break;
      if (n.t + n.dur < now - 0.5) continue;
      const k = viz.keyX(n.midi);
      if (!k) continue;
      const y2 = bottom - (n.t - now) * FALL_PPS;
      const y1 = bottom - (n.t + n.dur - now) * FALL_PPS;
      const w = Math.max(4, k.w * (k.black ? 0.9 : 0.78));
      const x = k.x + (k.w - w) / 2;
      let color = n.hand === 'L' ? left : accent;
      if (this.mode !== 'demo' && !n.user) color = 'rgba(160,160,175,.55)';
      if (n.missed) color = danger;
      const active = n.t <= now && n.t + n.dur > now;
      ctx.globalAlpha = n.user && !n.hit && n.t < now - 0.4 ? 0.35 : 1;
      const g = ctx.createLinearGradient(0, y1, 0, y2);
      g.addColorStop(0, color);
      g.addColorStop(1, active ? '#ffffff' : color);
      ctx.fillStyle = g;
      if (active) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
      }
      roundRect(ctx, x, y1, w, Math.max(4, y2 - y1), Math.min(6, w / 2));
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    return true;
  }
}
