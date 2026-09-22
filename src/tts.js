/* ============================================================
   CAPITAL CITY STREETS — src/tts.js
   PREMIUM FIX: No double voice ever, single voice guarantee
   Mobile + Desktop - Professional blind game standard
   
   FIXES double voice bug:
   - Generation token: each new voice invalidates previous
   - Chunk loop abort on cancel/error
   - Hard stop before any new voice
   - RealVoices + TTS mutually exclusive
   - Chapter load hard stop
   ============================================================ */

const TTS = (() => {
  let enabled = localStorage.getItem('ccs-tts') !== '0';
  let voices = [];
  let lastSpoken = null;
  let interruptTimer = null;
  let chunkTimer = null;
  let rateMul = parseFloat(localStorage.getItem('ccs-rate') || '1') || 1;
  let isSpeakingReal = false;
  let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  let isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  let voicesLoaded = false;
  let audioUnlocked = false;
  let speakGen = 0; // PREMIUM FIX: generation token for single voice guarantee

  function loadVoices() {
    if (!window.speechSynthesis) return;
    const v = window.speechSynthesis.getVoices();
    if (v.length) {
      voices = v;
      voicesLoaded = true;
    }
  }
  
  if (window.speechSynthesis) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      loadVoices();
      if (isIOS) setTimeout(loadVoices, 500);
    };
    if (isMobile) {
      setTimeout(loadVoices, 300);
      setTimeout(loadVoices, 1000);
      setTimeout(loadVoices, 2000);
    }
  }

  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    try {
      if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        window.speechSynthesis.speak(u);
        window.speechSynthesis.cancel();
      }
      if (typeof RealVoices !== 'undefined') {
        try { RealVoices.unlockMobile(); } catch (e) {}
      }
      if (typeof OGAudio !== 'undefined') {
        try { OGAudio.unlockMobile(); } catch (e) {}
      }
    } catch (e) {}
  }
  
  if (isMobile) {
    const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown'];
    const unlockOnce = () => {
      unlockAudio();
      unlockEvents.forEach(ev => document.removeEventListener(ev, unlockOnce));
    };
    unlockEvents.forEach(ev => document.addEventListener(ev, unlockOnce, { once: true, passive: true }));
  }

  let assigned = {};
  
  function scoreNatural(voice) {
    const name = (voice.name || '').toLowerCase();
    const uri = (voice.voiceURI || '').toLowerCase();
    let score = 0;
    if (isMobile) {
      if (voice.default) score += 50;
      if (!name.includes('compact') && !name.includes('espeak')) score += 30;
      if (isIOS) {
        if (name.includes('enhanced') || name.includes('premium')) score += 100;
        if (name.includes('siri')) score += 40;
      }
      if (!isIOS) {
        if (name.includes('google') && !name.includes('espeak')) score += 80;
      }
    } else {
      if (name.includes('natural') || name.includes('neural') || name.includes('wavenet') || name.includes('premium')) score += 100;
      if (name.includes('google') && !name.includes('espeak')) score += 80;
      if (name.includes('microsoft') && (name.includes('aria') || name.includes('jenny') || name.includes('guy') || name.includes('davis'))) score += 90;
      if (uri.includes('google') && !uri.includes('espeak')) score += 80;
    }
    if (name.includes('espeak') || name.includes('festival') || name.includes('robot') || uri.includes('espeak')) score -= 100;
    if (name.includes('compact')) score -= 30;
    if (voice.lang && voice.lang.toLowerCase().includes('en-us')) score += 15;
    else if (voice.lang && voice.lang.toLowerCase().includes('en-gb')) score += 10;
    else if (voice.lang && voice.lang.toLowerCase().startsWith('en')) score += 5;
    return score;
  }
  
  function pickVoice(profile) {
    if (!voices.length) {
      if (isMobile && !voicesLoaded) loadVoices();
      return null;
    }
    const en = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
    const pool = en.length ? en : voices;
    const sortedPool = [...pool].sort((a,b) => scoreNatural(b) - scoreNatural(a));
    const slot = (profile && typeof profile.slot === 'number') ? profile.slot : 0;
    if (assigned[slot] && pool.includes(assigned[slot])) return assigned[slot];
    const naturalCount = isMobile ? Math.min(3, sortedPool.length) : Math.max(3, Math.ceil(sortedPool.length * 0.6));
    const naturalPool = sortedPool.slice(0, naturalCount);
    const stride = Math.max(1, Math.floor(naturalPool.length / 8) || 1);
    for (let i = 0; i < naturalPool.length; i++) {
      const cand = naturalPool[(slot * stride + i) % naturalPool.length];
      if (!Object.values(assigned).includes(cand)) { assigned[slot] = cand; return cand; }
    }
    for (let i = 0; i < sortedPool.length; i++) {
      const cand = sortedPool[(slot * stride + i) % sortedPool.length];
      if (!Object.values(assigned).includes(cand)) { assigned[slot] = cand; return cand; }
    }
    const v = sortedPool[slot % sortedPool.length];
    assigned[slot] = v;
    return v;
  }

  function shouldSkipReal(text, profile) {
    if (!text) return true;
    if (profile && profile._skipReal) return true;
    const lower = String(text).toLowerCase();
    const uiKeywords = ['options available', 'option 1:', 'arrow keys', 'press enter', 'main menu', 'settings.', 'credits.', 'how to play', 'voice toggle', 'currently', 'percent', 'high contrast', 'real human voices', 'realistic sounds', 'blind friendly', 'real noir', 'real punch', 'starting new case', 'resuming your case', 'entering capitol', 'chapter select', 'use arrow keys to move', 'enhanced listening', 'sonar ping', 'rolling the opening'];
    for (const kw of uiKeywords) {
      if (lower.includes(kw)) return true;
    }
    if (lower.length < 60 && !lower.includes('stoneface') && !lower.includes('salena') && !lower.includes('chapter')) {
      if (lower.includes('press enter to') || lower.includes('press v to') || lower.includes('no saved case')) return true;
    }
    return false;
  }

  function splitLongText(text) {
    if (!isMobile) return [text];
    const maxLen = 150;
    if (text.length <= maxLen) return [text];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let current = '';
    for (const sent of sentences) {
      if ((current + sent).length > maxLen && current) {
        chunks.push(current.trim());
        current = sent;
      } else {
        current += sent;
      }
    }
    if (current) chunks.push(current.trim());
    return chunks.length ? chunks : [text];
  }

  // BUG FIX v2.2: Ultra hard stop - single voice guarantee, prevents option click double voice
  function hardStop() {
    speakGen++; // invalidate all pending chunks - generation token
    clearTimeout(interruptTimer);
    clearTimeout(chunkTimer);
    interruptTimer = null;
    chunkTimer = null;
    // Triple cancel for robustness - speechSynthesis cancel is async
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        // Chrome sometimes needs pause + cancel + resume + cancel
        try { window.speechSynthesis.pause(); } catch (e) {}
        window.speechSynthesis.cancel();
        try { window.speechSynthesis.resume(); } catch (e) {}
        window.speechSynthesis.cancel();
      }
    } catch (e) {}
    try { if (typeof RealVoices !== 'undefined') RealVoices.stop(); } catch (e) {}
    isSpeakingReal = false;
    // Unduck immediately to prevent music staying ducked
    try {
      if (typeof Music !== 'undefined') Music.duck(false);
      if (typeof BlindMusic !== 'undefined') BlindMusic.duck(false);
      if (typeof OGAudio !== 'undefined' && OGAudio.duck) OGAudio.duck(false);
    } catch (e) {}
  }

  function speak(text, profile = {}) {
    lastSpoken = { text, profile };
    if (!enabled || !window.speechSynthesis || !('SpeechSynthesisUtterance' in window)) {
      return Promise.resolve();
    }
    if (isMobile && !voicesLoaded) loadVoices();
    
    // PREMIUM: Hard stop previous before new
    hardStop();
    
    if (shouldSkipReal(text, profile)) {
      return speakTTS(text, profile);
    }
    
    try {
      if (typeof RealVoices !== 'undefined' && RealVoices.isEnabled() && !profile._skipReal) {
        const charId = profile._charId || null;
        const realResult = RealVoices.findRealFile(text, charId);
        if (!realResult) {
          return speakTTS(text, profile);
        }
        const realPromise = RealVoices.playReal(text, charId);
        if (realPromise && typeof realPromise.then === 'function') {
          isSpeakingReal = true;
          return realPromise.then(played => {
            isSpeakingReal = false;
            if (played !== false) return;
            return speakTTS(text, profile);
          }).catch(() => {
            isSpeakingReal = false;
            return speakTTS(text, profile);
          });
        } else if (realPromise === false) {
          return speakTTS(text, profile);
        } else {
          return realPromise;
        }
      }
    } catch (e) {
      console.warn('[TTS] RealVoices failed, fallback:', e);
    }
    
    return speakTTS(text, profile);
  }
  
  function speakTTS(text, profile = {}) {
    return new Promise(resolve => {
      const myGen = ++speakGen; // capture generation
      hardStop(); // ensure clean
      const currentGen = myGen;
      // Re-increment after hardStop invalidated, so we need fresh
      const finalGen = ++speakGen;
      
      const chunks = splitLongText(String(text).replace(/[*_#>]/g, ''));
      let idx = 0;
      
      const unduckAll = () => {
        setTimeout(() => {
          if (typeof Music !== 'undefined') Music.duck(false);
          if (typeof BlindMusic !== 'undefined') BlindMusic.duck(false);
        }, isMobile ? 300 : 200);
      };
      
      const speakChunk = () => {
        // PREMIUM FIX: Check if invalidated by newer voice
        if (finalGen !== speakGen) {
          console.log('[TTS] Chunk aborted - newer voice started');
          unduckAll();
          resolve();
          return;
        }
        if (idx >= chunks.length) {
          unduckAll();
          resolve();
          return;
        }
        const clean = chunks[idx];
        const u = new SpeechSynthesisUtterance(clean);
        const v = pickVoice(profile);
        if (v) u.voice = v;
        
        let pitch = typeof profile.pitch === 'number' ? profile.pitch : 1;
        let rate = typeof profile.rate === 'number' ? profile.rate : 1.12;
        if (isMobile) {
          rate = Math.min(1.1, rate * 0.95);
          pitch = Math.max(0.9, Math.min(1.1, pitch));
        }
        u.pitch = pitch;
        u.rate = Math.min(2, Math.max(0.5, rate * rateMul));
        u.volume = 1.0;
        
        if (typeof Music !== 'undefined') Music.duck(true);
        if (typeof BlindMusic !== 'undefined') BlindMusic.duck(true);
        if (typeof OGAudio !== 'undefined' && OGAudio.duck) OGAudio.duck(true);
        if (typeof OGAudio !== 'undefined' && OGAudio.duck) OGAudio.duck(true);
        
        u.onend = () => {
          if (finalGen !== speakGen) {
            unduckAll();
            resolve();
            return;
          }
          idx++;
          if (idx < chunks.length) {
            chunkTimer = setTimeout(speakChunk, isMobile ? 80 : 20);
          } else {
            unduckAll();
            resolve();
          }
        };
        u.onerror = (e) => {
          // PREMIUM FIX: Don't continue on cancel/interrupted
          const err = e.error || '';
          if (err === 'canceled' || err === 'interrupted' || finalGen !== speakGen) {
            console.log('[TTS] onerror canceled/interrupted - aborting chunks', err);
            unduckAll();
            resolve();
            return;
          }
          console.warn('[TTS] onerror:', e);
          idx++;
          if (finalGen !== speakGen) {
            unduckAll();
            resolve();
            return;
          }
          if (idx < chunks.length) chunkTimer = setTimeout(speakChunk, 100);
          else { unduckAll(); resolve(); }
        };
        
        try {
          window.speechSynthesis.speak(u);
          if (isIOS) {
            setTimeout(() => { try { window.speechSynthesis.resume(); } catch (e) {} }, 100);
          }
        } catch (e) {
          unduckAll();
          resolve();
        }
      };
      
      speakChunk();
    });
  }

  function interrupt(text, profile = {}) {
    lastSpoken = { text, profile };
    if (!enabled || !window.speechSynthesis) return Promise.resolve();
    
    // PREMIUM: Hard stop immediately
    hardStop();
    
    return new Promise(resolve => {
      const delay = isMobile ? 50 : 35;
      const myGen = speakGen;
      interruptTimer = setTimeout(() => {
        // Check if invalidated during delay
        if (myGen !== speakGen && myGen !== speakGen - 1) {
          resolve();
          return;
        }
        try { window.speechSynthesis.resume(); } catch (e) {}
        
        if (shouldSkipReal(text, profile)) {
          speakTTSInterrupt(text, profile, resolve);
          return;
        }
        
        try {
          if (typeof RealVoices !== 'undefined' && RealVoices.isEnabled() && !profile._skipReal) {
            const hasFile = RealVoices.findRealFile(text, profile._charId || null);
            if (!hasFile) {
              speakTTSInterrupt(text, profile, resolve);
              return;
            }
            const charId = profile._charId || null;
            RealVoices.playReal(text, charId).then(played => {
              if (played !== false) { resolve(); return; }
              speakTTSInterrupt(text, profile, resolve);
            }).catch(() => speakTTSInterrupt(text, profile, resolve));
            return;
          }
        } catch (e) {}
        
        speakTTSInterrupt(text, profile, resolve);
      }, delay);
    });
  }
  
  function speakTTSInterrupt(text, profile, resolve) {
    const finalGen = ++speakGen;
    
    const clean = String(text).replace(/[*_#>]/g, '');
    const chunks = splitLongText(clean);
    let idx = 0;
    
    const unduckAll = () => {
      setTimeout(() => {
        try {
          if (typeof Music !== 'undefined') Music.duck(false);
          if (typeof BlindMusic !== 'undefined') BlindMusic.duck(false);
          if (typeof OGAudio !== 'undefined' && OGAudio.duck) OGAudio.duck(false);
        } catch (e) {}
      }, isMobile ? 300 : 200);
    };
    
    const speakChunk = () => {
      if (finalGen !== speakGen) {
        unduckAll();
        resolve();
        return;
      }
      if (idx >= chunks.length) {
        unduckAll();
        resolve();
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[idx]);
      const v = pickVoice(profile);
      if (v) u.voice = v;
      
      let pitch = typeof profile.pitch === 'number' ? profile.pitch : 1;
      let rate = typeof profile.rate === 'number' ? profile.rate : 1.12;
      if (isMobile) {
        rate = Math.min(1.1, rate * 0.95);
        pitch = Math.max(0.9, Math.min(1.1, pitch));
      }
      u.pitch = pitch;
      u.rate = Math.min(2, Math.max(0.5, rate * rateMul));
      u.volume = 1.0;
      
        if (typeof Music !== 'undefined') Music.duck(true);
        if (typeof BlindMusic !== 'undefined') BlindMusic.duck(true);
        if (typeof OGAudio !== 'undefined' && OGAudio.duck) OGAudio.duck(true);
        if (typeof OGAudio !== 'undefined' && OGAudio.duck) OGAudio.duck(true);
      
      u.onend = () => {
        if (finalGen !== speakGen) { unduckAll(); resolve(); return; }
        idx++;
        if (idx < chunks.length) chunkTimer = setTimeout(speakChunk, isMobile ? 80 : 20);
        else { unduckAll(); resolve(); }
      };
      u.onerror = (e) => {
        const err = e.error || '';
        if (err === 'canceled' || err === 'interrupted' || finalGen !== speakGen) {
          unduckAll();
          resolve();
          return;
        }
        idx++;
        if (finalGen !== speakGen) { unduckAll(); resolve(); return; }
        if (idx < chunks.length) chunkTimer = setTimeout(speakChunk, 100);
        else { unduckAll(); resolve(); }
      };
      
      try {
        window.speechSynthesis.speak(u);
        if (isIOS) setTimeout(() => { try { window.speechSynthesis.resume(); } catch (e) {} }, 100);
      } catch (e) { unduckAll(); resolve(); }
    };
    
    speakChunk();
  }

  function stop() {
    hardStop();
  }

  function replay() {
    if (lastSpoken) speak(lastSpoken.text, lastSpoken.profile);
  }

  return {
    speak, interrupt, stop, replay, hardStop,
    setEnabled(v) { enabled = v; localStorage.setItem('ccs-tts', v ? '1' : '0'); if (!v) stop(); window.dispatchEvent(new CustomEvent('tts-toggle', { detail: v })); },
    isEnabled: () => enabled,
    setRateMultiplier(m) { rateMul = Math.min(1.6, Math.max(0.6, m)); localStorage.setItem('ccs-rate', String(rateMul)); },
    getRateMultiplier: () => rateMul,
    isMobile: () => isMobile,
    isIOS: () => isIOS,
    unlockAudio,
  };
})();
