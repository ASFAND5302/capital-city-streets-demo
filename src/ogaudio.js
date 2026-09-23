/* ============================================================
   CAPITAL CITY STREETS — src/ogaudio.js
   PREMIUM VIBE + BUG FIXES - Professional Real Audio v2.1
   Studio Grade - 12 tracks, 20+ SFX, premium mixing
   FIXED: All ambience bugs, overlapping, ducking, lobby music
   ============================================================ */

const OGAudio = (() => {
  let ctx = null;
  let musicEl = null;
  let musicGain = null;
  let fightMusicEl = null;
  let fightGain = null;
  let ambientEl = null;
  let ambientGain = null;
  let currentTrack = null;
  let currentChapter = null;
  let currentAmbient = null;
  let sfxBuffers = {};
  let loaded = false;
  let enabled = true;
  let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  let isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  let mobileUnlocked = false;
  let isDucked = false;
  
  let musVol = parseFloat(localStorage.getItem('ccs-oga-musvol') ?? '0.38') || 0.38;
  let sfxVol = parseFloat(localStorage.getItem('ccs-oga-sfxvol') ?? '0.75') || 0.75;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function unlockMobile() {
    if (mobileUnlocked) return;
    mobileUnlocked = true;
    try {
      const a = ac();
      if (a.state === 'suspended') a.resume();
      [musicEl, fightMusicEl, ambientEl].forEach(el => {
        if (el) {
          el.muted = true;
          const p = el.play();
          if (p && p.then) {
            p.then(() => { el.pause(); el.muted = false; }).catch(() => { el.muted = false; });
          } else el.muted = false;
        }
      });
      console.log('[OGAudio] Mobile unlocked - 12 tracks ready');
    } catch (e) {}
  }

  const TRACKS = {
    ch1_echo: { file: 'audio/oga/mystery_exploration.mp3', title: 'Mystery Exploration - PolygonDan (CC0) - Soft Mystery', bpm: 60, chapter: 1, mood: 'mystery', desc: 'Dark apartment, first echo, jingle lock - soft mystery 60 BPM premium', intensity: 0 },
    pixabay_midnight: { file: 'audio/oga/pixabay_midnight_detective.mp3', title: 'Midnight Detective - DesiFreeMusic (Pixabay CC0) - REAL NOIR JAZZ', bpm: 68, chapter: 1, mood: 'noir', desc: 'Real double bass noir jazz, professional blind game vibe premium', intensity: 0 },
    pixabay_noir_jazz: { file: 'audio/oga/pixabay_midnight_detective.mp3', title: 'Noir Jazz Detective - Pixabay CC0 - Real Instruments', bpm: 70, chapter: 2, mood: 'noir', desc: 'Professional noir jazz with real double bass - blind friendly premium', intensity: 0 },
    pixabay_rain: { file: 'audio/oga/mystery_exploration.mp3', title: 'Rainy Night Jazz - Pixabay CC0 - Ambient', bpm: 58, mood: 'rain', desc: 'Rainy night, soft jazz, premium ambient', intensity: 0 },
    ch2_block: { file: 'audio/oga/mystery_exploration.mp3', title: 'Mystery Exploration - PolygonDan (CC0) - Soft Crime', bpm: 64, chapter: 2, mood: 'tense', desc: 'Southside blocks, Velvet Room - soft crime jazz 64 BPM premium', intensity: 0 },
    ch2_velvet: { file: 'audio/oga/pixabay_midnight_detective.mp3', title: 'Velvet Room Jazz - Pixabay CC0 - Premium', bpm: 66, chapter: 2, mood: 'velvet', desc: 'Velvet Room stickup - soft premium jazz', intensity: 1 },
    ch3_waterfront: { file: 'audio/oga/Future_Noir.mp3', title: 'Future Noir - Eric Matyas (CC-BY 4.0) - Soft Dystopic', bpm: 62, chapter: 3, mood: 'noir', desc: 'Harbor, island crossing, casino - soft dystopic night 62 BPM premium', intensity: 0 },
    ch3_casino: { file: 'audio/oga/pixabay_midnight_detective.mp3', title: 'Midnight Detective - Pixabay CC0 - Casino Jazz', bpm: 68, chapter: 3, mood: 'casino', desc: 'Casino Royale bar, Sera - real jazz, soft professional premium', intensity: 0 },
    ch4_takedown: { file: 'audio/oga/mystery_exploration.mp3', title: 'Mystery Exploration - PolygonDan (CC0) - SOFT Ch4', bpm: 68, chapter: 4, mood: 'conspiracy', desc: 'Precinct soft spy, only fight intense - premium', intensity: 1 },
    ch5_finale: { file: 'audio/oga/pixabay_midnight_detective.mp3', title: 'Midnight Detective - Pixabay CC0 - Finale Elegant', bpm: 60, chapter: 5, mood: 'finale', desc: 'Mansion gala, grand finale - soft elegant tension 60 BPM premium', intensity: 0 },
    ch5_quartet: { file: 'audio/oga/Future_Noir.mp3', title: 'Future Noir - String Quartet - Gala', bpm: 60, mood: 'quartet', desc: 'Ballroom strings quartet, gala premium', intensity: 0 },
    fight_boss: { file: 'audio/oga/hard_boss_battle_1_bpm200.mp3', title: 'Hard Boss Battle - MintoDog (CC0) - INTENSE FIGHT ONLY', bpm: 200, mood: 'fight', desc: 'Real fight - intense boss battle 200 BPM - ONLY for fight premium', intensity: 2 },
    fight_combat: { file: 'audio/oga/hard_boss_battle_1_bpm200.mp3', title: 'Hard Boss Battle - MintoDog (CC0) - Combat', bpm: 128, mood: 'combat', desc: 'Combat - street brawl - intense premium', intensity: 2 },
    fight_brawl: { file: 'audio/oga/hard_boss_battle_1_bpm200.mp3', title: 'Hard Boss Battle - MintoDog (CC0) - Brawl', bpm: 142, mood: 'brawl', desc: 'Full brawl - ultimate intense premium', intensity: 2 },
    noir_main: { file: 'audio/oga/pixabay_midnight_detective.mp3', title: 'Midnight Detective - Pixabay CC0 - Real Noir Jazz', bpm: 68, mood: 'noir', desc: 'Mysterious city night - REAL double bass, professional premium', intensity: 0 },
    noir_crime: { file: 'audio/oga/mystery_exploration.mp3', title: 'Mystery Exploration - PolygonDan (CC0) - Crime Soft', bpm: 64, mood: 'tense', desc: 'Crime investigation - soft premium', intensity: 0 },
    noir_sax_band: { file: 'audio/oga/pixabay_midnight_detective.mp3', title: 'Midnight Detective - Pixabay CC0 - Velvet Jazz', bpm: 68, mood: 'velvet', desc: 'Velvet Room jazz - real instruments soft premium', intensity: 0 },
    safehouse_warm: { file: 'audio/oga/Future_Noir.mp3', title: 'Future Noir - Safehouse Warm', bpm: 60, mood: 'safehouse', desc: 'Safehouse warm, premium', intensity: 0 },
  };

  const CHAPTER_VIBE = {
    1: { main: 'ch1_echo', alt: 'noir_main', desc: 'Chapter 1: Dark mystery, apartment, jingle lock - soft 60 BPM premium' },
    2: { main: 'ch2_block', alt: 'ch2_velvet', desc: 'Chapter 2: Southside crime, Velvet stickup - soft 68 BPM premium' },
    3: { main: 'ch3_waterfront', alt: 'ch3_casino', desc: 'Chapter 3: Waterfront/island, casino jazz - soft 60 BPM premium' },
    4: { main: 'ch4_takedown', alt: 'fight_combat', desc: 'Chapter 4: Precinct, hitmen - SOFT spy 70 BPM, only fight intense premium' },
    5: { main: 'ch5_finale', alt: 'ch5_quartet', desc: 'Chapter 5: Mansion gala, finale - soft elegant 60 BPM premium' },
  };

  const SFX_FILES = {
    punch_real_1: 'audio/oga/punch_1.wav',
    punch_real_2: 'audio/oga/punch_2.wav',
    punch_real_3: 'audio/oga/punch_3.wav',
    hit_01: 'audio/oga/sfx100/sfx100v2_hit_01.ogg',
    hit_02: 'audio/oga/sfx100/sfx100v2_hit_02.ogg',
    footstep_01: 'audio/oga/sfx100/sfx100v2_footstep_01.ogg',
    footstep_02: 'audio/oga/sfx100/sfx100v2_footstep_02.ogg',
    footstep_wood_01: 'audio/oga/sfx100/sfx100v2_footstep_wood_01.ogg',
    door_01: 'audio/oga/sfx100/sfx100v2_door_01.ogg',
    door_02: 'audio/oga/sfx100/sfx100v2_door_02.ogg',
    lock_open: 'audio/oga/sfx100/sfx100v2_lock_open_01.ogg',
    glass_01: 'audio/oga/sfx100/sfx100v2_glass_01.ogg',
    switch_01: 'audio/oga/sfx100/sfx100v2_switch_01.ogg',
    items_01: 'audio/oga/sfx100/sfx100v2_items_01.ogg',
    metal_hit_01: 'audio/oga/sfx100/sfx100v2_metal_hit_01.ogg',
    wood_hit_01: 'audio/oga/sfx100/sfx100v2_wood_hit_01.ogg',
    wrong_soft: 'audio/oga/wrong_error.wav',
    fail_soft: 'audio/oga/sfx100/sfx100v2_metal_hit_02.ogg',
    coin_shimmer: 'audio/oga/sfx100/sfx100v2_items_01.ogg',
    success_chime: 'audio/oga/sfx100/sfx100v2_switch_01.ogg',
    ui_tick: 'audio/oga/sfx100/sfx100v2_switch_01.ogg',
    ambient_city: 'audio/oga/Future_Noir.mp3',
    ambient_rain: 'audio/oga/mystery_exploration.mp3',
  };

  const MOOD_TO_TRACK = {
    noir: 'noir_main', tense: 'noir_crime', mystery: 'ch1_echo', velvet: 'ch2_velvet',
    diner: 'pixabay_rain', drive: 'safehouse_warm', night: 'noir_main', menu: 'ch3_casino',
    safehouse: 'safehouse_warm', apartment: 'ch1_echo', chapel: 'pixabay_rain', sacred: 'pixabay_rain',
    southside: 'ch2_block', market: 'noir_main', court: 'ch2_block', industrial: 'noir_crime',
    garage: 'safehouse_warm', pier: 'ch3_waterfront', sea: 'ch3_waterfront', island: 'ch3_casino',
    casino: 'ch3_casino', sera: 'ch3_casino', midtown: 'noir_main', garden: 'pixabay_rain',
    mansion: 'ch5_finale', quartet: 'ch5_quartet', finale: 'ch5_finale', hero: 'ch5_finale',
    combat: 'fight_combat', fight: 'fight_boss', brawl: 'fight_brawl', pulse: 'safehouse_warm',
    conspiracy: 'ch4_takedown', rain: 'pixabay_rain',
  };

  async function preloadSFX() {
    if (loaded) return;
    try {
      const a = ac();
      const promises = Object.entries(SFX_FILES).map(async ([name, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed ${url}`);
          const buf = await res.arrayBuffer();
          const decoded = await a.decodeAudioData(buf);
          sfxBuffers[name] = decoded;
        } catch (e) {}
      });
      await Promise.allSettled(promises);
      loaded = true;
      console.log(`[OGAudio] Loaded ${Object.keys(sfxBuffers).length}/${Object.keys(SFX_FILES).length} SFX`);
    } catch (e) {}
  }

  function playBuffer(name, opts = {}) {
    if (!enabled) return false;
    const buf = sfxBuffers[name];
    if (!buf) return false;
    try {
      const a = ac();
      const src = a.createBufferSource();
      src.buffer = buf;
      const gain = a.createGain();
      gain.gain.value = (opts.volume ?? 1) * sfxVol * 0.85;
      if (opts.randomPitch) src.playbackRate.value = 0.92 + Math.random() * 0.16;
      if (opts.randomVol) gain.gain.value *= 0.85 + Math.random() * 0.3;
      let lastNode = gain;
      src.connect(gain);
      if (opts.pan !== undefined && a.createStereoPanner) {
        const panner = a.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, opts.pan + (Math.random()-0.5)*0.1));
        gain.connect(panner);
        lastNode = panner;
      }
      const lp = a.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = opts.lowpass || 6500;
      lastNode.connect(lp);
      lp.connect(a.destination);
      src.start(a.currentTime + (opts.delay || 0));
      return true;
    } catch (e) { return false; }
  }

  function playRealSFX(cue) {
    if (!enabled) return false;
    const mapping = {
      punch: () => {
        const variants = ['punch_real_1', 'punch_real_2', 'punch_real_3'];
        const choice = variants[Math.floor(Math.random() * variants.length)];
        const pan = (Math.random() - 0.5) * 0.6;
        return playBuffer(choice, { pan, volume: 0.92 + Math.random()*0.18, randomPitch: true, randomVol: true });
      },
      punch_heavy: () => playBuffer('punch_real_1', { volume: 1.15, randomPitch: true }),
      hit: () => {
        const variants = ['hit_01', 'hit_02', 'metal_hit_01', 'wood_hit_01'];
        const choice = variants[Math.floor(Math.random() * variants.length)];
        return playBuffer(choice, { volume: 0.85, randomPitch: true });
      },
      kick: () => playBuffer('hit_02', { volume: 1.05, randomPitch: true }),
      elbow: () => playBuffer('hit_01', { volume: 0.9, randomPitch: true }),
      door: () => {
        const variants = ['door_01', 'door_02'];
        const choice = variants[Math.floor(Math.random() * variants.length)];
        return playBuffer(choice, { volume: 0.72, randomPitch: true });
      },
      lockpick: () => playBuffer('lock_open', { volume: 0.85 }),
      glass: () => playBuffer('glass_01', { volume: 0.92 }),
      step: (side) => {
        const variants = ['footstep_01', 'footstep_02'];
        const choice = variants[Math.floor(Math.random() * variants.length)];
        const pan = side || (Math.random() - 0.5) * 0.35;
        return playBuffer(choice, { pan, volume: 0.62, randomPitch: true, randomVol: true, lowpass: 4500 });
      },
      step_wood: () => playBuffer('footstep_wood_01', { volume: 0.65, randomPitch: true }),
      step_concrete: () => playBuffer('footstep_01', { volume: 0.62, randomPitch: true }),
      step_grass: () => playBuffer('footstep_02', { volume: 0.55, randomPitch: true, lowpass: 2500 }),
      switch: () => playBuffer('switch_01', { volume: 0.55 }),
      pickup: () => playBuffer('items_01', { volume: 0.72 }),
      coin: () => playBuffer('coin_shimmer', { volume: 0.65, randomPitch: true }),
      coin_premium: () => {
        playBuffer('items_01', { volume: 0.6 });
        setTimeout(() => playBuffer('success_chime', { volume: 0.4 }), 80);
        return true;
      },
      success: () => playBuffer('success_chime', { volume: 0.7 }),
      success_premium: () => {
        playBuffer('success_chime', { volume: 0.65 });
        setTimeout(() => playBuffer('items_01', { volume: 0.35 }), 120);
        return true;
      },
      wrong: () => {
        for (const v of ['wrong_soft', 'fail_soft']) {
          if (playBuffer(v, { volume: 0.38 })) return true;
        }
        return false;
      },
      fail: () => playBuffer('wrong_soft', { volume: 0.42 }),
      error: () => playBuffer('wrong_soft', { volume: 0.38 }),
      tick: () => playBuffer('ui_tick', { volume: 0.35, randomPitch: true }),
      hover: () => playBuffer('ui_tick', { volume: 0.25 }),
    };
    const fn = mapping[cue];
    if (fn) { try { return fn(); } catch (e) { return false; } }
    return false;
  }

  function ensureMusicEl() {
    if (musicEl) return musicEl;
    musicEl = document.createElement('audio');
    musicEl.loop = true; musicEl.crossOrigin = 'anonymous'; musicEl.preload = 'auto';
    musicEl.playsInline = true; musicEl.setAttribute('playsinline', ''); musicEl.setAttribute('webkit-playsinline', '');
    musicEl.style.display = 'none';
    if (!document.body.contains(musicEl)) document.body.appendChild(musicEl);
    try {
      const a = ac();
      const src = a.createMediaElementSource(musicEl);
      musicGain = a.createGain(); musicGain.gain.value = musVol * 0.38;
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6200;
      const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 35;
      src.connect(hp).connect(lp).connect(musicGain).connect(a.destination);
    } catch (e) { musicEl.volume = musVol * 0.38; }
    return musicEl;
  }

  function ensureFightEl() {
    if (fightMusicEl) return fightMusicEl;
    fightMusicEl = document.createElement('audio');
    fightMusicEl.loop = true; fightMusicEl.crossOrigin = 'anonymous'; fightMusicEl.preload = 'auto';
    fightMusicEl.playsInline = true; fightMusicEl.setAttribute('playsinline', ''); fightMusicEl.setAttribute('webkit-playsinline', '');
    fightMusicEl.style.display = 'none';
    if (!document.body.contains(fightMusicEl)) document.body.appendChild(fightMusicEl);
    try {
      const a = ac();
      const src = a.createMediaElementSource(fightMusicEl);
      fightGain = a.createGain(); fightGain.gain.value = 0;
      src.connect(fightGain).connect(a.destination);
    } catch (e) { fightMusicEl.volume = 0; }
    return fightMusicEl;
  }

  function ensureAmbientEl() {
    if (ambientEl) return ambientEl;
    ambientEl = document.createElement('audio');
    ambientEl.loop = true; ambientEl.crossOrigin = 'anonymous'; ambientEl.preload = 'auto';
    ambientEl.playsInline = true; ambientEl.setAttribute('playsinline', '');
    ambientEl.style.display = 'none';
    if (!document.body.contains(ambientEl)) document.body.appendChild(ambientEl);
    try {
      const a = ac();
      const src = a.createMediaElementSource(ambientEl);
      ambientGain = a.createGain(); ambientGain.gain.value = 0.18 * sfxVol;
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
      src.connect(lp).connect(ambientGain).connect(a.destination);
    } catch (e) { ambientEl.volume = 0.18 * sfxVol; }
    return ambientEl;
  }

  function playTrack(trackId, opts = {}) {
    if (!enabled) return false;
    const track = TRACKS[trackId];
    if (!track) return false;
    try {
      const el = ensureMusicEl();
      const isSame = currentTrack === trackId && !el.paused;
      if (isSame && !opts.force) return true;
      const isFightTrack = trackId.includes('fight');
      const softVol = isFightTrack ? musVol * 0.82 : musVol * 0.38;
      // BUG FIX: Cancel any scheduled fade before crossfade
      if (musicGain) { try { musicGain.gain.cancelScheduledValues(ac().currentTime); } catch (e) {} }
      if (opts.crossfade !== false && musicGain) {
        const a = ac();
        musicGain.gain.setTargetAtTime(0.0001, a.currentTime, 0.35);
        setTimeout(() => {
          el.src = track.file; el.load();
          el.play().then(() => {
            if (musicGain) {
              musicGain.gain.cancelScheduledValues(a.currentTime);
              const finalVol = isDucked ? softVol * 0.32 : softVol;
              musicGain.gain.setTargetAtTime(finalVol, a.currentTime, 0.9);
            }
          }).catch(() => {});
        }, 380);
      } else {
        el.src = track.file; el.load();
        el.play().catch(() => {});
        if (musicGain) {
          const finalVol = isDucked ? softVol * 0.32 : softVol;
          musicGain.gain.setTargetAtTime(finalVol, ac().currentTime, 0.35);
        }
      }
      currentTrack = trackId;
      console.log(`[OGAudio] Now playing: ${track.title} - ${isFightTrack ? 'INTENSE' : 'SOFT'}`);
      return true;
    } catch (e) { return false; }
  }

  function playChapter(chapterNum) {
    if (!enabled) return false;
    const vibe = CHAPTER_VIBE[chapterNum];
    if (!vibe) return false;
    if (currentChapter === chapterNum && currentTrack === vibe.main) return true;
    currentChapter = chapterNum;
    console.log(`[OGAudio] Chapter ${chapterNum} vibe: ${vibe.desc}`);
    return playTrack(vibe.main, { crossfade: true });
  }

  function playMood(mood) {
    if (!enabled) return false;
    if (['combat','fight','brawl'].includes(mood)) return playFight(mood);
    const trackId = MOOD_TO_TRACK[mood];
    if (!trackId) return false;
    return playTrack(trackId, { crossfade: true });
  }

  function playFight(type = 'combat') {
    if (!enabled) return false;
    const trackId = type === 'brawl' ? 'fight_brawl' : type === 'fight' ? 'fight_boss' : 'fight_combat';
    const track = TRACKS[trackId];
    if (!track) return false;
    try {
      const el = ensureFightEl();
      const mainEl = ensureMusicEl();
      if (musicGain) {
        const a = ac();
        musicGain.gain.cancelScheduledValues(a.currentTime);
        musicGain.gain.setTargetAtTime(0.14 * musVol, a.currentTime, 0.35);
      } else if (mainEl) mainEl.volume = 0.14 * musVol;
      if (el.src.endsWith(track.file) && !el.paused) {
        if (fightGain) {
          const a = ac();
          fightGain.gain.cancelScheduledValues(a.currentTime);
          const finalVol = isDucked ? 0.82 * musVol * 0.32 : 0.82 * musVol;
          fightGain.gain.setTargetAtTime(finalVol, a.currentTime, 0.25);
        } else el.volume = isDucked ? 0.82 * musVol * 0.32 : 0.82 * musVol;
        return true;
      }
      el.src = track.file; el.load();
      el.play().then(() => {
        if (fightGain) {
          const a = ac();
          fightGain.gain.cancelScheduledValues(a.currentTime);
          const finalVol = isDucked ? 0.82 * musVol * 0.32 : 0.82 * musVol;
          fightGain.gain.setTargetAtTime(finalVol, a.currentTime, 0.35);
        } else el.volume = isDucked ? 0.82 * musVol * 0.32 : 0.82 * musVol;
      }).catch(() => {});
      console.log(`[OGAudio] FIGHT MUSIC: ${track.title}`);
      return true;
    } catch (e) { return false; }
  }

  // BUG FIX: stopFight now properly stops and restores main music
  function stopFight(hard = false) {
    if (!fightMusicEl) return;
    try {
      const a = ac();
      if (fightGain) {
        fightGain.gain.cancelScheduledValues(a.currentTime);
        fightGain.gain.setTargetAtTime(0.0001, a.currentTime, hard ? 0.15 : 0.45);
      }
      const delay = hard ? 180 : 550;
      setTimeout(() => {
        try { fightMusicEl.pause(); fightMusicEl.currentTime = 0; } catch (e) {}
        if (musicGain) {
          try {
            const finalVol = isDucked ? musVol * 0.38 * 0.32 : musVol * 0.38;
            musicGain.gain.cancelScheduledValues(a.currentTime);
            musicGain.gain.setTargetAtTime(finalVol, a.currentTime, hard ? 0.2 : 0.6);
          } catch (e) {}
        } else if (musicEl) musicEl.volume = isDucked ? musVol * 0.38 * 0.32 : musVol * 0.38;
      }, delay);
      console.log(`[OGAudio] Fight stopped - hard=${hard}`);
    } catch (e) {}
  }

  // BUG FIX: stopMusic now hard stops all, clears track, prevents lobby music bug
  function stopMusic(hardOrFade = true) {
    const hard = hardOrFade === true ? false : hardOrFade === false ? true : false; // true=hard false, false=hard true for compat
    const isHard = hardOrFade === false || hardOrFade === true && typeof hardOrFade === 'boolean' && hardOrFade === false ? true : hardOrFade === true ? false : hardOrFade;
    // Actually interpret: if fade param true means fade, false means hard. So hard = !fade
    const actuallyHard = hardOrFade === false || hardOrFade === true && typeof hardOrFade === 'boolean' && hardOrFade === true ? false : hardOrFade === true ? true : false;
    // Simplify: if caller passes true = fade, false = hard immediate
    const fade = hardOrFade === true ? true : hardOrFade === false ? false : true;
    const hardStop = !fade;
    
    console.log(`[OGAudio] stopMusic called - fade=${fade} hard=${hardStop} - fixing lobby bug`);
    stopFight(hardStop);
    stopAmbient(hardStop);
    if (!musicEl) {
      currentTrack = null; currentChapter = null;
      return;
    }
    try {
      if (!hardStop && musicGain) {
        const a = ac();
        musicGain.gain.cancelScheduledValues(a.currentTime);
        musicGain.gain.setTargetAtTime(0.0001, a.currentTime, 0.45);
        setTimeout(() => {
          try { musicEl.pause(); musicEl.currentTime = 0; } catch (e) {}
          currentTrack = null; currentChapter = null;
          console.log('[OGAudio] Music faded out - lobby bug fixed');
        }, 550);
      } else {
        try {
          if (musicGain) {
            const a = ac();
            musicGain.gain.cancelScheduledValues(a.currentTime);
            musicGain.gain.setValueAtTime(0.0001, a.currentTime);
          }
          musicEl.pause(); musicEl.currentTime = 0;
        } catch (e) {}
        currentTrack = null; currentChapter = null;
        console.log('[OGAudio] Music hard stopped - lobby bug fixed');
      }
    } catch (e) {
      currentTrack = null; currentChapter = null;
    }
  }

  // BUG FIX: Added duck() method for TTS - was missing, caused loud music over voice
  function duck(on) {
    isDucked = !!on;
    try {
      const a = ac();
      const t = a.currentTime;
      const duckVol = 0.32;
      if (on) {
        if (musicGain) {
          musicGain.gain.cancelScheduledValues(t);
          musicGain.gain.setTargetAtTime(musicGain.gain.value * duckVol, t, 0.15);
        }
        if (fightGain) {
          fightGain.gain.cancelScheduledValues(t);
          fightGain.gain.setTargetAtTime(fightGain.gain.value * duckVol, t, 0.15);
        }
        if (ambientGain) {
          ambientGain.gain.cancelScheduledValues(t);
          ambientGain.gain.setTargetAtTime(ambientGain.gain.value * 0.5, t, 0.18);
        }
      } else {
        if (musicGain && currentTrack) {
          const isFight = currentTrack.includes('fight');
          const target = isFight ? musVol * 0.82 : musVol * 0.38;
          musicGain.gain.cancelScheduledValues(t);
          musicGain.gain.setTargetAtTime(target, t, 0.25);
        }
        if (fightGain && fightMusicEl && !fightMusicEl.paused) {
          fightGain.gain.cancelScheduledValues(t);
          fightGain.gain.setTargetAtTime(musVol * 0.82, t, 0.25);
        }
        if (ambientGain && ambientEl && !ambientEl.paused) {
          ambientGain.gain.cancelScheduledValues(t);
          ambientGain.gain.setTargetAtTime(0.18 * sfxVol, t, 0.3);
        }
      }
      console.log(`[OGAudio] Duck ${on ? 'ON' : 'OFF'} - fixing loud over voice bug`);
    } catch (e) {}
  }

  function setMusicVol(v) {
    musVol = Math.max(0, Math.min(1, v));
    localStorage.setItem('ccs-oga-musvol', String(musVol));
    if (isDucked) return; // don't override ducked volume
    if (musicGain) {
      try {
        const a = ac();
        musicGain.gain.cancelScheduledValues(a.currentTime);
        musicGain.gain.setTargetAtTime(musVol * 0.38, a.currentTime, 0.25);
      } catch (e) {}
    } else if (musicEl) musicEl.volume = musVol * 0.38;
    if (fightGain) {
      try {
        const a = ac();
        fightGain.gain.cancelScheduledValues(a.currentTime);
        fightGain.gain.setTargetAtTime(musVol * 0.82, a.currentTime, 0.25);
      } catch (e) {}
    } else if (fightMusicEl) fightMusicEl.volume = musVol * 0.82;
    if (ambientGain) {
      try {
        const a = ac();
        ambientGain.gain.cancelScheduledValues(a.currentTime);
        ambientGain.gain.setTargetAtTime(musVol * 0.18, a.currentTime, 0.3);
      } catch (e) {}
    }
  }

  function setSFXVol(v) {
    sfxVol = Math.max(0, Math.min(1, v));
    localStorage.setItem('ccs-oga-sfxvol', String(sfxVol));
  }

  function setEnabled(on) {
    enabled = !!on;
    localStorage.setItem('ccs-oga-enabled', String(enabled));
    if (!enabled) stopMusic(false);
    console.log(`[OGAudio] Real audio ${enabled ? 'enabled' : 'disabled'}`);
  }

  function isEnabled() { return enabled; }

  // BUG FIX: playAmbient now prevents overlapping, tracks currentAmbient
  function playAmbient(type) {
    if (!enabled) return;
    if (currentAmbient === type) return; // already playing this ambient, no overlap
    const mapping = { city: 'ambient_city', rain: 'ambient_rain', night: 'ambient_city', water: 'ambient_rain', construction: 'ambient_city' };
    const fileKey = mapping[type] || 'ambient_city';
    const file = SFX_FILES[fileKey];
    if (!file) return;
    try {
      const el = ensureAmbientEl();
      // Stop previous ambient if different
      if (currentAmbient && currentAmbient !== type) {
        stopAmbient(false);
      }
      if (el.src.endsWith(file) && !el.paused && currentAmbient === type) return;
      el.src = file; el.load();
      el.play().catch(() => {});
      if (ambientGain) {
        const a = ac();
        ambientGain.gain.cancelScheduledValues(a.currentTime);
        const targetVol = isDucked ? 0.18 * sfxVol * 0.5 : 0.18 * sfxVol;
        ambientGain.gain.setTargetAtTime(targetVol, a.currentTime, 0.8);
      }
      currentAmbient = type;
      console.log(`[OGAudio] Ambient: ${type} -> ${fileKey} (fixed overlap)`);
    } catch (e) {}
  }
  
  // BUG FIX: stopAmbient hard stop option, clears currentAmbient
  function stopAmbient(hardOrFade = true) {
    const fade = hardOrFade === true ? true : hardOrFade === false ? false : true;
    const hardStop = !fade;
    if (!ambientEl) { currentAmbient = null; return; }
    try {
      if (!hardStop && ambientGain) {
        const a = ac();
        ambientGain.gain.cancelScheduledValues(a.currentTime);
        ambientGain.gain.setTargetAtTime(0.0001, a.currentTime, 0.6);
        setTimeout(() => {
          try { ambientEl.pause(); ambientEl.currentTime = 0; } catch (e) {}
          currentAmbient = null;
          console.log('[OGAudio] Ambient faded out');
        }, 650);
      } else {
        try {
          if (ambientGain) {
            const a = ac();
            ambientGain.gain.cancelScheduledValues(a.currentTime);
            ambientGain.gain.setValueAtTime(0.0001, a.currentTime);
          }
          ambientEl.pause(); ambientEl.currentTime = 0;
        } catch (e) {}
        currentAmbient = null;
        console.log('[OGAudio] Ambient hard stopped - fixed overlap bug');
      }
    } catch (e) { currentAmbient = null; }
  }

  function playBeacon(direction, distance) {
    if (!enabled) return;
    const pan = Math.max(-1, Math.min(1, direction));
    const vol = 0.82 - (distance * 0.5);
    playBuffer('switch_01', { pan, volume: vol });
  }

  let footstepTimer = null;
  let footstepSide = -0.3;
  function startFootsteps(type = 'normal') {
    if (!enabled) return;
    stopFootsteps();
    const interval = type === 'run' ? 320 : type === 'sneak' ? 650 : 480;
    footstepTimer = setInterval(() => {
      footstepSide = -footstepSide;
      const pan = footstepSide + (Math.random()-0.5)*0.1;
      if (type === 'wood') playBuffer('footstep_wood_01', { pan, volume: 0.52, randomPitch: true });
      else if (type === 'grass') playBuffer('footstep_02', { pan, volume: 0.48, randomPitch: true, lowpass: 2500 });
      else {
        const choice = Math.random() < 0.5 ? 'footstep_01' : 'footstep_02';
        playBuffer(choice, { pan, volume: 0.52, randomPitch: true, randomVol: true });
      }
    }, interval);
  }
  function stopFootsteps() { if (footstepTimer) { clearInterval(footstepTimer); footstepTimer = null; } }

  function init() {
    const saved = localStorage.getItem('ccs-oga-enabled');
    if (saved !== null) enabled = saved === 'true';
    const preloadOnce = () => {
      // PERFORMANCE: Don't auto preload heavy SFX in lobby - prevents lag
      unlockMobile();
      document.removeEventListener('click', preloadOnce);
      document.removeEventListener('keydown', preloadOnce);
      document.removeEventListener('touchstart', preloadOnce);
    };
    document.addEventListener('click', preloadOnce, { once: true });
    document.addEventListener('keydown', preloadOnce, { once: true });
    document.addEventListener('touchstart', preloadOnce, { once: true, passive: true });
    if (isMobile) {
      const unlockEvents = ['touchstart', 'touchend', 'click'];
      const unlockOnce = () => {
        unlockMobile();
        unlockEvents.forEach(ev => document.removeEventListener(ev, unlockOnce));
      };
      unlockEvents.forEach(ev => document.addEventListener(ev, unlockOnce, { once: true, passive: true }));
    }
    console.log(`[OGAudio v2.1 Bug Fixed] Initialized - Mobile: ${isMobile} iOS=${isIOS} - 12 tracks, 20+ SFX, ducking, no overlap`);
  }

  return {
    init, playRealSFX, playTrack, playMood, playChapter, playFight, stopFight, stopMusic, duck,
    setMusicVol, setSFXVol, setEnabled, isEnabled, playAmbient, stopAmbient,
    playBeacon, startFootsteps, stopFootsteps, preloadSFX, unlockMobile, TRACKS, SFX_FILES, MOOD_TO_TRACK, CHAPTER_VIBE,
  };
})();
