// Look-ahead scheduler that plays a list of timed events against the AudioContext clock.
// Songs, recorder playback and the notepad all use it. Event times are in seconds at 1× speed.
import { Emitter } from './util.js';

const LOOKAHEAD = 0.15;
const TICK_MS = 25;

export class Sequencer extends Emitter {
  /**
   * @param ctx AudioContext
   * @param onEvent (event, audioTime, rate) => any  — schedule sound/visuals for one event
   */
  constructor(ctx, onEvent) {
    super();
    this.ctx = ctx;
    this.onEvent = onEvent;
    this.events = [];
    this.duration = 0;
    this.rate = 1;
    this.playing = false;
    this.pos = 0;
    this.idx = 0;
    this.anchorCtx = 0;
    this.anchorSong = 0;
    this.holdAt = null; // song time the clock may not pass (practice mode)
    this.timer = null;
    this.handles = []; // things to cancel on pause/seek: { cancel() }
  }

  load(events, duration) {
    this.stop();
    this.events = [...events].sort((a, b) => a.t - b.t);
    const last = this.events.reduce((m, e) => Math.max(m, e.t + (e.dur || 0)), 0);
    this.duration = duration ?? last;
    this.pos = 0;
    this.idx = 0;
  }

  /** Current song time in seconds (1× scale). */
  time() {
    if (!this.playing) return this.pos;
    const raw = this.anchorSong + Math.max(0, this.ctx.currentTime - this.anchorCtx) * this.rate;
    return this.holdAt != null ? Math.min(raw, this.holdAt) : raw;
  }

  audioTimeOf(songT) {
    return this.anchorCtx + (songT - this.anchorSong) / this.rate;
  }

  _firstIndexAt(t) {
    let lo = 0;
    let hi = this.events.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.events[mid].t < t - 1e-6) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  play() {
    if (this.playing) return;
    if (this.pos >= this.duration) this.pos = 0;
    this.playAt(this.ctx.currentTime + 0.06, this.pos);
  }

  /** Starts so that song time `from` lands exactly on AudioContext time `ctxTime`. */
  playAt(ctxTime, from = 0) {
    if (this.playing) this.pause();
    this.pos = from;
    this.playing = true;
    this.anchorSong = from;
    this.anchorCtx = ctxTime;
    this.idx = this._firstIndexAt(from);
    this.timer = setInterval(() => this._tick(), TICK_MS);
    this._tick();
    this.emit('state', 'playing');
  }

  pause() {
    if (!this.playing) return;
    this.pos = this.time();
    this.playing = false;
    clearInterval(this.timer);
    this.timer = null;
    this._cancelHandles();
    this.emit('state', 'paused');
  }

  stop() {
    this.pause();
    this.pos = 0;
    this.idx = 0;
    this.holdAt = null;
  }

  seek(t) {
    const was = this.playing;
    if (was) this.pause();
    this.pos = Math.max(0, Math.min(this.duration, t));
    this.idx = this._firstIndexAt(this.pos);
    this.emit('seek', this.pos);
    if (was) this.play();
  }

  setRate(rate) {
    if (this.playing) {
      const now = this.time();
      this.anchorSong = now;
      this.anchorCtx = this.ctx.currentTime;
    }
    this.rate = rate;
  }

  /** Practice mode: stop the clock at songT until release() is called. */
  setHold(songT) {
    if (this.playing && this.holdAt != null && songT !== this.holdAt) {
      // Re-anchor if the clock was frozen at the previous hold point.
      const raw = this.anchorSong + Math.max(0, this.ctx.currentTime - this.anchorCtx) * this.rate;
      if (raw >= this.holdAt) {
        this.anchorSong = this.holdAt;
        this.anchorCtx = this.ctx.currentTime;
      }
    }
    this.holdAt = songT;
  }

  isHolding() {
    if (!this.playing || this.holdAt == null) return false;
    const raw = this.anchorSong + Math.max(0, this.ctx.currentTime - this.anchorCtx) * this.rate;
    return raw >= this.holdAt;
  }

  track(handle) {
    if (handle) this.handles.push(handle);
  }

  _cancelHandles() {
    for (const h of this.handles) h.cancel?.();
    this.handles = [];
  }

  _tick() {
    if (!this.playing) return;
    const horizon = this.anchorSong + (this.ctx.currentTime + LOOKAHEAD - this.anchorCtx) * this.rate;
    const limit = this.holdAt != null ? Math.min(horizon, this.holdAt + 1e-6) : horizon;
    while (this.idx < this.events.length && this.events[this.idx].t <= limit) {
      const ev = this.events[this.idx++];
      const at = this.audioTimeOf(ev.t);
      this.track(this.onEvent(ev, at, this.rate));
    }
    // Drop handles whose notes are long over.
    if (this.handles.length > 128) this.handles = this.handles.filter((h) => (h.until ?? Infinity) > this.ctx.currentTime);
    const now = this.time();
    this.emit('time', now);
    if (this.idx >= this.events.length && now >= this.duration) {
      this.playing = false;
      clearInterval(this.timer);
      this.timer = null;
      this.pos = this.duration;
      this.emit('state', 'ended');
    }
  }
}

/**
 * Wraps a scheduled voice plus its visual timers so a pause can silence both.
 * `until` is the audio time after which the handle no longer matters.
 */
export function scheduledHandle(ctx, voice, until, timers = [], onCancel = null) {
  return {
    until,
    cancel() {
      if (voice && ctx.currentTime < until) voice.kill(ctx.currentTime);
      for (const id of timers) clearTimeout(id);
      onCancel?.();
    },
  };
}
