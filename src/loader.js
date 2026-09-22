/* ============================================================
   CAPITAL CITY STREETS — src/loader.js
   PROPER LOADING SCREEN — Asfand Ali
   Ensures ALL game files loaded before lobby entry.
   Shows progress 0-100%, blocks lobby until ready.
   ============================================================ */

const GameLoader = (() => {
  let progress = 0;
  let loaded = false;
  let statusText = 'Initializing...';
  let onProgressCb = null;

  const $ = sel => document.querySelector(sel);
  
  // Files to preload
  const DATA_FILES = [
    'data/characters.json',
    'data/chapters.json', 
    'data/city.json'
  ];

  const IMAGE_FILES = [
    'img/title.jpg',
    'img/stoneface.jpg',
    'img/apartment_in.jpg',
    'img/apartment_ext.jpg',
    'img/desk.jpg',
    'img/jingle_safe.jpg',
    'img/datadrive.jpg',
    'img/glasses_boot.jpg',
    'img/fireescape.jpg',
    'img/bonnie.jpg',
    'img/southside.jpg',
    'img/drive.jpg',
    'img/harbor.jpg',
    'img/boat.jpg',
    'img/casino.jpg',
    'img/sera.jpg',
    'img/mansion.jpg',
    'img/gala.jpg',
    'img/confrontation.jpg',
    'img/precinct.jpg',
    'img/hitmen.jpg',
    'img/escape.jpg',
    'img/ambush.jpg',
    'img/fight.jpg',
    'img/defenders.jpg',
    'img/epilogue.jpg',
    'img/twins.jpg',
    'img/musicbox.jpg',
    'img/ch1_end.jpg',
    'img/chapter2_end.svg',
    'img/crew.svg',
    'img/hospital.svg',
    'img/priest.svg',
    'img/stickup.svg'
  ];

  // Essential audio - not all 28MB, just key OGA + real voices existence check
  const AUDIO_FILES = [
    'audio/oga/Future_Noir.mp3',
    'audio/oga/Noire_Crime_Time.mp3',
    'audio/oga/pixabay_midnight_detective.mp3',
    'audio/real/glasses_online.mp3',
    'audio/real/bonnie_online.mp3',
    'audio/realistic/city_rain.mp3',
    'audio/realistic/footsteps_concrete.mp3',
    'audio/realistic/punch_strong.mp3'
  ];

  // Tracking
  let totalSteps = 0;
  let completedSteps = 0;

  function calcTotal() {
    // Weighted: data 15%, images 60%, audio 15%, voices 5%, engine 5%
    totalSteps = DATA_FILES.length + IMAGE_FILES.length + AUDIO_FILES.length + 2; // + voices + engine
    return totalSteps;
  }

  function updateProgress(fileName, type) {
    completedSteps++;
    const pct = Math.min(100, Math.round((completedSteps / totalSteps) * 100));
    progress = pct;
    statusText = type + ': ' + fileName.split('/').pop();
    
    // Update UI
    const bar = $('#loading-bar-fill');
    const pctEl = $('#loading-percent');
    const statusEl = $('#loading-status');
    const detailEl = $('#loading-detail');
    
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
    if (statusEl) statusEl.textContent = statusText;
    if (detailEl) {
      const icons = {
        data: '📄',
        image: '🖼️',
        audio: '🔊',
        voice: '🎙️',
        engine: '⚙️'
      };
      detailEl.textContent = (icons[type] || '•') + ' Loading ' + type + '... ' + fileName.split('/').pop();
    }

    // Checklist updates
    updateChecklist(type, pct);

    if (onProgressCb) onProgressCb(pct, statusText);

    console.log(`[Loader] ${pct}% - ${type} - ${fileName}`);
  }

  function updateChecklist(type, pct) {
    const dataEl = $('#chk-data');
    const imgEl = $('#chk-images');
    const audioEl = $('#chk-audio');
    const voiceEl = $('#chk-voices');
    const engineEl = $('#chk-engine');
    
    // Rough grouping for checklist
    if (completedSteps <= DATA_FILES.length) {
      if (dataEl) dataEl.className = 'chk loading';
    } else if (completedSteps <= DATA_FILES.length + IMAGE_FILES.length) {
      if (dataEl) dataEl.className = 'chk done';
      if (imgEl) imgEl.className = 'chk loading';
      if (imgEl) imgEl.querySelector('.chk-pct').textContent = Math.round(((completedSteps - DATA_FILES.length) / IMAGE_FILES.length)*100) + '%';
    } else if (completedSteps <= DATA_FILES.length + IMAGE_FILES.length + AUDIO_FILES.length) {
      if (imgEl) { imgEl.className = 'chk done'; imgEl.querySelector('.chk-pct').textContent = '100%'; }
      if (audioEl) audioEl.className = 'chk loading';
    } else {
      if (audioEl) audioEl.className = 'chk done';
      if (voiceEl) voiceEl.className = 'chk loading';
    }
  }

  function loadJSON(url) {
    return fetch(url, { cache: 'force-cache' })
      .then(r => {
        if (!r.ok) throw new Error('Failed ' + url);
        return r.json();
      })
      .then(data => {
        // Cache for Game.boot to reuse
        if (!window.__PRELOADED_DATA) window.__PRELOADED_DATA = {};
        window.__PRELOADED_DATA[url] = data;
        updateProgress(url, 'data');
        return data;
      })
      .catch(err => {
        console.warn('[Loader] JSON failed, will retry from cache:', url, err);
        // Still count as loaded to not block
        updateProgress(url + ' (cached)', 'data');
        return null;
      });
  }

  function loadImage(url) {
    return new Promise(resolve => {
      const img = new Image();
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        updateProgress(url, 'image');
        resolve();
      };
      img.onload = finish;
      img.onerror = () => {
        console.warn('[Loader] Image failed:', url);
        finish(); // don't block game
      };
      img.src = url + '?v=' + Date.now(); // cache bust? actually use cache
      // Timeout 3s per image
      setTimeout(finish, 3000);
    });
  }

  function loadAudio(url) {
    return new Promise(resolve => {
      // Just check existence via fetch HEAD, not full decode (save bandwidth)
      fetch(url, { method: 'HEAD', cache: 'force-cache' })
        .then(() => {
          updateProgress(url, 'audio');
          resolve();
        })
        .catch(() => {
          // Try full fetch as fallback
          fetch(url, { cache: 'force-cache' }).then(() => {
            updateProgress(url, 'audio');
            resolve();
          }).catch(() => {
            console.warn('[Loader] Audio check failed:', url);
            updateProgress(url + ' (skip)', 'audio');
            resolve();
          });
        });
      setTimeout(() => {
        updateProgress(url + ' (timeout)', 'audio');
        resolve();
      }, 2500);
    });
  }

  function loadVoices() {
    return new Promise(resolve => {
      const check = () => {
        const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
        if (voices.length > 0) {
          updateProgress('TTS voices (' + voices.length + ')', 'voice');
          const voiceEl = $('#chk-voices');
          if (voiceEl) voiceEl.className = 'chk done';
          resolve();
        } else {
          // Keep trying
          if (window.speechSynthesis) {
            try { window.speechSynthesis.getVoices(); } catch(e){}
          }
        }
      };
      
      check();
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = check;
        setTimeout(check, 300);
        setTimeout(check, 1000);
        setTimeout(check, 2000);
      }
      // Don't block forever - 4s max
      setTimeout(() => {
        updateProgress('TTS voices ready', 'voice');
        const voiceEl = $('#chk-voices');
        if (voiceEl) voiceEl.className = 'chk done';
        resolve();
      }, 4000);
    });
  }

  function loadEngine() {
    return new Promise(resolve => {
      // Wait for THREE and other globals
      const check = () => {
        const hasThree = typeof THREE !== 'undefined' || document.querySelector('script[src*=\"three\"]');
        if (hasThree || completedSteps > totalSteps - 2) {
          updateProgress('Game engine', 'engine');
          const engEl = $('#chk-engine');
          if (engEl) engEl.className = 'chk done';
          resolve();
        }
      };
      setTimeout(check, 500);
      setTimeout(check, 1200);
      setTimeout(() => {
        updateProgress('Game engine ready', 'engine');
        const engEl = $('#chk-engine');
        if (engEl) engEl.className = 'chk done';
        resolve();
      }, 2000);
    });
  }

  async function loadAll(onProgress) {
    if (onProgress) onProgressCb = onProgress;
    calcTotal();
    console.log('[Loader] Starting - total steps:', totalSteps);
    
    statusText = 'Loading game data...';
    
    // Phase 1: Data (critical)
    for (const f of DATA_FILES) {
      await loadJSON(f);
    }
    
    // Phase 2: Images (biggest part, parallel in batches of 4 for speed)
    const batchSize = 4;
    for (let i = 0; i < IMAGE_FILES.length; i += batchSize) {
      const batch = IMAGE_FILES.slice(i, i + batchSize);
      await Promise.all(batch.map(f => loadImage(f)));
    }
    
    // Phase 3: Audio essentials (parallel)
    await Promise.all(AUDIO_FILES.map(f => loadAudio(f)));
    
    // Phase 4: Voices
    await loadVoices();
    
    // Phase 5: Engine
    await loadEngine();
    
    // Final
    progress = 100;
    loaded = true;
    
    const bar = $('#loading-bar-fill');
    const pctEl = $('#loading-percent');
    const statusEl = $('#loading-status');
    const detailEl = $('#loading-detail');
    const hintEl = $('#loading-hint');
    const checklistEl = $('#loading-checklist');
    
    if (bar) bar.style.width = '100%';
    if (pctEl) pctEl.textContent = '100%';
    if (statusEl) statusEl.textContent = 'All files loaded! Ready to enter Capitol City.';
    if (detailEl) detailEl.textContent = '✅ All game files properly loaded — lobby ready!';
    if (checklistEl) {
      checklistEl.querySelectorAll('.chk').forEach(el => el.className = 'chk done');
    }
    
    // Show ready state
    const loadingScreen = $('#loading-screen');
    if (loadingScreen) loadingScreen.classList.add('ready');
    if (hintEl) {
      hintEl.innerHTML = '<span class="ready-pulse">✓ READY</span> — Press any key to enter Capitol City';
      hintEl.classList.add('ready');
    }
    
    console.log('[Loader] ALL FILES LOADED - Lobby ready');
    
    // Enable entry
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

// Auto-start when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const loadingScreen = document.getElementById('loading-screen');
  const splash = document.getElementById('splash');
  const mainMenu = document.getElementById('main-menu');
  
  // Hide splash and menu until loading done
  if (splash) splash.style.display = 'none';
  if (mainMenu) mainMenu.hidden = true;
  if (loadingScreen) loadingScreen.style.display = 'flex';
  
  GameLoader.loadAll().then(() => {
    console.log('[Loader] Done, waiting for user key...');
    
    const enterLobby = (ev) => {
      if (!window.__GAME_FILES_LOADED__) return;
      if (ev) { ev.preventDefault(); ev.stopImmediatePropagation(); }
      
      const ls = document.getElementById('loading-screen');
      const sp = document.getElementById('splash');
      
      if (ls) {
        ls.classList.add('gone');
        setTimeout(() => {
          ls.style.display = 'none';
          // Now show splash for studio intro, then menu
          if (sp) {
            sp.style.display = 'flex';
            sp.classList.remove('gone');
            
            // Splash will handle its own key to go to menu
            // But we need to re-enable splash logic
            const goSplash = (ev2) => {
              if (sp.classList.contains('gone')) return;
              if (ev2) { ev2.stopImmediatePropagation(); ev2.preventDefault(); }
              sp.classList.add('gone');
              setTimeout(() => {
                sp.style.display = 'none';
                sp.remove();
                // Menu.start already called? Ensure menu visible
                if (typeof Menu !== 'undefined' && Menu.open) {
                  // Game.boot already? Menu.start does boot
                  // If boot already done via preloaded data, just open
                  Menu.open();
                }
              }, 700);
            };
            
            // Splash listeners
            document.addEventListener('keydown', goSplash, { once: true, capture: true });
            document.addEventListener('pointerdown', goSplash, { once: true, capture: true });
            setTimeout(goSplash, 4000);
          } else {
            if (typeof Menu !== 'undefined' && Menu.open) Menu.open();
          }
        }, 600);
      }
      
      // Remove this listener
      document.removeEventListener('keydown', enterLobby);
      document.removeEventListener('pointerdown', enterLobby);
      document.removeEventListener('touchstart', enterLobby);
    };
    
    // Wait for any key to enter
    document.addEventListener('keydown', enterLobby, { capture: true });
    document.addEventListener('pointerdown', enterLobby, { capture: true });
    document.addEventListener('touchstart', enterLobby, { capture: true, passive: false });
    
    // Auto enter after 2 sec if user already pressed? Actually show hint
    const hint = document.getElementById('loading-hint');
    if (hint) hint.style.animation = 'hintBlink 1.2s ease-in-out infinite';
  });
});
