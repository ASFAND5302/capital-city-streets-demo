/* ============================================================
   CAPITAL CITY STREETS — src/spatial.js
   Full spatial audio system for proper game feel
   - Story mode: characters positioned in 3D space
   - Fight scenes: directional punches, dodges, impacts
   - City mode: enhanced HRTF already in audio3d.js
   - All SFX: stereo panning based on action

   100% synthesized, zero files, uses Web Audio HRTF
   ============================================================ */

const Spatial = (() => {
  let ctx = null;
  let master = null;
  let listenerX = 0, listenerZ = 0, listenerAngle = 0;
  let enabled = true;
  let charPositions = {}; // speaker -> {x, z, angle}
  let fightSide = 1; // alternates left/right for fight realism

  function ac() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.85;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 7500; lp.Q.value = 0.5;
        master.connect(lp).connect(ctx.destination);
      } catch(e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Set listener position and orientation (for city and story)
  function setListener(x, z, angleDeg) {
    listenerX = x; listenerZ = z; listenerAngle = angleDeg;
    if (!ctx) return;
    const L = ctx.listener;
    const rad = angleDeg * Math.PI / 180;
    const fx = Math.sin(rad), fz = -Math.cos(rad);
    if (L.positionX) {
      L.positionX.value = x; L.positionY.value = 1.7; L.positionZ.value = z;
      L.forwardX.value = fx; L.forwardY.value = 0; L.forwardZ.value = fz;
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else {
      L.setPosition(x, 1.7, z);
      L.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  // Position a character in 3D space around player
  function placeCharacter(speaker, preset = 'front') {
    // Presets: front, left, right, behind, front-left, front-right, etc
    const positions = {
      'front': { x: 0, z: -3, angle: 0 },
      'front-left': { x: -2, z: -2.5, angle: -30 },
      'front-right': { x: 2, z: -2.5, angle: 30 },
      'left': { x: -3.5, z: 0, angle: -90 },
      'right': { x: 3.5, z: 0, angle: 90 },
      'behind': { x: 0, z: 3, angle: 180 },
      'behind-left': { x: -2, z: 2.5, angle: -150 },
      'behind-right': { x: 2, z: 2.5, angle: 150 },
      'close-left': { x: -1.2, z: -1, angle: -45 },
      'close-right': { x: 1.2, z: -1, angle: 45 },
      'far': { x: 0, z: -8, angle: 0 },
    };
    const pos = positions[preset] || positions['front'];
    charPositions[speaker] = pos;
    return pos;
  }

  // Auto-place characters for story scenes
  function autoPlaceForScene(sceneId, speakers) {
    // Clear old
    charPositions = {};
    // Fight scenes: attacker alternates left/right for realism
    if (sceneId && sceneId.includes('fight')) {
      const attackers = speakers.filter(s => s !== 'stoneface' && s !== 'glasses' && s !== 'you');
      attackers.forEach((sp, i) => {
        const side = i % 2 === 0 ? (fightSide > 0 ? 'front-right' : 'front-left') : (fightSide > 0 ? 'front-left' : 'front-right');
        placeCharacter(sp, side);
      });
      placeCharacter('stoneface', 'front');
      placeCharacter('glasses', 'close-left'); // Smart Glasses always close
      fightSide *= -1; // alternate for next fight
    } else if (sceneId && sceneId.includes('precinct')) {
      // Precinct shootout: enemies all around
      speakers.forEach((sp, i) => {
        if (sp === 'stoneface') placeCharacter(sp, 'front');
        else if (sp === 'glasses') placeCharacter(sp, 'close-left');
        else {
          const presets = ['front-left','front-right','left','right','behind'];
          placeCharacter(sp, presets[i % presets.length]);
        }
      });
    } else {
      // Normal dialogue: spread characters
      const presets = ['front','front-left','front-right','left','right'];
      speakers.forEach((sp, i) => {
        if (sp === 'glasses') placeCharacter(sp, 'close-left');
        else if (sp === 'stoneface' || sp === 'you') placeCharacter(sp, 'front');
        else placeCharacter(sp, presets[i % presets.length]);
      });
    }
  }

  // Play a tone with 3D positioning
  function playSpatial(freq, dur, gain, speaker, type = 'sine', when = 0) {
    try {
      const a = ac(); if (!a) return;
      const t = a.currentTime + when;
      const pos = charPositions[speaker] || { x: 0, z: -2, angle: 0 };
      
      const o = a.createOscillator();
      const g = a.createGain();
      const panner = a.createPanner();
      
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1.5;
      panner.maxDistance = 20;
      panner.rolloffFactor = 0.8;
      
      if (panner.positionX) {
        panner.positionX.value = pos.x;
        panner.positionY.value = 1.6;
        panner.positionZ.value = pos.z;
      } else {
        panner.setPosition(pos.x, 1.6, pos.z);
      }

      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      
      o.connect(g).connect(panner).connect(master);
      o.start(t); o.stop(t + dur + 0.05);
    } catch(e) {}
  }

  // Play SFX with directional panning for fight realism
  function playFightSFX(sfxName, side = null) {
    try {
      const a = ac(); if (!a) return;
      // Determine side: left (-0.8), right (0.8), or random for realism
      let pan = 0;
      if (side === 'left') pan = -0.7 - Math.random()*0.3;
      else if (side === 'right') pan = 0.7 + Math.random()*0.3;
      else if (sfxName.includes('punch') || sfxName.includes('kick')) {
        // Alternate sides for combo feel
        pan = (fightSide > 0 ? 0.6 : -0.6) + (Math.random()-0.5)*0.4;
        fightSide *= -1;
      } else if (sfxName === 'dodge') {
        pan = Math.random() > 0.5 ? -0.8 : 0.8;
      } else {
        pan = (Math.random()-0.5)*0.6;
      }

      // Use StereoPanner for SFX (lighter than HRTF for fast sounds)
      const t = a.currentTime;
      
      // Create layered fight sound with panning
      if (sfxName === 'punch' || sfxName === 'punch_heavy') {
        // Thud centered, crack panned
        const thud = a.createOscillator(), g1 = a.createGain();
        const crack = a.createBufferSource(), g2 = a.createGain(), f = a.createBiquadFilter();
        const p1 = a.createStereoPanner ? a.createStereoPanner() : null;
        const p2 = a.createStereoPanner ? a.createStereoPanner() : null;
        
        // Thud - low, centered
        thud.type = 'sine'; thud.frequency.value = sfxName === 'punch_heavy' ? 45 : 55;
        g1.gain.setValueAtTime(0.0001, t);
        g1.gain.linearRampToValueAtTime(sfxName === 'punch_heavy' ? 0.22 : 0.17, t+0.01);
        g1.gain.exponentialRampToValueAtTime(0.0001, t+0.14);
        thud.connect(g1);
        if (p1) { p1.pan.value = pan*0.3; g1.connect(p1).connect(master); } else g1.connect(master);
        thud.start(t); thud.stop(t+0.15);

        // Crack - high, panned to impact side
        if (!window._noiseBuf) {
          window._noiseBuf = a.createBuffer(1, a.sampleRate*0.5, a.sampleRate);
          const d = window._noiseBuf.getChannelData(0);
          for(let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
        }
        crack.buffer = window._noiseBuf;
        f.type = 'highpass'; f.frequency.value = 2800;
        g2.gain.setValueAtTime(0.0001, t+0.018);
        g2.gain.linearRampToValueAtTime(0.12, t+0.022);
        g2.gain.exponentialRampToValueAtTime(0.0001, t+0.06);
        crack.connect(f).connect(g2);
        if (p2) { p2.pan.value = pan; g2.connect(p2).connect(master); } else g2.connect(master);
        crack.start(t+0.018); crack.stop(t+0.07);
        
      } else {
        // For other SFX, use simple panned tone
        const o = a.createOscillator(), g = a.createGain();
        const panner = a.createStereoPanner ? a.createStereoPanner() : null;
        o.type = 'sine'; o.frequency.value = 120;
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t+0.15);
        o.connect(g);
        if (panner) { panner.pan.value = pan; g.connect(panner).connect(master); }
        else g.connect(master);
        o.start(t); o.stop(t+0.16);
      }
    } catch(e) {}
  }

  // Ambient spatial: room tone from specific direction
  function playAmbient(type, x, z, gain = 0.05) {
    try {
      const a = ac(); if (!a) return;
      const panner = a.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 3;
      panner.maxDistance = 30;
      if (panner.positionX) {
        panner.positionX.value = x;
        panner.positionY.value = 1;
        panner.positionZ.value = z;
      } else panner.setPosition(x, 1, z);
      
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'sine';
      o.frequency.value = type === 'room' ? 98 : type === 'rain' ? 2400 : 120;
      g.gain.value = gain;
      o.connect(g).connect(panner).connect(master);
      o.start();
      setTimeout(() => { try{ o.stop(); }catch(e){} }, 3000);
    } catch(e) {}
  }

  // Footsteps with alternating left/right
  let footSide = -1;
  function footstep() {
    footSide *= -1;
    playFightSFX('step', footSide > 0 ? 'right' : 'left');
  }

  // Reset
  function reset() {
    charPositions = {};
    fightSide = 1;
    footSide = -1;
  }

  function setEnabled(v) { enabled = v; if (master) master.gain.value = v ? 0.85 : 0; }

  return {
    init: ac,
    setListener,
    placeCharacter,
    autoPlaceForScene,
    playSpatial,
    playFightSFX,
    playAmbient,
    footstep,
    reset,
    setEnabled,
    isEnabled: () => enabled,
    getPositions: () => charPositions
  };
})();
