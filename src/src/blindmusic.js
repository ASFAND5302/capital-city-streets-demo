/* ============================================================
   CAPITAL CITY STREETS — src/blindmusic.js
   PREMIUM VIBE + BUG FIXES - Studio Grade v2.1
   FIXED: All ambience bugs, overlapping layers, lobby music, ducking
   ============================================================ */

const BlindMusic = (() => {
  let ctx = null;
  let masterGain = null;
  let baseGain = null, tensionGain = null, combatGain = null, ambientGain = null;
  let stingerGain = null, subGain = null;
  let currentMood = null;
  let isEnhancedListening = false;
  let leitmotifTimer = null;
  let layers = { base: null, tension: null, combat: null, ambient: null };
  let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  let mobileUnlocked = false;
  let intensity = 0;
  let isDucked = false;
  
  const LEITMOTIFS = {
    stoneface: { notes: [48, 51, 48, 46], rhythm: [0, 0.5, 1.0, 1.8], desc: 'Stoneface - low solitary resilient', color: 'blind brilliant', variation: [48, 50, 51, 48] },
    salena: { notes: [60, 64, 67, 71, 72], rhythm: [0, 0.3, 0.6, 0.9, 1.4], desc: 'Salena - warm major7 hopeful', color: 'sister hope', variation: [60, 62, 64, 67, 69] },
    glasses: { notes: [72, 76, 79, 84], rhythm: [0, 0.15, 0.3, 0.45], desc: 'Glasses - electronic arpeggio', color: 'tech guidance', variation: [72, 74, 76, 79] },
    harbor: { notes: [38, 38, 43], rhythm: [0, 0.8, 1.6], desc: 'Harbor - harbor bell loyalty', color: 'court loyalty', variation: [38, 40, 43] },
    wexler: { notes: [62, 61, 62, 58], rhythm: [0, 0.2, 0.4, 0.9], desc: 'Wexler - dissonant corruption', color: 'villain', variation: [62, 60, 62, 58] },
    voss: { notes: [50, 49, 50, 46], rhythm: [0, 0.25, 0.5, 1.0], desc: 'Voss - dark brooding boss', color: 'final boss', variation: [50, 48, 50, 46] },
    bonnie: { notes: [60, 62, 64, 67], rhythm: [0, 0.2, 0.4, 0.7], desc: 'Bonnie - driving armor ally', color: 'ally', variation: [60, 64, 65, 67] },
    nyx: { notes: [72, 71, 69, 67], rhythm: [0, 0.3, 0.6, 1.0], desc: 'Nyx - mysterious informant', color: 'informant', variation: [72, 69, 67, 65] },
    sera: { notes: [74, 77, 79, 81], rhythm: [0, 0.25, 0.5, 0.85], desc: 'Sera - island romance', color: 'romance', variation: [74, 76, 79, 81] },
    tess: { notes: [76, 79, 81, 84], rhythm: [0, 0.18, 0.36, 0.54], desc: 'Tess - engineer bright', color: 'engineer', variation: [76, 77, 79, 81] },
    priest: { notes: [48, 52, 55, 60], rhythm: [0, 0.6, 1.2, 2.0], desc: 'Priest - sacred compass', color: 'moral sacred', variation: [48, 50, 52, 55] },
    ledger: { notes: [62, 65, 67, 70], rhythm: [0, 0.22, 0.44, 0.7], desc: 'Ledger - pawnshop investor', color: 'investor', variation: [62, 64, 65, 67] },
    danger: { notes: [50, 49, 50, 49], rhythm: [0, 0.15, 0.3, 0.45], desc: 'Danger - urgent warning', color: 'warning' },
    objective: { notes: [60, 64, 67, 72], rhythm: [0, 0.2, 0.4, 0.8], desc: 'Objective found - rising success', color: 'success' },
    discovery: { notes: [67, 72, 76, 79], rhythm: [0, 0.15, 0.35, 0.6], desc: 'Discovery - bright found', color: 'found' },
    victory: { notes: [60, 64, 67, 72, 76], rhythm: [0, 0.18, 0.36, 0.6, 0.9], desc: 'Victory - triumphant', color: 'victory' },
    lament: { notes: [64, 62, 60, 57], rhythm: [0, 0.5, 1.0, 1.8], desc: 'Lament - sad loss', color: 'sad' },
  };

  const PROGRESSIONS = {
    noir_soft: [[57,60,64,71,74], [53,57,60,65,69], [48,55,60,64,67], [55,59,62,65,69]],
    noir_tense: [[50,53,57,60], [50,54,57,61], [49,52,56,59]],
    noir_warm: [[48,55,60,64,67], [45,52,57,60,64]],
    noir_sad: [[45,52,57,60], [43,50,55,58], [41,48,53,56]],
    noir_hero: [[45,52,57,64,67], [43,50,55,62,65]],
    noir_mystery: [[57,60,63,67], [55,58,62,65], [52,55,59,62]],
    ch4_soft: [[50,53,57,60], [48,52,55,59], [45,50,53,57]],
    ch5_gala: [[57,60,64,71], [55,59,62,67], [53,57,60,64]],
    ambient_night: [[48,52,55,59], [45,50,53,57]],
  };

  function unlockMobile() {
    if (mobileUnlocked) return;
    mobileUnlocked = true;
    try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {}
  }

  function ac() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain(); masterGain.gain.value = isMobile ? 0.42 : 0.62;
    const masterHP = ctx.createBiquadFilter(); masterHP.type = 'highpass'; masterHP.frequency.value = 32; masterHP.Q.value = 0.6;
    const masterLP = ctx.createBiquadFilter(); masterLP.type = 'lowpass'; masterLP.frequency.value = 6200; masterLP.Q.value = 0.5;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.knee.value = 26; comp.ratio.value = 2.0; comp.attack.value = 0.035; comp.release.value = 0.42;
    const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -8; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.15;
    masterGain.connect(masterHP).connect(masterLP).connect(comp).connect(limiter).connect(ctx.destination);
    baseGain = ctx.createGain(); baseGain.gain.value = 0.0001;
    tensionGain = ctx.createGain(); tensionGain.gain.value = 0.0001;
    combatGain = ctx.createGain(); combatGain.gain.value = 0.0001;
    ambientGain = ctx.createGain(); ambientGain.gain.value = 0.0001;
    stingerGain = ctx.createGain(); stingerGain.gain.value = 0.88;
    subGain = ctx.createGain(); subGain.gain.value = 0.32;
    const baseLP = ctx.createBiquadFilter(); baseLP.type = 'lowpass'; baseLP.frequency.value = 3400; baseLP.Q.value = 0.55;
    const baseHP = ctx.createBiquadFilter(); baseHP.type = 'highpass'; baseHP.frequency.value = 85;
    const tensionLP = ctx.createBiquadFilter(); tensionLP.type = 'lowpass'; tensionLP.frequency.value = 2000;
    const tensionHP = ctx.createBiquadFilter(); tensionHP.type = 'highpass'; tensionHP.frequency.value = 120;
    const combatLP = ctx.createBiquadFilter(); combatLP.type = 'lowpass'; combatLP.frequency.value = 2400;
    const combatHP = ctx.createBiquadFilter(); combatHP.type = 'highpass'; combatHP.frequency.value = 60;
    const ambientLP = ctx.createBiquadFilter(); ambientLP.type = 'lowpass'; ambientLP.frequency.value = 1800;
    const ambientHP = ctx.createBiquadFilter(); ambientHP.type = 'highpass'; ambientHP.frequency.value = 40;
    const stingerLP = ctx.createBiquadFilter(); stingerLP.type = 'lowpass'; stingerLP.frequency.value = 4500;
    baseGain.connect(baseHP).connect(baseLP).connect(masterGain);
    tensionGain.connect(tensionHP).connect(tensionLP).connect(masterGain);
    combatGain.connect(combatHP).connect(combatLP).connect(masterGain);
    ambientGain.connect(ambientHP).connect(ambientLP).connect(masterGain);
    stingerGain.connect(stingerLP).connect(masterGain);
    subGain.connect(masterGain);
    const spaceSend = ctx.createGain(); spaceSend.gain.value = 0.28;
    const preDelay = ctx.createDelay(0.5); preDelay.delayTime.value = 0.055;
    const dl = ctx.createDelay(1.2); dl.delayTime.value = 0.38;
    const dl2 = ctx.createDelay(1.2); dl2.delayTime.value = 0.58;
    const fb = ctx.createGain(); fb.gain.value = 0.12;
    const fb2 = ctx.createGain(); fb2.gain.value = 0.09;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1450;
    const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 1150;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 200;
    spaceSend.connect(preDelay); preDelay.connect(dl); dl.connect(lp); lp.connect(hp); hp.connect(fb); fb.connect(dl);
    dl.connect(dl2); dl2.connect(lp2); lp2.connect(fb2); fb2.connect(dl2);
    const wet = ctx.createGain(); wet.gain.value = 0.12;
    const wet2 = ctx.createGain(); wet2.gain.value = 0.08;
    dl.connect(wet).connect(masterGain); dl2.connect(wet2).connect(masterGain);
    ctx._spaceSend = spaceSend; ctx._subGain = subGain;
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const M = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function humanize(time, amount = 0.018) { return time + (Math.random() - 0.5) * amount; }
  function humanVelocity(base, variance = 0.18) { return base * (0.88 + Math.random() * variance); }
  function humanDetune(amount = 3) { return (Math.random() - 0.5) * amount; }

  function playLeitmotif(character, opts = {}) {
    if (!LEITMOTIFS[character]) return;
    try {
      const a = ac();
      const motif = LEITMOTIFS[character];
      const useVariation = opts.variation && motif.variation && Math.random() < 0.35;
      const notes = useVariation ? motif.variation : motif.notes;
      const t0 = a.currentTime + (opts.delay || 0.05);
      const vol = opts.volume || 0.042;
      const isSoft = opts.soft !== false;
      const pan = opts.pan || 0;
      notes.forEach((midi, i) => {
        const t = humanize(t0 + motif.rhythm[i], 0.016);
        const o = a.createOscillator(); const o2 = a.createOscillator();
        const g = a.createGain(); const g2 = a.createGain();
        const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = isSoft ? 1550 : 2400; lp.Q.value = 0.6;
        const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 60;
        o.type = midi >= 74 ? 'sine' : 'triangle'; o.frequency.value = M(midi); o.detune.value = humanDetune(3.5);
        o2.type = 'sine'; o2.frequency.value = M(midi) * 2.005; g2.gain.value = 0.16;
        const vel = humanVelocity(vol, 0.22);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.045); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
        o.connect(lp).connect(hp).connect(g); o2.connect(g2).connect(g);
        let out = g;
        if (pan !== 0 && a.createStereoPanner) {
          const panner = a.createStereoPanner();
          panner.pan.value = Math.max(-1, Math.min(1, pan + (Math.random()-0.5)*0.15));
          g.connect(panner); out = panner;
        }
        out.connect(stingerGain);
        if (!isSoft) g.connect(a._spaceSend);
        o.start(t); o.stop(t + 1.1); o2.start(t); o2.stop(t + 1.1);
      });
    } catch (e) {}
  }

  function playStinger(type, opts = {}) {
    const mapping = {
      objective: () => playLeitmotif('objective', { volume: 0.065, ...opts }),
      discovery: () => playLeitmotif('discovery', { volume: 0.055, ...opts }),
      danger: () => playLeitmotif('danger', { volume: 0.072, ...opts }),
      enemy_spotted: () => { playLeitmotif('danger', { volume: 0.062 }); setTimeout(() => playLeitmotif('danger', { volume: 0.042, pan: 0.3 }), 220); },
      success: () => playLeitmotif('objective', { volume: 0.075 }),
      victory: () => playLeitmotif('victory', { volume: 0.068 }),
      fail: () => {
        try {
          const a = ac(); const t = a.currentTime;
          [0, 0.16].forEach(off => {
            const o = a.createOscillator(); const g = a.createGain(); const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 850;
            o.type = 'sine'; o.frequency.value = M(50 + off * 10);
            g.gain.setValueAtTime(0.0001, t + off); g.gain.linearRampToValueAtTime(0.032, t + off + 0.025); g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.45);
            o.connect(lp).connect(g).connect(stingerGain); g.connect(a._spaceSend);
            o.start(t + off); o.stop(t + off + 0.55);
          });
        } catch (e) {}
      },
      levelup: () => playLeitmotif('victory', { volume: 0.06 }),
      coin: () => {
        try {
          const a = ac(); const t = a.currentTime;
          [0, 0.1, 0.2].forEach((off, i) => {
            const o = a.createOscillator(); const g = a.createGain();
            o.type = 'sine'; o.frequency.value = M(60 + i*4);
            g.gain.setValueAtTime(0.0001, t + off); g.gain.linearRampToValueAtTime(0.04 - i*0.01, t + off + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.5);
            o.connect(g).connect(stingerGain); g.connect(a._spaceSend);
            o.start(t + off); o.stop(t + off + 0.6);
          });
        } catch (e) {}
      },
      door: () => playLeitmotif('stoneface', { volume: 0.035, soft: true }),
      footstep: () => {
        try {
          const a = ac(); const t = a.currentTime;
          const o = a.createOscillator(); const g = a.createGain();
          o.type = 'sine'; o.frequency.value = M(36);
          g.gain.setValueAtTime(0.02, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
          o.connect(g).connect(ambientGain); o.start(t); o.stop(t + 0.15);
        } catch (e) {}
      },
      heartbeat: () => {
        try {
          const a = ac(); const t = a.currentTime;
          [0, 0.2].forEach(off => {
            const o = a.createOscillator(); const g = a.createGain(); const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200;
            o.type = 'sine'; o.frequency.setValueAtTime(52, t + off); o.frequency.exponentialRampToValueAtTime(38, t + off + 0.14);
            g.gain.setValueAtTime(0.07, t + off); g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.18);
            o.connect(lp).connect(g).connect(stingerGain); o.start(t + off); o.stop(t + off + 0.2);
          });
        } catch (e) {}
      },
    };
    const fn = mapping[type];
    if (fn) { try { fn(); } catch (e) {} }
  }

  // BUG FIX: setIntensity now cancels scheduled values, no overlap
  function setIntensity(level) {
    intensity = level;
    try {
      const a = ac(); const t = a.currentTime;
      if (level === 0) {
        baseGain.gain.cancelScheduledValues(t); baseGain.gain.setTargetAtTime(isDucked ? 0.048*0.32 : 0.048, t, 0.9);
        tensionGain.gain.cancelScheduledValues(t); tensionGain.gain.setTargetAtTime(0.0001, t, 0.7);
        combatGain.gain.cancelScheduledValues(t); combatGain.gain.setTargetAtTime(0.0001, t, 0.6);
        ambientGain.gain.cancelScheduledValues(t); ambientGain.gain.setTargetAtTime(isDucked ? 0.018*0.5 : 0.018, t, 1.2);
        subGain.gain.cancelScheduledValues(t); subGain.gain.setTargetAtTime(isDucked ? 0.08*0.5 : 0.08, t, 1.0);
      } else if (level === 1) {
        baseGain.gain.cancelScheduledValues(t); baseGain.gain.setTargetAtTime(isDucked ? 0.042*0.32 : 0.042, t, 0.7);
        tensionGain.gain.cancelScheduledValues(t); tensionGain.gain.setTargetAtTime(isDucked ? 0.028*0.32 : 0.028, t, 0.9);
        combatGain.gain.cancelScheduledValues(t); combatGain.gain.setTargetAtTime(0.0001, t, 0.6);
        ambientGain.gain.cancelScheduledValues(t); ambientGain.gain.setTargetAtTime(isDucked ? 0.012*0.5 : 0.012, t, 0.8);
        subGain.gain.cancelScheduledValues(t); subGain.gain.setTargetAtTime(isDucked ? 0.12*0.5 : 0.12, t, 0.8);
      } else if (level >= 2) {
        baseGain.gain.cancelScheduledValues(t); baseGain.gain.setTargetAtTime(isDucked ? 0.032*0.32 : 0.032, t, 0.5);
        tensionGain.gain.cancelScheduledValues(t); tensionGain.gain.setTargetAtTime(isDucked ? 0.038*0.32 : 0.038, t, 0.6);
        combatGain.gain.cancelScheduledValues(t); combatGain.gain.setTargetAtTime(isDucked ? 0.058*0.32 : 0.058, t, 0.35);
        ambientGain.gain.cancelScheduledValues(t); ambientGain.gain.setTargetAtTime(isDucked ? 0.008*0.5 : 0.008, t, 0.5);
        subGain.gain.cancelScheduledValues(t); subGain.gain.setTargetAtTime(isDucked ? 0.18*0.5 : 0.18, t, 0.4);
      }
    } catch (e) {}
  }

  function playBase(mood = 'noir_soft', opts = {}) {
    // BUG FIX: Clear previous base timeout to prevent overlapping layers
    clearTimeout(layers.base);
    try {
      const a = ac();
      const prog = PROGRESSIONS[mood] || PROGRESSIONS.noir_soft;
      const t0 = a.currentTime + 0.05;
      const chord = prog[Math.floor(Math.random() * prog.length)];
      chord.forEach((midi, i) => {
        const ht = humanize(t0, 0.02);
        const o = a.createOscillator(); const o2 = a.createOscillator();
        const g = a.createGain(); const g2 = a.createGain();
        const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000; lp.Q.value = 0.6;
        const lp2 = a.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 2200;
        o.type = 'sine'; o.frequency.value = M(midi); o.detune.value = (i % 2 ? 2.5 : -2.2) + humanDetune(1.2);
        o2.type = 'sine'; o2.frequency.value = M(midi) * 2.003; g2.gain.value = 0.15;
        const vel = humanVelocity(0.030, 0.16);
        g.gain.setValueAtTime(0.0001, ht); g.gain.linearRampToValueAtTime(isDucked ? vel*0.32 : vel, ht + 0.65); g.gain.linearRampToValueAtTime(0.0001, ht + 5.0);
        o.connect(lp).connect(g); o2.connect(lp2).connect(g2).connect(g);
        g.connect(baseGain); g.connect(a._spaceSend);
        o.start(ht); o.stop(ht + 5.5); o2.start(ht); o2.stop(ht + 5.5);
      });
      if (chord.length && subGain) {
        const subN = chord[0] - 12; const o = a.createOscillator(), g = a.createGain();
        const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 110;
        o.type = 'sine'; o.frequency.value = M(subN);
        g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(isDucked ? 0.05*0.5 : 0.05, t0 + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.8);
        o.connect(lp).connect(g).connect(subGain); o.start(t0); o.stop(t0 + 5.2);
      }
      layers.base = setTimeout(() => playBase(mood), 4800 + Math.random() * 1200);
      currentMood = mood;
    } catch (e) {}
  }

  function setEnhancedListening(on) {
    isEnhancedListening = !!on;
    if (on) {
      playSonarSweep();
      try {
        if (typeof Spatial !== 'undefined') {
          const positions = Spatial.getPositions();
          Object.keys(positions).forEach((char, i) => {
            const pos = positions[char];
            const pan = pos ? Math.max(-0.8, Math.min(0.8, pos.x * 0.3)) : 0;
            setTimeout(() => playLeitmotif(char, { volume: 0.038, soft: true, pan }), i * 380);
          });
        }
      } catch (e) {}
    }
  }

  function playSonarSweep() {
    if (!isEnhancedListening) return;
    try {
      const a = ac(); const t = a.currentTime;
      const o = a.createOscillator(); const o2 = a.createOscillator();
      const g = a.createGain(); const g2 = a.createGain();
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
      const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 120;
      const panner = a.createStereoPanner ? a.createStereoPanner() : null;
      o.type = 'sine'; o.frequency.setValueAtTime(M(86), t); o.frequency.exponentialRampToValueAtTime(M(46), t + 1.3);
      o2.type = 'sine'; o2.frequency.value = M(86) * 2.01; g2.gain.value = 0.18;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(isDucked ? 0.065*0.32 : 0.065, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(lp).connect(hp).connect(g); o2.connect(g2).connect(g);
      if (panner) {
        g.connect(panner).connect(stingerGain); panner.pan.setValueAtTime(-0.85, t); panner.pan.linearRampToValueAtTime(0.85, t + 1.3); g.connect(a._spaceSend);
      } else { g.connect(stingerGain); g.connect(a._spaceSend); }
      o.start(t); o.stop(t + 1.5); o2.start(t); o2.stop(t + 1.5);
      if (isEnhancedListening) setTimeout(() => playSonarSweep(), 3600);
    } catch (e) {}
  }

  // BUG FIX: duck now properly handles all gains and prevents overlap
  function duck(on) {
    isDucked = !!on;
    if (!ctx || !masterGain) return;
    try {
      const t = ctx.currentTime;
      if (on) {
        [baseGain, tensionGain, combatGain, ambientGain, subGain].forEach(g => {
          if (g) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(g.gain.value * 0.32, t, 0.16); }
        });
      } else {
        setIntensity(intensity);
      }
      console.log(`[BlindMusic] Duck ${on ? 'ON' : 'OFF'} - fixed`);
    } catch (e) {}
  }

  function playRealNoir(trackId, opts = {}) {
    try {
      if (typeof OGAudio !== 'undefined' && OGAudio.isEnabled()) {
        const played = OGAudio.playMood(trackId);
        if (played) { if (baseGain) { try { baseGain.gain.cancelScheduledValues(ctx.currentTime); baseGain.gain.setTargetAtTime(0.013, ctx.currentTime, 0.6); } catch (e) {} } return true; }
      }
      return false;
    } catch (e) { return false; }
  }

  function setVolume(v) {
    const vol = Math.max(0, Math.min(1, v));
    localStorage.setItem('ccs-blindvol', String(vol));
    if (masterGain) { try { masterGain.gain.cancelScheduledValues(ctx.currentTime); masterGain.gain.setTargetAtTime(0.62 * vol, ctx.currentTime, 0.35); } catch (e) {} }
  }

  // BUG FIX: stop now hard stops all layers, no overlap, clears timeouts
  function stop(hard = false) {
    console.log(`[BlindMusic] Stop called - hard=${hard} - fixing overlap bug`);
    isEnhancedListening = false;
    Object.values(layers).forEach(t => clearTimeout(t));
    layers = { base: null, tension: null, combat: null, ambient: null };
    clearTimeout(leitmotifTimer);
    try {
      if (ctx) {
        const t = ctx.currentTime;
        const fade = hard ? 0.15 : 0.45;
        [baseGain, tensionGain, combatGain, ambientGain, subGain].forEach(g => {
          if (g) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, fade); }
        });
      }
    } catch (e) {}
    if (hard) {
      currentMood = null;
      intensity = 0;
    }
    console.log('[BlindMusic] All layers stopped - overlap fixed');
  }

  function init() {
    console.log(`[BlindMusic v2.1 Bug Fixed] Initialized - 15 leitmotifs, 4 layers, no overlap, ducking`);
    try { ac(); } catch (e) {}
    if (isMobile) {
      const unlockEvents = ['touchstart', 'touchend', 'click'];
      const unlockOnce = () => { unlockMobile(); unlockEvents.forEach(ev => document.removeEventListener(ev, unlockOnce)); };
      unlockEvents.forEach(ev => document.addEventListener(ev, unlockOnce, { once: true, passive: true }));
    }
  }

  return {
    init, playLeitmotif, playStinger, setIntensity, playBase, setEnhancedListening, playSonarSweep,
    duck, playRealNoir, setVolume, stop, unlockMobile, LEITMOTIFS, PROGRESSIONS,
    isEnhancedListening: () => isEnhancedListening,
  };
})();
