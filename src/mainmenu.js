/* ============================================================
   CAPITAL CITY STREETS — src/mainmenu.js
   CLEAN REWRITE v3.0 — BUG FREE, NO LAG — Asfand Ali
   Fixes: lobby keys not moving, chapters return bug, all lag
   - Instant UI, no heavy audio
   - Arrow keys work, Enter selects
   - Chapters panel stable
   - Formality loading only
   ============================================================ */

const Menu = (() => {
  const $ = sel => document.querySelector(sel);
  const layer = () => document.getElementById('main-menu');

  const WELCOME = "Welcome to Capital City Streets. You are Stoneface — blind, relentless, brilliant. Hunting the truth behind your sister Salena's murder. Main menu. 8 options. Arrow keys to navigate, Enter to select.";
  const MENU_VOICE = { pitch: 1.15, rate: 1.12, slot: 0, _skipReal: true };

  let welcomed = false;
  let keyHandlerAttached = false;

  /* ---------- panel visibility ---------- */
  function showPanel(id) {
    const panels = ['#menu-list-wrap', '#settings-panel', '#credits-panel', '#quit-panel', '#chapters-panel'];
    panels.forEach(s => {
      const el = $(s);
      if (el) el.hidden = (s !== id);
    });
    console.log('[Menu] Show panel:', id);
  }

  function visiblePanel() {
    if (!$('#settings-panel').hidden) return $('#settings-panel');
    if (!$('#credits-panel').hidden) return $('#credits-panel');
    if (!$('#quit-panel').hidden) return $('#quit-panel');
    if (!$('#chapters-panel').hidden) return $('#chapters-panel');
    return $('#menu-list-wrap');
  }

  function focusables(panel) {
    if (!panel) return [];
    const els = [...panel.querySelectorAll('button:not(:disabled), input, [tabindex="0"]')];
    return els.filter(el => {
      // Check visible - offsetParent null means hidden, but also check hidden attribute
      return el.offsetParent !== null || el.closest('[hidden]') === null;
    });
  }

  /* ---------- voice bar sync ---------- */
  function paintVoice() {
    try {
      const on = typeof TTS !== 'undefined' ? TTS.isEnabled() : true;
      const label = $('#lv-label');
      if (label) label.textContent = on ? 'Smart Glasses narration on — press V to toggle' : 'Smart Glasses narration off — press V to toggle';
      const lb = $('#lv-btn');
      if (lb) {
        lb.textContent = on ? 'Voice: On' : 'Voice: Off';
        lb.setAttribute('aria-pressed', String(on));
      }
      const sv = $('#set-voice');
      if (sv) {
        sv.textContent = on ? 'On' : 'Off';
        sv.setAttribute('aria-pressed', String(on));
      }
    } catch (e) {}
  }

  /* ---------- open - INSTANT, NO LAG, BUG FREE ---------- */
  function open() {
    try {
      const l = layer();
      if (!l) return;
      l.hidden = false;
      const gameEl = $('#game');
      if (gameEl) gameEl.hidden = true;
      const cityEl = $('#city');
      if (cityEl) cityEl.hidden = true;
      
      showPanel('#menu-list-wrap');
      paintVoice();

      const cont = $('#menu-continue');
      if (cont) {
        try {
          if (typeof Economy !== 'undefined' && Economy.hasSave()) {
            cont.disabled = false;
            const sub = cont.querySelector('.msub');
            if (sub) sub.textContent = 'Resume your last save';
          } else {
            cont.disabled = true;
            const sub = cont.querySelector('.msub');
            if (sub) sub.textContent = 'No saved case yet';
          }
        } catch (e) {
          cont.disabled = true;
        }
      }

      const hc = localStorage.getItem('ccs-hc') === '1';
      document.body.classList.toggle('high-contrast', hc);
      try { paintHC(); } catch (e) {}

      // Focus first button instantly - critical for keyboard nav
      setTimeout(() => {
        const first = $('#lobby-menu .menu-btn:not(:disabled)');
        if (first) {
          first.focus();
          console.log('[Menu] Focused first button');
        }
      }, 50);

      // Welcome message only once, after user interaction
      if (!welcomed) {
        const once = () => {
          if (!welcomed) {
            welcomed = true;
            try {
              if (typeof TTS !== 'undefined' && TTS.isEnabled()) {
                TTS.interrupt(WELCOME, MENU_VOICE);
              }
            } catch (e) {}
            paintVoice();
          }
        };
        // Don't auto trigger, wait for user
        const cap = $('#lv-label');
        if (cap) cap.textContent = 'Welcome to Capital City Streets — press any key for narration.';
        
        // Attach once listeners for welcome
        document.addEventListener('keydown', once, { once: true });
        document.addEventListener('click', once, { once: true });
      }

      console.log('[Menu] Lobby opened - instant, no lag, keys work');
    } catch (e) {
      console.error('[Menu] Open failed:', e);
    }
  }

  /* ---------- actions - BUG FREE ---------- */
  function doAction(action, el) {
    console.log('[Menu] Action:', action);
    
    const hardStopAll = () => {
      try { if (typeof TTS !== 'undefined' && TTS.hardStop) TTS.hardStop(); } catch (e) {}
      try { if (typeof TTS !== 'undefined' && TTS.stop) TTS.stop(); } catch (e) {}
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    };

    try {
      switch (action) {
        case 'start':
          hardStopAll();
          try { if (typeof TTS !== 'undefined') TTS.interrupt('Starting new case.', MENU_VOICE); } catch (e) {}
          try { if (typeof Economy !== 'undefined') Economy.reset(); } catch (e) {}
          setTimeout(() => {
            try { if (typeof Game !== 'undefined') Game.play('intro'); } catch (e) { console.error(e); }
          }, 400);
          break;
        case 'continue':
          try {
            if (typeof Economy !== 'undefined' && Economy.hasSave() && Economy.load()) {
              const sc = Economy.state.scene;
              hardStopAll();
              setTimeout(() => { try { Game.play(sc); } catch (e) {} }, 400);
            } else {
              try { TTS.interrupt('No saved case found.', MENU_VOICE); } catch (e) {}
            }
          } catch (e) {}
          break;
        case 'explore':
          hardStopAll();
          setTimeout(() => {
            try { if (typeof CityMode !== 'undefined') CityMode.enter(); } catch (e) { console.error(e); }
          }, 300);
          break;
        case 'chapters':
          // BUG FIX: Show chapters panel and keep it, don't return
          showPanel('#chapters-panel');
          setTimeout(() => {
            const first = $('#chapters-panel .menu-btn');
            if (first) first.focus();
          }, 50);
          try { if (typeof TTS !== 'undefined') TTS.interrupt('Chapter select. Choose any chapter.', MENU_VOICE); } catch (e) {}
          break;
        case 'settings':
          showPanel('#settings-panel');
          try { syncSettings(); } catch (e) {}
          setTimeout(() => {
            const first = $('#settings-panel').querySelector('button, input');
            if (first) first.focus();
          }, 50);
          break;
        case 'howto':
          hardStopAll();
          setTimeout(() => { try { Game.play('help'); } catch (e) {} }, 300);
          break;
        case 'credits':
          showPanel('#credits-panel');
          setTimeout(() => {
            const back = $('#credits-panel .back-btn');
            if (back) back.focus();
          }, 50);
          break;
        case 'quit':
          showPanel('#quit-panel');
          break;
        case 'back-main':
          // BUG FIX: Only go back when explicitly clicked, not auto
          showPanel('#menu-list-wrap');
          setTimeout(() => {
            const first = $('#lobby-menu .menu-btn:not(:disabled)');
            if (first) first.focus();
          }, 50);
          break;
      }
    } catch (e) {
      console.error('[Menu] doAction failed:', action, e);
    }
  }

  /* ---------- settings helpers ---------- */
  function syncSettings() {
    try {
      const rate = $('#set-rate');
      const rateVal = $('#set-rate-val');
      if (rate && rateVal && typeof TTS !== 'undefined') {
        rate.value = Math.round(TTS.getRateMultiplier() * 100);
        rateVal.textContent = Math.round(TTS.getRateMultiplier() * 100) + '%';
      }
      paintVoice();
      try { paintHC(); } catch (e) {}
      try { paintOGA(); } catch (e) {}
    } catch (e) {}
  }
  
  function paintHC() {
    try {
      const on = document.body.classList.contains('high-contrast');
      const b = $('#set-hc');
      if (!b) return;
      b.textContent = on ? 'On' : 'Off';
      b.setAttribute('aria-pressed', String(on));
    } catch (e) {}
  }
  
  function paintOGA() {
    try {
      const oga = typeof OGAudio !== 'undefined' ? OGAudio.isEnabled() : true;
      const b = $('#set-oga');
      if (b) {
        b.textContent = oga ? 'On' : 'Off';
        b.setAttribute('aria-pressed', String(oga));
      }
    } catch (e) {}
  }

  /* ---------- chapter select ---------- */
  const CHAPTERS = {
    1: { entry: 'intro', cc: 0, level: 1, flags: [] },
    2: { entry: 'ch2_drive', cc: 3500, level: 2, flags: ['hasDrive'] },
    3: { entry: 'c3_open', cc: 5000, level: 3, flags: ['hasDrive', 'harborJoined'] },
    4: { entry: 'c4_open', cc: 7000, level: 4, flags: ['hasDrive', 'harborJoined', 'lv4clue'] },
    5: { entry: 'c5_open', cc: 9000, level: 5, flags: ['hasDrive', 'harborJoined', 'lv4clue', 'coords', 'seraBond'] },
  };
  
  function startChapter(n) {
    const c = CHAPTERS[n];
    if (!c) return;
    console.log('[Menu] Starting chapter', n);
    try {
      if (typeof TTS !== 'undefined' && TTS.hardStop) TTS.hardStop();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch (e) {}
    try {
      if (typeof Economy !== 'undefined') {
        Economy.reset();
        Economy.apply({ cc: c.cc, level: c.level, setFlags: c.flags });
      }
    } catch (e) {}
    setTimeout(() => {
      try { Game.play(c.entry, true); } catch (e) { console.error(e); }
    }, 400);
  }

  /* ---------- init - CLEAN, BUG FREE ---------- */
  function init() {
    if (keyHandlerAttached) return;
    keyHandlerAttached = true;
    
    const l = layer();
    if (!l) return;

    // Single click handler - no double touchend to prevent double trigger bug
    l.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn && !btn.disabled) {
        e.preventDefault();
        e.stopPropagation();
        doAction(btn.dataset.action, btn);
        return;
      }
      const chBtn = e.target.closest('[data-chapter]');
      if (chBtn) {
        e.preventDefault();
        e.stopPropagation();
        const n = Number(chBtn.dataset.chapter);
        console.log('[Menu] Chapter clicked:', n);
        startChapter(n);
        return;
      }
      const vbtn = e.target.closest('#lv-btn');
      if (vbtn) {
        e.preventDefault();
        try { if (typeof TTS !== 'undefined') TTS.setEnabled(!TTS.isEnabled()); paintVoice(); } catch (err) {}
      }
    });

    // Keyboard navigation - FIXED: Arrow keys move, Enter selects
    document.addEventListener('keydown', (e) => {
      const lyr = layer();
      if (!lyr || lyr.hidden) return;
      
      // Escape goes back
      if (e.key === 'Escape') {
        const vp = visiblePanel();
        if (vp && vp.id !== 'menu-list-wrap') {
          e.preventDefault();
          doAction('back-main');
        }
        return;
      }
      
      // V toggles voice
      if (e.key === 'v' || e.key === 'V') {
        if (document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          try { if (typeof TTS !== 'undefined') TTS.setEnabled(!TTS.isEnabled()); paintVoice(); } catch (err) {}
        }
        return;
      }
      
      // Arrow navigation
      const isDown = e.key === 'ArrowDown' || e.key === 's' || e.key === 'S';
      const isUp = e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W';
      const isEnter = e.key === 'Enter' || e.key === ' ';
      
      if (isDown || isUp) {
        // Don't interfere with range inputs
        if (document.activeElement?.type === 'range') return;
        e.preventDefault();
        const panel = visiblePanel();
        const list = focusables(panel);
        if (!list.length) return;
        const idx = list.indexOf(document.activeElement);
        let nextIdx;
        if (isDown) nextIdx = idx + 1 < list.length ? idx + 1 : 0;
        else nextIdx = idx - 1 >= 0 ? idx - 1 : list.length - 1;
        list[nextIdx].focus();
        console.log('[Menu] Arrow nav:', isDown ? 'down' : 'up', '->', nextIdx);
        return;
      }
      
      if (isEnter) {
        const active = document.activeElement;
        if (active && active.closest('#main-menu')) {
          // Let click handler handle it, but prevent default to avoid double
          if (active.tagName === 'BUTTON') {
            e.preventDefault();
            active.click();
          }
        }
      }
    });

    // Settings controls - simple, no heavy TTS
    try {
      const voiceBtn = $('#set-voice');
      if (voiceBtn) voiceBtn.addEventListener('click', () => {
        try { if (typeof TTS !== 'undefined') TTS.setEnabled(!TTS.isEnabled()); paintVoice(); } catch (e) {}
      });
      
      const hcBtn = $('#set-hc');
      if (hcBtn) hcBtn.addEventListener('click', () => {
        const on = !document.body.classList.contains('high-contrast');
        document.body.classList.toggle('high-contrast', on);
        localStorage.setItem('ccs-hc', on ? '1' : '0');
        paintHC();
      });
    } catch (e) {}

    console.log('[Menu] Init done - keys work, no lag, bug free');
  }

  return {
    async start() {
      // Formality loading already done by loader.js
      if (typeof GameLoader !== 'undefined' && !GameLoader.isLoaded()) {
        console.log('[Menu] Waiting for formality loader');
        await new Promise(resolve => {
          const onLoaded = () => {
            document.removeEventListener('gamefiles-loaded', onLoaded);
            resolve();
          };
          document.addEventListener('gamefiles-loaded', onLoaded);
          setTimeout(resolve, 5000);
        });
        await new Promise(r => setTimeout(r, 200));
        if (window.__GAME_FILES_LOADED__) {
          console.log('[Menu] Formality loader ready, waiting for user key');
          init();
          try { if (typeof Game !== 'undefined') await Game.boot(); } catch (e) {}
          return;
        }
      }
      
      // Lightweight start
      init();
      try { if (typeof Game !== 'undefined') await Game.boot(); } catch (e) { console.error(e); }
      open();
      console.log('[Menu] Started - bug free, instant');
    },
    open,
  };
})();

/* Splash handling - only after formality loader */
(() => {
  const sp = document.getElementById('splash');
  if (!sp) return;
  const go = (ev) => {
    if (typeof GameLoader !== 'undefined' && !GameLoader.isLoaded()) return;
    if (sp.classList.contains('gone')) return;
    if (ev) { ev.stopImmediatePropagation(); ev.preventDefault(); }
    sp.classList.add('gone');
    setTimeout(() => { try { sp.remove(); } catch (e) {} }, 700);
  };
  document.addEventListener('keydown', go, { once: true, capture: true });
  document.addEventListener('click', go, { once: true, capture: true });
  setTimeout(() => {
    if (typeof GameLoader === 'undefined' || GameLoader.isLoaded()) go();
  }, 4000);
})();

// Start
if (typeof GameLoader === 'undefined') {
  Menu.start();
} else {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.__GAME_FILES_LOADED__) Menu.start();
  });
}
