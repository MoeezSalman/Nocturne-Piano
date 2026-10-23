// Effects rack. With every effect off and the "Original" room, the chain is identical to the
// original site's: tone filter → dry + 1.8 s reverb → master.
//
//   voices ─► tone ─► EQ ─► drive ─► chorus ─► tremolo ─┬─────────────► master ─► limiter ─► volume ─► out
//                                                      ├─► reverb ─► wet ─┘
//                                                      └─► echo (ping-pong) ─┘

export const REVERB_WET = 0.15;
export const LOWPASS_Q = 0.5;
export const MASTER_GAIN = 0.4;

export const ROOMS = {
  original: { label: 'Original', seconds: 1.8, decay: 2.5 },
  room: { label: 'Studio room', seconds: 0.8, decay: 3.2, damp: 7000 },
  hall: { label: 'Concert hall', seconds: 3.2, decay: 2.1, damp: 9000, pre: 0.025 },
  cathedral: { label: 'Cathedral', seconds: 6.5, decay: 1.6, damp: 5200, pre: 0.045 },
  plate: { label: 'Plate', seconds: 2.4, decay: 2.6, pre: 0.008, bright: true },
  space: { label: 'Deep space', seconds: 9, decay: 1.2, damp: 4000, pre: 0.08 },
};

export const DEFAULT_FX = {
  room: 'original',
  eqOn: false,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  driveOn: false,
  drive: 0.35,
  chorusOn: false,
  chorusDepth: 0.5,
  chorusRate: 0.9,
  tremoloOn: false,
  tremoloMode: 'volume', // volume | pan
  tremoloRate: 5,
  tremoloDepth: 0.5,
  delayOn: false,
  delayDiv: '1/8.', // tempo-synced
  delayFeedback: 0.35,
  delayMix: 0.25,
  limiterOn: false,
  bpm: 120,
};

export const DELAY_DIVS = { '1/4': 1, '1/8.': 0.75, '1/8': 0.5, '1/8T': 1 / 3, '1/16': 0.25, '1/4.': 1.5 };

/** Impulse response for a room. "original" is exactly the site's generated reverb. */
export function makeImpulse(ctx, roomId = 'original') {
  const room = ROOMS[roomId] || ROOMS.original;
  const pre = Math.floor((room.pre || 0) * ctx.sampleRate);
  const len = Math.floor(ctx.sampleRate * room.seconds) + pre;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    const tail = len - pre;
    for (let i = 0; i < tail; i++) {
      const env = (1 - i / tail) ** room.decay;
      let n = Math.random() * 2 - 1;
      if (room.damp) {
        // Darken the tail over time, like air absorbing high frequencies.
        const k = Math.min(0.97, (i / tail) * (12000 / room.damp) * 0.6);
        lp = lp * k + n * (1 - k);
        n = lp * (1 + k);
      }
      if (room.bright) n *= 1 + 0.4 * Math.sin(i * 0.9);
      d[pre + i] = n * env;
    }
  }
  return buf;
}

function driveCurve(amount) {
  const k = 1 + amount * 40;
  const n = 2048;
  const curve = new Float32Array(n);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

/** Builds the full chain on any context (live or offline). */
export function buildChain(ctx, sound, impulse, destination = ctx.destination) {
  const fx = { ...DEFAULT_FX, ...sound };
  const g = (v = 1) => {
    const n = ctx.createGain();
    n.gain.value = v;
    return n;
  };

  const output = g(sound.volume);
  output.connect(destination);
  const limiter = ctx.createDynamicsCompressor();
  const limIn = g();
  const master = g(MASTER_GAIN);
  master.connect(limIn);
  limIn.connect(output); // bypassed until enabled

  const lowPass = ctx.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.Q.value = LOWPASS_Q;
  lowPass.frequency.value = sound.toneOn ? sound.toneHz : ctx.sampleRate / 2;

  // EQ
  const eqLow = ctx.createBiquadFilter();
  eqLow.type = 'lowshelf';
  eqLow.frequency.value = 220;
  const eqMid = ctx.createBiquadFilter();
  eqMid.type = 'peaking';
  eqMid.frequency.value = 1100;
  eqMid.Q.value = 0.8;
  const eqHigh = ctx.createBiquadFilter();
  eqHigh.type = 'highshelf';
  eqHigh.frequency.value = 4200;
  eqLow.connect(eqMid).connect(eqHigh);

  // Drive
  const driveIn = g();
  const shaper = ctx.createWaveShaper();
  shaper.oversample = '4x';
  const driveWet = g(0);
  const driveDry = g(1);
  const driveOut = g();
  driveIn.connect(shaper).connect(driveWet).connect(driveOut);
  driveIn.connect(driveDry).connect(driveOut);

  // Chorus: two modulated delays panned apart
  const chorusIn = g();
  const chorusOut = g();
  const chorusDry = g(1);
  chorusIn.connect(chorusDry).connect(chorusOut);
  const chorusWet = g(0);
  const chorusLfos = [];
  const chorusDepths = [];
  const chorusDelays = [];
  for (const side of [-1, 1]) {
    const d = ctx.createDelay(0.05);
    d.delayTime.value = side < 0 ? 0.016 : 0.021;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = fx.chorusRate * (side < 0 ? 1 : 1.13);
    const depth = g(0.0035 * fx.chorusDepth);
    lfo.connect(depth).connect(d.delayTime);
    lfo.start();
    const pan = ctx.createStereoPanner();
    pan.pan.value = side * 0.75;
    chorusIn.connect(d);
    d.connect(pan).connect(chorusWet);
    chorusLfos.push(lfo);
    chorusDepths.push(depth);
    chorusDelays.push(d);
  }
  chorusWet.connect(chorusOut);

  // Tremolo / auto-pan
  const tremGain = g(1);
  const tremPan = ctx.createStereoPanner();
  const tremLfo = ctx.createOscillator();
  tremLfo.frequency.value = fx.tremoloRate;
  const tremDepthGain = g(0);
  const tremDepthPan = g(0);
  tremLfo.connect(tremDepthGain).connect(tremGain.gain);
  tremLfo.connect(tremDepthPan).connect(tremPan.pan);
  tremLfo.start();

  const post = g(); // end of the insert chain
  post.connect(master);

  // Reverb send
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse;
  const wet = g(sound.reverbOn ? sound.reverbWet : 0);
  post.connect(reverb);
  reverb.connect(wet).connect(master);

  // Ping-pong echo
  const delaySend = g(0);
  const dL = ctx.createDelay(4);
  const dR = ctx.createDelay(4);
  const fbL = g(fx.delayFeedback);
  const fbR = g(fx.delayFeedback);
  const delayTone = ctx.createBiquadFilter();
  delayTone.type = 'lowpass';
  delayTone.frequency.value = 4500;
  const panL = ctx.createStereoPanner();
  panL.pan.value = -0.8;
  const panR = ctx.createStereoPanner();
  panR.pan.value = 0.8;
  const delayWet = g(1);
  post.connect(delaySend).connect(delayTone).connect(dL);
  dL.connect(panL).connect(delayWet);
  dL.connect(fbL).connect(dR);
  dR.connect(panR).connect(delayWet);
  dR.connect(fbR).connect(dL);
  delayWet.connect(master);

  const analyser = ctx.createAnalyser?.() ?? null;
  if (analyser) {
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.78;
    output.connect(analyser);
  }

  const chain = {
    ctx,
    input: lowPass,
    lowPass,
    output,
    master,
    reverb,
    wet,
    analyser,
    roomId: fx.room || 'original',
    signature: null,
    apply(patch, { smooth = true } = {}) {
      Object.assign(fx, patch);
      const t = ctx.currentTime;
      const set = (param, v) => (smooth && 'setTargetAtTime' in param ? param.setTargetAtTime(v, t, 0.02) : (param.value = v));
      set(output.gain, fx.volume);
      set(lowPass.frequency, fx.toneOn ? fx.toneHz : ctx.sampleRate / 2);
      set(wet.gain, fx.reverbOn ? fx.reverbWet : 0);
      // EQ
      set(eqLow.gain, fx.eqOn ? fx.eqLow : 0);
      set(eqMid.gain, fx.eqOn ? fx.eqMid : 0);
      set(eqHigh.gain, fx.eqOn ? fx.eqHigh : 0);
      // Drive
      if (fx.driveOn) shaper.curve = driveCurve(fx.drive);
      set(driveWet.gain, fx.driveOn ? 0.55 + fx.drive * 0.2 : 0);
      set(driveDry.gain, fx.driveOn ? 0.35 : 1);
      // Chorus
      set(chorusWet.gain, fx.chorusOn ? 0.55 : 0);
      set(chorusDry.gain, fx.chorusOn ? 0.8 : 1);
      chorusLfos.forEach((l, i) => set(l.frequency, fx.chorusRate * (i ? 1.13 : 1)));
      chorusDepths.forEach((d) => set(d.gain, 0.0035 * fx.chorusDepth));
      // Tremolo
      set(tremLfo.frequency, fx.tremoloRate);
      const vol = fx.tremoloOn && fx.tremoloMode === 'volume';
      const pan = fx.tremoloOn && fx.tremoloMode === 'pan';
      set(tremDepthGain.gain, vol ? fx.tremoloDepth * 0.5 : 0);
      set(tremGain.gain, vol ? 1 - fx.tremoloDepth * 0.5 : 1);
      set(tremDepthPan.gain, pan ? fx.tremoloDepth : 0);
      // Echo
      const secs = (60 / (fx.bpm || 120)) * (DELAY_DIVS[fx.delayDiv] ?? 0.5);
      set(dL.delayTime, Math.min(3.9, secs));
      set(dR.delayTime, Math.min(3.9, secs));
      set(fbL.gain, fx.delayFeedback);
      set(fbR.gain, fx.delayFeedback);
      set(delaySend.gain, fx.delayOn ? fx.delayMix : 0);
      // Re-route only when an effect is switched on or off (avoids clicks while dragging sliders).
      const signature = [fx.eqOn, fx.driveOn, fx.chorusOn, vol, pan, fx.limiterOn].join();
      if (signature !== chain.signature) {
        chain.signature = signature;
        route(vol, pan);
      }
      // Room
      const room = fx.room || 'original';
      if (room !== chain.roomId) {
        chain.roomId = room;
        reverb.buffer = makeImpulse(ctx, room);
      }
    },
  };

  function route(vol, pan) {
      limIn.disconnect();
      if (fx.limiterOn) {
        limiter.threshold.value = -8;
        limiter.knee.value = 4;
        limiter.ratio.value = 14;
        limiter.attack.value = 0.002;
        limiter.release.value = 0.2;
        limIn.connect(limiter).connect(output);
      } else {
        limIn.connect(output);
      }
      // Series routing: disabled stages are taken out of the path entirely.
      for (const n of [lowPass, eqHigh, driveOut, chorusOut, tremGain, tremPan]) n.disconnect();
      let tail = lowPass;
      const through = (entry, exit) => {
        tail.connect(entry);
        tail = exit;
      };
      if (fx.eqOn) through(eqLow, eqHigh);
      if (fx.driveOn) through(driveIn, driveOut);
      if (fx.chorusOn) through(chorusIn, chorusOut);
      if (vol) through(tremGain, tremGain);
      if (pan) {
        through(tremGain, tremGain);
        through(tremPan, tremPan);
      }
      tail.connect(post);
  }

  chain.apply({}, { smooth: false });
  return chain;
}
