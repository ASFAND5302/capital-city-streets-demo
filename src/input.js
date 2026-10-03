/* ============================================================
   CAPITAL CITY STREETS — src/input.js
   v4.0 HOTKEY FIX — every key works, no mode fights another mode.
   Story keys:
     Up/Down or W/S .. move between choices (each one is spoken)
     Enter/Space .... select focused choice (or skip narration)
     1-9 ............ jump-select a choice directly
     A/B/C/D... ..... letter hotkey printed on each choice
     R .............. replay last spoken line
     J .............. case journal (chapter, clues, inventory)
     E .............. sonar ping — enhanced listening
     Backspace ...... repeat all options again
     F .............. Focus Mode (boosts narration, dims art)
     H .............. high-contrast toggle
     T/V ............ voice on/off
     Esc ............ back to menu (asks first)
   City mode and the main menu handle their own keys — this file
   stays out of their way (that cross-talk was auto-selecting
   hidden story choices while roaming the city).
   ============================================================ */

const Input = (() => {
  const handlers = { choose: null, global: null };

  // Letters the story reserves — choice hotkeys never use these.
  // (game.js uses the same list when printing A/B/C badges.)
  const RESERVED = new Set(['e', 'f', 'h', 'j', 'r', 's', 't', 'v', 'w']);

  function cityOpen() {
    try {
      if (typeof CityMode !== 'undefined' && CityMode.isActive) return CityMode.isActive();
    } catch (e) {}
    const c = document.getElementById('city');
    return !!(c && !c.hidden);
  }

  function gameOpen() {
    const g = document.getElementById('game');
    return !!(g && !g.hidden);
  }

  function storyChoices() {
    if (!gameOpen()) return { list: [], index: -1 };
    const list = [...document.querySelectorAll('#choices .choice:not(:disabled)')];
    const cur = document.activeElement;
    const i = list.indexOf(cur);
    return { list, index: i >= 0 ? i : -1 };
  }

  function focusChoice(i) {
    const { list } = storyChoices();
    if (!list.length) return;
    const idx = Math.max(0, Math.min(i, list.length - 1));
    const el = list[idx];
    el.focus();
    // Speak the option just landed on. interrupt() stops the old voice,
    // waits for the engine to settle, then speaks — never dropped.
    if (el.dataset.label) {
      const letter = (el.dataset.hotkey || '').toUpperCase();
      const prefix = letter ? `Option ${letter}, ${idx + 1} of ${list.length}` : `Option ${idx + 1} of ${list.length}`;
      try {
        TTS.interrupt(`${prefix}: ${el.dataset.label}`,
          { pitch: 1.15, rate: 1.1, slot: 0, _skipReal: true });
      } catch (e) {}
    }
  }

  document.addEventListener('keydown', (e) => {
    const inEditor = document.getElementById('editor')?.open ||
                     document.activeElement?.id === 'editor-text';
    if (inEditor) return; // never hijack keys while editing content

    // City mode owns every key while it is open.
    if (cityOpen()) return;

    // Main menu owns arrows/enter/numbers — only global toggles here.
    if (!gameOpen()) {
      switch (e.key) {
        case 'r': case 'R': try { TTS.replay(); } catch (err) {} break;
        case 'h': case 'H': handlers.global?.('highContrast'); break;
        case 't': case 'T': case 'v': case 'V': handlers.global?.('voiceToggle'); break;
        default: break;
      }
      return;
    }

    // ---- story mode ----
    const { list, index } = storyChoices();

    switch (e.key) {
      case 'ArrowDown': case 's': case 'S':
        if (!list.length) return;
        e.preventDefault(); focusChoice(index + 1 < list.length ? index + 1 : 0); break;
      case 'ArrowUp': case 'w': case 'W':
        if (!list.length) return;
        e.preventDefault(); focusChoice(index - 1 >= 0 ? index - 1 : list.length - 1); break;
      case 'Enter': case ' ': {
        // while the story is narrating, Enter/Space skips straight to choices
        if (Game.isSpeaking()) {
          e.preventDefault();
          Game.skip();
          return;
        }
        const el = document.activeElement;
        // Never hijack Enter/Space on real interactive elements — their
        // native click must fire; preventDefault() here would cancel it.
        if (el && (el.tagName === 'BUTTON' || el.tagName === 'INPUT' ||
                   el.tagName === 'A' || el.isContentEditable)) return;
        if (list.length) {
          e.preventDefault();
          (list[index >= 0 ? index : 0]).click();
        }
        break;
      }
      case 'Backspace':
        e.preventDefault();
        handlers.global?.('repeatOptions');
        break;
      case 'r': case 'R': try { TTS.replay(); } catch (err) {} break;
      case 'e': case 'E': handlers.global?.('enhancedListening'); break;
      case 'j': case 'J': handlers.global?.('journal'); break;
      case 'Escape': handlers.global?.('escape'); break;
      case 'f': case 'F': handlers.global?.('focusMode'); break;
      case 'h': case 'H': handlers.global?.('highContrast'); break;
      case 't': case 'T': case 'v': case 'V': handlers.global?.('voiceToggle'); break;
      default:
        if (/^[1-9]$/.test(e.key)) {
          const i = Number(e.key) - 1;
          if (list[i]) { e.preventDefault(); list[i].click(); }
        } else if (/^[a-zA-Z]$/.test(e.key) && !RESERVED.has(e.key.toLowerCase())) {
          // letter hotkey printed on the choice badge (A/B/C...)
          const hot = e.key.toLowerCase();
          const hit = list.find(el => (el.dataset.hotkey || '').toLowerCase() === hot);
          if (hit) { e.preventDefault(); hit.click(); }
        }
    }
  });

  return {
    onChoose(fn) { handlers.choose = fn; },
    onGlobal(fn) { handlers.global = fn; },
    fireChoose(c) { handlers.choose?.(c); },
    reservedLetters: () => [...RESERVED],
  };
})();
