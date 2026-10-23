// Records a video of the app window with its sound, ready to share.
import { Emitter } from './util.js';

const TYPES = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];

export class VideoRecorder extends Emitter {
  constructor(engine) {
    super();
    this.engine = engine;
    this.recording = false;
    this.startedAt = 0;
  }

  get supported() {
    return !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== 'undefined';
  }

  async start() {
    if (this.recording) return;
    const display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 60, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
    });
    this.display = display;
    this.dest = this.engine.ctx.createMediaStreamDestination();
    this.engine.chain.output.connect(this.dest);
    const stream = new MediaStream([...display.getVideoTracks(), ...this.dest.stream.getAudioTracks()]);
    this.mime = TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    this.chunks = [];
    this.rec = new MediaRecorder(stream, { mimeType: this.mime || undefined, videoBitsPerSecond: 10_000_000, audioBitsPerSecond: 192_000 });
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.done = new Promise((resolve) => (this.rec.onstop = resolve));
    display.getVideoTracks()[0].addEventListener('ended', () => this.stop());
    this.rec.start(1000);
    this.recording = true;
    this.startedAt = performance.now();
    this.emit('state', true);
  }

  /** Stops and resolves { blob, ext }. */
  async stop() {
    if (!this.recording) return null;
    this.recording = false;
    this.rec.stop();
    await this.done;
    for (const t of this.display.getTracks()) t.stop();
    try {
      this.engine.chain.output.disconnect(this.dest);
    } catch {
      /* already disconnected */
    }
    this.emit('state', false);
    const type = this.rec.mimeType || this.mime || 'video/webm';
    return { blob: new Blob(this.chunks, { type }), ext: type.includes('mp4') ? 'mp4' : 'webm' };
  }

  elapsed() {
    return this.recording ? (performance.now() - this.startedAt) / 1000 : 0;
  }
}
