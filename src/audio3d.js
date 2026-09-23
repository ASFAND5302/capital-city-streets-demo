/* ============================================================
   CAPITAL CITY STREETS — src/audio3d.js
   True 3D spatial audio (Web Audio API, HRTF binaural panning).
   Every landmark is a sound source placed in world space; the
   listener is the player. With headphones, sounds come from
   real directions — front/behind/left/right — with distance
   falloff. This is the core non-visual navigation sense.

   Landmark sound types (editable per POI in data/city.json):
   bell · bass · ball · murmur · radio · engine · music
   All loops are synthesized — zero audio files needed.
   ============================================================ */

const Audio3D = (() => {
  const SCALE = 6;            // world units per city block
  const EAR = 1.7;            // ear height in world units
  let ctx = null;
  let master = null;
  let sources = [];
  let timers = [];
  let enabled = true;
  let built = false;

  /* ---------- synthesized loop buffers ---------- */
  function makeBuffer(seconds, fn) {
    const rate = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(seconds * rate), rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = fn(i / rate);
    return buf;
  }
  const noise = () => Math.random() * 2 - 1;

  const LOOPS = {
    // church bell: one strike every loop — inharmonic partials
    bell: () => makeBuffer(6, t => {
      if (t > 5.5) return 0;
      const partials = [[1, .5, 4.5], [2.0, .3, 3.5], [2.98, .2, 2.8], [4.2, .12, 2.0], [5.43, .07, 1.4]];
      let s = 0;
      for (const [r, a, dec] of partials) {
        s += a * Math.sin(2 * Math.PI * 164 * r * t) * Math.exp(-t / dec);
      }
      return s * 0.5;
    }),
    // nightclub: four-on-the-floor sub kick + low hum
    bass: () => makeBuffer(2.4, t => {
      const beat = t % 0.6;
      const f = 88 * Math.pow(0.5, beat / 0.18);
      const kick = Math.sin(2 * Math.PI * f * beat) * Math.exp(-beat / 0.16) * 0.8;
      const hum = 0.12 * Math.sin(2 * Math.PI * 41 * t);
      return kick + hum;
    }),
    // basketball: two bounces per loop
    ball: () => makeBuffer(1.4, t => {
      const bounce = (off) => {
        const bt = t - off;
        if (bt < 0 || bt > 0.12) return 0;
        return Math.sin(2 * Math.PI * (190 - bt * 700) * bt) * Math.exp(-bt / 0.03) * 0.9;
      };
      return bounce(0) + bounce(0.75) * 0.8;
    }),
    // diner: warm brown-noise murmur - softened
    murmur: (() => { let lp = 0; return () => makeBuffer(3, () => {
      lp = (lp + 0.015 * noise()) / 1.03;
      return lp * 1.2 * (0.8 + 0.15 * Math.sin(Math.random() * 0.5));
    }); })(),
    // small radio: quiet detuned melody
    radio: () => makeBuffer(4, t => {
      const notes = [220, 262, 196, 247];
      const n = notes[Math.floor(t / 1) % 4];
      const lt = t % 1;
      return 0.16 * Math.sin(2 * Math.PI * n * t + 2 * Math.sin(2 * Math.PI * 5 * t)) * (1 - lt * 0.6);
    }),
    // garage: idling engine
    engine: () => makeBuffer(2, t => {
      let s = 0;
      for (let h = 1; h <= 4; h++) s += Math.sin(2 * Math.PI * 52 * h * t) / h;
      return s * 0.22 * (0.85 + 0.15 * Math.sin(2 * Math.PI * 11 * t));
    }),
    // theater: soft arpeggio
    music: () => makeBuffer(4.8, t => {
      const seq = [262, 330, 392, 523];
      const n = seq[Math.floor(t / 1.2) % 4];
      const lt = t % 1.2;
      return 0.2 * Math.sin(2 * Math.PI * n * t) * Math.exp(-lt / 0.9);
    }),
  };

  /* ---------- church bell: one soft strike, then every ~4 minutes ---------- */
  let bellBuf = null;
  function makeBellBuffer() {
    const rate = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(6 * rate), rate);
    const d = buf.getChannelData(0);
    const partials = [[1, .5, 4.5], [2.0, .3, 3.5], [2.98, .2, 2.8], [4.2, .12, 2.0], [5.43, .07, 1.4]];
    for (let i = 0; i < d.length; i++) {
      const t = i / rate;
      if (t > 5.5) break;
      let s = 0;
      for (const [r, a, dec] of partials) s += a * Math.sin(2 * Math.PI * 164 * r * t) * Math.exp(-t / dec);
      d[i] = s * 0.4;
    }
    return buf;
  }
  function bellStrike(panner, vol) {
    if (!bellBuf) bellBuf = makeBellBuffer();
    const s = ctx.createBufferSource(); s.buffer = bellBuf;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(g).connect(panner);
    s.start();
  }

  /* ---------- core ---------- */
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.55;
      // soft master filter to cut harsh highs in 3D audio
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5500;
      master.connect(lp).connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function clearSources() {
    sources.forEach(s => { try { s.src.stop(); } catch (e) {} try { s.panner.disconnect(); } catch (e) {} });
    sources = [];
    timers.forEach(clearInterval); timers = [];
  }

  /** Build the soundscape from city.json POIs. */
  function buildFrom(city) {
    if (!ctx) return;
    clearSources();
    for (const p of city.pois) {
      const au = p.audio || {};
      const type = au.type;
      if (!type) continue;   // no audio declared -> silent landmark
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = (au.range || 60) * 0.16;
      panner.maxDistance = au.range || 60;
      panner.rolloffFactor = 1.25;
      panner.positionX ? (panner.positionX.value = p.x * SCALE, panner.positionZ.value = p.y * SCALE, panner.positionY.value = 2)
                         : panner.setPosition(p.x * SCALE, 2, p.y * SCALE);
      panner.connect(master);

      if (type === 'bell') {
        // Church bell: one soft strike shortly after arrival, then every
        // intervalSec (default 240 = 4 minutes). No loop buffer.
        const vol = typeof au.volume === 'number' ? au.volume : 0.25;
        const every = (au.intervalSec || 240) * 1000;
        const first = setTimeout(() => { if (enabled) bellStrike(panner, vol); }, 8000);
        const loop = setInterval(() => { if (enabled) bellStrike(panner, vol); }, every);
        timers.push(first, loop);
        sources.push({ src: null, panner, id: p.id });
        continue;
      }

      const loop = LOOPS[type] ? LOOPS[type]() : LOOPS.radio();
      const src = ctx.createBufferSource();
      src.buffer = loop; src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = typeof au.volume === 'number' ? au.volume : 0.5;
      src.connect(gain).connect(panner);
      src.start();
      sources.push({ src, panner, id: p.id });
    }
    built = true;
  }

  /** Move the listener. x,z in GRID coordinates; fx,fz = facing vector. */
  function updateListener(x, z, fx, fz) {
    if (!ctx || !enabled) return;
    const L = ctx.listener;
    const px = x * SCALE, pz = z * SCALE;
    if (L.positionX) {
      L.positionX.value = px; L.positionY.value = EAR; L.positionZ.value = pz;
      L.forwardX.value = fx; L.forwardY.value = 0; L.forwardZ.value = fz;
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else {
      L.setPosition(px, EAR, pz);
      L.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  /** Spatial sonar ping AT a world position (grid coords). */
  function pingAt(x, z) {
    if (!ctx || !enabled) return false;
    try {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const p = ctx.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = 8; p.maxDistance = 200; p.rolloffFactor = 0.6;
      p.positionX ? (p.positionX.value = x * SCALE, p.positionY.value = 3, p.positionZ.value = z * SCALE)
                   : p.setPosition(x * SCALE, 3, z * SCALE);
      o.type = 'sine';
      o.frequency.setValueAtTime(1400, t);
      o.frequency.exponentialRampToValueAtTime(520, t + 0.5);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(p).connect(master);
      o.start(t); o.stop(t + 0.7);
      return true;
    } catch (e) { return false; }
  }

  function setEnabled(v) {
    enabled = v;
    if (master) master.gain.value = v ? 0.9 : 0;
  }

  function stop() {
    clearSources();
    built = false;
    if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
  }

  return { init, buildFrom, updateListener, pingAt, setEnabled, stop,
           isEnabled: () => enabled, SCALE };
})();
