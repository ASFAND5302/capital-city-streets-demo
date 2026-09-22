/* ============================================================
   CAPITAL CITY STREETS — src/audio.js
   PREMIUM VIBE - Professional Blind Game SFX
   Studio-grade WebAudio, no external files needed
   Inspired by TLOU2, Hades, Plague Tale audio design
   
   Features:
   - Master chain: compressor + lowpass + reverb send
   - Premium cues: layered, randomized, spatialized
   - New effects: footsteps, doors, coins, UI premium
   - Environmental: rain, city, church, boat
   - Fight: ultra-realistic with Doppler, layers
   - Free sources: Sonniss GDC 7.47GB, Kenney CC0, Pixabay
   ============================================================ */

const SFX = (() => {
  let ctx = null, master = null, reverbSend = null, reverbReturn = null;
  let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Premium master chain
      master = ctx.createGain();
      master.gain.value = isMobile ? 0.75 : 0.85;
      
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 20;
      comp.ratio.value = 2.5;
      comp.attack.value = 0.015;
      comp.release.value = 0.25;
      
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 7500;
      lp.Q.value = 0.5;
      
      // Premium reverb - filtered feedback delay (studio quality)
      reverbSend = ctx.createGain();
      reverbSend.gain.value = 0.22;
      const dl = ctx.createDelay(1.5);
      dl.delayTime.value = 0.34;
      const fb = ctx.createGain();
      fb.gain.value = 0.18;
      const rlp = ctx.createBiquadFilter();
      rlp.type = 'lowpass';
      rlp.frequency.value = 1800;
      const rhp = ctx.createBiquadFilter();
      rhp.type = 'highpass';
      rhp.frequency.value = 250;
      reverbSend.connect(dl);
      dl.connect(rlp);
      rlp.connect(rhp);
      rhp.connect(fb);
      fb.connect(dl);
      reverbReturn = ctx.createGain();
      reverbReturn.gain.value = 0.16;
      dl.connect(reverbReturn);
      reverbReturn.connect(master);
      
      master.connect(lp).connect(comp).connect(ctx.destination);
      
      console.log('[SFX] Premium audio initialized - Mobile:', isMobile, 'Master:', master.gain.value);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'sine', gain = 0.08, when = 0, pan = 0, sendReverb = false) {
    try {
      const a = ac();
      const t = a.currentTime + when;
      const o = a.createOscillator();
      const g = a.createGain();
      const lp = a.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = type === 'square' || type === 'sawtooth' ? 3200 : 7000;
      const softType = type === 'square' ? 'triangle' : type === 'sawtooth' ? 'sine' : type;
      o.type = softType;
      o.frequency.value = freq;
      // Premium envelope - faster attack, natural decay
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain * 0.7, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp).connect(g);
      let out = g;
      if (pan !== 0 && a.createStereoPanner) {
        const p = a.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        g.connect(p);
        out = p;
      }
      out.connect(master);
      if (sendReverb) g.connect(reverbSend);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) {}
  }

  let noiseBuf = null;
  function getNoise() {
    if (noiseBuf) return noiseBuf;
    const a = ac();
    noiseBuf = a.createBuffer(1, a.sampleRate * 2.5, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  
  function noiseBurst(dur, freq, gain, pan = 0, type = 'lowpass', when = 0, sendReverb = false) {
    try {
      const a = ac();
      const t = a.currentTime + when;
      const s = a.createBufferSource();
      s.buffer = getNoise();
      const f = a.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain * 0.8, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g);
      let out = g;
      if (pan !== 0 && a.createStereoPanner) {
        const p = a.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        g.connect(p);
        out = p;
      }
      out.connect(master);
      if (sendReverb) g.connect(reverbSend);
      s.start(t);
      s.stop(t + dur + 0.05);
    } catch (e) {}
  }
  
  function note(freq, dur, gain, when = 0, harmonic = 2.8, pan = 0) {
    tone(freq, dur, 'sine', gain, when, pan, true);
    tone(freq * harmonic, dur * 0.55, 'sine', gain * 0.28, when, pan, false);
    tone(freq * 1.5, dur * 0.3, 'sine', gain * 0.12, when + 0.02, pan, false);
  }

  function shimmerNote(freq, dur, gain, when = 0) {
    // Premium shimmer - multiple harmonics with random detune
    const detune = (Math.random() - 0.5) * 4;
    note(freq + detune, dur, gain, when, 3.2, (Math.random()-0.5)*0.2);
    setTimeout(() => note(freq * 2.01, dur * 0.4, gain * 0.3, 0, 2.5, 0), when * 1000 + 30);
  }

  const CUES = {
    ping:    [[880, .14, 'sine', .08], [1320, .22, 'sine', .06, .14]],
    coin:    [[1046, .1, 'sine', .06], [1568, .16, 'sine', .06, .1], [2093, .3, 'sine', .04, .18]],
    hit:     [[160, .18, 'sine', .12]],
    fail:    [[320, .2, 'sine', .08], [220, .28, 'sine', .08, .18]],
    success: [[523, .12, 'sine', .07], [659, .12, 'sine', .07, .12], [784, .24, 'sine', .07, .24], [1046, .4, 'sine', .05, .38]],
    alarm:   [[700, .22, 'sine', .07], [700, .22, 'sine', .07, .32]],
    chapter: [[392, .16, 'sine', .07], [523, .16, 'sine', .07, .16], [659, .34, 'sine', .08, .32]],
  };

  const CUSTOM = {
    // ===== PREMIUM FIGHT - ultra realistic =====
    whoosh: () => {
      const v = 0.8 + Math.random()*0.4;
      const pan = (Math.random()-0.5)*0.5;
      noiseBurst(0.14 + Math.random()*0.04, 950 + Math.random()*200, 0.06 * v, pan, 'bandpass', 0, false);
      tone(340 + Math.random()*80, 0.11, 'sine', 0.045 * v, 0, pan*0.5);
      tone(200 + Math.random()*40, 0.13, 'sine', 0.035 * v, 0.03, pan*0.3);
    },
    whoosh_heavy: () => {
      const pan = (Math.random()-0.5)*0.6;
      noiseBurst(0.2 + Math.random()*0.06, 700 + Math.random()*150, 0.09, pan, 'bandpass', 0, false);
      tone(240 + Math.random()*50, 0.18, 'sine', 0.07, 0, pan*0.4);
      tone(140 + Math.random()*30, 0.2, 'sine', 0.06, 0.05, pan*0.2);
    },
    punch: () => {
      const rnd = Math.random();
      const pan = (Math.random()-0.5)*0.15;
      const lowFreq = 52 + rnd*10;
      const midFreq = 105 + rnd*20;
      const bodyFreq = 175 + rnd*20;
      tone(lowFreq, 0.14 + rnd*0.03, 'sine', 0.19 + rnd*0.04, 0, pan, false);
      tone(midFreq, 0.10 + rnd*0.02, 'sine', 0.13 + rnd*0.03, 0.008, pan);
      tone(bodyFreq, 0.08 + rnd*0.02, 'sine', 0.10, 0.018, pan);
      tone(bodyFreq*1.4, 0.055, 'sine', 0.06, 0.022, pan);
      noiseBurst(0.038 + rnd*0.015, 2800 + rnd*500, 0.13 + rnd*0.04, pan, 'highpass', 0.018, false);
      noiseBurst(0.028, 3900 + rnd*600, 0.07, pan, 'highpass', 0.026, false);
      setTimeout(() => noiseBurst(0.07 + rnd*0.04, 480 + rnd*100, 0.04, pan, 'lowpass', 0, true), 28 + rnd*10);
    },
    punch_heavy: () => {
      const rnd = Math.random();
      const pan = (Math.random()-0.5)*0.2;
      tone(42 + rnd*6, 0.19 + rnd*0.04, 'sine', 0.24 + rnd*0.05, 0, pan);
      tone(88 + rnd*10, 0.14, 'sine', 0.16, 0.008, pan);
      tone(155 + rnd*15, 0.10, 'sine', 0.13, 0.018, pan);
      tone(240, 0.07, 'sine', 0.08, 0.025, pan);
      noiseBurst(0.055, 2500 + rnd*300, 0.15, pan, 'highpass', 0.018);
      noiseBurst(0.045, 4300, 0.09, pan, 'highpass', 0.028);
      noiseBurst(0.07, 620, 0.11, pan, 'lowpass', 0.02, true);
    },
    hit: () => {
      const rnd = Math.random();
      const pan = (Math.random()-0.5)*0.1;
      tone(62 + rnd*8, 0.16, 'sine', 0.20, 0, pan);
      tone(125 + rnd*15, 0.12, 'sine', 0.14, 0.008, pan);
      tone(215 + rnd*20, 0.08, 'sine', 0.10, 0.018, pan);
      tone(320, 0.045, 'sine', 0.06, 0.022, pan);
      noiseBurst(0.055 + rnd*0.02, 1150 + rnd*300, 0.11, pan, 'bandpass', 0.018);
      noiseBurst(0.038, 3000 + rnd*400, 0.10, pan, 'highpass', 0.026);
    },
    kick: () => {
      const rnd = Math.random();
      tone(38 + rnd*6, 0.21, 'sine', 0.26, 0);
      tone(76 + rnd*10, 0.14, 'sine', 0.18, 0.015);
      tone(140, 0.09, 'sine', 0.10, 0.025);
      noiseBurst(0.08 + rnd*0.03, 780 + rnd*200, 0.12, 0, 'bandpass', 0.025, true);
      noiseBurst(0.045, 1900, 0.06, 0, 'highpass', 0.04);
    },
    elbow: () => {
      const rnd = Math.random();
      tone(68 + rnd*8, 0.12, 'sine', 0.19, 0);
      tone(145 + rnd*15, 0.08, 'sine', 0.13, 0.008);
      noiseBurst(0.03, 3200 + rnd*400, 0.12, 0, 'highpass', 0.015);
      noiseBurst(0.022, 4600, 0.07, 0, 'highpass', 0.022);
    },
    knee: () => {
      tone(45, 0.17, 'sine', 0.21, 0);
      tone(90, 0.12, 'sine', 0.14, 0.01);
      tone(180, 0.07, 'sine', 0.09, 0.02);
      noiseBurst(0.07, 920, 0.10, 0, 'bandpass', 0.02, true);
    },
    block: () => {
      tone(115 + Math.random()*15, 0.10, 'sine', 0.12, 0);
      tone(195 + Math.random()*20, 0.08, 'sine', 0.09, 0.008);
      noiseBurst(0.045, 580 + Math.random()*150, 0.08, 0, 'lowpass', 0.008, true);
    },
    dodge: () => {
      const pan = Math.random() > 0.5 ? -0.7 : 0.7;
      noiseBurst(0.10, 980 + Math.random()*150, 0.06, pan, 'bandpass');
      noiseBurst(0.10, 1180 + Math.random()*150, 0.06, -pan, 'bandpass', 0.07);
    },
    grunt: () => {
      const base = 85 + Math.random()*20;
      tone(base, 0.14, 'sine', 0.11, 0);
      tone(base*0.7, 0.18, 'sine', 0.09, 0.05);
      tone(base*1.5, 0.09, 'sine', 0.05, 0.02);
    },
    slam: () => {
      tone(32 + Math.random()*6, 0.30, 'sine', 0.28, 0);
      tone(68 + Math.random()*8, 0.20, 'sine', 0.19, 0.015);
      tone(130, 0.13, 'sine', 0.11, 0.03);
      noiseBurst(0.12, 500 + Math.random()*100, 0.14, 0, 'lowpass', 0.025, true);
      noiseBurst(0.06, 2100, 0.07, 0, 'highpass', 0.06);
    },
    uppercut: () => {
      const a = ac();
      const t = a.currentTime;
      tone(50, 0.13, 'sine', 0.17, 0);
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(100, t);
      o.frequency.linearRampToValueAtTime(240, t+0.13);
      g.gain.setValueAtTime(0.13, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t+0.15);
      o.connect(g).connect(master);
      g.connect(reverbSend);
      o.start(t);
      o.stop(t+0.16);
      noiseBurst(0.045, 3100, 0.12, 0, 'highpass', 0.02);
    },

    // ===== PREMIUM UI - studio quality =====
    tick: () => {
      // Premium tick - crisp, with slight shimmer
      tone(1950, 0.035, 'sine', 0.028, 0, 0, false);
      tone(3900, 0.02, 'sine', 0.012, 0.01, 0, false);
    },
    hover: () => {
      tone(1200, 0.06, 'sine', 0.02, 0, 0, false);
    },
    select: () => {
      // Premium select - layered
      note(880, 0.18, 0.06, 0, 2.9, 0);
      note(1320, 0.22, 0.04, 0.04, 3.1, 0.1);
    },
    back: () => {
      tone(660, 0.1, 'sine', 0.05, 0, 0, false);
      tone(440, 0.18, 'sine', 0.04, 0.06, 0, false);
    },

    // ===== PREMIUM ENVIRONMENTAL =====
    footstep_concrete: (side) => {
      const pan = side || (Math.random()-0.5)*0.2;
      const rnd = Math.random();
      // Heel + toe + surface
      tone(85 + rnd*10, 0.08, 'sine', 0.06, 0, pan);
      noiseBurst(0.04, 1800 + rnd*400, 0.05, pan, 'bandpass', 0.01, true);
      noiseBurst(0.02, 4500, 0.02, pan, 'highpass', 0.02);
    },
    footstep_grass: (side) => {
      const pan = side || (Math.random()-0.5)*0.15;
      noiseBurst(0.06, 600 + Math.random()*200, 0.04, pan, 'lowpass', 0, true);
      noiseBurst(0.03, 2000, 0.02, pan, 'bandpass', 0.01);
    },
    footstep_wood: (side) => {
      const pan = side || (Math.random()-0.5)*0.15;
      tone(180 + Math.random()*30, 0.06, 'sine', 0.05, 0, pan);
      tone(350 + Math.random()*50, 0.04, 'sine', 0.03, 0.01, pan);
      noiseBurst(0.02, 3000, 0.02, pan, 'highpass', 0.015);
    },
    door_open: () => {
      // Premium door - creak + air
      const a = ac();
      const t = a.currentTime;
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(180, t);
      o.frequency.linearRampToValueAtTime(420, t+0.35);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t+0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t+0.45);
      o.connect(g).connect(master);
      g.connect(reverbSend);
      o.start(t);
      o.stop(t+0.5);
      noiseBurst(0.08, 800, 0.03, 0, 'lowpass', 0.05, true);
    },
    door_close: () => {
      tone(120, 0.12, 'sine', 0.08, 0, 0, false);
      noiseBurst(0.04, 600, 0.06, 0, 'lowpass', 0.02, true);
      tone(80, 0.08, 'sine', 0.05, 0.04, 0, false);
    },
    coin_premium: () => {
      // Premium coin - shimmer with harmonics
      shimmerNote(1046, 0.12, 0.06, 0);
      setTimeout(() => shimmerNote(1568, 0.18, 0.05, 0), 90);
      setTimeout(() => shimmerNote(2093, 0.35, 0.04, 0), 170);
      setTimeout(() => shimmerNote(3136, 0.5, 0.02, 0), 250);
    },
    success_premium: () => {
      // Premium success - choir pad + chimes
      const base = 523;
      [0, 0.12, 0.24, 0.4].forEach((d, i) => {
        const f = base * [1, 1.26, 1.5, 2][i];
        note(f, 0.5 + i*0.15, 0.06 - i*0.01, d, 2.8 + i*0.2, (i-1.5)*0.15);
      });
    },
    fail_premium: () => {
      // Premium fail - low brass + soft thud
      tone(150, 0.25, 'sine', 0.07, 0, 0, true);
      tone(100, 0.35, 'sine', 0.06, 0.08, 0, true);
      noiseBurst(0.08, 300, 0.04, 0, 'lowpass', 0.05, true);
    },
    levelup: () => {
      // Premium level up - rising arpeggio
      [523, 659, 784, 1046, 1318].forEach((f, i) => {
        shimmerNote(f, 0.3 + i*0.1, 0.05, i*0.09);
      });
    },
    heartbeat: () => {
      tone(55, 0.12, 'sine', 0.09, 0);
      tone(55, 0.12, 'sine', 0.09, 0.18);
    },
    breath: () => {
      noiseBurst(0.4, 400, 0.03, 0, 'lowpass', 0, true);
      noiseBurst(0.5, 600, 0.02, 0, 'bandpass', 0.1, true);
    },
    wind: () => {
      noiseBurst(1.2, 300, 0.025, (Math.random()-0.5)*0.6, 'lowpass', 0, true);
    },
    rain_drop: () => {
      const f = 2000 + Math.random()*2000;
      tone(f, 0.04, 'sine', 0.015 + Math.random()*0.01, 0, (Math.random()-0.5)*0.8);
    },
    church_bell: () => {
      // Premium church bell - fundamental + harmonics
      const base = 220;
      tone(base, 2.0, 'sine', 0.08, 0, 0, true);
      tone(base*2, 1.5, 'sine', 0.04, 0, 0, true);
      tone(base*3, 1.0, 'sine', 0.02, 0.05, 0, true);
      tone(base*4.2, 0.6, 'sine', 0.01, 0.1, 0, true);
    },
    city_hum: () => {
      tone(60, 0.8, 'sine', 0.02, 0, 0, true);
      tone(120, 0.8, 'sine', 0.015, 0, 0, true);
      noiseBurst(0.8, 400, 0.015, 0, 'lowpass', 0, true);
    },

    // Legacy - keep for compatibility
    buzz: () => { tone(140, 0.2, 'sine', 0.06); tone(110, 0.25, 'sine', 0.06, 0.18); },
    chime: () => shimmerNote(1318, 0.7, 0.07),
    chime2: () => { shimmerNote(1318, 0.5, 0.06); setTimeout(() => shimmerNote(1568, 0.7, 0.06), 180); },
    jingle: () => {
      const seq = [[659,0],[784,.28],[880,.56],[784,.84],[659,1.12],[587,1.4],[659,1.68]];
      seq.forEach(([f, w]) => shimmerNote(f, 0.9, 0.07, w));
      setTimeout(() => shimmerNote(1318, 1.4, 0.05), 1960);
    },
    pickup: () => { shimmerNote(880, 0.25, 0.06); setTimeout(() => shimmerNote(1174, 0.3, 0.06), 90); setTimeout(() => shimmerNote(1568, 0.5, 0.06), 180); },
    cash: () => { tone(1046, .07, 'sine', .05); tone(1568, .12, 'sine', .05, .08); shimmerNote(2093, .5, .05, .16); },
    phone: () => { for (let r = 0; r < 2; r++) { tone(440, .14, 'sine', .05, r * .5); tone(480, .14, 'sine', .05, r * .5); } },
    siren: () => { for (let i = 0; i < 3; i++) { tone(700, .3, 'sine', .04, i * .6); tone(950, .3, 'sine', .04, i * .6 + .3); } },
    door: () => { tone(300, .5, 'sine', .04); tone(210, .6, 'sine', .04, .25); noiseBurst(.3, 300, .03, 0, 'lowpass', .45, true); },
    lockpick: () => { noiseBurst(.04, 2400, .04); noiseBurst(.04, 2600, .04, 0, 'highpass', .16); noiseBurst(.05, 2200, .045, 0, 'highpass', .34); },
    step: (side) => CUSTOM.footstep_concrete(side),
    
    // Character stingers - premium
    'v-stoneface': () => { tone(98, .32, 'sine', .07, 0, -0.1, true); tone(82, .42, 'sine', .06, .14, -0.1, true); },
    'v-glasses': () => { shimmerNote(880, .14, .08, 0); setTimeout(() => shimmerNote(1320, .2, .06), 120); },
    'v-salena': () => shimmerNote(880, .7, .09),
    'v-sam': () => { tone(440, .12, 'sine', .07, 0); tone(480, .12, 'sine', .07, .14); },
    'v-priest': () => { CUSTOM.church_bell(); },
    'v-harbor': () => { tone(55, .45, 'sine', .15, 0, 0, true); noiseBurst(.14, 300, .07); },
    'v-nyx': () => { shimmerNote(1046, .45, .07); setTimeout(() => shimmerNote(1244, .65, .06), 140); },
    'v-nia': () => { shimmerNote(1318, .28, .08); setTimeout(() => shimmerNote(1568, .28, .08), 100); setTimeout(() => shimmerNote(1760, .45, .08), 200); },
    'v-ledger': () => { tone(1568, .07, 'triangle', .06); tone(2093, .14, 'triangle', .06, .08); },
    'v-bonnie': () => { tone(220, .16, 'sine', .06, 0, 0, true); tone(330, .16, 'sine', .06, .14, 0, true); tone(440, .28, 'sine', .06, .28, 0, true); },
    'v-wexler': () => { tone(392, .55, 'triangle', .07, 0, 0, true); tone(494, .55, 'triangle', .06, .02, 0, true); },
    'v-voss': () => { tone(147, .38, 'triangle', .07, 0, 0, true); tone(139, .38, 'triangle', .06, .22, 0, true); },
    'v-defender': () => noiseBurst(.16, 500, .11),
    'v-thug': () => noiseBurst(.16, 400, .11),
    'v-news': () => { noiseBurst(.09, 3000, .06, 0, 'highpass'); tone(940, .22, 'sine', .06, .12); },
    'v-tess': () => { tone(660, .09, 'sine', .06, 0); tone(880, .09, 'sine', .06, .1); tone(1320, .14, 'sine', .06, .2); },
    'v-dan': () => { noiseBurst(.035, 3000, .07); tone(1568, .12, 'triangle', .07, .07); },
    'v-marlow': () => { tone(196, .55, 'sine', .09, 0, 0, true); tone(147, .65, 'sine', .08, .22, 0, true); },
    'v-sera': () => { shimmerNote(740, .75, .08); setTimeout(() => shimmerNote(988, .95, .07), 220); },
    
    // Mission SFX - premium
    shot: () => { noiseBurst(.07, 1300, .11, 0, 'bandpass'); tone(90, .11, 'sine', .11, .01); },
    boom: () => { tone(50, .65, 'sine', .15, 0, 0, true); noiseBurst(.55, 200, .10, 0, 'lowpass', 0, true); },
    heli: () => { noiseBurst(.65, 300, .07, 0, 'lowpass', 0, true); tone(28, .65, 'sine', .06); },
    boat: () => { tone(70, .85, 'sine', .07, 0, 0, true); noiseBurst(.75, 250, .05, 0, 'lowpass', 0, true); },
    card: () => noiseBurst(.035, 3000, .035),
    glass: () => { noiseBurst(.22, 3600, .07, 0, 'highpass'); tone(2200, .16, 'sine', .035); },
    arrive: () => { shimmerNote(880, .32, .04, 0); setTimeout(() => shimmerNote(1174, .42, .04), 100); setTimeout(() => shimmerNote(1568, .52, .035), 200); },
    draw: () => { noiseBurst(.09, 2600, .035, 0, 'highpass'); tone(1200, .06, 'sine', .03, .1); },
  };

  function play(name, arg) {
    try {
      if (typeof OGAudio !== 'undefined' && OGAudio.isEnabled()) {
        const realPlayed = OGAudio.playRealSFX(name);
        if (realPlayed) {
          if ((name === 'punch' || name === 'hit') && Math.random() < 0.4) {
            setTimeout(() => { if (CUSTOM['grunt']) CUSTOM['grunt'](); }, 80 + Math.random()*60);
          }
          if (['punch', 'punch_heavy', 'door', 'glass', 'step'].includes(name)) {
            if (CUSTOM[name] && Math.random() < 0.25) {
              setTimeout(() => CUSTOM[name](arg), 30);
            }
            return;
          }
        }
      }
    } catch (e) {}

    if (name === 'punch' && Math.random() < 0.35) {
      if (CUSTOM['punch_heavy']) return CUSTOM['punch_heavy'](arg);
    }
    if (name === 'whoosh' && Math.random() < 0.3) {
      if (CUSTOM['whoosh_heavy']) return CUSTOM['whoosh_heavy'](arg);
    }
    if ((name === 'punch' || name === 'hit' || name === 'kick') && Math.random() < 0.35) {
      setTimeout(() => { if (CUSTOM['grunt']) CUSTOM['grunt'](); }, 80 + Math.random()*60);
    }
    if (CUSTOM[name]) return CUSTOM[name](arg);
    const seq = CUES[name];
    if (!seq) return;
    seq.forEach(([f, d, ty, g, w]) => tone(f, d, ty, g, w || 0));
  }

  function fightCombo(type = 'punch') {
    if (CUSTOM['whoosh']) CUSTOM['whoosh']();
    setTimeout(() => play(type), 120);
  }

  let engineNodes = null;
  function startEngine() {
    if (engineNodes) return;
    try {
      const a = ac();
      const len = a.sampleRate * 2;
      const buf = a.createBuffer(1, len, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / a.sampleRate;
        let v = 0;
        for (let h = 1; h <= 4; h++) v += Math.sin(2 * Math.PI * 52 * h * t) / h;
        d[i] = v * 0.22 * (0.85 + 0.15 * Math.sin(2 * Math.PI * 11 * t));
      }
      const s = a.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      const f = a.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 320;
      const g = a.createGain();
      g.gain.value = 0.14;
      s.connect(f).connect(g).connect(master);
      g.connect(reverbSend);
      s.start();
      engineNodes = { s, g };
    } catch (e) {}
  }
  
  function stopEngine() {
    if (!engineNodes) return;
    try {
      const a = ac();
      engineNodes.g.gain.setTargetAtTime(0.0001, a.currentTime, 0.25);
      const s = engineNodes.s;
      setTimeout(() => { try { s.stop(); } catch (e) {} }, 750);
    } catch (e) {}
    engineNodes = null;
  }

  function panPing(pan) {
    try {
      const a = ac();
      const t = a.currentTime;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(1500, t);
      o.frequency.exponentialRampToValueAtTime(480, t + 0.55);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g);
      let out = g;
      if (a.createStereoPanner) {
        const p = a.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        g.connect(p);
        out = p;
      }
      out.connect(master);
      g.connect(reverbSend);
      o.start(t);
      o.stop(t + 0.65);
    } catch (e) {}
  }

  function unlockMobile() {
    try { ac(); if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {}
  }

  return { play, panPing, startEngine, stopEngine, unlockMobile, CUSTOM, CUES };
})();
