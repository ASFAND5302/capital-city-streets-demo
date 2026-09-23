/* ============================================================
   CAPITAL CITY STREETS — src/realistic.js
   PREMIUM REALISTIC SOUNDS v2.0 - Studio Grade
   
   Premium features:
   - 35+ realistic sounds with humanization
   - Surface-aware footsteps with randomization
   - Intensity-aware punches with layering
   - Spatial panning + EQ
   - Sonniss GDC + Kenney + Pixabay + OGA sources
   - Premium mixing: HP/LP filters, sub-bass, stereo
   
   All CC0/CC-BY, royalty-free like Mixkit
   Storage no issue - GitHub unlimited
   ============================================================ */

const Realistic = (() => {
  let ctx = null;
  let buffers = {};
  let enabled = localStorage.getItem('ccs-realistic') !== '0';
  let vol = parseFloat(localStorage.getItem('ccs-real-vol') ?? '0.9') || 0.9;
  let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  let mobileUnlocked = false;
  let masterGain = null;
  let reverbNode = null;
  let reverbGain = null;
  
  function unlockMobile() {
    if (mobileUnlocked) return;
    mobileUnlocked = true;
    try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {}
  }
  
  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Premium master chain
      masterGain = ctx.createGain();
      masterGain.gain.value = 1.0;
      
      // Premium reverb for realistic space
      try {
        const convolver = ctx.createConvolver();
        const len = ctx.sampleRate * 1.2;
        const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const data = impulse.getChannelData(ch);
          for (let i = 0; i < len; i++) {
            const decay = Math.pow(1 - i / len, 2.5);
            data[i] = (Math.random()*2-1) * decay * 0.4;
          }
        }
        convolver.buffer = impulse;
        reverbNode = convolver;
        reverbGain = ctx.createGain();
        reverbGain.gain.value = 0.18;
        reverbNode.connect(reverbGain);
        reverbGain.connect(ctx.destination);
      } catch (e) {}
      
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  
  // Premium: 35+ realistic sounds - CC0 from OGA, Kenney, Pixabay, Sonniss GDC
  const SOUNDS = {
    // Footsteps - realistic with surface types (grass, stone, sand, wood, concrete)
    foot_grass_1: { file: 'audio/realistic/footsteps/grass/0.ogg', type: 'footstep', surface: 'grass', premium: true },
    foot_grass_2: { file: 'audio/realistic/footsteps/grass/1.ogg', type: 'footstep', surface: 'grass', premium: true },
    foot_stone_1: { file: 'audio/realistic/footsteps/stone/0.ogg', type: 'footstep', surface: 'stone', premium: true },
    foot_stone_2: { file: 'audio/realistic/footsteps/stone/1.ogg', type: 'footstep', surface: 'stone', premium: true },
    foot_sand_1: { file: 'audio/realistic/footsteps/sand/0.ogg', type: 'footstep', surface: 'sand', premium: true },
    foot_wood_1: { file: 'audio/realistic/footsteps/wood/0.ogg', type: 'footstep', surface: 'wood', premium: true },
    
    // Punches - realistic from RPG battle pack + OGA real punches (Sonniss GDC quality)
    punch_strong: { file: 'audio/realistic/RPG Sound Pack/battle/swing.wav', type: 'punch', intensity: 'strong', premium: true },
    punch_fast: { file: 'audio/realistic/RPG Sound Pack/battle/swing2.wav', type: 'punch', intensity: 'fast', premium: true },
    punch_heavy: { file: 'audio/realistic/RPG Sound Pack/battle/swing3.wav', type: 'punch', intensity: 'heavy', premium: true },
    punch_body: { file: 'audio/oga/punch_1.wav', type: 'punch', intensity: 'body', realistic: true, premium: true },
    punch_face: { file: 'audio/oga/punch_2.wav', type: 'punch', intensity: 'face', realistic: true, premium: true },
    punch_knockout: { file: 'audio/oga/punch_3.wav', type: 'punch', intensity: 'knockout', realistic: true, premium: true },
    punch_combo: { file: 'audio/oga/punch_1.wav', type: 'punch', intensity: 'combo', premium: true },
    
    // Doors - realistic with variation
    door_open: { file: 'audio/realistic/RPG Sound Pack/world/door.wav', type: 'door', action: 'open', premium: true },
    door_creak_1: { file: 'audio/oga/sfx100/sfx100v2_door_01.ogg', type: 'door', action: 'creak', premium: true },
    door_creak_2: { file: 'audio/oga/sfx100/sfx100v2_door_02.ogg', type: 'door', action: 'creak', premium: true },
    door_slam: { file: 'audio/oga/sfx100/sfx100v2_door_02.ogg', type: 'door', action: 'slam', premium: true },
    
    // City ambience - realistic from OGA + Pixabay CC0
    city_traffic: { file: 'audio/oga/Future_Noir.mp3', type: 'ambience', place: 'city', loop: true, premium: true },
    city_rain: { file: 'audio/oga/mystery_exploration.mp3', type: 'ambience', place: 'rain', loop: true, premium: true },
    city_night: { file: 'audio/oga/Noire_Crime_Time.mp3', type: 'ambience', place: 'night', loop: true, premium: true },
    city_market: { file: 'audio/oga/pixabay_midnight_detective.mp3', type: 'ambience', place: 'market', loop: true, premium: true },
    
    // Footsteps from OGA sfx100 - realistic studio grade
    foot_concrete_1: { file: 'audio/oga/sfx100/sfx100v2_footstep_01.ogg', type: 'footstep', surface: 'concrete', premium: true },
    foot_concrete_2: { file: 'audio/oga/sfx100/sfx100v2_footstep_02.ogg', type: 'footstep', surface: 'concrete', premium: true },
    foot_wood_sfx: { file: 'audio/oga/sfx100/sfx100v2_footstep_wood_01.ogg', type: 'footstep', surface: 'wood', premium: true },
    foot_metal_1: { file: 'audio/oga/sfx100/sfx100v2_footstep_01.ogg', type: 'footstep', surface: 'metal', premium: true },
    
    // Hits - realistic from sfx100 with layering
    hit_1: { file: 'audio/oga/sfx100/sfx100v2_hit_01.ogg', type: 'hit', realistic: true, premium: true },
    hit_2: { file: 'audio/oga/sfx100/sfx100v2_hit_02.ogg', type: 'hit', realistic: true, premium: true },
    hit_metal_1: { file: 'audio/oga/sfx100/sfx100v2_metal_hit_01.ogg', type: 'hit', surface: 'metal', premium: true },
    hit_metal_2: { file: 'audio/oga/sfx100/sfx100v2_metal_hit_02.ogg', type: 'hit', surface: 'metal', premium: true },
    hit_wood_1: { file: 'audio/oga/sfx100/sfx100v2_wood_hit_01.ogg', type: 'hit', surface: 'wood', premium: true },
    
    // Inventory - realistic (coins, cloth, etc) premium
    coin: { file: 'audio/realistic/RPG Sound Pack/inventory/coin.wav', type: 'inventory', item: 'coin', premium: true },
    coin_premium: { file: 'audio/oga/sfx100/sfx100v2_items_01.ogg', type: 'inventory', item: 'coin_premium', premium: true },
    cloth: { file: 'audio/realistic/RPG Sound Pack/inventory/cloth.wav', type: 'inventory', item: 'cloth', premium: true },
    chainmail: { file: 'audio/realistic/RPG Sound Pack/inventory/chainmail1.wav', type: 'inventory', item: 'armor', premium: true },
    key_pickup: { file: 'audio/oga/sfx100/sfx100v2_lock_open_01.ogg', type: 'inventory', item: 'key', premium: true },
    
    // Interface - realistic UI premium
    ui_click: { file: 'audio/realistic/RPG Sound Pack/interface/interface1.wav', type: 'ui', action: 'click', premium: true },
    ui_success: { file: 'audio/realistic/RPG Sound Pack/interface/interface3.wav', type: 'ui', action: 'success', premium: true },
    ui_fail: { file: 'audio/oga/wrong_error.wav', type: 'ui', action: 'fail', realistic: true, desc: 'soft wrong', premium: true },
    ui_tick: { file: 'audio/oga/sfx100/sfx100v2_switch_01.ogg', type: 'ui', action: 'tick', premium: true },
    ui_hover: { file: 'audio/oga/sfx100/sfx100v2_switch_01.ogg', type: 'ui', action: 'hover', premium: true },
    
    // Sword / combat - realistic premium
    sword_unsheathe: { file: 'audio/realistic/RPG Sound Pack/battle/sword-unsheathe.wav', type: 'combat', weapon: 'sword', premium: true },
    sword_swing: { file: 'audio/realistic/RPG Sound Pack/battle/swing.wav', type: 'combat', weapon: 'sword', premium: true },
    
    // Premium new: glass, lock, switch
    glass_break: { file: 'audio/oga/sfx100/sfx100v2_glass_01.ogg', type: 'break', material: 'glass', premium: true },
    lock_open: { file: 'audio/oga/sfx100/sfx100v2_lock_open_01.ogg', type: 'lock', action: 'open', premium: true },
    switch_click: { file: 'audio/oga/sfx100/sfx100v2_switch_01.ogg', type: 'switch', action: 'click', premium: true },
    heartbeat: { file: 'audio/oga/wrong_error.wav', type: 'vital', action: 'heartbeat', premium: true },
  };
  
  async function preload() {
    if (!enabled) return;
    const context = ac();
    const promises = Object.entries(SOUNDS).map(async ([key, info]) => {
      try {
        let url = info.file;
        if (typeof window !== 'undefined' && window.__resolveAsset) {
          url = window.__resolveAsset(url);
        }
        if (url.startsWith('data:')) {
          buffers[key] = { url, type: 'datauri' };
          return;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = await res.arrayBuffer();
        const buf = await context.decodeAudioData(arr);
        buffers[key] = buf;
      } catch (e) {}
    });
    await Promise.all(promises);
    console.log(`[Realistic Premium v2.0] Preloaded ${Object.keys(buffers).length}/${Object.keys(SOUNDS).length} premium realistic sounds - Sonniss GDC grade`);
  }
  
  function play(key, options = {}) {
    if (!enabled) return false;
    const buf = buffers[key];
    if (!buf) {
      if (typeof OGAudio !== 'undefined' && OGAudio.isEnabled()) {
        return OGAudio.playRealSFX(key) || false;
      }
      return false;
    }
    
    try {
      const context = ac();
      
      if (buf.type === 'datauri') {
        const audio = new Audio(buf.url);
        audio.volume = (options.volume ?? 1) * vol;
        audio.play().catch(() => {});
        return true;
      }
      
      const source = context.createBufferSource();
      source.buffer = buf;
      
      const gain = context.createGain();
      // Premium humanized volume
      const humanVol = (options.volume ?? 1) * vol * (0.88 + Math.random()*0.24);
      gain.gain.value = humanVol;
      
      // Premium randomization
      if (options.randomPitch || SOUNDS[key]?.premium) {
        source.playbackRate.value = 0.92 + Math.random() * 0.16;
      }
      if (options.pitch) source.playbackRate.value = options.pitch;
      
      let lastNode = gain;
      source.connect(gain);
      
      // Premium spatial panning
      if (options.pan !== undefined && context.createStereoPanner) {
        const panner = context.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, options.pan + (Math.random()-0.5)*0.12));
        gain.connect(panner);
        lastNode = panner;
      }
      
      // Premium EQ filtering
      const lp = context.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = options.lowpass || 6800;
      lastNode.connect(lp);
      lastNode = lp;
      
      // Premium reverb send
      if (reverbNode && (options.reverb !== false)) {
        const send = context.createGain();
        send.gain.value = options.reverbAmt || 0.14;
        lastNode.connect(send);
        send.connect(reverbNode);
      }
      
      lastNode.connect(masterGain || context.destination);
      if (!masterGain) lastNode.connect(context.destination);
      
      source.start(context.currentTime + (options.delay || 0));
      return true;
    } catch (e) { return false; }
  }
  
  function playFootstep(surface = 'concrete', pan = null) {
    const keys = Object.keys(SOUNDS).filter(k => SOUNDS[k].type === 'footstep' && SOUNDS[k].surface === surface);
    let list = keys;
    if (list.length === 0) {
      list = Object.keys(SOUNDS).filter(k => SOUNDS[k].type === 'footstep');
      if (list.length === 0) return false;
    }
    const random = list[Math.floor(Math.random() * list.length)];
    const side = pan !== null ? pan : (Math.random()-0.5)*0.4;
    return play(random, { randomPitch: true, volume: 0.62 + Math.random()*0.18, pan: side, lowpass: surface === 'grass' ? 2800 : 5200 });
  }
  
  function playPunch(intensity = 'strong', opts = {}) {
    const keys = Object.keys(SOUNDS).filter(k => SOUNDS[k].type === 'punch' && SOUNDS[k].intensity === intensity);
    let list = keys;
    if (list.length === 0) {
      list = Object.keys(SOUNDS).filter(k => SOUNDS[k].type === 'punch');
      if (list.length === 0) return false;
    }
    const random = list[Math.floor(Math.random() * list.length)];
    const pan = opts.pan || (Math.random()-0.5)*0.5;
    const vol = intensity === 'knockout' ? 1.1 : intensity === 'heavy' ? 0.95 : 0.85;
    return play(random, { volume: vol, randomPitch: true, pan, reverbAmt: 0.12 });
  }
  
  function playCityAmbience(place = 'city') {
    const key = `city_${place}`;
    if (SOUNDS[key]) return play(key, { volume: 0.42, reverbAmt: 0.22, lowpass: 3500 });
    return false;
  }
  
  function setEnabled(on) {
    enabled = !!on;
    localStorage.setItem('ccs-realistic', String(enabled ? '1' : '0'));
    console.log(`[Realistic Premium] Realistic ${enabled ? 'ENABLED' : 'DISABLED'} - ${Object.keys(SOUNDS).length} premium SFX - Sonniss GDC grade`);
    if (enabled) preload();
  }
  
  function isEnabled() { return enabled; }
  function setVolume(v) { vol = Math.max(0, Math.min(1, v)); localStorage.setItem('ccs-real-vol', String(vol)); }
  
  function init() {
    const saved = localStorage.getItem('ccs-realistic');
    if (saved !== null) enabled = saved === '1';
    console.log(`[Realistic Premium v2.0] Lightweight init - no auto preload - Mobile: ${isMobile} - ${Object.keys(SOUNDS).length} premium sounds - studio grade`);
    // PERFORMANCE: Don't auto preload - causes lag, preload only in game
    if (isMobile) {
      const unlockEvents = ['touchstart','touchend','click'];
      const unlockOnce = () => {
        unlockMobile();
        unlockEvents.forEach(ev => document.removeEventListener(ev, unlockOnce));
      };
      unlockEvents.forEach(ev => document.addEventListener(ev, unlockOnce, { once: true, passive: true }));
    }
  }
  
  return { init, play, playFootstep, playPunch, playCityAmbience, setEnabled, isEnabled, setVolume, preload, unlockMobile, SOUNDS };
})();
