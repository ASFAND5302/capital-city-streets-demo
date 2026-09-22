/* ============================================================
   CAPITAL CITY STREETS — src/realvoices.js
   PREMIUM FIX: Single voice guarantee - no double voice ever
   Mobile + Desktop - All 5 chapters (43 files)
   ============================================================ */

const RealVoices = (() => {
  let enabled = localStorage.getItem('ccs-realvoices') !== '0';
  let audioEl = null;
  let currentPlaying = null;
  let pendingResolve = null;
  let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  let isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  let mobileUnlocked = false;
  let playGen = 0; // PREMIUM FIX: generation token for single voice
  
  const CHARACTER_VOICE = {
    stoneface: 'voice-00', harbor: 'voice-00',
    glasses: 'voice-01', bonnie: 'voice-01', tess: 'voice-01', narrator: 'voice-01', nia: 'voice-01',
    salena: 'voice-02', nyx: 'voice-02', sera: 'voice-02',
    sam: 'voice-03', ledger: 'voice-03', voss: 'voice-03',
    priest: 'voice-04', wexler: 'voice-04',
  };
  
  const REAL_FILES = {
    'narrator_stoneface': { file: 'audio/real/narrator_stoneface.mp3', character: 'narrator', text: 'They call you Stoneface. Blind since birth.', keywords: ['they call you stoneface'], chapter: 1 },
    'stoneface_intro': { file: 'audio/real/stoneface_intro.mp3', character: 'stoneface', text: 'You are Stoneface.', keywords: ['you are stoneface'], chapter: 1 },
    'stoneface_sister': { file: 'audio/real/stoneface_sister.mp3', character: 'stoneface', text: 'They took the only person who ever read the world to me.', keywords: ['only person who ever read'], chapter: 1 },
    'stoneface_apartment': { file: 'audio/real/stoneface_apartment.mp3', character: 'stoneface', text: "Salena's apartment.", keywords: ['salena apartment'], chapter: 1 },
    'stoneface_walk': { file: 'audio/real/stoneface_walk.mp3', character: 'stoneface', text: 'Then we walk.', keywords: ['one block at a time'], chapter: 1 },
    'stoneface_drive_found': { file: 'audio/real/stoneface_drive_found.mp3', character: 'stoneface', text: "Mama's photo — the drive is here.", keywords: ['mama photo drive'], chapter: 1 },
    'stoneface_jingle': { file: 'audio/real/stoneface_jingle.mp3', character: 'stoneface', text: 'The jingle lock.', keywords: ['jingle lock', 'seven chimes'], chapter: 1 },
    'stoneface_truth': { file: 'audio/real/stoneface_truth.mp3', character: 'stoneface', text: "I'll read the confession.", keywords: ['read the confession'], chapter: 1 },
    'glasses_tutorial': { file: 'audio/real/glasses_tutorial.mp3', character: 'glasses', text: 'Smart Glasses online.', keywords: ['smart glasses online'], chapter: 1 },
    'glasses_online': { file: 'audio/real/glasses_online.mp3', character: 'glasses', text: 'Tactical narration active.', keywords: ['tactical narration active'], chapter: 1 },
    'glasses_chapel': { file: 'audio/real/glasses_chapel.mp3', character: 'glasses', text: "Chapel Row, outside Salena's building.", keywords: ['chapel row'], chapter: 1 },
    'glasses_jingle': { file: 'audio/real/glasses_jingle.mp3', character: 'glasses', text: 'Jingle lock detected.', keywords: ['jingle lock detected'], chapter: 1 },
    'glasses_objective': { file: 'audio/real/glasses_objective.mp3', character: 'glasses', text: "Tonight's objective.", keywords: ['tonight objective'], chapter: 1 },
    'glasses_scanning': { file: 'audio/real/glasses_scanning.mp3', character: 'glasses', text: 'Scanning. The idling car.', keywords: ['scanning', 'idling car'], chapter: 1 },
    'glasses_livingroom': { file: 'audio/real/glasses_livingroom.mp3', character: 'glasses', text: "Living room. Salena's books.", keywords: ['living room'], chapter: 1 },
    'salena_message': { file: 'audio/real/salena_message.mp3', character: 'salena', text: "Stoneface, it's Salena.", keywords: ['if you hearing this'], chapter: 1 },
    'salena_hidden': { file: 'audio/real/salena_hidden.mp3', character: 'salena', text: "I hid the drive behind Mama's photo.", keywords: ['hid the drive'], chapter: 1 },
    'salena_budget': { file: 'audio/real/salena_budget.mp3', character: 'salena', text: "The budget numbers... they bleed.", keywords: ['budget numbers'], chapter: 1 },
    'sam_tip': { file: 'audio/real/sam_tip.mp3', character: 'sam', text: 'Stoneface, it\'s Sam.', keywords: ['data drive you found'], chapter: 2 },
    'sam_drive': { file: 'audio/real/sam_drive.mp3', character: 'sam', text: 'It points to City Hall.', keywords: ['points to city hall'], chapter: 2 },
    'priest_church': { file: 'audio/real/priest_church.mp3', character: 'priest', text: 'The city has forgotten how to mourn.', keywords: ['forgotten how to mourn'], chapter: 1 },
    'priest_mourn': { file: 'audio/real/priest_mourn.mp3', character: 'priest', text: 'But I remember your sister.', keywords: ['remember your sister'], chapter: 1 },
    'priest_afraid': { file: 'audio/real/priest_afraid.mp3', character: 'priest', text: 'She was afraid.', keywords: ['she was afraid'], chapter: 1 },
    'harbor_court': { file: 'audio/real/harbor_court.mp3', character: 'harbor', text: 'Blind man walks onto my court.', keywords: ['blind man walks onto my court'], chapter: 2 },
    'bonnie_online': { file: 'audio/real/bonnie_online.mp3', character: 'bonnie', text: 'Bonnie online. Armor at 100%.', keywords: ['bonnie online'], chapter: 2 },
    'glasses_southside': { file: 'audio/real/glasses_southside.mp3', character: 'glasses', text: 'Keystone Avenue and Ironrail Street.', keywords: ['keystone avenue'], chapter: 2 },
    'ledger_call': { file: 'audio/real/ledger_call.mp3', character: 'ledger', text: 'Ledger here.', keywords: ['ledger here'], chapter: 2 },
    'nyx_point': { file: 'audio/real/nyx_point.mp3', character: 'nyx', text: "Point us.", keywords: ['point us'], chapter: 2 },
    'priest_waterfront': { file: 'audio/real/priest_waterfront.mp3', character: 'priest', text: 'You want the waterfront.', keywords: ['you want the waterfront'], chapter: 2 },
    'tess_boat': { file: 'audio/real/tess_boat.mp3', character: 'glasses', text: "Salena's drive names a boat.", keywords: ['drive names a boat'], chapter: 3 },
    'bonnie_ambush': { file: 'audio/real/bonnie_ambush.mp3', character: 'bonnie', text: 'Contact. Two vehicles.', keywords: ['two vehicles', 'no plates'], chapter: 3 },
    'sam_radio': { file: 'audio/real/sam_radio.mp3', character: 'sam', text: "I can hold the radio at tier six.", keywords: ['hold the radio at tier six'], chapter: 3 },
    'sera_bar': { file: 'audio/real/sera_bar.mp3', character: 'nyx', text: 'You hear me before you see me.', keywords: ['hear me before you see me'], chapter: 3 },
    'narrator_ch4': { file: 'audio/real/narrator_ch4.mp3', character: 'narrator', text: 'Chapter Four — The Takedown.', keywords: ['chapter four', 'the takedown', 'precinct', 'five hitmen'], chapter: 4 },
    'glasses_precinct': { file: 'audio/real/glasses_precinct.mp3', character: 'glasses', text: 'The evidence room ledger.', keywords: ['evidence room ledger', 'voss signatures'], chapter: 4 },
    'wexler_gala': { file: 'audio/real/wexler_gala.mp3', character: 'priest', text: 'Do enjoy the finale, Stoneface. The gala is Saturday.', keywords: ['do enjoy the finale', 'gala is saturday', 'two hundred liars'], chapter: 4 },
    'harbor_whistle': { file: 'audio/real/harbor_whistle.mp3', character: 'harbor', text: 'They followed you home, Stoneface. My court.', keywords: ['followed you home', 'my court', 'my whistle'], chapter: 4 },
    'narrator_ch5': { file: 'audio/real/narrator_ch5.mp3', character: 'narrator', text: 'Chapter Five — The Grand Finale.', keywords: ['chapter five', 'grand finale', 'one mansion'], chapter: 5 },
    'nyx_gates': { file: 'audio/real/nyx_gates.mp3', character: 'nyx', text: 'Gates, guards, gala.', keywords: ['gates guards gala', 'two hundred liars'], chapter: 5 },
    'glasses_mansion': { file: 'audio/real/glasses_mansion.mp3', character: 'glasses', text: 'Two patrols, mirrored routes.', keywords: ['two patrols', 'mirrored routes', 'rose beds'], chapter: 5 },
    'glasses_ballroom': { file: 'audio/real/glasses_ballroom.mp3', character: 'glasses', text: 'Ballroom. Strings quartet.', keywords: ['ballroom', 'strings quartet', 'champagne towers'], chapter: 5 },
    'bonnie_gate': { file: 'audio/real/bonnie_gate.mp3', character: 'bonnie', text: 'Bonnie through the gate at forty.', keywords: ['bonnie through the gate', 'guards scattering'], chapter: 5 },
    'priest_finale': { file: 'audio/real/priest_finale.mp3', character: 'priest', text: 'The city has watched you, Stoneface.', keywords: ['city has watched you', 'for salena', 'every name that bled'], chapter: 5 },
  };
  
  let lookupCache = new Map();
  
  function findRealFile(text, character) {
    if (!enabled || !text) return null;
    const lower = String(text).toLowerCase();
    if (lower.includes('options available') || lower.includes('option 1:') || lower.includes('arrow keys') || lower.includes('press enter') || lower.includes('percent') || lower.length < 15) {
      return null;
    }
    const cacheKey = lower.slice(0, 50);
    if (lookupCache.has(cacheKey)) return lookupCache.get(cacheKey);
    for (const info of Object.values(REAL_FILES)) {
      if (info.keywords) {
        for (const kw of info.keywords) {
          if (lower.includes(kw.toLowerCase())) {
            lookupCache.set(cacheKey, info.file);
            return info.file;
          }
        }
      }
      if (info.text && lower.includes(info.text.toLowerCase().slice(0, 22))) {
        lookupCache.set(cacheKey, info.file);
        return info.file;
      }
    }
    lookupCache.set(cacheKey, null);
    return null;
  }
  
  function ensureAudio() {
    if (audioEl) return audioEl;
    audioEl = document.createElement('audio');
    audioEl.preload = 'auto';
    audioEl.crossOrigin = 'anonymous';
    audioEl.playsInline = true;
    audioEl.setAttribute('playsinline', '');
    audioEl.setAttribute('webkit-playsinline', '');
    audioEl.volume = 1.0;
    if (!document.body.contains(audioEl)) {
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
    }
    if (lookupCache.size > 200) lookupCache.clear();
    return audioEl;
  }
  
  function unlockMobile() {
    if (mobileUnlocked) return;
    mobileUnlocked = true;
    try {
      const el = ensureAudio();
      el.muted = true;
      el.volume = 0;
      const p = el.play();
      if (p && p.then) {
        p.then(() => {
          el.pause();
          el.muted = false;
          el.volume = 1.0;
        }).catch(() => {
          el.muted = false;
          el.volume = 1.0;
        });
      } else {
        el.muted = false;
        el.volume = 1.0;
      }
    } catch (e) {}
  }
  
  // PREMIUM FIX: Hard stop with generation increment - single voice guarantee
  function stop() {
    playGen++; // invalidate any pending play
    if (audioEl) {
      try { audioEl.pause(); } catch (e) {}
      try { audioEl.currentTime = 0; } catch (e) {}
      try { audioEl.onended = null; audioEl.onerror = null; } catch (e) {}
      try { audioEl.src = ''; } catch (e) {} // clear src to force stop
    }
    if (currentPlaying) {
      try { currentPlaying.pause(); } catch (e) {}
      try { currentPlaying.currentTime = 0; } catch (e) {}
    }
    currentPlaying = null;
    if (pendingResolve) {
      try { pendingResolve(false); } catch (e) {}
      pendingResolve = null;
    }
    if (typeof Music !== 'undefined') {
      try { Music.duck(false); } catch (e) {}
    }
    if (typeof BlindMusic !== 'undefined') {
      try { BlindMusic.duck(false); } catch (e) {}
    }
  }
  
  async function playReal(text, character) {
    if (!enabled) return false;
    const file = findRealFile(text, character);
    if (!file) return false;
    
    const myGen = ++playGen; // capture generation
    
    try {
      // PREMIUM: Stop TTS immediately before real voice
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
      
      const el = ensureAudio();
      
      if (isMobile && !mobileUnlocked) unlockMobile();
      
      // Stop any previous real voice
      if (currentPlaying) {
        try { currentPlaying.pause(); } catch (e) {}
        try { currentPlaying.currentTime = 0; } catch (e) {}
      }
      if (pendingResolve) {
        try { pendingResolve(false); } catch (e) {}
        pendingResolve = null;
      }
      
      // Check if invalidated during async
      if (myGen !== playGen) return false;
      
      el.onended = null;
      el.onerror = null;
      el.muted = false;
      el.volume = 1.0;
      
      el.src = file;
      el.load();
      
      if (typeof Music !== 'undefined') Music.duck(true);
      if (typeof BlindMusic !== 'undefined') BlindMusic.duck(true);
      if (typeof OGAudio !== 'undefined' && OGAudio.duck) OGAudio.duck(true);
      if (typeof OGAudio !== 'undefined' && OGAudio.duck) OGAudio.duck(true);
      
      // Check again after load
      if (myGen !== playGen) {
        if (typeof Music !== 'undefined') Music.duck(false);
        if (typeof BlindMusic !== 'undefined') BlindMusic.duck(false);
        if (typeof OGAudio !== 'undefined' && OGAudio.duck) OGAudio.duck(false);
        return false;
      }
      
      try {
        const playPromise = el.play();
        if (playPromise && playPromise.then) {
          await playPromise;
        }
      } catch (playErr) {
        if (typeof Music !== 'undefined') Music.duck(false);
        if (typeof BlindMusic !== 'undefined') BlindMusic.duck(false);
        if (typeof OGAudio !== 'undefined' && OGAudio.duck) OGAudio.duck(false);
        if (isMobile && playErr.name === 'NotAllowedError') {
          return false;
        }
        return false;
      }
      
      if (myGen !== playGen) {
        try { el.pause(); } catch (e) {}
        if (typeof Music !== 'undefined') Music.duck(false);
        if (typeof BlindMusic !== 'undefined') BlindMusic.duck(false);
        if (typeof OGAudio !== 'undefined' && OGAudio.duck) OGAudio.duck(false);
        return false;
      }
      
      currentPlaying = el;
      
      return new Promise(resolve => {
        pendingResolve = resolve;
        el.onended = () => {
          if (myGen !== playGen) {
            resolve(false);
            return;
          }
          currentPlaying = null;
          pendingResolve = null;
          if (typeof Music !== 'undefined') Music.duck(false);
          if (typeof BlindMusic !== 'undefined') BlindMusic.duck(false);
          resolve(true);
        };
        el.onerror = (e) => {
          currentPlaying = null;
          pendingResolve = null;
          if (typeof Music !== 'undefined') Music.duck(false);
          if (typeof BlindMusic !== 'undefined') BlindMusic.duck(false);
          resolve(false);
        };
      });
    } catch (e) {
      return false;
    }
  }
  
  function setEnabled(on) {
    enabled = !!on;
    localStorage.setItem('ccs-realvoices', String(enabled ? '1' : '0'));
    if (!enabled) stop();
  }
  function isEnabled() { return enabled; }
  function getVoiceForCharacter(c) { return CHARACTER_VOICE[c] || null; }
  function init() {
    const saved = localStorage.getItem('ccs-realvoices');
    if (saved !== null) enabled = saved === '1';
    console.log(`[RealVoices] ${Object.keys(REAL_FILES).length} files - Premium single voice - Mobile: ${isMobile}`);
    ensureAudio();
    if (isMobile) {
      const unlockEvents = ['touchstart', 'touchend', 'click'];
      const unlockOnce = () => {
        unlockMobile();
        unlockEvents.forEach(ev => document.removeEventListener(ev, unlockOnce));
      };
      unlockEvents.forEach(ev => document.addEventListener(ev, unlockOnce, { once: true, passive: true }));
    }
  }
  return { init, playReal, stop, setEnabled, isEnabled, getVoiceForCharacter, findRealFile, unlockMobile, REAL_FILES, CHARACTER_VOICE };
})();
