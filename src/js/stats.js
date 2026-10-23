// Practice tracker: minutes played, notes, daily streak, favourite sounds and key usage.
import { Emitter, loadJSON, saveJSON } from './util.js';

const KEY = 'nocturne.stats.v1';
const IDLE_GAP = 6; // seconds without a note before practice time stops counting

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export class Stats extends Emitter {
  constructor() {
    super();
    const saved = loadJSON(KEY, {});
    this.data = { days: {}, keys: Array(128).fill(0), sounds: {}, songs: {}, totalNotes: 0, totalSeconds: 0, ...saved };
    this.lastNote = 0;
    this._dirty = false;
    setInterval(() => this._flush(), 10000);
    window.addEventListener('beforeunload', () => this._flush());
  }

  today() {
    const k = dayKey();
    if (!this.data.days[k]) this.data.days[k] = { notes: 0, seconds: 0 };
    return this.data.days[k];
  }

  note(midi, instId) {
    const now = performance.now() / 1000;
    const day = this.today();
    const gap = now - this.lastNote;
    if (this.lastNote && gap < IDLE_GAP) {
      day.seconds += gap;
      this.data.totalSeconds += gap;
      if (instId) this.data.sounds[instId] = (this.data.sounds[instId] || 0) + gap;
    }
    this.lastNote = now;
    day.notes++;
    this.data.totalNotes++;
    if (midi >= 0 && midi < 128) this.data.keys[midi]++;
    this._dirty = true;
  }

  songResult(songId, title, score) {
    const s = (this.data.songs[songId] ||= { title, plays: 0, best: 0 });
    s.plays++;
    s.title = title;
    if (score != null) s.best = Math.max(s.best, score);
    this._dirty = true;
    this._flush();
  }

  streak() {
    let n = 0;
    const d = new Date();
    // Today counts once you've played; otherwise the streak is measured up to yesterday.
    if (!this._active(dayKey(d))) d.setDate(d.getDate() - 1);
    while (this._active(dayKey(d))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  _active(k) {
    const day = this.data.days[k];
    return !!day && (day.seconds >= 60 || day.notes >= 50);
  }

  lastDays(n = 14) {
    const out = [];
    const d = new Date();
    d.setDate(d.getDate() - (n - 1));
    for (let i = 0; i < n; i++) {
      const k = dayKey(d);
      out.push({ key: k, label: d.toLocaleDateString(undefined, { weekday: 'short' }), date: d.getDate(), ...(this.data.days[k] || { notes: 0, seconds: 0 }) });
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  reset() {
    this.data = { days: {}, keys: Array(128).fill(0), sounds: {}, songs: {}, totalNotes: 0, totalSeconds: 0 };
    this._dirty = true;
    this._flush();
  }

  _flush() {
    if (!this._dirty) return;
    this._dirty = false;
    saveJSON(KEY, this.data);
    this.emit('change');
  }
}
