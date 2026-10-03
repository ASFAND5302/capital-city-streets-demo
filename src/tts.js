/* ============================================================
   CAPITAL CITY STREETS — src/tts.js
   v4.0 NARRATOR FIX: every arrow press announces, never freezes.
   - cancel→speak always separated by a delay (Chrome drops
     utterances spoken immediately after cancel — that was the
     "arrows move but don't announce" bug)
   - watchdog timeout on every utterance (a stuck speech engine
     can never freeze the game again — the ep3→ep4 shutdown)
   - gender-aware voices (Bonnie finally sounds female)
   ============================================================ */

const TTS = (() => {
  let enabled = localStorage.getItem('ccs-tts') !== '0';
  let voices = [];
  let lastSpoken = null;
  let interruptTimer = null;
  let chunkTimer = null;
  let watchdogTimer = null;
  let rateMul = parseFloat(localStorage.getItem('ccs-rate') || '1') || 1;
  let isSpeakingReal = false;
  let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  let isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  let voicesLoaded = false;
  let audioUnlocked = false;
  let speakGen = 0; // generation token: each new request invalidates older ones
  let assigned = {};

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

  /* ---------- voice picking (gender-aware) ---------- */
  const FEMALE_HINTS = ['female', 'woman', 'girl', 'aria', 'jenny', 'samantha', 'zira',
    'susan', 'karen', 'moira', 'tessa', 'veena', 'fiona', 'kate', 'serena', 'kathy',
    'shelley', 'zira', 'linda', 'heather', 'siri_female', 'female_'];
  const MALE_HINTS = ['male_', '_male', 'david', 'guy', 'daniel', 'alex ', 'fred',
    'oliver', 'matthew', 'george', 'aaron', 'davis', 'thomas', 'paul', 'mark',
    'microsoft guy', 'microsoft davis', 'google uk english male'];

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

  function genderBonus(voice, gender) {
    if (!gender) return 0;
    const name = (voice.name || '').toLowerCase();
    const isF = FEMALE_HINTS.some(h => name.includes(h));
    const isM = MALE_HINTS.some(h => name.includes(h));
    if (gender === 'female') return (isF ? 140 : 0) + (isM ? -120 : 0);
    if (gender === 'male') return (isM ? 140 : 0) + (isF ? -120 : 0);
    return 0;
  }

  function pickVoice(profile) {
    profile = profile || {};
    if (!voices.length) {
      if (isMobile && !voicesLoaded) loadVoices();
      return null;
    }
    const en = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
    const pool = en.length ? en : voices;
    const gender = profile.gender || null;
    const sortedPool = [...pool].sort((a, b) =>
      (scoreNatural(b) + genderBonus(b, gender)) - (scoreNatural(a) + genderBonus(a, gender)));
    const slot = (typeof profile.slot === 'number') ? profile.slot : 0;
    if (assigned[slot] && pool.includes(assigned[slot])) return assigned[slot];
    // gendered slots prefer the top gender-matching third of the pool
    let candidates = sortedPool;
    if (gender) {
      const matched = sortedPool.filter(v => genderBonus(v, gender) > 0);
      if (matched.length) candidates = matched;
    }
    const naturalCount = isMobile ? Math.min(3, candidates.length) : Math.max(3, Math.ceil(candidates.length * 0.6));
    const naturalPool = candidates.slice(0, Math.max(1, naturalCount));
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
    const uiKeywords = ['options available', 'option 1:', 'arrow keys', 'press enter', 'main menu',
      'settings.', 'credits.', 'how to play', 'voice toggle', 'currently', 'percent',
      'high contrast', 'real human voices', 'realistic sounds', 'blind friendly', 'real noir',
      'real punch', 'starting new case', 'resuming your case', 'entering capitol',
      'chapter select', 'use arrow keys to move', 'enhanced listening', 'sonar ping',
      'rolling the opening', 'options again', 'case journal', 'clues found', 'beacon:'];
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

  function duckAll(on) {
    try {
      if (typeof Music !== 'undefined') Music.duck(on);
      if (typeof BlindMusic !== 'undefined') BlindMusic.duck(on);
      if (typeof OGAudio !== 'undefined' && OGAudio.duck) OGAudio.duck(on);
    } catch (e) {}
  }

  /* v4.0: single clean stop. No pause/resume dance — that dance left
     Chrome's speech engine stuck and dropped the next utterance. */
  function hardStop() {
    speakGen++; // invalidate everything pending
    clearTimeout(interruptTimer); interruptTimer = null;
    clearTimeout(chunkTimer); chunkTimer = null;
    clearTimeout(watchdogTimer); watchdogTimer = null;
    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch (e) {}
    try { if (typeof RealVoices !== 'undefined') RealVoices.stop(); } catch (e) {}
    isSpeakingReal = false;
    duckAll(false);
  }

  /* Speak pre-cleaned text via speechSynthesis. gen = our generation token.
     ALWAYS resolves — watchdog guarantees the game can never hang. */
  function speakUtterances(text, profile, gen, resolve) {
    const chunks = splitLongText(String(text).replace(/[*_#>]/g, ''));
    let idx = 0;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(chunkTimer); chunkTimer = null;
      clearTimeout(watchdogTimer); watchdogTimer = null;
      setTimeout(() => duckAll(false), isMobile ? 300 : 200);
      resolve();
    };

    // Watchdog: speech engines stall (tab switch, long sessions, mobile).
    // Never leave the story awaiting forever — resolve and move on.
    const watchMs = Math.max(6000, Math.min(40000, 4000 + String(text).length * 260));
    clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(() => {
      console.warn('[TTS] Watchdog fired — speech engine stalled, releasing story');
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
      finish();
    }, watchMs);

    const speakChunk = () => {
      if (done) return;
      if (gen !== speakGen) { finish(); return; } // superseded by newer voice
      if (idx >= chunks.length) { finish(); return; }
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
      duckAll(true);

      u.onend = () => {
        if (done) return;
        if (gen !== speakGen) { finish(); return; }
        idx++;
        if (idx < chunks.length) chunkTimer = setTimeout(speakChunk, isMobile ? 80 : 20);
        else finish();
      };
      u.onerror = (e) => {
        if (done) return;
        const err = (e && e.error) || '';
        if (err === 'canceled' || err === 'interrupted' || gen !== speakGen) { finish(); return; }
        console.warn('[TTS] chunk error, continuing:', err);
        idx++;
        if (gen !== speakGen) { finish(); return; }
        if (idx < chunks.length) chunkTimer = setTimeout(speakChunk, 100);
        else finish();
      };
      try {
        window.speechSynthesis.speak(u);
        if (isIOS) setTimeout(() => { try { window.speechSynthesis.resume(); } catch (e) {} }, 100);
      } catch (e) { finish(); }
    };

    speakChunk();
  }

  /* v4.0 core: stop everything, wait for the engine to settle, THEN speak.
     That settle-delay is the whole narrator fix. */
  function queueSpeak(text, profile, delayMs) {
    profile = profile || {};
    lastSpoken = { text, profile };
    if (!enabled || !window.speechSynthesis || !('SpeechSynthesisUtterance' in window)) {
      return Promise.resolve();
    }
    if (isMobile && !voicesLoaded) loadVoices();
    hardStop();
    const gen = speakGen;
    return new Promise(resolve => {
      clearTimeout(interruptTimer);
      interruptTimer = setTimeout(() => {
        interruptTimer = null;
        if (gen !== speakGen) { resolve(); return; } // a newer request won
        try { window.speechSynthesis.resume(); } catch (e) {}
        // Real human voice first (story lines), TTS fallback
        if (!shouldSkipReal(text, profile)) {
          try {
            if (typeof RealVoices !== 'undefined' && RealVoices.isEnabled() && !profile._skipReal) {
              const charId = profile._charId || null;
              if (RealVoices.findRealFile(text, charId)) {
                isSpeakingReal = true;
                Promise.resolve(RealVoices.playReal(text, charId)).then(played => {
                  isSpeakingReal = false;
                  if (gen !== speakGen) { resolve(); return; }
                  if (played !== false) { duckAll(false); resolve(); return; }
                  speakUtterances(text, profile, gen, resolve);
                }).catch(() => {
                  isSpeakingReal = false;
                  if (gen !== speakGen) { resolve(); return; }
                  speakUtterances(text, profile, gen, resolve);
                });
                return;
              }
            }
          } catch (e) { console.warn('[TTS] RealVoices failed, fallback:', e); }
        }
        speakUtterances(text, profile, gen, resolve);
      }, delayMs);
    });
  }

  // Full line (waits for engine settle so long story lines never drop)
  function speak(text, profile) {
    return queueSpeak(text, profile || {}, isMobile ? 140 : 70);
  }

  // Instant UI speech (arrows, menus — short settle, still never dropped)
  function interrupt(text, profile) {
    return queueSpeak(text, profile || {}, isMobile ? 90 : 45);
  }

  function stop() { hardStop(); }

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
