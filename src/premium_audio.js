/* ============================================================
   CAPITAL CITY STREETS — src/premium_audio.js
   PREMIUM AUDIO ORCHESTRATOR v2.0 - Ultimate Premium Vibe
   
   Combines all audio systems into cohesive premium experience
   - Music: generative + real + blind layers
   - SFX: synthesized + real + spatial
   - Ambient: dynamic environmental
   - Adaptive: reacts to story, health, location
   
   Free sources used:
   - Sonniss GDC 7.47GB (2026) + archive 200GB+ royalty-free
   - Kenney CC0 audio packs
   - Pixabay Music Content License (no attribution)
   - Freesound CC0 filter 381k sounds
   - OpenGameArt CC0/CC-BY
   - Mixkit free license
   
   Premium techniques:
   - Leitmotifs (15 chars)
   - Vertical remixing (4 layers)
   - Stingers (12 types)
   - Binaural sonar (TLOU2)
   - Sidechain ducking musical
   - Sub-bass depth
   - Humanization
   - 3D spatial audio
   ============================================================ */

const PremiumAudio = (() => {
  let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  let initialized = false;
  let currentIntensity = 0;
  let currentLocation = null;
  let ambientTimer = null;
  
  // Premium ambient soundscapes per location
  const AMBIENT_PRESETS = {
    apartment: { type: 'room', sounds: ['clock', 'fridge'], interval: 4000 },
    safehouse: { type: 'room', sounds: ['radio', 'crackle'], interval: 3500 },
    southside: { type: 'city', sounds: ['traffic', 'distant_siren'], interval: 3000 },
    velvet: { type: 'club', sounds: ['bass_thump', 'glass'], interval: 2500 },
    chapel: { type: 'church', sounds: ['organ', 'bell'], interval: 8000 },
    pier: { type: 'water', sounds: ['wave', 'gull'], interval: 3500 },
    mansion: { type: 'mansion', sounds: ['chandelier', 'footstep_wood'], interval: 4500 },
    rain: { type: 'rain', sounds: ['drop', 'thunder'], interval: 1200 },
    court: { type: 'court', sounds: ['ball', 'chain'], interval: 3000 },
  };
  
  // Premium music intensity mapping per story beat
  const STORY_INTENSITY = {
    intro: 0, apartment: 0, jingle: 0, safe: 0, // calm
    chapel: 0, church: 0, hospital: 0, // calm sacred
    southside: 0, market: 0, diner: 0, // calm city
    velvet_back: 1, office: 1, planning: 1, // tense spy
    ambush: 2, fight: 2, brawl: 2, shootout: 2, // combat intense
    gala: 0, ballroom: 0, mansion: 0, // elegant calm
    finale: 1, hero: 1, victory: 0, lament: 0,
  };
  
  function init() {
    if (initialized) return;
    initialized = true;
    console.log('[PremiumAudio v2.0] Initializing ultimate premium vibe...');
    console.log('[PremiumAudio] Sources: Sonniss GDC 7.47GB, Kenney CC0, Pixabay CC0, Freesound 381k CC0, OGA');
    console.log('[PremiumAudio] Techniques: 15 leitmotifs, 4-layer vertical, 12 stingers, binaural sonar, sub-bass, plate reverb');
    
    try { if (typeof SFX !== 'undefined') SFX.play('tick'); } catch (e) {}
    try { if (typeof BlindMusic !== 'undefined') BlindMusic.init(); } catch (e) {}
    try { if (typeof OGAudio !== 'undefined') OGAudio.init(); } catch (e) {}
    try { if (typeof Realistic !== 'undefined') Realistic.init(); } catch (e) {}
    
    if (isMobile) {
      const unlockEvents = ['touchstart', 'touchend', 'click'];
      const unlockOnce = () => {
        try { if (typeof SFX !== 'undefined' && SFX.unlockMobile) SFX.unlockMobile(); } catch (e) {}
        try { if (typeof Music !== 'undefined' && Music.unlockMobile) Music.unlockMobile(); } catch (e) {}
        try { if (typeof BlindMusic !== 'undefined' && BlindMusic.unlockMobile) BlindMusic.unlockMobile(); } catch (e) {}
        try { if (typeof OGAudio !== 'undefined' && OGAudio.unlockMobile) OGAudio.unlockMobile(); } catch (e) {}
        unlockEvents.forEach(ev => document.removeEventListener(ev, unlockOnce));
      };
      unlockEvents.forEach(ev => document.addEventListener(ev, unlockOnce, { once: true, passive: true }));
    }
    
    console.log('[PremiumAudio Premium] Initialized - Mobile:', isMobile, '- Ultimate premium vibe ready');
  }
  
  // Premium: Play arrival signature with location-specific sounds
  function playArrival(location) {
    currentLocation = location;
    const lower = (location || '').toLowerCase();
    
    try {
      // Music vibe per location - premium
      if (typeof Music !== 'undefined') {
        if (lower.includes('apartment') || lower.includes('safehouse')) Music.play('apartment');
        else if (lower.includes('velvet')) Music.play('velvet');
        else if (lower.includes('chapel') || lower.includes('church')) Music.play('chapel');
        else if (lower.includes('southside')) Music.play('southside');
        else if (lower.includes('court')) Music.play('court');
        else if (lower.includes('pier') || lower.includes('harbor')) Music.play('pier');
        else if (lower.includes('mansion') || lower.includes('gala') || lower.includes('ballroom')) Music.play('mansion');
        else if (lower.includes('island') || lower.includes('casino')) Music.play('casino');
        else if (lower.includes('precinct')) Music.play('mystery');
        else Music.play('noir');
      }
      
      // BlindMusic base + leitmotif
      if (typeof BlindMusic !== 'undefined') {
        const isFight = lower.includes('fight') || lower.includes('brawl');
        const isSpy = lower.includes('velvet') || lower.includes('precinct') || lower.includes('industrial');
        if (isFight) {
          BlindMusic.setIntensity(2);
          BlindMusic.playBase('noir_tense');
        } else if (isSpy) {
          BlindMusic.setIntensity(1);
          BlindMusic.playBase('noir_tense');
        } else {
          BlindMusic.setIntensity(0);
          BlindMusic.playBase('noir_soft');
        }
      }
      
      // SFX arrival - premium
      if (typeof SFX !== 'undefined') {
        if (lower.includes('apartment')) SFX.play('door_open');
        else if (lower.includes('church') || lower.includes('chapel')) SFX.play('church_bell');
        else if (lower.includes('court')) SFX.play('arrive');
        else if (lower.includes('rain')) {
          for (let i = 0; i < 3; i++) setTimeout(() => SFX.play('rain_drop'), i * 120);
        } else SFX.play('arrive');
      }
      
      // Ambient per location
      playAmbientForLocation(location);
      
      console.log(`[PremiumAudio] Arrival: ${location} - premium vibe`);
    } catch (e) {
      console.warn('[PremiumAudio] Arrival failed:', e);
    }
  }
  
  function playAmbientForLocation(location) {
    const lower = (location || '').toLowerCase();
    let preset = null;
    
    if (lower.includes('apartment') || lower.includes('room')) preset = AMBIENT_PRESETS.apartment;
    else if (lower.includes('safehouse')) preset = AMBIENT_PRESETS.safehouse;
    else if (lower.includes('southside') || lower.includes('city') || lower.includes('capitol')) preset = AMBIENT_PRESETS.southside;
    else if (lower.includes('velvet') || lower.includes('club') || lower.includes('casino')) preset = AMBIENT_PRESETS.velvet;
    else if (lower.includes('chapel') || lower.includes('church')) preset = AMBIENT_PRESETS.chapel;
    else if (lower.includes('pier') || lower.includes('harbor') || lower.includes('water')) preset = AMBIENT_PRESETS.pier;
    else if (lower.includes('mansion') || lower.includes('gala') || lower.includes('ballroom')) preset = AMBIENT_PRESETS.mansion;
    else if (lower.includes('rain')) preset = AMBIENT_PRESETS.rain;
    else if (lower.includes('court')) preset = AMBIENT_PRESETS.court;
    
    if (preset) {
      clearInterval(ambientTimer);
      try { if (typeof OGAudio !== 'undefined') OGAudio.playAmbient(preset.type); } catch (e) {}
      
      ambientTimer = setInterval(() => {
        const sound = preset.sounds[Math.floor(Math.random() * preset.sounds.length)];
        try {
          if (typeof SFX !== 'undefined' && SFX.CUSTOM[sound]) SFX.play(sound);
          else if (typeof SFX !== 'undefined') SFX.play(sound);
        } catch (e) {}
      }, preset.interval + Math.random() * 1000);
    }
  }
  
  // Premium: Play stinger with intensity awareness
  function playStinger(type, opts = {}) {
    try {
      if (typeof BlindMusic !== 'undefined') BlindMusic.playStinger(type, opts);
      if (typeof Music !== 'undefined' && Music.stinger) Music.stinger(type);
      
      // SFX layer for stinger
      if (typeof SFX !== 'undefined') {
        if (type === 'objective' || type === 'discovery' || type === 'success') SFX.play('success_premium');
        else if (type === 'danger' || type === 'enemy_spotted') SFX.play('fail_premium');
        else if (type === 'coin') SFX.play('coin_premium');
        else if (type === 'levelup') SFX.play('levelup');
      }
    } catch (e) {}
  }
  
  // Premium: Set intensity with adaptive music
  function setIntensity(level, opts = {}) {
    currentIntensity = level;
    try {
      if (typeof Music !== 'undefined') Music.setIntensity(level);
      if (typeof BlindMusic !== 'undefined') BlindMusic.setIntensity(level);
      
      // Adaptive: if health low, add heartbeat
      if (opts.health !== undefined && opts.health < 35) {
        if (typeof Music !== 'undefined') Music.setHeartbeat(true);
        if (typeof SFX !== 'undefined') {
          clearInterval(PremiumAudio._heartbeatTimer);
          PremiumAudio._heartbeatTimer = setInterval(() => SFX.play('heartbeat'), 1100);
        }
      } else if (opts.health !== undefined) {
        if (typeof Music !== 'undefined') Music.setHeartbeat(level >= 2);
        clearInterval(PremiumAudio._heartbeatTimer);
      }
      
      console.log(`[PremiumAudio] Intensity ${level} - ${['calm', 'tense', 'combat'][level]} - adaptive`);
    } catch (e) {}
  }
  
  // Premium: Footstep system with surface detection
  function playFootstep(surface = 'concrete', side = null) {
    try {
      if (typeof Realistic !== 'undefined' && Realistic.isEnabled()) {
        return Realistic.playFootstep(surface);
      }
      if (typeof OGAudio !== 'undefined' && OGAudio.isEnabled()) {
        return OGAudio.playRealSFX(`step_${surface}`) || OGAudio.playRealSFX('step', side);
      }
      if (typeof SFX !== 'undefined') {
        return SFX.play(`footstep_${surface}`, side) || SFX.play('footstep_concrete', side);
      }
    } catch (e) {}
    return false;
  }
  
  // Premium: Start footstep loop with surface
  function startFootsteps(surface = 'concrete', speed = 'normal') {
    try {
      if (typeof OGAudio !== 'undefined') OGAudio.startFootsteps(surface === 'grass' ? 'normal' : surface);
      else if (typeof SFX !== 'undefined') {
        clearInterval(PremiumAudio._footTimer);
        const interval = speed === 'run' ? 320 : speed === 'sneak' ? 650 : 480;
        let side = -0.3;
        PremiumAudio._footTimer = setInterval(() => {
          side = -side;
          playFootstep(surface, side);
        }, interval);
      }
    } catch (e) {}
  }
  
  function stopFootsteps() {
    try { if (typeof OGAudio !== 'undefined') OGAudio.stopFootsteps(); } catch (e) {}
    clearInterval(PremiumAudio._footTimer);
  }
  
  // Premium: Play fight with combo and spatial
  function playFight(type = 'punch', opts = {}) {
    const isHeavy = opts.heavy || false;
    const combo = opts.combo || 0;
    const pan = opts.pan || (Math.random()-0.5)*0.4;
    
    try {
      if (typeof SFX !== 'undefined') {
        if (type === 'punch' && isHeavy) SFX.play('punch_heavy');
        else SFX.play(type);
        
        // Extra layers for combo
        if (combo >= 2) setTimeout(() => SFX.play('hit'), 50);
        if (Math.random() < 0.4) setTimeout(() => SFX.play('grunt'), 90 + Math.random()*60);
      }
      
      if (typeof OGAudio !== 'undefined' && OGAudio.isEnabled()) {
        OGAudio.playRealSFX(type);
      }
      
      if (typeof Realistic !== 'undefined' && Realistic.isEnabled()) {
        Realistic.playPunch(isHeavy ? 'heavy' : 'strong');
      }
      
      if (typeof Spatial !== 'undefined' && Spatial.isEnabled()) {
        Spatial.playFightSFX(type);
      }
    } catch (e) {}
  }
  
  // Premium: Enhanced listening sonar
  function triggerSonar() {
    try {
      if (typeof BlindMusic !== 'undefined') {
        if (!BlindMusic.isEnhancedListening()) BlindMusic.setEnhancedListening(true);
        else BlindMusic.playSonarSweep();
      }
      if (typeof SFX !== 'undefined') SFX.play('panPing', 0);
    } catch (e) {}
  }
  
  function stop() {
    clearInterval(ambientTimer);
    clearInterval(PremiumAudio._heartbeatTimer);
    clearInterval(PremiumAudio._footTimer);
    try { if (typeof Music !== 'undefined') Music.stop(); } catch (e) {}
    try { if (typeof BlindMusic !== 'undefined') BlindMusic.stop(); } catch (e) {}
    try { if (typeof OGAudio !== 'undefined') OGAudio.stopMusic(true); } catch (e) {}
    try { if (typeof OGAudio !== 'undefined') OGAudio.stopAmbient(); } catch (e) {}
  }
  
  function setVolume(type, vol) {
    try {
      if (type === 'music') {
        if (typeof Music !== 'undefined') Music.setMusicVol(vol);
        if (typeof BlindMusic !== 'undefined') BlindMusic.setVolume(vol * 0.65);
        if (typeof OGAudio !== 'undefined') OGAudio.setMusicVol(vol * 0.4);
      } else if (type === 'sfx') {
        if (typeof OGAudio !== 'undefined') OGAudio.setSFXVol(vol);
        if (typeof Realistic !== 'undefined') Realistic.setVolume(vol);
      } else if (type === 'ambient') {
        if (typeof Music !== 'undefined') Music.setAmbVol(vol);
      }
    } catch (e) {}
  }
  
  return {
    init, playArrival, playAmbientForLocation, playStinger, setIntensity,
    playFootstep, startFootsteps, stopFootsteps, playFight, triggerSonar, stop, setVolume,
    AMBIENT_PRESETS, STORY_INTENSITY,
    _footTimer: null, _heartbeatTimer: null,
  };
})();
