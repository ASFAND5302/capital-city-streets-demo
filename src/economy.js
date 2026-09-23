/* ============================================================
   CAPITAL CITY STREETS — src/economy.js
   Player state ledger: CC credits, health, heat, flags, items.
   All effects from data/chapters.json flow through apply().
   ============================================================ */

const Economy = (() => {
  const DEFAULTS = () => ({
    cc: 0,
    health: 100,
    maxHealth: 100,
    heat: 0,
    level: 1,
    flags: {},       // story switches, e.g. flags.jingleSolved
    items: [],       // inventory, e.g. "data-drive", "the-hurricane"
    scene: null,     // autosave pointer
  });

  let s = DEFAULTS();
  const listeners = [];

  function notify() {
    listeners.forEach(fn => fn(s));
  }

  /** Apply an effects object from the story data. */
  function apply(fx = {}) {
    if (!fx) return;
    if (typeof fx.cc === 'number') s.cc = Math.max(0, s.cc + fx.cc);
    if (typeof fx.health === 'number') s.health = Math.min(s.maxHealth, s.health + fx.health);
    if (typeof fx.heat === 'number') s.heat = Math.max(0, s.heat + fx.heat);
    if (typeof fx.level === 'number') s.level = Math.max(s.level, fx.level);
    if (fx.setFlag) s.flags[fx.setFlag] = true;
    if (fx.setFlags) fx.setFlags.forEach(f => { s.flags[f] = true; });
    if (fx.clearFlag) delete s.flags[fx.clearFlag];
    if (fx.addItem && !s.items.includes(fx.addItem)) s.items.push(fx.addItem);
    if (fx.removeItem) s.items = s.items.filter(i => i !== fx.removeItem);
    notify();
  }

  /** Test a condition object from the story data against state. */
  function test(cond = {}) {
    if (!cond) return true;
    if (cond.flag) {
      const need = Array.isArray(cond.flag) ? cond.flag : [cond.flag];
      if (!need.every(f => s.flags[f])) return false;
    }
    if (cond.notFlag) {
      const nope = Array.isArray(cond.notFlag) ? cond.notFlag : [cond.notFlag];
      if (nope.some(f => s.flags[f])) return false;
    }
    if (cond.item && !s.items.includes(cond.item)) return false;
    if (typeof cond.ccMin === 'number' && s.cc < cond.ccMin) return false;
    if (typeof cond.levelMin === 'number' && s.level < cond.levelMin) return false;
    return true;
  }

  return {
    get state() { return s; },
    apply, test, notify,
    onChange(fn) { listeners.push(fn); },
    save() { localStorage.setItem('ccs-save', JSON.stringify(s)); },
    load() {
      try {
        const raw = localStorage.getItem('ccs-save');
        if (raw) { s = { ...DEFAULTS(), ...JSON.parse(raw) }; notify(); return true; }
      } catch (e) {}
      return false;
    },
    hasSave() { return !!localStorage.getItem('ccs-save'); },
    reset() { s = DEFAULTS(); localStorage.removeItem('ccs-save'); notify(); },
  };
})();
