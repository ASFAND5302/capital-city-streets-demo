/* ============================================================
   CAPITAL CITY STREETS — src/input.js
   Keyboard-first input. Global keys:
     ↑/↓ or W/S .. move between choices
     Enter/Space . select focused choice
     1-9 ......... jump-select a choice directly
     R ........... replay last Smart Glasses line
     F ........... Focus Mode (boosts narration, dims art)
     H ........... high-contrast toggle
     T ........... voice on/off
   ============================================================ */

const Input = (() => {
  const handlers = { choose: null, global: null };

  function focusedChoice() {
    const list = [...document.querySelectorAll('#choices .choice:not(:disabled)')];
    const cur = document.activeElement;
    const i = list.indexOf(cur);
    return { list, index: i >= 0 ? i : -1 };
  }

  function focusChoice(i) {
    const { list } = focusedChoice();
    if (!list.length) return;
    const idx = Math.max(0, Math.min(i, list.length - 1));
    const el = list[idx];
    el.focus();
    // Speak the option the player just landed on. interrupt() cancels any
    // current speech and waits a beat so Chrome doesn't drop the utterance.
    if (el.dataset.label) {
      TTS.interrupt(`Option ${idx + 1} of ${list.length}: ${el.dataset.label}`,
        { pitch: 1.15, rate: 1.1, slot: 0 });
    }
  }

  document.addEventListener('keydown', (e) => {
    const inEditor = document.getElementById('editor')?.open ||
                     document.activeElement?.id === 'editor-text';
    if (inEditor) return; // never hijack keys while editing content

    const { list, index } = focusedChoice();

    switch (e.key) {
      case 'ArrowDown': case 's': case 'S':
        if (!list.length) return;  // let the main menu layer handle its own nav
        e.preventDefault(); focusChoice(index + 1 < list.length ? index + 1 : 0); break;
      case 'ArrowUp': case 'w': case 'W':
        if (!list.length) return;
        e.preventDefault(); focusChoice(index - 1 >= 0 ? index - 1 : list.length - 1); break;
      case 'Enter': case ' ': {
        // while the story is narrating, Enter/Space skips straight to choices
        if (!document.getElementById('game')?.hidden && Game.isSpeaking()) {
          e.preventDefault();
          Game.skip();
          return;
        }
        const el = document.activeElement;
        // Never hijack Enter/Space on real interactive elements (main-menu
        // buttons, settings controls...). Their native click must fire —
        // calling preventDefault() here would cancel it.
        if (el && (el.tagName === 'BUTTON' || el.tagName === 'INPUT' ||
                   el.tagName === 'A' || el.isContentEditable)) return;
        if (list.length) {
          e.preventDefault();
          (list[index >= 0 ? index : 0]).click();
        }
        break;
      }
      case 'r': case 'R': TTS.replay(); break;
      case 'Escape': handlers.global?.('escape'); break;
      case 'f': case 'F': handlers.global?.('focusMode'); break;
      case 'h': case 'H': handlers.global?.('highContrast'); break;
      case 't': case 'T': case 'v': case 'V': handlers.global?.('voiceToggle'); break;
      default:
        if (/^[1-9]$/.test(e.key)) {
          const i = Number(e.key) - 1;
          if (list[i]) { e.preventDefault(); list[i].click(); }
        }
    }
  });

  return {
    onChoose(fn) { handlers.choose = fn; },
    onGlobal(fn) { handlers.global = fn; },
    fireChoose(c) { handlers.choose?.(c); },
  };
})();
