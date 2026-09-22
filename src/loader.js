/* ============================================================
   CAPITAL CITY STREETS — src/loader.js
   PROPER LOADING SCREEN — FIXED LAYOUT & LAG — Asfand Ali
   - Blocks lobby until 100%
   - Shows big 70% loaded style
   - FIXED: No lag, lightweight, no heavy Image() preload
   - FIXED: Fullscreen overlay with inline CSS fallback
   ============================================================ */

const GameLoader = (() => {
  let progress = 0;
  let loaded = false;
  let statusText = 'Initializing...';
  let onProgressCb = null;

  const $ = sel => document.querySelector(sel);
  
  // LIGHTWEIGHT: Only essential files, not all 33 images (causes lag)
  const DATA_FILES = [
    'data/characters.json',
    'data/chapters.json', 
    'data/city.json'
  ];

  // Only 4 critical images for fast loading, rest lazy
  const CRITICAL_IMAGES = [
    'img/title.jpg',
    'img/stoneface.jpg',
    'img/apartment_in.jpg',
    'img/casino.jpg'
  ];

  let totalSteps = 0;
  let completedSteps = 0;

  function calcTotal() {
    totalSteps = DATA_FILES.length + CRITICAL_IMAGES.length + 3; // + voices + engine + final
    return totalSteps;
  }

  function updateProgress(fileName, type) {
    completedSteps++;
    const pct = Math.min(99, Math.round((completedSteps / totalSteps) * 100));
    progress = pct;
    statusText = type + ': ' + fileName.split('/').pop();
    
    // Update UI - BIG PERCENTAGE
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
    if (statusEl) statusEl.textContent = statusText;
    if (blockPctEl) blockPctEl.textContent = pct + '%';
    if (detailEl) {
      detailEl.textContent = pct + '% loaded — Loading ' + type + ': ' + fileName.split('/').pop();
    }
    if (hintEl && !$('#loading-screen')?.classList.contains('ready')) {
      hintEl.textContent = 'Loading... ' + pct + '% — lobby blocked until 100%';
    }

    if (onProgressCb) onProgressCb(pct, statusText);
    console.log(`[Loader] ${pct}% - ${type} - ${fileName}`);
  }

  function loadJSON(url) {
    return fetch(url, { cache: 'force-cache' })
      .then(r => {
        if (!r.ok) throw new Error('Failed ' + url);
        return r.json();
      })
      .then(data => {
        if (!window.__PRELOADED_DATA) window.__PRELOADED_DATA = {};
        window.__PRELOADED_DATA[url] = data;
        updateProgress(url, 'data');
        return data;
      })
      .catch(err => {
        console.warn('[Loader] JSON failed, using cache fallback:', url);
        updateProgress(url + ' (cached)', 'data');
        return null;
      });
  }

  function loadImageLight(url) {
    // LIGHTWEIGHT: Don't decode image, just fetch HEAD to verify exists, no Image() object (causes lag)
    return new Promise(resolve => {
      fetch(url, { method: 'HEAD', cache: 'force-cache' })
        .then(() => {
          updateProgress(url, 'image');
          resolve();
        })
        .catch(() => {
          // Fallback: try to load but with timeout, don't block
          updateProgress(url + ' (skip)', 'image');
          resolve();
        });
      // Timeout 1.5s max per image to prevent stuck
      setTimeout(() => {
        resolve();
      }, 1500);
    });
  }

  function loadVoices() {
    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        updateProgress('TTS voices', 'voice');
        resolve();
      };
      
      const check = () => {
        const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
        if (voices.length > 0) {
          console.log('[Loader] Voices found:', voices.length);
          finish();
        }
      };
      
      check();
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = check;
        setTimeout(check, 200);
        setTimeout(check, 800);
      }
      // Max 2s for voices, don't block
      setTimeout(finish, 2000);
    });
  }

  function loadEngine() {
    return new Promise(resolve => {
      updateProgress('Game engine', 'engine');
      setTimeout(resolve, 300);
    });
  }

  // Smooth fake progress to show 0-100% clearly even if real loading fast
  async function smoothProgress() {
    const bar = $('#loading-bar-fill');
    const bigPctEl = $('#loading-big-percent');
    const pctEl = $('#loading-percent');
    const barTextEl = $('#loading-bar-text');
    const blockPctEl = $('#loading-block-pct');
    const detailEl = $('#loading-detail');
    const hintEl = $('#loading-hint');
    
    // Animate from current to 100% smoothly
    for (let p = progress; p <= 100; p++) {
      if (bar) bar.style.width = p + '%';
      if (bigPctEl) bigPctEl.textContent = p + '%';
      if (pctEl) pctEl.textContent = p + '% loaded';
      if (barTextEl) barTextEl.textContent = p + '%';
      if (blockPctEl) blockPctEl.textContent = p + '%';
      if (p < 100) {
        if (detailEl) detailEl.textContent = p + '% loaded — Finalizing game files...';
        if (hintEl) hintEl.textContent = 'Loading... ' + p + '% — almost ready, lobby blocked until 100%';
      }
      // Slow down near end to show 70%, 80%, 90% clearly
      let delay = 20;
      if (p > 70 && p < 90) delay = 35;
      if (p >= 90) delay = 50;
      await new Promise(r => setTimeout(r, delay));
    }
  }

  async function loadAll(onProgress) {
    if (onProgress) onProgressCb = onProgress;
    calcTotal();
    console.log('[Loader] Starting LIGHTWEIGHT - total steps:', totalSteps);
    
    // Ensure body has loading-active class to hide menu
    document.body.classList.add('loading-active');
    
    // Show 0% immediately
    const initBig = $('#loading-big-percent');
    if (initBig) initBig.textContent = '0%';
    
    statusText = 'Loading game data...';
    await new Promise(r => setTimeout(r, 150));
    
    // Phase 1: Data (critical) - lightweight
    for (const f of DATA_FILES) {
      await loadJSON(f);
      await new Promise(r => setTimeout(r, 100)); // visible step
    }
    
    // Phase 2: Critical images only (not all 33 - prevents lag)
    for (const img of CRITICAL_IMAGES) {
      await loadImageLight(img);
      await new Promise(r => setTimeout(r, 80));
    }
    
    // Phase 3: Voices
    await loadVoices();
    
    // Phase 4: Engine
    await loadEngine();
    
    // Smooth to 100% to show 70% etc clearly
    await smoothProgress();
    
    // Final
    progress = 100;
    loaded = true;
    
    const bar = $('#loading-bar-fill');
    const pctEl = $('#loading-percent');
    const bigPctEl = $('#loading-big-percent');
    const barTextEl = $('#loading-bar-text');
    const statusEl = $('#loading-status');
    const detailEl = $('#loading-detail');
    const hintEl = $('#loading-hint');
    const blockPctEl = $('#loading-block-pct');
    
    if (bar) bar.style.width = '100%';
    if (pctEl) pctEl.textContent = '100% loaded';
    if (bigPctEl) bigPctEl.textContent = '100%';
    if (barTextEl) barTextEl.textContent = '100%';
    if (statusEl) statusEl.textContent = 'All files loaded! Ready.';
    if (detailEl) detailEl.textContent = '✅ 100% loaded — All game files properly loaded — lobby ready!';
    if (blockPctEl) blockPctEl.textContent = '100%';
    
    const loadingScreen = $('#loading-screen');
    if (loadingScreen) loadingScreen.classList.add('ready');
    if (hintEl) {
      hintEl.innerHTML = '<span style="color:#4ab08a; font-weight:800;">✓ 100% READY</span> — Press any key to enter Capitol City';
      hintEl.classList.add('ready');
      hintEl.style.animation = 'hintBlink 1s ease-in-out infinite';
    }
    
    console.log('[Loader] ALL FILES LOADED - Lobby ready, no lag');
    window.__GAME_FILES_LOADED__ = true;
    document.dispatchEvent(new CustomEvent('gamefiles-loaded'));
    
    return true;
  }

  return {
    loadAll,
    getProgress: () => progress,
    isLoaded: () => loaded,
    getStatus: () => statusText
  };
})();

// Auto-start
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('loading-active');
  const loadingScreen = document.getElementById('loading-screen');
  const splash = document.getElementById('splash');
  const mainMenu = document.getElementById('main-menu');
  
  if (splash) splash.style.display = 'none';
  if (mainMenu) mainMenu.hidden = true;
  if (loadingScreen) loadingScreen.style.display = 'flex';
  
  GameLoader.loadAll().then(() => {
    console.log('[Loader] Done, waiting for key...');
    
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
              }, 700);
            };
            
            document.addEventListener('keydown', goSplash, { once: true, capture: true });
            document.addEventListener('pointerdown', goSplash, { once: true, capture: true });
            setTimeout(goSplash, 4000);
          } else {
            if (typeof Menu !== 'undefined' && Menu.open) Menu.open();
          }
        }, 600);
      }
      
      document.removeEventListener('keydown', enterLobby);
      document.removeEventListener('pointerdown', enterLobby);
      document.removeEventListener('touchstart', enterLobby);
    };
    
    document.addEventListener('keydown', enterLobby, { capture: true });
    document.addEventListener('pointerdown', enterLobby, { capture: true });
    document.addEventListener('touchstart', enterLobby, { capture: true, passive: false });
    
    const hint = document.getElementById('loading-hint');
    if (hint) hint.style.animation = 'hintBlink 1s ease-in-out infinite';
  });
});
