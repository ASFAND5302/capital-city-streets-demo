/* ============================================================
   CAPITAL CITY STREETS — src/mainmenu.js
   Main menu layer (mirrors the original s-lobby screen):
   Start game / Continue / Settings / How to play / Credits / Quit.
   Keyboard-only: ↑↓ move (each option is spoken), Enter selects,
   Esc goes back, V toggles voice.
   ============================================================ */

const Menu = (() => {
  const $ = sel => document.querySelector(sel);
  const layer = () => document.getElementById('main-menu');

  const WELCOME = "Welcome to Capital City Streets. You are Stoneface — blind, relentless, brilliant. " +
    "Hunting the truth behind your sister Salena's murder. Smart Glasses are online. " +
    "Main menu. 8 options: Start game, Continue, Explore the city, Chapters, Settings, How to play, Credits, Quit. " +
    "Arrow keys to navigate, Enter to select. Press V to toggle narration.";
  const MENU_VOICE = { pitch: 1.15, rate: 1.12, slot: 0, _skipReal: true }; // FIXED: instant TTS for menu, no RealVoices lookup delay

  let welcomed = false;

  /* ---------- panel visibility ---------- */
  function showPanel(id) {
    ['#menu-list-wrap', '#settings-panel', '#credits-panel', '#quit-panel', '#chapters-panel'].forEach(s => {
      const el = $(s);
      if (el) el.hidden = (s !== id);
    });
  }

  function visiblePanel() {
    if (!$('#settings-panel').hidden) return $('#settings-panel');
    if (!$('#credits-panel').hidden) return $('#credits-panel');
    if (!$('#quit-panel').hidden) return $('#quit-panel');
    if (!$('#chapters-panel').hidden) return $('#chapters-panel');
    return $('#menu-list-wrap');
  }

  function focusables(panel) {
    return [...panel.querySelectorAll('button:not(:disabled), input, [tabindex="0"]')]
      .filter(el => el.offsetParent !== null);
  }

  /* ---------- voice bar sync ---------- */
  function paintVoice() {
    const on = TTS.isEnabled();
    $('#lv-label').textContent = on
      ? 'Smart Glasses narration on — press V to toggle'
      : 'Smart Glasses narration off — press V to toggle';
    const lb = $('#lv-btn');
    lb.textContent = on ? 'Voice: On' : 'Voice: Off';
    lb.setAttribute('aria-pressed', String(on));
    lb.dataset.speak = `Voice toggle. Currently ${on ? 'on' : 'off'}. Press Enter to turn narration ${on ? 'off' : 'on'}.`;
    const sv = $('#set-voice');
    sv.textContent = on ? 'On' : 'Off';
    sv.setAttribute('aria-pressed', String(on));
  }
  window.addEventListener('tts-toggle', paintVoice);

  /* ---------- open - BUG FIX v2.1: No lobby music overlap, clean start ---------- */
  function open() {
    layer().hidden = false;
    $('#game').hidden = true;
    showPanel('#menu-list-wrap');
    paintVoice();
    
    // BUG FIX v2.1: Hard stop all game music/ambience before playing menu music - fixes lobby bug
    try {
      if (typeof OGAudio !== 'undefined') {
        OGAudio.stopFight(true);
        OGAudio.stopAmbient(true);
        // Don't stop OGA music if already menu? Actually stop all to prevent overlap
        if (typeof Music !== 'undefined' && Music._lastMood !== 'menu') {
          OGAudio.stopMusic(true);
        }
      }
      if (typeof BlindMusic !== 'undefined') {
        BlindMusic.stop(true);
      }
      if (typeof PremiumAudio !== 'undefined') {
        PremiumAudio.stop();
      }
    } catch (e) {}
    
    // Mobile: unlock all audio contexts on first gesture
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      const unlockAll = () => {
        try { if (typeof TTS !== 'undefined' && TTS.unlockAudio) TTS.unlockAudio(); } catch (e) {}
        try { if (typeof RealVoices !== 'undefined' && RealVoices.unlockMobile) RealVoices.unlockMobile(); } catch (e) {}
        try { if (typeof OGAudio !== 'undefined' && OGAudio.unlockMobile) OGAudio.unlockMobile(); } catch (e) {}
        try { if (typeof BlindMusic !== 'undefined' && BlindMusic.unlockMobile) BlindMusic.unlockMobile(); } catch (e) {}
        try { if (typeof Music !== 'undefined' && Music._ctx && Music._ctx.state === 'suspended') Music._ctx.resume(); } catch (e) {}
        console.log('[Menu] Mobile audio unlock triggered');
      };
      document.addEventListener('touchstart', unlockAll, { once: true, passive: true });
      document.addEventListener('click', unlockAll, { once: true });
    }
    
    // BUG FIX v2.1: Only play menu if not already playing, low volume
    try {
      if (typeof Music !== 'undefined' && Music._lastMood !== 'menu') {
        Music.play('menu');
        Music.setAmb('crackle');
        console.log('[Menu] Menu music started - soft 56 BPM, no overlap');
      } else if (typeof Music !== 'undefined') {
        Music.setAmb('crackle');
      }
    } catch (e) {
      try { Music.play('menu'); Music.setAmb('crackle'); } catch (ee) {}
    }

    const cont = $('#menu-continue');
    if (Economy.hasSave()) {
      cont.disabled = false;
      cont.querySelector('.msub').textContent = 'Resume your last save';
      cont.dataset.speak = "Continue. Resume your last save. Stoneface's case file is waiting. Press Enter.";
    } else {
      cont.disabled = true;
      cont.querySelector('.msub').textContent = 'No saved case yet';
      cont.dataset.speak = 'Continue. No saved case found yet. Start a new game first.';
    }

    const hc = localStorage.getItem('ccs-hc') === '1';
    document.body.classList.toggle('high-contrast', hc);
    paintHC();

    const first = $('#lobby-menu .menu-btn');
    first?.focus();

    if (!welcomed) {
      const once = () => {
        if (!welcomed) {
          welcomed = true;
          // Mobile: ensure audio unlocked before TTS
          if (isMobile) {
            try { if (TTS.unlockAudio) TTS.unlockAudio(); } catch (e) {}
            try { if (RealVoices.unlockMobile) RealVoices.unlockMobile(); } catch (e) {}
            try { if (OGAudio.unlockMobile) OGAudio.unlockMobile(); } catch (e) {}
            try { if (BlindMusic.unlockMobile) BlindMusic.unlockMobile(); } catch (e) {}
          }
          TTS.interrupt(WELCOME, MENU_VOICE);
          paintVoice();
        }
      };
      document.addEventListener('keydown', once, { once: true });
      document.addEventListener('pointerdown', once, { once: true });
      document.addEventListener('touchstart', once, { once: true, passive: true });
      const cap = $('#lv-label');
      cap.textContent = 'Welcome to Capital City Streets — press any key for narration.';
    }
  }

  /* ---------- actions - BUG FIX v2.1: No double voice, no lobby music overlap ---------- */
  function doAction(action, el) {
    const hardStopAll = () => {
      try { if (typeof TTS !== 'undefined') { if (TTS.hardStop) TTS.hardStop(); else TTS.stop(); } } catch (e) {}
      try { if (typeof RealVoices !== 'undefined') RealVoices.stop(); } catch (e) {}
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    };
    const hardStopMusic = () => {
      try { if (typeof Music !== 'undefined') Music.stop(true); } catch (e) {}
      try { if (typeof OGAudio !== 'undefined') { OGAudio.stopMusic(false); OGAudio.stopAmbient(false); OGAudio.stopFight(true); } } catch (e) {}
      try { if (typeof BlindMusic !== 'undefined') BlindMusic.stop(true); } catch (e) {}
      try { if (typeof PremiumAudio !== 'undefined') PremiumAudio.stop(); } catch (e) {}
    };
    
    switch (action) {
      case 'start':
        hardStopAll();
        TTS.interrupt('Starting new case. Chapter One — The First Echo.', MENU_VOICE);
        hardStopMusic();
        Economy.reset();
        setTimeout(() => {
          hardStopAll();
          Game.play('intro');
        }, 600);
        break;
      case 'continue':
        if (Economy.hasSave() && Economy.load()) {
          const sc = Economy.state.scene;
          hardStopAll();
          TTS.interrupt('Resuming your case.', MENU_VOICE);
          hardStopMusic();
          setTimeout(() => {
            hardStopAll();
            Game.play(sc);
          }, 600);
        } else {
          TTS.interrupt('No saved case found yet.', MENU_VOICE);
        }
        break;
      case 'explore':
        hardStopAll();
        TTS.interrupt('Entering Capitol City. Free roam.', MENU_VOICE);
        hardStopMusic();
        setTimeout(() => {
          hardStopAll();
          CityMode.enter();
        }, 500);
        break;
      case 'chapters':
        showPanel('#chapters-panel');
        TTS.interrupt('Chapter select. Choose any chapter. You start with the credits and level that chapter expects.', MENU_VOICE);
        $('#chapters-panel .menu-btn')?.focus();
        break;
      case 'settings':
        showPanel('#settings-panel');
        syncSettings();
        TTS.interrupt('Settings. Use arrow keys to move between options.', MENU_VOICE);
        $('#settings-panel').querySelector('button, input')?.focus();
        break;
      case 'howto':
        hardStopAll();
        TTS.interrupt('How to play.', MENU_VOICE);
        hardStopMusic();
        setTimeout(() => {
          hardStopAll();
          Game.play('help');
        }, 500);
        break;
      case 'credits':
        showPanel('#credits-panel');
        TTS.interrupt('Credits. Meet the crew behind Capital City Streets. Arrow keys to move through the list.', MENU_VOICE);
        $('#credits-panel .back-btn')?.focus();
        break;
      case 'quit':
        showPanel('#quit-panel');
        TTS.interrupt('Quit game. It is now safe to close this tab. Thank you for playing Capital City Streets.', MENU_VOICE);
        break;
      case 'back-main':
        showPanel('#menu-list-wrap');
        TTS.interrupt('Main menu.', MENU_VOICE);
        $('#lobby-menu .menu-btn')?.focus();
        break;
    }
  }

  /* ---------- settings helpers ---------- */
  function syncSettings() {
    $('#set-rate').value = Math.round(TTS.getRateMultiplier() * 100);
    $('#set-rate-val').textContent = Math.round(TTS.getRateMultiplier() * 100) + '%';
    paintVoice(); paintHC(); paintOGA();
  }
  function paintHC() {
    const on = document.body.classList.contains('high-contrast');
    const b = $('#set-hc');
    b.textContent = on ? 'On' : 'Off';
    b.setAttribute('aria-pressed', String(on));
    b.dataset.speak = `High contrast mode. Currently ${on ? 'on' : 'off'}. Press Enter to toggle.`;
  }
  function paintOGA() {
    try {
      const on = typeof OGAudio !== 'undefined' ? OGAudio.isEnabled() : true;
      const b = $('#set-oga');
      if (b) {
        b.textContent = on ? 'On' : 'Off';
        b.setAttribute('aria-pressed', String(on));
        b.dataset.speak = `Blind friendly real audio from Open Game Art. Currently ${on ? 'on' : 'off'}. Real noir jazz and punch sounds for blind immersion. Press Enter to toggle.`;
      }
      const mus = $('#set-oga-mus');
      const musVal = $('#set-oga-mus-val');
      if (mus) {
        const v = parseFloat(localStorage.getItem('ccs-oga-musvol') ?? '0.7') * 100;
        mus.value = Math.round(v);
        musVal.textContent = Math.round(v) + '%';
      }
      const sfx = $('#set-oga-sfx');
      const sfxVal = $('#set-oga-sfx-val');
      if (sfx) {
        const v = parseFloat(localStorage.getItem('ccs-oga-sfxvol') ?? '0.9') * 100;
        sfx.value = Math.round(v);
        sfxVal.textContent = Math.round(v) + '%';
      }
      // Real voices toggle
      const rv = typeof RealVoices !== 'undefined' ? RealVoices.isEnabled() : false;
      const rvBtn = $('#set-realvoices');
      if (rvBtn) {
        rvBtn.textContent = rv ? 'On' : 'Off';
        rvBtn.setAttribute('aria-pressed', String(rv));
        rvBtn.dataset.speak = `Real human voices. Currently ${rv ? 'on. Real human voices, not computer. Stoneface, Glasses, Salena have real voices.' : 'off. Using computer TTS voices.'} Press Enter to toggle.`;
      }
      // Realistic sounds toggle - Mixkit/OGA
      const rs = typeof Realistic !== 'undefined' ? Realistic.isEnabled() : true;
      const rsBtn = $('#set-realistic');
      if (rsBtn) {
        rsBtn.textContent = rs ? 'On' : 'Off';
        rsBtn.setAttribute('aria-pressed', String(rs));
        rsBtn.dataset.speak = `Realistic sounds from Mixkit and OpenGameArt. Currently ${rs ? 'on. Real footsteps, punches, doors, city ambience.' : 'off.'} Press Enter to toggle.`;
      }
      const rvol = $('#set-real-vol');
      const rvolVal = $('#set-real-vol-val');
      if (rvol) {
        const v = parseFloat(localStorage.getItem('ccs-real-vol') ?? '0.9') * 100;
        rvol.value = Math.round(v);
        rvolVal.textContent = Math.round(v) + '%';
      }
      // Professional Blind Music Vibe - high level
      const bm = typeof BlindMusic !== 'undefined' ? true : false;
      const bmBtn = $('#set-blindmusic');
      if (bmBtn) {
        const isOn = localStorage.getItem('ccs-blindmusic') !== '0';
        bmBtn.textContent = isOn ? 'On' : 'Off';
        bmBtn.setAttribute('aria-pressed', String(isOn));
        bmBtn.dataset.speak = `Professional blind music vibe. Currently ${isOn ? 'on. Leitmotifs for Stoneface Salena Glasses, vertical remixing with 3 layers, stingers for events, sonar enhanced listening mode like The Last of Us Part 2.' : 'off.'} Press Enter to toggle.`;
      }
      const bvol = $('#set-blind-vol');
      const bvolVal = $('#set-blind-vol-val');
      if (bvol) {
        const v = parseFloat(localStorage.getItem('ccs-blindvol') ?? '0.6') * 100;
        bvol.value = Math.round(v);
        bvolVal.textContent = Math.round(v) + '%';
      }
      const sonarBtn = $('#set-sonar');
      if (sonarBtn) {
        const isOn = typeof BlindMusic !== 'undefined' ? BlindMusic.isEnhancedListening() : false;
        sonarBtn.textContent = isOn ? 'On' : 'Off';
        sonarBtn.setAttribute('aria-pressed', String(isOn));
        sonarBtn.dataset.speak = `Enhanced listening mode sonar. Currently ${isOn ? 'on. Press E in game to sonar ping nearby characters with leitmotifs and spatial audio.' : 'off. When on, press E to sonar ping.'} Press Enter to toggle.`;
      }
    } catch (e) {}
  }

  /* ---------- wiring ---------- */
  function init() {
    // Click / Enter activation + touch for mobile
    const handleAction = (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn && !btn.disabled) doAction(btn.dataset.action, btn);
      const chBtn = e.target.closest('[data-chapter]');
      if (chBtn) startChapter(Number(chBtn.dataset.chapter));
      const vbtn = e.target.closest('#lv-btn');
      if (vbtn) TTS.setEnabled(!TTS.isEnabled());
    };
    layer().addEventListener('click', handleAction);
    layer().addEventListener('touchend', (e) => {
      // Prevent double trigger on mobile - only handle if not already clicked
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        // Touchend for better mobile response
        const btn = e.target.closest('[data-action], [data-chapter], #lv-btn');
        if (btn) {
          e.preventDefault();
          handleAction(e);
        }
      }
    }, { passive: false });

    // PREMIUM FIX: Speak on focus - single voice guarantee, hard stop before new
    layer().addEventListener('focusin', e => {
      const t = e.target.closest('[data-speak]');
      if (t) {
        SFX.play('tick');
        try { if (typeof RealVoices !== 'undefined') RealVoices.stop(); } catch (err) {}
        try { if (typeof TTS !== 'undefined' && TTS.hardStop) TTS.hardStop(); } catch (err) {}
        try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (err) {}
        TTS.interrupt(t.dataset.speak, MENU_VOICE);
      }
    });

    // Arrow-key navigation between focusable elements of the visible panel
    document.addEventListener('keydown', e => {
      if (layer().hidden) return;
      if (e.key === 'Escape') {
        if (!visiblePanel().id.includes('menu-list')) {
          e.preventDefault();
          doAction('back-main');
        }
        return;
      }
      const down = ['ArrowDown', 's', 'S'].includes(e.key);
      const up = ['ArrowUp', 'w', 'W'].includes(e.key);
      if (!down && !up) return;
      // Let the range slider keep its arrows when focused
      if (document.activeElement?.type === 'range') return;
      e.preventDefault();
      const list = focusables(visiblePanel());
      if (!list.length) return;
      const i = list.indexOf(document.activeElement);
      const next = down ? (i + 1 < list.length ? i + 1 : 0)
                        : (i - 1 >= 0 ? i - 1 : list.length - 1);
      list[next].focus();
    });

    // Settings controls
    $('#set-voice').addEventListener('click', () => TTS.setEnabled(!TTS.isEnabled()));
    $('#set-hc').addEventListener('click', () => {
      const on = !document.body.classList.contains('high-contrast');
      document.body.classList.toggle('high-contrast', on);
      localStorage.setItem('ccs-hc', on ? '1' : '0');
      paintHC();
      TTS.interrupt(`High contrast ${on ? 'on' : 'off'}.`, MENU_VOICE);
    });
    // Blind-friendly OGA real audio toggle
    const ogaBtn = $('#set-oga');
    if (ogaBtn) ogaBtn.addEventListener('click', () => {
      const on = typeof OGAudio !== 'undefined' ? !OGAudio.isEnabled() : true;
      if (typeof OGAudio !== 'undefined') OGAudio.setEnabled(on);
      paintOGA();
      TTS.interrupt(`Blind friendly real audio ${on ? 'on. Real noir jazz and punch sounds from OpenGameArt.org for blind immersion.' : 'off. Using generative sounds.'}`, MENU_VOICE);
      if (on && typeof OGAudio !== 'undefined') OGAudio.preloadSFX();
    });
    // Real human voices toggle - not computer
    const rvBtn = $('#set-realvoices');
    if (rvBtn) rvBtn.addEventListener('click', () => {
      const on = typeof RealVoices !== 'undefined' ? !RealVoices.isEnabled() : true;
      if (typeof RealVoices !== 'undefined') RealVoices.setEnabled(on);
      paintOGA();
      TTS.interrupt(`Real human voices ${on ? 'on. Real human voices, not computer. Stoneface, Smart Glasses, Salena now sound like real people, not computer.' : 'off. Using computer TTS voices.'}`, MENU_VOICE);
    });
    // Realistic sounds toggle - Mixkit/OGA CC0
    const rsBtn = $('#set-realistic');
    if (rsBtn) rsBtn.addEventListener('click', () => {
      const on = typeof Realistic !== 'undefined' ? !Realistic.isEnabled() : true;
      if (typeof Realistic !== 'undefined') Realistic.setEnabled(on);
      paintOGA();
      TTS.interrupt(`Realistic sounds ${on ? 'on. Real footsteps from grass stone sand, punches strong fast, doors, city rain, coins. CC0 from Mixkit and OpenGameArt.' : 'off.'}`, MENU_VOICE);
      if (on && typeof Realistic !== 'undefined') Realistic.preload();
    });
    const realVol = $('#set-real-vol');
    const realVolVal = $('#set-real-vol-val');
    if (realVol) {
      realVol.addEventListener('input', e => { realVolVal.textContent = e.target.value + '%'; });
      realVol.addEventListener('change', e => {
        if (typeof Realistic !== 'undefined') Realistic.setVolume(e.target.value / 100);
        TTS.interrupt(`Realistic volume ${e.target.value} percent.`, MENU_VOICE);
      });
    }
    // Professional Blind Music toggle
    const blindBtn = $('#set-blindmusic');
    if (blindBtn) {
      blindBtn.addEventListener('click', () => {
        const isOn = localStorage.getItem('ccs-blindmusic') !== '0';
        const newOn = !isOn;
        localStorage.setItem('ccs-blindmusic', newOn ? '1' : '0');
        blindBtn.textContent = newOn ? 'On' : 'Off';
        blindBtn.setAttribute('aria-pressed', String(newOn));
        if (typeof BlindMusic !== 'undefined') {
          if (newOn) BlindMusic.playBase('noir_soft');
          else BlindMusic.stop();
        }
        paintOGA();
        TTS.interrupt(`Professional blind music vibe ${newOn ? 'on. Leitmotifs for Stoneface Salena Glasses, vertical remixing with 3 layers, stingers for events, sonar like The Last of Us Part 2, real noir jazz from Pixabay CC0 and OpenGameArt.' : 'off.'}`, MENU_VOICE);
      });
    }
    const blindVol = $('#set-blind-vol');
    const blindVolVal = $('#set-blind-vol-val');
    if (blindVol) {
      blindVol.addEventListener('input', e => { blindVolVal.textContent = e.target.value + '%'; });
      blindVol.addEventListener('change', e => {
        if (typeof BlindMusic !== 'undefined') BlindMusic.setVolume(e.target.value / 100);
        TTS.interrupt(`Blind music volume ${e.target.value} percent. Professional blind vibe with leitmotifs.`, MENU_VOICE);
      });
    }
    const sonarBtn = $('#set-sonar');
    if (sonarBtn) {
      sonarBtn.addEventListener('click', () => {
        const isOn = typeof BlindMusic !== 'undefined' ? BlindMusic.isEnhancedListening() : false;
        const newOn = !isOn;
        if (typeof BlindMusic !== 'undefined') BlindMusic.setEnhancedListening(newOn);
        if (typeof Music !== 'undefined') Music.setEnhancedListening(newOn);
        sonarBtn.textContent = newOn ? 'On' : 'Off';
        sonarBtn.setAttribute('aria-pressed', String(newOn));
        TTS.interrupt(`Enhanced listening sonar ${newOn ? 'on. Press E in game to ping nearby characters with leitmotifs and spatial audio. Like The Last of Us Part 2.' : 'off.'}`, MENU_VOICE);
      });
    }
    $('#set-rate').addEventListener('input', e => {
      $('#set-rate-val').textContent = e.target.value + '%';
    });
    $('#set-rate').addEventListener('change', e => {
      TTS.setRateMultiplier(Number(e.target.value) / 100);
      TTS.interrupt(`Narration speed ${e.target.value} percent. This is how fast I will speak.`, MENU_VOICE);
    });
    const initVol = (id, valId, key) => {
      const el = $(id), lab = $(valId);
      el.value = Math.round((parseFloat(localStorage.getItem(key) ?? '1') || 1) * 100);
      lab.textContent = el.value + '%';
      el.addEventListener('input', e => { lab.textContent = e.target.value + '%'; });
      return el;
    };
    initVol('#set-mus', '#set-mus-val', 'ccs-musvol').addEventListener('change', e => {
      Music.setMusicVol(e.target.value / 100);
      TTS.interrupt(`Music ${e.target.value} percent.`, MENU_VOICE);
    });
    initVol('#set-amb', '#set-amb-val', 'ccs-ambvol').addEventListener('change', e => {
      Music.setAmbVol(e.target.value / 100);
      TTS.interrupt(`Ambience ${e.target.value} percent.`, MENU_VOICE);
    });
    // OGA real audio volumes
    const ogaMus = $('#set-oga-mus');
    const ogaMusVal = $('#set-oga-mus-val');
    if (ogaMus) {
      ogaMus.addEventListener('input', e => { ogaMusVal.textContent = e.target.value + '%'; });
      ogaMus.addEventListener('change', e => {
        if (typeof OGAudio !== 'undefined') OGAudio.setMusicVol(e.target.value / 100);
        TTS.interrupt(`Real noir music ${e.target.value} percent. From OpenGameArt.org`, MENU_VOICE);
      });
    }
    const ogaSfx = $('#set-oga-sfx');
    const ogaSfxVal = $('#set-oga-sfx-val');
    if (ogaSfx) {
      ogaSfx.addEventListener('input', e => { ogaSfxVal.textContent = e.target.value + '%'; });
      ogaSfx.addEventListener('change', e => {
        if (typeof OGAudio !== 'undefined') OGAudio.setSFXVol(e.target.value / 100);
        TTS.interrupt(`Real punch and footsteps ${e.target.value} percent.`, MENU_VOICE);
      });
    }

    // Credits rows: Enter re-speaks
    document.querySelectorAll('.credit-row').forEach(row => {
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          TTS.interrupt(row.dataset.speak, MENU_VOICE);
        }
      });
    });
  }

  /* ---------- chapter select: jump anywhere with the right state ---------- */
const CHAPTERS = {
    1: { entry: 'intro',     cc: 0,    level: 1, flags: [] },
    2: { entry: 'ch2_drive', cc: 3500, level: 2, flags: ['hasDrive'] },
    3: { entry: 'c3_open',   cc: 5000, level: 3, flags: ['hasDrive', 'harborJoined'] },
    4: { entry: 'c4_open',   cc: 7000, level: 4, flags: ['hasDrive', 'harborJoined', 'lv4clue'] },
    5: { entry: 'c5_open',   cc: 9000, level: 5, flags: ['hasDrive', 'harborJoined', 'lv4clue', 'coords', 'seraBond'] },
  };
  function startChapter(n) {
    const c = CHAPTERS[n];
    if (!c) return;
    const hardStopAll = () => {
      try { if (typeof TTS !== 'undefined') { if (TTS.hardStop) TTS.hardStop(); else TTS.stop(); } } catch (e) {}
      try { if (typeof RealVoices !== 'undefined') RealVoices.stop(); } catch (e) {}
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    };
    const hardStopMusic = () => {
      try { if (typeof Music !== 'undefined') Music.stop(true); } catch (e) {}
      try { if (typeof OGAudio !== 'undefined') { OGAudio.stopMusic(false); OGAudio.stopAmbient(false); OGAudio.stopFight(true); } } catch (e) {}
      try { if (typeof BlindMusic !== 'undefined') BlindMusic.stop(true); } catch (e) {}
      try { if (typeof PremiumAudio !== 'undefined') PremiumAudio.stop(); } catch (e) {}
    };
    hardStopAll();
    hardStopMusic();
    Economy.reset();
    Economy.apply({ cc: c.cc, level: c.level, setFlags: c.flags });
    TTS.interrupt(`Chapter ${n}. Rolling the opening scene.`, MENU_VOICE);
    setTimeout(() => {
      hardStopAll();
      Game.play(c.entry, true);
    }, 600);
  }

  return {
    async start() {
      init();
      try { if (typeof RealVoices !== 'undefined') RealVoices.init(); } catch (e) {}
      try { if (typeof OGAudio !== 'undefined') OGAudio.init(); } catch (e) {}
      try { if (typeof Realistic !== 'undefined') Realistic.init(); } catch (e) {}
      try { if (typeof BlindMusic !== "undefined") BlindMusic.init(); } catch (e) {}
      try { if (typeof PremiumAudio !== "undefined") PremiumAudio.init(); } catch (e) {}
      await Game.boot();
      open();
      // Professional blind game: play soft base noir on menu
      try {
        if (typeof BlindMusic !== 'undefined') {
          BlindMusic.playBase('noir_soft');
          BlindMusic.setIntensity(0); // menu soft calm
        }
      } catch (e) {}
    },
    open,
  };
})();

  /* Paschall Game Hub splash: any key / tap dismisses; auto-fades after 6s */
(() => {
  const sp = document.getElementById('splash');
  if (!sp) return;
  const go = (ev) => {
    if (sp.classList.contains('gone')) return;
    // the dismissing key/tap only clears the splash — the menu answers the next one
    if (ev) { ev.stopImmediatePropagation(); ev.preventDefault(); }
    sp.classList.add('gone');
    setTimeout(() => sp.remove(), 900);
  };
  document.addEventListener('keydown', go, { once: true, capture: true });
  document.addEventListener('pointerdown', go, { once: true, capture: true });
  setTimeout(go, 6000);
})();

Menu.start();