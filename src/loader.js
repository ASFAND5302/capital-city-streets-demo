/* ============================================================
   CAPITAL CITY STREETS — src/loader.js
   FORMALITY LOADING SCREEN ONLY — Asfand Ali
   User request: files loading wala kaam khatam karo, bas formality keliye loading screen rakho
   - No heavy file loading, no fetch, no Image preload = no lag
   - Just fake 0-100% animation for show, then lobby
   - Game files load lazily when actually needed (Game.boot etc)
   ============================================================ */

const GameLoader = (() => {
  let progress = 0;
  let loaded = false;

  const $ = sel => document.querySelector(sel);

  function setProgress(pct, status) {
    progress = pct;
    const bar = $('#loading-bar-fill');
    const pctEl = $('#loading-percent');
    const bigPctEl = $('#loading-big-percent');
    const barTextEl = $('#loading-bar-text');
    const statusEl = $('#loading-status');
    const detailEl = $('#loading-detail');
    const hintEl = $('#loading-hint');
    const blockPctEl = $('#loading-block-pct');
    
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '% loaded';
    if (bigPctEl) bigPctEl.textContent = pct + '%';
    if (barTextEl) barTextEl.textContent = pct + '%';
    if (statusEl) statusEl.textContent = status;
    if (blockPctEl) blockPctEl.textContent = pct + '%';
    if (detailEl) detailEl.textContent = pct + '% — ' + status;
    if (hintEl && !$('#loading-screen')?.classList.contains('ready')) {
      hintEl.textContent = status + ' — ' + pct + '%';
    }
  }

  async function loadAll() {
    console.log('[Loader] Formality mode - no heavy file loading, just show');
    document.body.classList.add('loading-active');
    
    const steps = [
      { pct: 5,  status: 'Initializing Capital City...', delay: 150 },
      { pct: 15, status: 'Loading Stoneface...', delay: 200 },
      { pct: 28, status: 'Loading Smart Glasses...', delay: 180 },
      { pct: 42, status: 'Loading city map...', delay: 220 },
      { pct: 55, status: 'Loading game files...', delay: 200 },
      { pct: 68, status: 'Loading Capitol City Streets...', delay: 180 },
      { pct: 75, status: '70% loaded — Preparing lobby...', delay: 250 },
      { pct: 82, status: '82% loaded — Almost ready...', delay: 200 },
      { pct: 91, status: '91% loaded — Finalizing...', delay: 180 },
      { pct: 97, status: '97% loaded — Ready...', delay: 150 },
      { pct: 100, status: '100% loaded — All ready!', delay: 100 }
    ];

    // Smooth fake progress - no actual file fetches = no lag
    for (const step of steps) {
      setProgress(step.pct, step.status);
      await new Promise(r => setTimeout(r, step.delay));
    }

    // Ensure smooth 0-100% visible even if steps jump
    // Already done via steps above

    loaded = true;
    
    const loadingScreen = $('#loading-screen');
    const hintEl = $('#loading-hint');
    const statusEl = $('#loading-status');
    const detailEl = $('#loading-detail');
    
    if (loadingScreen) loadingScreen.classList.add('ready');
    if (statusEl) statusEl.textContent = 'All ready! Press any key to enter.';
    if (detailEl) detailEl.textContent = '✅ 100% — Formality loading complete — lobby ready!';
    if (hintEl) {
      hintEl.innerHTML = '<span style="color:#4ab08a; font-weight:800;">✓ 100% READY</span> — Press any key to enter Capitol City';
      hintEl.classList.add('ready');
    }
    
    console.log('[Loader] Formality loading done - 100% - no lag, lobby ready');
    window.__GAME_FILES_LOADED__ = true;
    document.dispatchEvent(new CustomEvent('gamefiles-loaded'));
    
    return true;
  }

  return {
    loadAll,
    getProgress: () => progress,
    isLoaded: () => loaded,
    getStatus: () => 'Formality loading'
  };
})();

// Auto-start - formality only, no heavy work
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('loading-active');
  const loadingScreen = document.getElementById('loading-screen');
  const splash = document.getElementById('splash');
  const mainMenu = document.getElementById('main-menu');
  
  if (splash) splash.style.display = 'none';
  if (mainMenu) mainMenu.hidden = true;
  if (loadingScreen) loadingScreen.style.display = 'flex';
  
  GameLoader.loadAll().then(() => {
    const enterLobby = (ev) => {
      if (!window.__GAME_FILES_LOADED__) return;
      if (ev) { ev.preventDefault(); ev.stopImmediatePropagation(); }
      
      const ls = document.getElementById('loading-screen');
      const sp = document.getElementById('splash');
      
      if (ls) {
        ls.classList.add('gone');
        setTimeout(() => {
          ls.style.display = 'none';
          document.body.classList.remove('loading-active');
          if (sp) {
            sp.style.display = 'flex';
            sp.classList.remove('gone');
            
            const goSplash = (ev2) => {
              if (sp.classList.contains('gone')) return;
              if (ev2) { ev2.stopImmediatePropagation(); ev2.preventDefault(); }
              sp.classList.add('gone');
              setTimeout(() => {
                sp.style.display = 'none';
                sp.remove();
                if (typeof Menu !== 'undefined' && Menu.open) Menu.open();
              }, 600);
            };
            
            document.addEventListener('keydown', goSplash, { once: true, capture: true });
            document.addEventListener('pointerdown', goSplash, { once: true, capture: true });
            setTimeout(goSplash, 3500);
          } else {
            if (typeof Menu !== 'undefined' && Menu.open) Menu.open();
          }
        }, 500);
      }
      
      document.removeEventListener('keydown', enterLobby);
      document.removeEventListener('pointerdown', enterLobby);
      document.removeEventListener('touchstart', enterLobby);
    };
    
    document.addEventListener('keydown', enterLobby, { capture: true });
    document.addEventListener('pointerdown', enterLobby, { capture: true });
    document.addEventListener('touchstart', enterLobby, { capture: true, passive: false });
  });
});
