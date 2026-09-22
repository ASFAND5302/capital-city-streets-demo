/* ============================================================
   CAPITAL CITY STREETS — src/music.js
   Generative noir score, 100% synthesized (zero audio files).
   Moods (set per scene in chapters.json via "music"):
     menu · noir · tense · combat · warm · sacred · drive · victory
   Ambient beds (via "vibe"): room · street · rain
   Music auto-ducks while the Smart Glasses speak.
   ============================================================ */

const Music = (() => {
  let ctx = null, master = null, musicGain = null, duckG = null, lpF = null;
  let mood = null, timer = null, nextBar = 0, barIdx = 0;
  let INTEN = 1;
  let volM = parseFloat(localStorage.getItem('ccs-musvol') ?? '1') || 1;
  let ambV = parseFloat(localStorage.getItem('ccs-ambvol') ?? '1') || 1;
  let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  let mobileUnlocked = false;

  const M = (n) => 440 * Math.pow(2, (n - 69) / 12);   // midi -> hz

  /* -------- mood definitions: chords(bars), bass, melody, style -------- */
  const MOODS = {
    menu:    { bpm: 56, pad: [[57,60,64,71],[53,57,60,65]], // slowed 66->56, softer
               bass: [33,29], mel: [76,74,72], melP: .15, perc: 'none', quiet: true }, // was 66 BPM, 4 chords, melP .35 brush -> 56 BPM, 2 bass, melP .15 none, quiet flag
    noir:    { bpm: 66, pad: [[57,60,64,71],[53,57,60,65],[48,55,60,64],[55,59,62,65]], // softened 70->66
               bass: [33,29,24,31], mel: [76,74,72,69,67,64], melP: .28, perc: 'brush', quiet: true }, // melP .5->.28 softer
    tense:   { bpm: 68, pad: [[50,53,57],[50,54,57]], bass: [38,38,37,38], // softened 84->68, spy scene but soft
               mel: [74,73,74,70], melP: .12, perc: 'brush', quiet: true }, // pulse->brush, .18->.12 soft for spy
    combat:  { bpm: 128, pad: [[48,51,55],[46,50,53],[43,48,52]], bass: [36,34,36,38,36,34,41,36],
               mel: [72,70,67,63,65], melP: .22, perc: 'fight', intense: true }, // KEEP intense - fight only
    fight:   { bpm: 138, pad: [[48,51,55],[45,49,52]], bass: [36,36,34,36,41,36,39,36],
               mel: [72,70,67,64], melP: .18, perc: 'fight', intense: true, fight: true }, // KEEP intense
    brawl:   { bpm: 142, pad: [[46,49,53],[43,48,52]], bass: [34,34,32,34,36,34],
               mel: [70,67,63,60], melP: .12, perc: 'fight', intense: true, fight: true }, // KEEP intense
    warm:    { bpm: 60, pad: [[48,55,60,64],[45,52,57,60]], bass: [24,21],
               mel: [76,79,81,79,76,74,76], melP: .9, perc: 'none', box: true },
    sacred:  { bpm: 56, pad: [[48,55,60,67],[43,50,55,62]], bass: [24,19],
               mel: [79,76,72], melP: .12, perc: 'none', bell: true },
    drive:   { bpm: 72, pad: [[45,48,52,55],[43,47,50,53]], bass: [33,33,40,33,31,31,38,43], // softened 96->72
               mel: [69,72,75,72], melP: .12, perc: 'brush', quiet: true }, // hats->brush, .2->.12 soft
    /* light district vibes for the open world (replaced noise beds) */
    chapel:  { bpm: 50, pad: [[48,55,60,67],[45,52,58,64]], bass: [24,19],
               mel: [83,81,79], melP: .12, perc: 'none', bell: true, quiet: true },
    midtown: { bpm: 68, pad: [[57,60,64,71],[53,57,60,67],[48,55,59,64],[55,59,62,67]], // 76->68 softer
               bass: [33,29,24,31], mel: [76,75,72,69,67], melP: .22, perc: 'brush', quiet: true }, // .4->.22
    southside:{ bpm: 64, pad: [[45,48,52,55],[43,47,50,53]], bass: [31,31,38,31,29,29,36,38], // 72->64
               mel: [67,70,72,70], melP: .15, perc: 'brush', quiet: true }, // hats->brush .25->.15
    /* extra vibe moods — boss asked for the right music behind every scene */
    mystery: { bpm: 60, pad: [[57,60,64],[55,58,62],[52,55,59]], bass: [33,31,29], // 64->60
               mel: [84,83,79,76], melP: .18, perc: 'none', shimmer: true, quiet: true }, // .3->.18
    blues:   { bpm: 56, pad: [[57,60,64,71],[53,57,60,67]], bass: [33,29], // 58->56
               mel: [69,72,74,75,76,79], melP: .25, perc: 'brush', quiet: true }, // .45->.25
    pulse:   { bpm: 78, pad: [[50,53,57],[48,52,55]], bass: [38,38,36,38], // FIXED loud bug 126->78 soft
               mel: [74,73,70], melP: .08, perc: 'brush', quiet: true }, // kit->brush .12->.08 soft, was loud cause
    conspiracy:{ bpm: 70, pad: [[50,53,57],[49,52,56]], bass: [38,37,38,36], // FIXED ch4 loud bug 80->70 soft spy
               mel: [74,73,70,67], melP: .10, perc: 'brush', quiet: true, motif: [62,63,62,59] }, // pulse->brush .2->.10 soft spy but still tense
    /* chapters 3-5 */
    sea:     { bpm: 60, pad: [[50,57,62,69],[48,55,60,67]], bass: [26,24], // 62->60
               mel: [81,79,76,74], melP: .18, perc: 'none', shimmer: true, quiet: true }, // .3->.18
    casino:  { bpm: 78, pad: [[53,57,60,67],[48,52,55,62]], bass: [29,29,36,29,24,24,31,36], // 104->78 soft
               mel: [72,74,76,79,76,74], melP: .22, perc: 'brush', quiet: true }, // .45->.22
    sera:    { bpm: 54, pad: [[57,64,69,76],[53,60,65,72]], bass: [33,29], // 56->54
               mel: [81,84,86,84,81,79], melP: .28, perc: 'none', motif: [81,84,86], quiet: true }, // .6->.28
    finale:  { bpm: 72, pad: [[50,53,57],[46,50,53]], bass: [38,36,34,31],   // 92->72 even softer
               mel: [70,67,63], melP: .06, perc: 'brush', motif: [62,63,62,59], quiet: true },  // .08->.06
    hero:    { bpm: 72, pad: [[45,52,57,64],[43,50,55,62]], bass: [33,31,29,26], // 88->72 soft
               mel: [69,72,76,79,81], melP: .18, perc: 'brush', motif: [45,52,57], quiet: true }, // .35->.18
    lament:  { bpm: 46, pad: [[45,52,57],[43,50,55]], bass: [26,24], // 48->46
               mel: [76,74,71,69,67], melP: .18, perc: 'none', motif: [76,74,71], quiet: true }, // .3->.18
    victory: { bpm: 72, pad: [[48,52,55,59],[53,57,60,64]], bass: [24,29], // 88->72
               mel: [72,76,79,84,79,76], melP: .28, perc: 'brush', motif: [72,76,79,84], quiet: true }, // .7->.28
    quartet: { bpm: 60, pad: [[57,60,64,71],[55,59,62,67],[53,57,60,64]], bass: [33,29,31], // 62->60
               mel: [76,79,81,84], melP: .12, perc: 'none', bowed: true, shimmer: false, quiet: true }, // .18->.12
    /* ===== Location-specific vibes — ALL SOFT except fight/spy ===== */
    safehouse: { bpm: 60, pad: [[57,60,64,69],[53,57,60,64],[48,52,55,60]], bass: [33,29,26], // 64->60
               mel: [74,72,69,67], melP: .18, perc: 'brush', shimmer: true, quiet: true }, // .30->.18
    apartment: { bpm: 58, pad: [[57,60,64],[55,58,62],[52,55,59]], bass: [33,31,29], // 62->58
               mel: [79,77,76,74], melP: .15, perc: 'none', shimmer: true, quiet: true }, // .28->.15
    pawnshop: { bpm: 56, pad: [[50,53,57],[48,52,56],[45,50,53]], bass: [33,31,29], // 60->56
               mel: [72,70,67,65], melP: .12, perc: 'none', quiet: true }, // .25->.12
    velvet:   { bpm: 68, pad: [[45,48,52,55],[43,47,50,54],[38,41,45,48]], bass: [38,36,38,40], // 78->68 soft
               mel: [69,72,75,72,70], melP: .18, perc: 'brush', quiet: true }, // pulse->brush .35->.18
    diner:    { bpm: 62, pad: [[57,60,64,67],[53,57,60,64],[48,55,59,64]], bass: [33,29,24], // 68->62
               mel: [69,71,72,74,76], melP: .18, perc: 'brush', quiet: true }, // .40->.18
    theater:  { bpm: 60, pad: [[57,60,64,71],[55,59,62,67],[53,57,60,64]], bass: [31,29,26], // 64->60
               mel: [76,79,81,79,76], melP: .15, perc: 'none', bowed: true, shimmer: true, quiet: true }, // .35->.15
    court:    { bpm: 64, pad: [[45,48,52,55],[43,47,50,53],[40,44,47,50]], bass: [31,31,38,31], // 74->64 soft
               mel: [67,70,72,70,69], melP: .12, perc: 'brush', quiet: true }, // hats->brush .30->.12
    garage:   { bpm: 68, pad: [[45,48,52,55],[43,47,50,53],[40,44,47,50]], bass: [33,33,40,33], // 88->68
               mel: [67,69,72,69], melP: .10, perc: 'brush', quiet: true }, // hats->brush .20->.10
    pier:     { bpm: 56, pad: [[50,57,62,69],[48,55,60,67],[45,52,57,62]], bass: [26,24,21], // 60->56
               mel: [79,77,74,72], melP: .12, perc: 'none', shimmer: true, quiet: true }, // .25->.12
    market:   { bpm: 62, pad: [[57,60,64],[55,58,62],[53,56,60]], bass: [33,31,29], // 70->62
               mel: [74,72,70,69], melP: .10, perc: 'none', quiet: true }, // .20->.10
    mansion:  { bpm: 58, pad: [[57,60,64,71],[53,57,60,67],[48,52,55,59]], bass: [24,29,31,26], // 62->58
               mel: [72,76,79,76,72], melP: .10, perc: 'none', bowed: true, shimmer: false, quiet: true }, // .15->.10
    workshop: { bpm: 64, pad: [[50,53,57],[48,52,55],[45,48,52]], bass: [36,34,38,33], // 80->64 soft
               mel: [70,68,65,67], melP: .08, perc: 'brush', quiet: true }, // pulse->brush .15->.08
    carwash:  { bpm: 64, pad: [[50,53,57],[48,51,55],[45,49,52]], bass: [33,31,29], // 76->64
               mel: [71,69,67,69], melP: .08, perc: 'brush', quiet: true }, // .15->.08
    greenhouse:{ bpm: 54, pad: [[48,55,60,67],[45,52,58,64],[43,50,55,60]], bass: [24,19,26], // 58->54
               mel: [81,79,76,74], melP: .10, perc: 'none', bell: true, shimmer: true, quiet: true }, // .20->.10
    industrial:{ bpm: 68, pad: [[50,53,57],[48,52,55],[45,48,52]], bass: [38,36,38,36], // 84->68 soft spy but not loud
               mel: [67,65,63,65], melP: .08, perc: 'brush', quiet: true }, // pulse->brush .12->.08 soft spy
    garden:   { bpm: 58, pad: [[48,55,60,64],[45,52,58,64],[43,50,55,60]], bass: [26,24,21], // 62->58
               mel: [76,74,72,71], melP: .10, perc: 'none', shimmer: true, quiet: true }, // .20->.10
  };


  function unlockMobile() {
    if (mobileUnlocked) return;
    mobileUnlocked = true;
    try {
      if (ctx && ctx.state === 'suspended') ctx.resume();
      console.log('[Music] Mobile unlocked - AudioContext resumed');
    } catch (e) {}
  }

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // PREMIUM MASTER CHAIN - studio grade
      master = ctx.createGain();
      master.gain.value = isMobile ? 0.62 : 0.78; // premium softer for blind clarity
      
      const masterLP = ctx.createBiquadFilter();
      masterLP.type = 'lowpass';
      masterLP.frequency.value = 6800; // premium air but no harsh
      masterLP.Q.value = 0.55;
      
      const masterHP = ctx.createBiquadFilter();
      masterHP.type = 'highpass';
      masterHP.frequency.value = 28; // remove sub rumble
      
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -22;
      comp.knee.value = 28;
      comp.ratio.value = 2.2; // gentle glue premium
      comp.attack.value = 0.025;
      comp.release.value = 0.38;
      
      // Premium limiter via second compressor
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 0;
      limiter.ratio.value = 18;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.12;
      
      master.connect(masterHP).connect(masterLP).connect(comp).connect(limiter).connect(ctx.destination);
      
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.0001;
      lpF = ctx.createBiquadFilter();
      lpF.type = 'lowpass';
      lpF.frequency.value = 6200;
      lpF.Q.value = 0.65;
      duckG = ctx.createGain();
      duckG.gain.value = 1;
      
      // Premium sub-bass gain for depth
      const subGain = ctx.createGain();
      subGain.gain.value = 0.35;
      ctx._subGain = subGain;
      subGain.connect(duckG);
      
      musicGain.connect(lpF);
      lpF.connect(duckG);
      duckG.connect(master);
      
      const isMenu = mood === 'menu';
      const isQuietMood = MOODS[mood] && MOODS[mood].quiet;
      const isFightMood = mood && ['combat','fight','brawl'].includes(mood);
      let targetVol = 0.055;
      if (isMenu) targetVol = 0.022;
      else if (isQuietMood) targetVol = 0.038;
      else if (isFightMood) targetVol = 0.095;
      else targetVol = 0.055;
      
      musicGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      musicGain.gain.linearRampToValueAtTime(targetVol * volM, ctx.currentTime + 3.2); // slower fade premium
      
      // PREMIUM REVERB - studio plate + hall hybrid
      spaceSend = ctx.createGain();
      spaceSend.gain.value = 0.32;
      const preDelay = ctx.createDelay(0.5);
      preDelay.delayTime.value = 0.045; // 45ms pre-delay premium
      const dl = ctx.createDelay(1.2);
      dl.delayTime.value = 0.36;
      const dl2 = ctx.createDelay(1.2);
      dl2.delayTime.value = 0.52; // second tap for stereo
      const fb = ctx.createGain();
      fb.gain.value = 0.14;
      const fb2 = ctx.createGain();
      fb2.gain.value = 0.11;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1650;
      const lp2 = ctx.createBiquadFilter();
      lp2.type = 'lowpass';
      lp2.frequency.value = 1350;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 220;
      
      spaceSend.connect(preDelay);
      preDelay.connect(dl);
      dl.connect(lp);
      lp.connect(hp);
      hp.connect(fb);
      fb.connect(dl);
      dl.connect(dl2);
      dl2.connect(lp2);
      lp2.connect(fb2);
      fb2.connect(dl2);
      
      const wet = ctx.createGain();
      wet.gain.value = 0.13;
      const wet2 = ctx.createGain();
      wet2.gain.value = 0.09;
      dl.connect(wet).connect(musicGain);
      dl2.connect(wet2).connect(musicGain);
      
      ctx._spaceDL = dl;
      ctx._spaceDL2 = dl2;
      
      console.log('[Music] Premium studio chain initialized - master:', master.gain.value, 'reverb: plate+hall');
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  let spaceSend = null;

  /* -------- PREMIUM voices - studio grade -------- */
  function humanizeTime(t, amount = 0.018) {
    return t + (Math.random() - 0.5) * amount; // ±9ms musical humanization
  }
  function humanizeVel(base, variance = 0.18) {
    return base * (0.85 + Math.random() * variance + 0.15 * Math.sin(Date.now() * 0.001 + Math.random()));
  }
  
  function padNote(freqs, t, dur) {
    const bowed = MOODS[mood] && MOODS[mood].bowed;
    const isGrandFinale = mood && ['quartet','mansion','finale','hero'].includes(mood);
    const isNoir = mood && ['noir','menu','safehouse','apartment'].includes(mood);
    
    // Premium: add jazz extensions - 9ths, 11ths, 13ths for richness
    let extendedFreqs = [...freqs];
    if (barIdx % 4 === 1 && !isGrandFinale) {
      extendedFreqs = extendedFreqs.concat([freqs[0] + 14]); // 9th
      if (Math.random() < 0.4 && isNoir) extendedFreqs.push(freqs[1] + 17); // 11th for noir
    }
    if (barIdx % 8 === 3 && isNoir && Math.random() < 0.3) {
      extendedFreqs.push(freqs[0] + 21); // 13th occasional
    }
    
    extendedFreqs.forEach((n, i) => {
      const ht = humanizeTime(t, 0.022);
      const o = ctx.createOscillator(), g = ctx.createGain();
      
      if (bowed) {
        o.type = 'triangle';
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = isGrandFinale ? 520 : 680;
        lp.Q.value = 0.6;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 80;
        o.connect(lp);
        lp.connect(hp);
        const out = g;
        hp.connect(out);
        o.frequency.value = M(n);
        o.detune.value = (i % 2 ? 2.5 : -2.2) + (Math.random()-0.5)*1.2; // musical detune
        const vel = humanizeVel(isGrandFinale ? 0.013 : 0.019, 0.2);
        g.gain.setValueAtTime(0.0001, ht);
        g.gain.linearRampToValueAtTime(vel, ht + dur * 0.55);
        g.gain.linearRampToValueAtTime(0.0001, ht + dur);
        o.start(ht);
        o.stop(ht + dur + 0.12);
        g.connect(musicGain);
        if (!isGrandFinale) g.connect(spaceSend);
        return;
      }
      
      // Premium pad - sine with subtle second harmonic for warmth
      o.type = 'sine';
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = isNoir ? 2800 : 3400;
      lp.Q.value = 0.5;
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = M(n) * 2.001; // slight detune for chorus
      const g2 = ctx.createGain();
      g2.gain.value = 0.18; // subtle harmonic
      const lp2 = ctx.createBiquadFilter();
      lp2.type = 'lowpass';
      lp2.frequency.value = 2200;
      
      o.frequency.value = M(n);
      o.detune.value = (i % 2 ? 3.2 : -2.4) + (Math.random()-0.5)*1.5;
      o2.detune.value = o.detune.value * 0.5;
      
      const vel = humanizeVel(0.034, 0.18);
      g.gain.setValueAtTime(0.0001, ht);
      g.gain.linearRampToValueAtTime(vel, ht + dur * 0.32);
      g.gain.linearRampToValueAtTime(0.0001, ht + dur);
      
      o.connect(lp).connect(g);
      o2.connect(lp2).connect(g2).connect(g);
      g.connect(musicGain);
      g.connect(spaceSend);
      o.start(ht);
      o.stop(ht + dur + 0.12);
      o2.start(ht);
      o2.stop(ht + dur + 0.12);
    });
    
    // Premium sub-bass layer for depth (only on root)
    if (freqs.length && ctx._subGain && !isGrandFinale) {
      const subN = freqs[0] - 12; // octave below root
      const o = ctx.createOscillator(), g = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 120;
      o.type = 'sine';
      o.frequency.value = M(subN);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.045, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.8);
      o.connect(lp).connect(g).connect(ctx._subGain);
      o.start(t);
      o.stop(t + dur * 0.8 + 0.1);
    }
  }
  
  function bassNote(n, t, dur) {
    const ht = humanizeTime(t, 0.015);
    const o = ctx.createOscillator(), g = ctx.createGain();
    const o2 = ctx.createOscillator(), g2 = ctx.createGain();
    
    // Premium bass - fundamental + subtle 2nd harmonic for punch
    o.type = 'sine';
    o.frequency.value = M(n);
    o2.type = 'sine';
    o2.frequency.value = M(n) * 2;
    g2.gain.value = 0.22;
    
    // Chromatic approach for walking bass realism (10% chance)
    if (Math.random() < 0.12 && dur < 0.6) {
      o.frequency.setValueAtTime(M(n - 1), ht);
      o.frequency.linearRampToValueAtTime(M(n), ht + 0.06);
    }
    
    const vel = humanizeVel(0.072, 0.15);
    g.gain.setValueAtTime(0.0001, ht);
    g.gain.linearRampToValueAtTime(vel, ht + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, ht + dur);
    
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 350;
    lp.Q.value = 0.6;
    
    o.connect(lp).connect(g);
    o2.connect(g2).connect(g);
    g.connect(musicGain);
    o.start(ht);
    o.stop(ht + dur + 0.12);
    o2.start(ht);
    o2.stop(ht + dur + 0.12);
  }
  function melodyNote(n, t, box) {
    const isGrandFinale = mood && ['quartet','mansion','finale','hero','victory'].includes(mood);
    const isPiercingRange = n >= 76; // E5 and above = piercing 2-4kHz harmonics
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = M(n);
    // gentle vibrato for a human touch - FIXED piercing: reduced depth for high notes in finale
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = isGrandFinale ? 3.2 : 4.8; // slower vibrato for finale
    lg.gain.value = M(n) * (isGrandFinale ? (isPiercingRange ? 0.0005 : 0.001) : 0.003); // was 0.003 piercing -> 0.0005 for high notes
    lfo.connect(lg).connect(o.frequency);
    // overtone - FIXED: removed for grand finale high notes to avoid 2-4kHz piercing
    const g2 = ctx.createGain(); 
    if (isGrandFinale && isPiercingRange) {
      g2.gain.value = 0.01; // was 0.05 piercing -> 0.01
    } else {
      g2.gain.value = box ? 0.04 : 0.02; // was 0.10/0.05 too loud -> 0.04/0.02
    }
    o2.type = 'sine'; o2.frequency.value = M(n) * (box ? 2 : 2); // was 4/3 -> 2/2 lower harmonic avoids 3kHz piercing
    // soft lowpass on the overtone - much lower for finale
    const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; 
    lp2.frequency.value = isGrandFinale ? (isPiercingRange ? 1000 : 1500) : (box ? 2000 : 1600); // was 3500/2800 piercing -> 1000-2000
    g.gain.setValueAtTime(0.0001, t);
    const mainGain = isGrandFinale ? (box ? 0.03 : (isPiercingRange ? 0.015 : 0.022)) : (box ? 0.06 : 0.038);
    g.gain.linearRampToValueAtTime(mainGain, t + .04); // slightly longer attack
    g.gain.exponentialRampToValueAtTime(0.0001, t + (isGrandFinale ? 1.0 : 1.4)); // shorter for finale less overlap
    o.connect(g); 
    if (!isGrandFinale || !isPiercingRange || Math.random() < 0.3) { // 70% skip harmonic for high finale notes
      o2.connect(lp2).connect(g2).connect(g);
    }
    g.connect(musicGain); 
    if (!isGrandFinale) g.connect(spaceSend); // no reverb for finale to avoid build-up piercing
    o.start(t); o.stop(t + (isGrandFinale ? 1.1 : 1.5)); 
    o2.start(t); o2.stop(t + (isGrandFinale ? 1.1 : 1.5)); 
    lfo.start(t); lfo.stop(t + (isGrandFinale ? 1.1 : 1.5));
  }
  function hat(t, open) { 
    const isGrandFinale = mood && ['quartet','mansion','finale','hero','victory','pulse','tense'].includes(mood);
    // FIXED piercing: was 3800Hz harsh sizzle -> lower freq for all, especially finale
    const freq = isGrandFinale ? (open ? 1600 : 1100) : (open ? 2200 : 1600);
    const gain = isGrandFinale ? (open ? 0.025 : 0.010) : (open ? 0.045 : 0.018);
    const dur = isGrandFinale ? (open ? 0.045 : 0.012) : (open ? 0.06 : 0.020);
    noiseAt(t, gain, freq, 'highpass', dur); 
  }
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(42, t + .14);
    g.gain.setValueAtTime(.18, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + .20);
    o.connect(g).connect(musicGain); o.start(t); o.stop(t + .22);
  }
  function snare(t) { 
    const isGrandFinale = mood && ['quartet','mansion','finale','hero','victory','pulse'].includes(mood);
    const gain = isGrandFinale ? 0.035 : 0.055; // was 0.065
    const freq = isGrandFinale ? 900 : 1300; // was 1600 piercing
    noiseAt(t, gain, freq, 'bandpass', isGrandFinale ? 0.05 : 0.07); 
  }
  function noiseAt(t, gain, freq, type, dur) {
    const s = ctx.createBufferSource(); s.buffer = getNoiseBuf();
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + .01);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f).connect(g).connect(musicGain);
    s.start(t); s.stop(t + dur + .05);
  }
  let noiseBuf = null;
  function getNoiseBuf() {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  /* -------- scheduler -------- */
  function scheduleBar(t) {
    const md = MOODS[mood]; if (!md) return;
    const barDur = (60 / md.bpm) * 4;
    const chord = md.pad[barIdx % md.pad.length];
    padNote(chord, t, barDur * 1.05);
    const b = md.bass[barIdx % md.bass.length];
    const swing = barDur / 24;
    if (md.perc === 'fight') {
      // REAL FIGHT FEEL: like a street brawl - pounding heart, heavy breathing, impacts
      const isBrawl = md.fight && md.bpm >= 142;
      const isFight = md.fight || md.bpm >= 138;
      // 1. Driving bass - like footsteps circling, heavy and low
      for (let e = 0; e < 8; e++) {
        const et = t + (barDur / 8) * e + (e % 2 ? swing * 0.4 : 0);
        // Alternating root and 5th - tension
        const note = e % 4 === 0 ? b : e % 4 === 2 ? b + 7 : e % 2 ? b - 2 : b;
        bassNote(note, et, barDur / 11);
        // Double bass for brawl - extra aggression
        if (isBrawl && e % 2 === 0) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = M(note - 12) * 0.5; // sub-bass
          g.gain.setValueAtTime(0.05, et);
          g.gain.exponentialRampToValueAtTime(0.0001, et + barDur/6);
          o.connect(g).connect(musicGain); o.start(et); o.stop(et + barDur/6 + 0.05);
        }
        // Fast aggressive hats - like quick jabs
        hat(et, false);
        if (e % 2 === 0) {
          hat(et + barDur/32, false);
          if (isFight) hat(et + barDur/24, false); // extra 16th
        }
      }
      // 2. Heavy fight drums - kick = body shot, snare = head shot
      // Kick pattern: BOOM - boom - BOOM - BOOM (like real fight rhythm)
      kick(t); // heavy downbeat
      kick(t + barDur/8 * 0.9); // quick follow
      kick(t + barDur/4); // beat 2
      if (isFight) kick(t + barDur/4 + barDur/16); // extra jab
      kick(t + barDur/2); // beat 3 - heavy
      kick(t + barDur/2 + barDur/12); // stumble
      if (isBrawl) {
        kick(t + barDur*0.625);
        kick(t + barDur*0.78);
      }
      // Snare: CRACK on 2 and 4, plus off-beats like counters
      snare(t + barDur/4); // 2
      snare(t + barDur/4 + barDur/32); // flam
      snare(t + barDur*0.75); // 4
      snare(t + barDur*0.375); // counter 1
      snare(t + barDur*0.875); // counter 2
      if (isFight) {
        snare(t + barDur*0.15); // early counter
        snare(t + barDur*0.65); // late counter
      }
      // 3. Low fight rumble - chest thump, crowd tension
      if (INTEN >= 1) {
        const rumbleT = t + barDur*0.05;
        // Sub rumble 45->28 Hz - like heart pounding
        const o = ctx.createOscillator(), g = ctx.createGain();
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 90;
        o.type = 'sine'; o.frequency.setValueAtTime(48, rumbleT);
        o.frequency.exponentialRampToValueAtTime(28, rumbleT + barDur*0.9);
        g.gain.setValueAtTime(isBrawl ? 0.12 : 0.09, rumbleT);
        g.gain.linearRampToValueAtTime(isBrawl ? 0.06 : 0.04, rumbleT + barDur*0.5);
        g.gain.exponentialRampToValueAtTime(0.0001, rumbleT + barDur);
        o.connect(lp).connect(g).connect(musicGain);
        o.start(rumbleT); o.stop(rumbleT + barDur + 0.1);
        // Second harmonic for thickness
        const o2 = ctx.createOscillator(), g2 = ctx.createGain();
        o2.type = 'sine'; o2.frequency.setValueAtTime(96, rumbleT);
        o2.frequency.exponentialRampToValueAtTime(56, rumbleT + barDur*0.9);
        g2.gain.setValueAtTime(0.03, rumbleT);
        g2.gain.exponentialRampToValueAtTime(0.0001, rumbleT + barDur*0.7);
        o2.connect(g2).connect(musicGain); o2.start(rumbleT); o2.stop(rumbleT + barDur*0.7);
      }
      // 4. Fight heartbeat - double thump like real adrenaline
      if (INTEN >= 1) {
        [0, 0.18].forEach(off => {
          const ht = t + barDur*off;
          const o = ctx.createOscillator(), g = ctx.createGain();
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200;
          o.type = 'sine';
          o.frequency.setValueAtTime(60, ht);
          o.frequency.exponentialRampToValueAtTime(38, ht + 0.12);
          g.gain.setValueAtTime(0.08, ht);
          g.gain.exponentialRampToValueAtTime(0.0001, ht + 0.16);
          o.connect(lp).connect(g).connect(musicGain);
          o.start(ht); o.stop(ht + 0.18);
        });
      }
      if (INTEN >= 2) {
        hat(t + barDur * .75 + swing, false);
        kick(t + barDur*0.625);
        // Extra impact hit
        if (Math.random() < 0.4) {
          const it = t + barDur*0.9;
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'triangle'; o.frequency.value = M(36);
          g.gain.setValueAtTime(0.06, it);
          g.gain.exponentialRampToValueAtTime(0.0001, it + 0.15);
          o.connect(g).connect(musicGain); o.start(it); o.stop(it + 0.16);
        }
      }
    } else if (md.perc === 'kit' || md.perc === 'hats') {
      for (let e = 0; e < 8; e++) {
        const et = t + (barDur / 8) * e + (e % 2 ? swing : 0);
        bassNote(e % 2 ? b + 12 : b, et, barDur / 9);
        if (INTEN >= 1) hat(et, false);
      }
      if (md.perc === 'kit' && INTEN >= 1) { kick(t); kick(t + barDur / 2); snare(t + barDur / 4); snare(t + barDur * .75); }
      if (INTEN >= 2) hat(t + barDur * .75 + swing, false);   // extra heat
    } else if (md.perc === 'pulse') {
      for (let e = 0; e < 4; e++) { bassNote(b, t + (barDur / 4) * e, .3); }
      if (INTEN >= 1) noiseAt(t + barDur / 2, .03, 300, 'lowpass', .3);
    } else {
      // walking bass: root, 5th, octave, blue 7th
      const walk = [0, 7, 12, 10];
      for (let e = 0; e < 4; e++) bassNote(b + walk[e], t + (barDur / 4) * e, barDur / 4.5);
      hat(t + barDur * .5 + swing, true);   // brushed swing
      if (INTEN >= 2) hat(t + barDur * .75 + swing, false);
    }
    if (md.box) {  // Mama's song, one motif note per beat
      const seq = md.mel;
      const note = seq[barIdx % seq.length];
      melodyNote(note, t + .05, true);
      if (barIdx % 2) melodyNote(seq[(barIdx + 3) % seq.length], t + barDur / 2, true);
    } else if (Math.random() < md.melP * (INTEN === 0 ? 0.4 : INTEN >= 2 ? 1.2 : 1)) {
      // a short blue-scale phrase instead of a single note
      const start = Math.floor(Math.random() * md.mel.length);
      const len = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < len; i++) {
        const n = md.mel[(start + (i % 2 ? i : -i) + md.mel.length * 2) % md.mel.length];
        melodyNote(n, t + barDur * 0.1 + i * 0.24, false);
      }
    }
    if (md.bell && barIdx % 4 === 2) melodyNote(88, t + barDur / 2, true);
    if (md.motif && barIdx % 4 === 3 && INTEN >= 1) {   // leitmotif cameo every 4th bar - FIXED piercing in finale
      const isGrandFinale = ['quartet','mansion','finale','hero','victory'].includes(mood);
      if (isGrandFinale && INTEN === 0) return; // no motif when calm in gala to avoid piercing
      md.motif.forEach((n, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = isGrandFinale ? 1200 : 2000; // was 2800 piercing -> 1200
        o.type = 'sine'; o.frequency.value = M(n);
        const et = t + (barDur / 4) * i * .9;
        g.gain.setValueAtTime(0.0001, et);
        g.gain.linearRampToValueAtTime(isGrandFinale ? 0.012 : 0.022, et + .05); // was 0.028
        g.gain.exponentialRampToValueAtTime(0.0001, et + (isGrandFinale ? 0.35 : 0.55));
        o.connect(lp).connect(g); g.connect(musicGain); 
        if (!isGrandFinale) g.connect(spaceSend);
        o.start(et); o.stop(et + (isGrandFinale ? 0.40 : 0.60));
      });
    }
    if (md.shimmer) {  // airy 16th-note sparkle - FIXED piercing: reduced gain and skip for finale
      const isGrandFinale = ['quartet','mansion','finale','hero','victory'].includes(mood);
      if (isGrandFinale) return; // no shimmer at all in grand finale to avoid piercing
      for (let e = 0; e < 8; e++) {
        const n = chord[e % chord.length] + 24;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = M(n);
        const et = t + (barDur / 8) * e + (e % 2 ? barDur / 24 : 0);
        g.gain.setValueAtTime(0.0001, et);
        g.gain.linearRampToValueAtTime(0.004, et + .04); // was 0.008 -> 0.004 less piercing
        g.gain.exponentialRampToValueAtTime(0.0001, et + .25); // was 0.35 shorter
        o.connect(g); g.connect(musicGain); g.connect(spaceSend);
        o.start(et); o.stop(et + .30); // was 0.40 shorter
      }
    }
    barIdx++;
  }

  function tick() {
    const md = MOODS[mood]; if (!md) return;
    const barDur = (60 / md.bpm) * 4;
    while (nextBar < ctx.currentTime + 0.6) {
      scheduleBar(Math.max(nextBar, ctx.currentTime + 0.05));
      nextBar += barDur;
    }
  }

  /* -------- public - with OpenGameArt.org real noir tracks for blind vibe -------- */
  function play(id) {
    if (!MOODS[id]) return;
    
    // Try real OGA noir tracks first for blind-friendly immersion
    // If OGAudio enabled and has track for this mood, use real music
    try {
      if (typeof OGAudio !== 'undefined' && OGAudio.isEnabled()) {
        const hasReal = OGAudio.playMood(id);
        if (hasReal) {
          // Also keep generative as subtle layer underneath for continuity
          // But lower its volume so real track is prominent
          mood = id;
          console.log(`[Music] Blind vibe: Real noir track for ${id} from OpenGameArt.org`);
          // Still init generative context for ambient and effects
          try { ac(); } catch (e) {}
          // Reduce generative volume to be background texture - menu even lower
          const isMenuReal = id === 'menu';
          if (musicGain) {
            try { musicGain.gain.setTargetAtTime((isMenuReal ? 0.015 : 0.02) * volM, ctx.currentTime, 0.5); } catch (e) {}
          }
          // Stop generative timer to avoid clash, but keep ambient
          if (timer) { clearInterval(timer); timer = null; }
          return;
        }
      }
    } catch (e) {
      console.warn('[Music] OGAudio playMood failed, falling back to generative:', e);
    }
    
    // Fallback to generative noir score
    try { ac(); } catch (e) { return; }
    if (mood === id && timer) return;
    const changed = mood && mood !== id;
    const oldMood = mood;
    mood = id; barIdx = 0;
    nextBar = ctx.currentTime + 0.15;
    // ALL SOFT except fight/spy - user request: sary soft musics rakho sirf fight intense or spy seens main hii intense
    const isMenu = id === 'menu';
    const isQuiet = MOODS[id] && MOODS[id].quiet;
    const isFight = ['combat','fight','brawl'].includes(id);
    const isSpy = ['conspiracy','tense','pulse','industrial'].includes(id);
    if (isMenu) {
      if (musicGain) {
        try { musicGain.gain.setTargetAtTime(0.025 * volM, ctx.currentTime, 0.8); } catch (e) {}
      }
    } else if (isQuiet) {
      if (musicGain) {
        try { musicGain.gain.setTargetAtTime(0.04 * volM, ctx.currentTime, 0.8); } catch (e) {} // soft
      }
    } else if (isFight) {
      if (musicGain) {
        try { musicGain.gain.setTargetAtTime(0.10 * volM, ctx.currentTime, 0.5); } catch (e) {} // fight intense loud
      }
    } else if (isSpy) {
      if (musicGain) {
        try { musicGain.gain.setTargetAtTime(0.055 * volM, ctx.currentTime, 0.8); } catch (e) {} // spy medium soft
      }
    } else {
      if (musicGain && changed) {
        // Coming from menu to chapter - fade up soft
        if (oldMood === 'menu') {
          musicGain.gain.setValueAtTime(0.025 * volM, ctx.currentTime);
          musicGain.gain.linearRampToValueAtTime(0.06 * volM, ctx.currentTime + 1.2);
        } else {
          musicGain.gain.setTargetAtTime(0.06 * volM, ctx.currentTime, 0.8); // default soft
        }
      } else if (musicGain && !changed) {
        // Same mood but ensure soft volume
        const target = isQuiet ? 0.04 : 0.06;
        musicGain.gain.setTargetAtTime(target * volM, ctx.currentTime, 0.8);
      }
    }
    if (changed) {  // FIXED: smooth crossfade to avoid glitchy overlap when entering ch5
      // Quick fade out old mood to prevent piercing overlap
      const t = ctx.currentTime;
      musicGain.gain.setTargetAtTime(0.0001, t, 0.12);
      setTimeout(() => {
        if (ctx && musicGain) {
          musicGain.gain.setTargetAtTime(0.10 * volM, ctx.currentTime, 0.35);
        }
      }, 180);
      // Soft rising answer from new key - lower gain for finale to avoid piercing
      const isNewFinale = ['quartet','mansion','finale','hero','victory'].includes(id);
      const root = MOODS[id].pad[0];
      [0, 2, 1].forEach((ix, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = isNewFinale ? 1200 : 2000;
        o.type = 'sine'; o.frequency.value = M(root[ix] + 12);
        const et = ctx.currentTime + i * 0.13;
        g.gain.setValueAtTime(0.0001, et);
        g.gain.linearRampToValueAtTime(isNewFinale ? 0.02 : 0.035, et + .03);
        g.gain.exponentialRampToValueAtTime(0.0001, et + (isNewFinale ? 0.45 : 0.6));
        o.connect(lp).connect(g); g.connect(musicGain); 
        if (!isNewFinale) g.connect(spaceSend);
        o.start(et); o.stop(et + (isNewFinale ? 0.50 : 0.65));
      });
      console.log(`[Music] Crossfade: ${oldMood} -> ${id} (fix glitch)`);
    }
    if (!timer) timer = setInterval(tick, 250);
    tick();
  }

  /* -------- musical ambience layers (impulses & tones, never noise washes) - softened -------- */
  let ambGains = {}, ambBuilt = false, curAmb = null;
  const blip = (f, dur, gain, type = 'sine', glideTo) => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
    o.type = type === 'square' || type === 'sawtooth' ? 'sine' : type; // avoid harsh square/saw in ambience
    o.frequency.setValueAtTime(f, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(gain * 0.6, t); // reduce ambience harshness by 40%
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(master);
    o.start(t); o.stop(t + dur + .02);
  };
  function buildAmb() {
    if (ambBuilt) return; ambBuilt = true;
    const mk = (id, period, prob, tick, drones) => {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
      (drones || []).forEach(([f, dg, type]) => {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = type || 'sine'; o.frequency.value = f; og.gain.value = dg;
        o.connect(og).connect(g); o.start();
      });
      setInterval(() => { if (g.gain.value > 0.001 && Math.random() < prob) tick(); }, period);
      ambGains[id] = g;
    };
    mk('room', 2800, 1, () => blip(1400, .05, .02), [[98, .5], [147, .4]]);
    mk('radio', 1400, 1, () => {
      const penta = [69, 72, 74, 76, 79];
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 750;
      o.type = 'triangle'; o.frequency.value = M(penta[Math.floor(Math.random() * penta.length)]);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.04, t + .05);
      g.gain.exponentialRampToValueAtTime(.0001, t + 1.1);
      o.connect(g).connect(lp).connect(master); o.start(t); o.stop(t + 1.2);
    });
    mk('crackle', 130, .6, () => {
      const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = getNoiseBuf();
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3500;
      const g = ctx.createGain(); g.gain.setValueAtTime(.012, t);
      g.gain.exponentialRampToValueAtTime(.0001, t + .02);
      s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + .03);
    });
    /* night city: FIXED piercing 4200Hz cricket -> 2800Hz softer */
    mk('night', 1200, .4, () => { // was 900,0.5 too frequent piercing
      if (Math.random() < .80) { blip(2800, .04, .005); if (Math.random() < .4) setTimeout(() => blip(2600, .04, .004), 140); } // was 4200Hz 0.008
      else { blip(220, .6, .010, 'triangle'); blip(280, .6, .008, 'triangle', 350); } // was 233/311
    });
    /* club / casino: muffled sub thumps + glass clinks */
    mk('club', 480, .8, () => {
      if (Math.random() < .7) blip(52, .14, .05);
      else blip(2400 + Math.random() * 600, .09, .012);
    });
    /* church: low organ fifth + a bell every so often */
    mk('church', 9000, 1, () => { blip(880, 2.2, .015, 'sine', 870); blip(1320, 1.6, .008); },
       [[49, .5], [74, .35]]);
    /* island: lazy plucked pentatonics + an occasional gull cry */
    mk('island', 1600, .8, () => {
      if (Math.random() < .88) {
        const n = [72, 74, 76, 79, 81][Math.floor(Math.random() * 5)];
        blip(M(n), .5, .02); blip(M(n) * 2.7, .25, .006);
      } else blip(1250, .35, .012, 'sine', 720);
    });
    /* mansion / gala: FIXED - was sawtooth 98Hz 0.35 gain glitchy, now soft sine + lower blip */
    mk('mansion', 4000, .35, () => blip(1400 + Math.random() * 400, .30, .005), // was 3200,0.5, 2100Hz 0.008 piercing -> 4000,0.35, 1400Hz 0.005
       [[49, 0.08, 'sine'], [74, 0.04, 'sine']]); // was 0.10/0.06 -> 0.08/0.04 even softer
    /* precinct: fluorescent hum + far phone + typewriter ticks */
    mk('precinct', 1200, .6, () => {
      const r = Math.random();
      if (r < .6) blip(1800, .02, .008);
      else if (r < .75) { blip(440, .12, .01); blip(480, .12, .01); }
    }, [[120, .25]]);
    /* boat: puttering engine rhythm */
    mk('boat', 350, .9, () => blip(70, .07, .045, 'square', 60));
    /* rain: discrete drops on the rooftop + a far thunder now and then */
    mk('rain', 300, .5, () => {
      if (Math.random() < .82) blip(2600 + Math.random() * 1800, .03, .008);
      else blip(60, 1.4, .02, 'sine', 45);
    });
    /* court: a lone bouncing ball + chain-net rattle */
    mk('court', 1100, .8, () => {
      if (Math.random() < .75) blip(190, .09, .03, 'sine', 150);
      else { const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = getNoiseBuf();
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
        const g = ctx.createGain(); g.gain.setValueAtTime(.008, t);
        g.gain.exponentialRampToValueAtTime(.0001, t + .08);
        s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + .1); }
    });
  }
  function setAmb(id) {
    if (curAmb === id) return;
    curAmb = id;
    try { ac(); buildAmb(); } catch (e) { return; }
    const t = ctx.currentTime;
    for (const [k, g] of Object.entries(ambGains)) {
      g.gain.setTargetAtTime(k === id ? 0.028 * ambV : 0, t, 0.9);
    }
  }

  /* -------- arrival signatures: every place sounds like itself - softened -------- */
  function arrive(kind) {
    try { ac(); } catch (e) { return; }
    const t0 = ctx.currentTime + 0.05;
    const at = (f, dur, g, type, glide, w) => {
      const t = t0 + (w || 0);
      const o = ctx.createOscillator(), gg = ctx.createGain();
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4500;
      // soften harsh types
      const softType = type === 'square' || type === 'sawtooth' ? 'sine' : (type || 'sine');
      o.type = softType; o.frequency.setValueAtTime(f, t);
      if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
      gg.gain.setValueAtTime(g * 0.6, t);
      gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp).connect(gg); gg.connect(spaceSend); gg.connect(master);
      o.start(t); o.stop(t + dur + .02);
    };
    switch (kind) {
      case 'room':     at(1400, .05, .012); at(1400, .05, .009, 'sine', 0, .3); break;
      case 'radio':    noiseAt(t0, .02, 3000, 'highpass', .02); at(660, .3, .018, 'sine'); at(784, .4, .018, 'sine', 0, .18); break;
      case 'crackle':  noiseAt(t0, .01, 3500, 'highpass', .01); noiseAt(t0 + .12, .01, 3500, 'highpass', .008); noiseAt(t0 + .21, .01, 3500, 'highpass', .01); break;
      case 'night':    at(4200, .03, .007); at(4200, .03, .006, 'sine', 0, .14); at(233, .6, .012, 'sine', 220, .3); break;
      case 'club':     at(52, .25, .045); at(2400, .08, .012, 'sine', 0, .2); at(2800, .08, .009, 'sine', 0, .3); break;
      case 'church':   at(880, 1.8, .018, 'sine', 870); at(1320, 1.2, .009); at(49, 1.2, .018); break;
      case 'island':   at(M(72), .4, .018); at(M(76), .4, .018, 'sine', 0, .18); at(M(81), .6, .018, 'sine', 0, .36); at(1250, .3, .007, 'sine', 720, .6); break;
      case 'mansion':  at(2100, .25, .009); at(2600, .3, .007, 'sine', 0, .15); at(98, 1.2, .012, 'sine'); break;
      case 'precinct': at(120, .8, .012); at(440, .12, .009); at(480, .12, .009, 'sine', 0, .16); at(1800, .02, .007, 'sine', 0, .34); break;
      case 'boat':     at(70, .08, .035, 'sine', 60); at(70, .08, .035, 'sine', 60, .22); at(70, .08, .035, 'sine', 60, .44); break;
      case 'court':    at(190, .09, .024, 'sine', 150); at(190, .09, .018, 'sine', 150, .35); noiseAt(t0 + .6, .04, 4500, 'highpass', .007); break;
      case 'rain':     at(2600, .03, .007); at(3100, .03, .006, 'sine', 0, .1); at(2400, .03, .007, 'sine', 0, .22); at(60, 1.2, .012, 'sine', 45, .4); break;
      case 'south':    at(55, .3, .04); at(52, .35, .035, 'sine', 0, .25); at(900, .12, .012, 'sine', 500, .5); at(700, .1, .012, 'sine', 420, .66); break;
      case 'garden':   at(2400, .08, .009, 'sine', 3000); at(2800, .1, .008, 'sine', 3400, .18); at(190, .09, .018, 'sine', 150, .4); break;
      case 'industrial': at(300, .5, .018, 'sine', 900); at(120, .4, .024, 'sine', 0, .3); break;
      case 'harbor':   at(1250, .3, .009, 'sine', 720); at(70, .08, .03, 'sine', 60, .3); at(1100, .25, .007, 'sine', 650, .5); break;
    }
  }
  function setTranspose(semis) { TRANS = semis || 0; }

  /* closing credits: Mama's song, once more, over a warm chord */
  function credits() {
    try { ac(); } catch (e) { return; }
    const t = ctx.currentTime;
    const seq = [[659,0],[784,.32],[880,.64],[784,.96],[659,1.28],[587,1.6],[659,1.92],[1318,2.4]];
    seq.forEach(([f, w]) => {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      o2.type = 'sine'; o2.frequency.value = f * 4; g2.gain.value = .18;
      const et = t + w;
      g.gain.setValueAtTime(.0001, et);
      g.gain.linearRampToValueAtTime(.09, et + .02);
      g.gain.exponentialRampToValueAtTime(.0001, et + 1.6);
      o.connect(g); o2.connect(g2).connect(g);
      g.connect(musicGain); g.connect(spaceSend);
      o.start(et); o.stop(et + 1.7); o2.start(et); o2.stop(et + 1.7);
    });
    [48,55,60,64,71].forEach((n) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = M(n);
      g.gain.setValueAtTime(.0001, t + 2.2);
      g.gain.linearRampToValueAtTime(.04, t + 3.0);
      g.gain.linearRampToValueAtTime(.0001, t + 7);
      o.connect(g).connect(musicGain);
      o.start(t + 2.2); o.stop(t + 7.1);
    });
  }

  /* -------- heartbeat when hurt - softened -------- */
  let heartTimer = null;
  function setHeartbeat(on) {
    if (on && !heartTimer) {
      try { ac(); } catch (e) { return; }
      heartTimer = setInterval(() => {
        const t = ctx.currentTime;
        [0, .20].forEach(off => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
          o.type = 'sine';
          o.frequency.setValueAtTime(52, t + off);
          o.frequency.exponentialRampToValueAtTime(38, t + off + .14);
          g.gain.setValueAtTime(.07, t + off);
          g.gain.exponentialRampToValueAtTime(.0001, t + off + .18);
          o.connect(lp).connect(g).connect(master); o.start(t + off); o.stop(t + off + .20);
        });
      }, 1050);
    } else if (!on && heartTimer) {
      clearInterval(heartTimer); heartTimer = null;
    }
  }
  function duck(on) {
    if (!ctx || !duckG) return;
    duckG.gain.setTargetAtTime(on ? 0.32 : 1, ctx.currentTime, 0.15);
  }
  function setMuffle(on) {
    if (!ctx || !lpF) return;
    lpF.frequency.setTargetAtTime(on ? 450 : 6000, ctx.currentTime, 0.5);
  }
  function setIntensity(v) { INTEN = Math.max(0, Math.min(2, v | 0)); }
  function setMusicVol(v) {
    volM = Math.max(0, Math.min(1, v));
    localStorage.setItem('ccs-musvol', String(volM));
    if (ctx && musicGain) musicGain.gain.setTargetAtTime(0.08 * volM, ctx.currentTime, 0.25); // softened 0.11->0.08 professional
    // Also set OGA real music volume + BlindMusic
    try { if (typeof OGAudio !== 'undefined') OGAudio.setMusicVol(v * 0.5); } catch (e) {} // OGA even softer for blind clarity
    try { if (typeof BlindMusic !== 'undefined') BlindMusic.setVolume(v * 0.6); } catch (e) {}
  }
  function setAmbVol(v) {
    ambV = Math.max(0, Math.min(1, v));
    localStorage.setItem('ccs-ambvol', String(ambV));
    if (ctx && curAmb && ambGains[curAmb]) {
      ambGains[curAmb].gain.setTargetAtTime(0.020 * ambV, ctx.currentTime, 0.4); // softened 0.028->0.020
    }
    try { if (typeof OGAudio !== 'undefined') OGAudio.setSFXVol(v); } catch (e) {}
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    mood = null;
    if (ctx) ctx.suspend().catch(() => {});
    try { if (typeof OGAudio !== 'undefined') OGAudio.stopMusic(true); } catch (e) {}
    try { if (typeof OGAudio !== 'undefined') OGAudio.stopAmbient(); } catch (e) {}
    try { if (typeof BlindMusic !== 'undefined') BlindMusic.stop(); } catch (e) {}
  }
  
  // Professional blind game: stinger for events (Hades technique)
  function stinger(type) {
    try { if (typeof BlindMusic !== 'undefined') BlindMusic.playStinger(type); } catch (e) {}
  }
  
  // Professional: enhanced listening mode toggle (TLOU2 technique)
  function setEnhancedListening(on) {
    try { if (typeof BlindMusic !== 'undefined') BlindMusic.setEnhancedListening(on); } catch (e) {}
  }
  
  return { play, duck, stop, setAmb, setHeartbeat, setTranspose,
           setMuffle, setIntensity, setMusicVol, setAmbVol, credits, arrive,
           stinger, setEnhancedListening, unlockMobile };
})();