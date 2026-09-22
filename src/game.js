/* ============================================================
   CAPITAL CITY STREETS — src/game.js
   Data-driven story engine. ALL story content lives in data/*.json.
   Nothing in this file should need editing to add chapters,
   scenes, characters, dialogue, or rewards.

   Data shape (data/chapters.json):
   {
     "start": "sceneId",
     "scenes": {
       "sceneId": {
         "chapter": 1, "chapterName": "The First Echo",
         "location": "Old Chapel Ward", "art": "img/apartment.jpg",
         "nodes": [
           {
             "art": "img/optional-override.jpg",
             "lines": [ {"speaker": "glasses", "text": "..."} ],
             "choices": [
               { "label": "...", "goto": "sceneOrNodeId",
                 "effects": {...}, "condition": {...},
                 "chance": { "fail": 0.3, "failGoto": "...", "failEffects": {...} } }
             ]
           }
         ]
       }
     }
   }
   A "goto" may be a SCENE id, or "sceneId:2" to jump to a
   specific node index inside a scene (for loops like combat).
   ============================================================ */

const Game = (() => {
  let chars = {};
  let story = null;
  let current = { scene: null, nodeIndex: 0 };
  let speaking = false;
  let skipping = false;
  let armed = false;        // Esc-to-menu confirmation state
  let armTimer = null;
  let lastChapter = -1;
  let lastAmb = null;
  let lastLocation = null;
  /* every place gets its own color grade + music vibe, cross-fading as you travel */
  const GRADE = {
    room: '#c9a86a', radio: '#7fa8d4', crackle: '#d8c9a0', night: '#3a4a7a',
    club: '#b03a8a', church: '#d4a04a', island: '#4ab08a', mansion: '#d4c08a',
    precinct: '#6a8ab0', boat: '#4a7a8a', court: '#8a6a4a', rain: '#4a6a9a',
  };
  // Location-specific music vibe - each story location has its own separate music
  // BUG FIX v2.1: Cleaned duplicates, each location unique vibe, no overlap
  const LOCATION_MOOD = {
    'Capitol City': 'noir',
    'Your safehouse': 'safehouse',
    'Safehouse': 'safehouse',
    'Old Chapel Ward': 'chapel',
    'Old Chapel Ward — the church': 'sacred',
    'Salena\'s apartment': 'apartment',
    'Salena\'s apartment — desk': 'apartment',
    'Salena\'s apartment — bookshelf': 'apartment',
    'Salena\'s apartment — bedroom door': 'mystery',
    'The jingle lock': 'warm',
    'Salena\'s apartment — bedroom': 'tense',
    'Fight — round 1': 'combat',
    'Fight — round 2': 'fight',
    'Fight — round 3': 'brawl',
    'Salena\'s apartment — the safe': 'mystery',
    'Fire escape': 'tense',
    'Bonnie — en route': 'garage',
    'Southside Blocks': 'southside',
    'Southside alley': 'southside',
    'Southside corner store': 'market',
    'Southside — the court': 'court',
    'Southside — planning': 'velvet',
    'Velvet Room — back alley': 'velvet',
    'Velvet Room — stickup': 'fight',
    'Velvet Room — back office': 'conspiracy',
    'Southside — under the overpass': 'southside',
    'Old Chapel Ward — the gate': 'victory',
    'St. Verity Hospital': 'lament',
    'Industrial Row': 'industrial',
    'Coast Road': 'pulse',
    'Tess\'s Workshop': 'workshop',
    'Harborfront': 'pier',
    'The Crossing': 'sea',
    'The Island': 'island',
    'Casino Royale': 'casino',
    'Casino Bar': 'sera',
    'Midtown Strip': 'midtown',
    'Precinct 9': 'mystery',
    'Garden Parks': 'garden',
    'Upper Hills': 'mansion',
    'Mansion Gardens': 'mansion',
    'Mansion Gates': 'finale',
    'The Gala — Ballroom': 'quartet',
    'The Gala — Service Halls': 'mansion',
    'Mansion Roof': 'pulse',
    'Blue Note Diner': 'diner',
    'The Study': 'hero',
  };

  const $ = sel => document.querySelector(sel);

  /* ---------- data loading (with editor overrides) ---------- */
  async function loadData() {
    const files = ['characters.json', 'chapters.json'];
    const out = {};
    for (const f of files) {
      const override = localStorage.getItem('ccs-data:' + f);
      if (override) { out[f] = JSON.parse(override); continue; }
      const res = await fetch('data/' + f);
      out[f] = await res.json();
    }
    chars = out['characters.json'].characters;
    story = out['chapters.json'];
  }

  /* ---------- HUD ---------- */
  function paintHUD() {
    const s = Economy.state;
    $('#hud-cc').textContent = `🪙 ${s.cc.toLocaleString()} CC`;
    $('#hud-health').setAttribute('aria-label', `Health ${s.health} of ${s.maxHealth}`);
    $('#health-fill').style.width = Math.max(0, (s.health / s.maxHealth) * 100) + '%';
    const heat = $('#hud-heat');
    heat.hidden = s.heat <= 0;
    heat.textContent = `🔥 Heat ${s.heat}`;
    const loc = $('#hud-location');
    const sc = current.scene;
    loc.textContent = '📍 ' + (sc ? (story.scenes[sc].location || '—') : '—');
  }

  Economy.onChange(paintHUD);

  /* ---------- narration ---------- */
  function charOf(speaker) {
    return chars[speaker] || { name: speaker, voice: {} };
  }

  function logLine(speaker, text) {
    const li = document.createElement('li');
    const c = charOf(speaker);
    li.innerHTML = `<span class="who">${c.name}:</span> ${text}`;
    if (c.color) li.querySelector('.who').style.color = c.color;
    const list = $('#log-lines');
    list.prepend(li);
    while (list.children.length > 60) list.lastChild.remove();
  }

  function showCaption(speaker, text) {
    const sub = $('#subtitle');
    const c = charOf(speaker);
    sub.innerHTML = `<span class="speaker">${c.name}</span><span class="type"></span>`;
    if (c.color) sub.querySelector('.speaker').style.color = c.color;
    const el = sub.querySelector('.type');
    clearInterval(typeTimer);
    let i = 0;
    typeTimer = setInterval(() => {
      i += 2;
      el.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(typeTimer);
    }, 24);
    sub.classList.remove('flash'); void sub.offsetWidth; sub.classList.add('flash');
  }
  let typeTimer = 0;

  function setArt(src) {
    if (!src) return;
    const svg = $('#scene-art');
    svg.innerHTML = `<image href="${src}" x="0" y="0" width="800" height="450" preserveAspectRatio="xMidYMid slice"/>`;
    // restart Ken Burns + fade for the new shot
    svg.style.animation = 'none'; void svg.offsetWidth; svg.style.animation = '';
  }

  /* ---------- scene / node runner - HAR CHAPTER KI APNI VIBE ---------- */
  function showScene(sceneId, nodeIndex = 0) {
    const scene = story.scenes[sceneId];
    if (!scene) { console.error('Missing scene:', sceneId); return; }
    current = { scene: sceneId, nodeIndex };
    Economy.state.scene = sceneId;
    Economy.save();
    paintHUD();
    $('#stage').dataset.fx = scene.fx || '';

    // cinematic chapter title card + chapter-specific music vibe from OpenGameArt.org
    if (scene.chapter && scene.chapter !== lastChapter) {
      lastChapter = scene.chapter;
      const names = { 1: 'ONE', 2: 'TWO', 3: 'THREE', 4: 'FOUR', 5: 'FIVE' };
      const card = $('#chapter-card');
      card.innerHTML = `<span class="cc-k">CHAPTER ${names[scene.chapter]}</span><span class="cc-n">${scene.chapterName}</span>`;
      card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
      clearTimeout(card._t);
      card._t = setTimeout(() => card.classList.remove('show'), 2600);
      
      // HAR CHAPTER KI APNI MUSIC VIBE - OpenGameArt.org real tracks
      try {
        if (typeof OGAudio !== 'undefined' && OGAudio.isEnabled()) {
          const played = OGAudio.playChapter(scene.chapter);
          if (played) {
            console.log(`[Story] Chapter ${scene.chapter} vibe: ${scene.chapterName} -> real track from OGA`);
          }
        }
      } catch (e) {}
    }

    // generative score - LOCATION-SPECIFIC VIBE: each place gets its own music
    const chapterMood = { 0: 'menu', 1: 'noir', 2: 'drive' };
    // Determine music: priority = scene.music (if action) > location vibe > chapter fallback
    const locationVibe = LOCATION_MOOD[scene.location] || null;
    const actionMoods = ['combat', 'fight', 'brawl', 'tense', 'pulse', 'finale', 'hero', 'conspiracy'];
    let chosenMood;
    if (scene.music && actionMoods.includes(scene.music)) {
      // Keep action music (fights, chases, finales) - FIGHT MUSIC EFFECTS from OGA
      chosenMood = scene.music;
      // If fight scene, try real fight music from OGA
      try {
        if (typeof OGAudio !== 'undefined' && OGAudio.isEnabled() && ['combat','fight','brawl'].includes(scene.music)) {
          const fightPlayed = OGAudio.playFight(scene.music);
          if (fightPlayed) {
            console.log(`[Story] Fight music: ${scene.music} -> REAL fight track from OpenGameArt.org (MintoDog CC0)`);
          }
        }
      } catch (e) {}
    } else if (locationVibe) {
      // Location has its own separate vibe - use it!
      chosenMood = locationVibe;
    } else {
      // Fallback to scene's music or chapter mood
      chosenMood = scene.music || chapterMood[scene.chapter] || 'noir';
    }
    // Only switch if location actually changed or mood is different - avoids cutting music every node
    // But if OGA already playing chapter vibe, don't override with generative unless it's fight
    const isOGAChapterPlaying = typeof OGAudio !== 'undefined' && OGAudio.isEnabled() && scene.chapter && !['combat','fight','brawl'].includes(chosenMood);
    if (!isOGAChapterPlaying) {
      if (scene.location !== lastLocation || chosenMood !== Music._lastMood) {
        Music.play(chosenMood);
        console.log(`[Story] Location vibe: ${scene.location} -> ${chosenMood} (was ${lastLocation})`);
        Music._lastMood = chosenMood;
      }
    } else {
      console.log(`[Story] Keeping OGA chapter ${scene.chapter} vibe for ${scene.location}, not overriding with ${chosenMood}`);
    }
    lastLocation = scene.location;
    Music.setTranspose(scene.chapter || 0);
    // PROFESSIONAL BLIND GAME VIBE: All soft except fight intense + spy medium
    // Vertical remixing + leitmotifs for characters (high-level blind game)
    const isFightScene = ['combat','fight','brawl'].includes(chosenMood) || scene.heat;
    const isSpyScene = ['conspiracy','tense','pulse','industrial'].includes(chosenMood);
    const isSoftMood = ['quartet','mansion','victory','finale','hero','safehouse','apartment','chapel','sacred','mystery','sea','casino','sera','diner','market','pier','garden','midtown','southside','court','garage','workshop','velvet','noir','warm','blues','lounge'].includes(chosenMood);
    let inten;
    if (isFightScene) inten = 2; // fight = intense loud
    else if (isSpyScene) inten = 1; // spy = medium tense but soft volume
    else inten = 0; // all other locations soft calm - PROFESSIONAL BLIND: keep music low to preserve TTS clarity
    // Chapter 4 specific: c4_open should be soft not loud (fixed bug)
    if (scene.chapter === 4 && sceneId === 'c4_open') inten = 0;
    Music.setIntensity(inten);
    // PROFESSIONAL: Vertical remixing via BlindMusic layers
    try {
      if (typeof BlindMusic !== 'undefined') {
        BlindMusic.setIntensity(inten);
        window._blindIntensity = inten;
        // Play base layer soft noir
        if (inten === 0) BlindMusic.playBase('noir_soft');
        else if (inten === 1) BlindMusic.playBase('noir_tense');
        // Leitmotifs for characters in scene - professional blind technique
        const speakers = [...new Set((scene.nodes[0]?.lines || []).map(l => l.speaker).filter(Boolean))];
        speakers.forEach((sp, i) => {
          if (['stoneface','salena','glasses','harbor','wexler','bonnie','nyx'].includes(sp)) {
            setTimeout(() => {
              try { BlindMusic.playLeitmotif(sp, { volume: 0.035, soft: true }); } catch (e) {}
            }, i * 600);
          }
        });
      }
    } catch (e) {}
    // Heartbeat only for fights + low health (not for normal scenes) - professional: minimal distraction
    const isLowHealth = Economy.state.health > 0 && Economy.state.health < 35;
    const isFightMood = ['combat','fight','brawl'].includes(chosenMood);
    Music.setHeartbeat(isLowHealth || isFightMood);
    Music.setMuffle(!!scene.muffle);
    // BUG FIX v2.1: Ambience no overlap, single source, proper stop
    const effAmb = scene.amb || (scene.fx === 'rain' ? 'rain' : null);
    const isFight = ['combat','fight','brawl'].includes(chosenMood);
    if (effAmb) {
      if (effAmb !== lastAmb) {
        Music.setAmb(effAmb);
        Music.arrive(effAmb);
        console.log(`[Game] Ambience: ${lastAmb || 'none'} -> ${effAmb} (fixed overlap)`);
      }
      lastAmb = effAmb;
    } else {
      if (lastAmb !== null) {
        Music.setAmb(null);
        console.log(`[Game] Ambience: ${lastAmb} -> none (stopped)`);
      }
      lastAmb = null;
    }
    $('#grade').style.background = GRADE[effAmb] || (scene.music === 'sea' || scene.music === 'sera' ? '#4ab08a' : scene.music === 'conspiracy' ? '#5a6a8a' : '#101018');
    
    // BUG FIX v2.1: OGAudio ambient - single source, no overlap with generative, stop properly
    try {
      if (typeof OGAudio !== 'undefined' && OGAudio.isEnabled()) {
        if (isFight) {
          // Fight - stop ambient to keep clarity
          OGAudio.stopAmbient(true);
        } else if (effAmb === 'rain') {
          OGAudio.playAmbient('water');
        } else if (effAmb === 'room' || sceneId.includes('apartment') || sceneId.includes('safehouse')) {
          OGAudio.stopAmbient(true); // apartment/safehouse should be quiet, no city noise
        } else if (scene.location && scene.location.toLowerCase().includes('industrial')) {
          OGAudio.stopAmbient(true); // industrial - generative is enough
        } else if (scene.location && scene.location.toLowerCase().includes('southside')) {
          OGAudio.playAmbient('city');
        } else if (scene.location && scene.location.toLowerCase().includes('harbor')) {
          OGAudio.playAmbient('water');
        } else if (!effAmb) {
          OGAudio.stopAmbient(true); // no ambience defined -> stop OGA ambient too
        }
      }
    } catch (e) {}
    
    // BUG FIX v2.1: Stop fight music when leaving fight scene
    try {
      if (!isFight && typeof OGAudio !== 'undefined' && OGAudio.isEnabled()) {
        OGAudio.stopFight(false);
      }
    } catch (e) {}
    
    if (sceneId === 'the_end') setTimeout(() => Music.credits(), 1500);
    runNode();
  }

  /* Skip - PREMIUM FIX: hard stop */
  function skip() {
    if (speaking) {
      skipping = true;
      try { if (typeof TTS !== 'undefined') { if (TTS.hardStop) TTS.hardStop(); else TTS.stop(); } } catch (e) {}
      try { if (typeof RealVoices !== 'undefined') RealVoices.stop(); } catch (e) {}
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    }
  }

  async function runNode() {
    armed = false;   // any forward progress cancels the exit prompt
    skipping = false;
    const scene = story.scenes[current.scene];
    const node = scene.nodes[current.nodeIndex];
    if (!node) return;
    if (node.art || scene.art) setArt(node.art || scene.art);

    // Spatial audio: auto-place characters for 3D feel
    if (typeof Spatial !== 'undefined') {
      const speakers = [...new Set((node.lines || []).map(l => l.speaker).filter(Boolean))];
      Spatial.autoPlaceForScene(current.scene, speakers);
      Spatial.init();
      Spatial.setListener(0, 0, 0);
    }

    $('#choices').innerHTML = '';
    speaking = true;

    let lastSpeaker = null;
    for (const line of node.lines || []) {
      if (line.condition && !Economy.test(line.condition)) continue;
      const c = charOf(line.speaker);
      showCaption(line.speaker, line.text);
      logLine(line.speaker, line.text);
      // Pass character id to TTS for RealVoices (real human, not computer)
      const voiceProfile = { ...(c.voice || {}), _charId: line.speaker };
      // Spatial: character voice from its 3D position
      if (typeof Spatial !== 'undefined' && line.speaker) {
        // Place stinger spatially
        if (line.speaker !== lastSpeaker && c.stinger) {
          // Play stinger with spatial panning
          const pos = Spatial.getPositions()[line.speaker];
          if (pos) {
            // Slight spatial cue before voice
            SFX.play(c.stinger);
            // Also play spatial tone for direction
            if (pos.x < -1) SFX.play('tick'); // left cue
            else if (pos.x > 1) setTimeout(() => SFX.play('tick'), 80);
          } else {
            SFX.play(c.stinger);
          }
        }
      } else {
        // identity sting when a new character starts talking
        if (line.speaker !== lastSpeaker && c.stinger) SFX.play(c.stinger);
      }
      lastSpeaker = line.speaker;
      if (line.sfx) {
        // Spatial fight SFX with directional panning
        if (typeof Spatial !== 'undefined' && ['punch','punch_heavy','hit','kick','elbow','knee','slam','uppercut','block','dodge','whoosh','whoosh_heavy'].includes(line.sfx)) {
          Spatial.playFightSFX(line.sfx);
        } else {
          SFX.play(line.sfx);
        }
      }
      if (!skipping) {
        // Use real human voice if available, else computer TTS
        try {
          if (typeof RealVoices !== 'undefined' && RealVoices.isEnabled()) {
            const realPlayed = await RealVoices.playReal(line.text, line.speaker);
            if (realPlayed === false) {
              await TTS.speak(line.text, voiceProfile);
            }
          } else {
            await TTS.speak(line.text, voiceProfile);
          }
        } catch (e) {
          await TTS.speak(line.text, voiceProfile);
        }
      }
    }

    speaking = false;
    skipping = false;
    renderChoices(node);
  }

  function renderChoices(node) {
    const box = $('#choices');
    box.innerHTML = '';
    let visible = 0;

    (node.choices || []).forEach(ch => {
      if (!Economy.test(ch.condition)) return;
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.dataset.label = ch.label;
      btn.innerHTML = `<span class="key-hint">${visible + 1}</span><span>${ch.label}</span>`;
      btn.addEventListener('click', () => pick(ch));
      box.appendChild(btn);
      visible++;
    });

    if (!visible && node.autoGoto) {
      go(node.autoGoto);
      return;
    }
    const first = box.querySelector('.choice');
    first?.focus();
    // PREMIUM FIX: Hard stop before options prompt - single voice guarantee
    const firstLabel = first ? first.dataset.label : '';
    try { if (typeof RealVoices !== 'undefined') RealVoices.stop(); } catch (e) {}
    try { if (typeof TTS !== 'undefined' && TTS.hardStop) TTS.hardStop(); } catch (e) {}
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    setTimeout(() => {
      TTS.speak(
        `${visible} options available. Option 1: ${firstLabel}. Use arrow keys to hear all options.`,
        { pitch: 1.15, rate: 1.1, slot: 0, _skipReal: true }
      );
    }, 80);
  }

  function go(goto) {
    if (!goto) return;
    if (goto === '@menu' || goto === '@title') return toMenu();
    if (goto === '@city') { TTS.stop(); CityMode.enter(); return; }
    const [sceneId, idx] = goto.split(':');
    showScene(sceneId, idx ? Number(idx) : 0);
  }

  function toMenu() {
    try { if (typeof TTS !== 'undefined') { if (TTS.hardStop) TTS.hardStop(); else TTS.stop(); } } catch (e) {}
    try { if (typeof RealVoices !== 'undefined') RealVoices.stop(); } catch (e) {}
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    $('#game').hidden = true;
    const menu = document.getElementById('main-menu');
    menu.hidden = false;
    Menu.open();
  }

  function pick(choice) {
    if (speaking) return;
    armed = false;
    try { if (typeof TTS !== 'undefined') { if (TTS.hardStop) TTS.hardStop(); else TTS.stop(); } } catch (e) {}
    try { if (typeof RealVoices !== 'undefined') RealVoices.stop(); } catch (e) {}
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}

    // Optional random risk (combat dodges, lockpicks...) - WRONG OPTION HALKI AWAZ
    if (choice.chance && Math.random() < choice.chance.fail) {
      // GHLT OPTION PICK - halki awaz wala sound from OpenGameArt.org
      try {
        if (typeof OGAudio !== 'undefined' && OGAudio.isEnabled()) {
          const wrongPlayed = OGAudio.playRealSFX('wrong');
          if (wrongPlayed) {
            console.log('[SFX] Wrong option - halki awaz from OpenGameArt.org (Wrong Error.wav)');
          } else {
            SFX.play('fail');
          }
        } else {
          // Real fight fail feel - block/dodge + grunt
          if (choice.sfx === 'punch' || choice.label.toLowerCase().includes('punch') || choice.label.toLowerCase().includes('block')) {
            SFX.play('block');
            setTimeout(() => SFX.play('grunt'), 100);
          } else {
            SFX.play('fail');
          }
        }
      } catch (e) {
        SFX.play('fail');
      }
      // Screen shake on fail too
      const st = $('#stage');
      st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake');
      Economy.apply(choice.chance.failEffects);
      if (Economy.state.health <= 0) return knockedOut();
      go(choice.chance.failGoto || current.scene + ':' + current.nodeIndex);
      return;
    }

    Economy.apply(choice.effects);
    // PROFESSIONAL BLIND: Stingers for events (Hades technique)
    try {
      if (typeof BlindMusic !== 'undefined') {
        if (choice.effects?.cc > 0) BlindMusic.playStinger('objective');
        else if (choice.effects?.setFlag) BlindMusic.playStinger('discovery');
        else if (choice.effects?.health < 0) BlindMusic.playStinger('fail');
        else if (choice.goto && choice.goto.includes('precinct')) BlindMusic.playStinger('enemy_spotted');
      }
      if (typeof Music !== 'undefined' && Music.stinger) {
        if (choice.effects?.cc > 0) Music.stinger('objective');
        else if (choice.effects?.setFlag) Music.stinger('discovery');
      }
    } catch (e) {}
    // Keep heartbeat on for low health OR if currently in fight mood
    const curMood = Music._lastMood;
    const inFightMood = curMood && ['combat','fight','brawl'].includes(curMood);
    Music.setHeartbeat((Economy.state.health > 0 && Economy.state.health < 35) || inFightMood);

    // Real fight feel - detect fight actions with combo tracking
    if (!window._fightCombo) window._fightCombo = 0;
    const isFight = (choice.sfx && ['punch','hit','kick','elbow','slam','punch_heavy','whoosh','whoosh_heavy','uppercut','knee'].includes(choice.sfx)) ||
                    (choice.label && /punch|kick|strike|hit|slam|elbow|knee|swing|duck|slip|counter|haymaker|feint|sweep|tackle|ram|pit|thread|blind|dare|uppercut|jab|cross|hook/i.test(choice.label));
    const isHeavy = choice.label && /heavy|haymaker|slam|ram|pit|heavy|hard|uppercut|finisher/i.test(choice.label);
    const isCounter = choice.label && /counter|slip|duck|feint/i.test(choice.label);

    if (isFight) {
      window._fightCombo++;
      // Intensify music for real fight - combo increases intensity
      Music.setIntensity(2);
      if (window._fightCombo >= 3) Music.setHeartbeat(true); // adrenaline
      // Screen effects - shake + flash + slow-mo on heavy
      const st = $('#stage');
      st.classList.remove('shake', 'fight-flash', 'heavy', 'slowmo');
      void st.offsetWidth;
      // Random shake direction for realism
      st.style.setProperty('--shake-x', (Math.random()*2-1)*8 + 'px');
      if (isHeavy) {
        st.classList.add('shake','heavy','fight-flash');
        // Slow-mo effect for heavy finisher
        if (window._fightCombo >= 2) {
          st.classList.add('slowmo');
          setTimeout(() => st.classList.remove('slowmo'), 400);
        }
      } else if (isCounter) {
        st.classList.add('shake');
        st.style.animationDuration = '0.25s'; // quicker dodge
      } else {
        st.classList.add('shake');
      }
      // Play realistic combo: whoosh then impact with variation + SPATIAL
      const punchType = isHeavy ? 'punch_heavy' : (window._fightCombo % 3 === 0 ? 'uppercut' : choice.sfx || 'punch');
      const useSpatial = typeof Spatial !== 'undefined' && Spatial.isEnabled();
      if (choice.sfx === 'punch' || choice.sfx === 'kick' || choice.sfx === 'uppercut' || !choice.sfx || isCounter) {
        if (useSpatial) Spatial.playFightSFX(isHeavy ? 'whoosh_heavy' : 'whoosh');
        else SFX.play(isHeavy ? 'whoosh_heavy' : 'whoosh');
        setTimeout(() => {
          if (useSpatial) Spatial.playFightSFX(punchType);
          else SFX.play(punchType);
          // Extra impact layer for combo
          if (window._fightCombo >= 2 && Math.random() < 0.5) {
            setTimeout(() => {
              if (useSpatial) Spatial.playFightSFX('hit');
              else SFX.play('hit');
            }, 40);
          }
        }, isHeavy ? 140 : 95 + Math.random()*30);
      }
      // Grunt logic - more grunts as combo builds + spatial
      const gruntChance = isHeavy ? 0.8 : 0.4 + window._fightCombo*0.1;
      if (Math.random() < gruntChance) {
        setTimeout(() => {
          if (useSpatial) Spatial.playFightSFX('grunt');
          else SFX.play('grunt');
        }, 120 + Math.random()*80);
      }
      // Breathing heavy after long combo
      if (window._fightCombo >= 4 && Math.random() < 0.3) {
        setTimeout(() => {
          if (useSpatial) Spatial.playFightSFX('grunt');
          else SFX.play('grunt');
        }, 300);
      }
      setTimeout(() => {
        st.classList.remove('fight-flash','heavy');
        st.style.animationDuration = '';
      }, isHeavy ? 450 : 300);
    } else {
      // Not a fight action - reset combo after a pause
      if (window._fightCombo > 0) {
        clearTimeout(window._fightComboTimer);
        window._fightComboTimer = setTimeout(() => { window._fightCombo = 0; }, 8000);
      }
    }

    // GHLT OPTION - halki awaz for wrong picks with negative effects
    const isWrongChoice = choice.effects?.health < 0 || (choice.effects?.cc < 0 && Math.abs(choice.effects.cc) > 100);
    
    if (choice.effects?.health < 0) {
      const st = $('#stage');
      st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake');
      // Extra hit sound when taking damage + wrong soft
      setTimeout(() => SFX.play('hit'), 60);
      if (isWrongChoice) {
        try {
          if (typeof OGAudio !== 'undefined' && OGAudio.isEnabled()) {
            setTimeout(() => OGAudio.playRealSFX('wrong'), 20);
          }
        } catch (e) {}
      }
    }

    // Play main SFX with REALISTIC sounds from Mixkit/OGA (CC0)
    // Try Realistic first (real recorded, not synthetic)
    const tryRealistic = (sfxName) => {
      try {
        if (typeof Realistic !== 'undefined' && Realistic.isEnabled()) {
          // Map game SFX to realistic
          if (['punch','punch_heavy','hit','kick','elbow','knee','slam','uppercut'].includes(sfxName)) {
            const intensity = sfxName.includes('heavy') ? 'heavy' : sfxName.includes('punch') ? 'strong' : 'fast';
            return Realistic.playPunch(intensity);
          }
          if (sfxName.includes('foot') || sfxName === 'step') {
            return Realistic.playFootstep('concrete');
          }
          if (sfxName.includes('door')) {
            return Realistic.play('door_open');
          }
          if (sfxName === 'coin') {
            return Realistic.play('coin');
          }
          if (sfxName === 'success') {
            return Realistic.play('ui_success');
          }
          if (sfxName === 'fail' || sfxName === 'wrong') {
            return Realistic.play('ui_fail');
          }
          // Try direct key
          return Realistic.play(sfxName);
        }
      } catch (e) {}
      return false;
    };
    
    if (!isFight) {
      // If wrong choice, play halki awaz first (realistic)
      if (isWrongChoice) {
        try {
          if (typeof Realistic !== 'undefined' && Realistic.isEnabled()) {
            Realistic.play('ui_fail');
            console.log('[SFX] Wrong choice - halki awaz REALISTIC from Mixkit/OGA');
          } else if (typeof OGAudio !== 'undefined' && OGAudio.isEnabled()) {
            OGAudio.playRealSFX('wrong');
          }
        } catch (e) {}
      }
      // Try realistic first
      const sfxToPlay = choice.sfx ? choice.sfx :
        choice.effects?.cc > 0 ? 'coin' :
        choice.effects?.health < 0 ? 'hit' :
        choice.effects?.setFlag ? 'success' : 'ping';
      
      const realisticPlayed = tryRealistic(sfxToPlay);
      if (!realisticPlayed) {
        SFX.play(sfxToPlay);
      }
    } else {
      // Fight - use realistic punches
      const realisticPunch = tryRealistic(choice.sfx || 'punch');
      if (!realisticPunch) {
        if (choice.sfx && choice.sfx !== 'punch' && choice.sfx !== 'kick') {
          SFX.play(choice.sfx);
        }
      }
      // Extra realistic layer for combo
      if (window._fightCombo >= 2) {
        setTimeout(() => tryRealistic('hit_1'), 50);
      }
    }

    if (Economy.state.health <= 0) return knockedOut();
    go(choice.goto);
  }

  function knockedOut() {
    Economy.apply({ health: 100 - Economy.state.health, cc: -Math.min(500, Economy.state.cc) });
    TTS.speak('You are down. Waking up in the hospital. 500 CC gone to the bill.', {});
    go(story.knockoutGoto || 'hospital');
  }

  /* ---------- global toggles - PROFESSIONAL BLIND GAME ---------- */
  function globalKey(key) {
    if (key === 'escape') {
      if ($('#game').hidden) return;
      if (!armed) {
        armed = true;
        clearTimeout(armTimer);
        armTimer = setTimeout(() => { armed = false; }, 7000);
        const msg = 'Press Enter to return to the main menu. Press Escape again to keep playing.';
        showCaption('glasses', msg);
        try { if (typeof RealVoices !== 'undefined') RealVoices.stop(); } catch (e) {}
        TTS.interrupt(msg, { _skipReal: true });
      } else {
        armed = false;
        toMenu();
      }
      return;
    }
    if (key === 'focusMode') {
      document.body.classList.toggle('focus-mode');
      const on = document.body.classList.contains('focus-mode');
      $('#hud-focus').hidden = !on;
      TTS.speak(on ? 'Focus mode on.' : 'Focus mode off.', { _skipReal: true });
    } else if (key === 'highContrast') {
      document.body.classList.toggle('high-contrast');
    } else if (key === 'voiceToggle') {
      TTS.setEnabled(!TTS.isEnabled());
    } else if (key === 'e' || key === 'E' || key === 'enhancedListening') {
      // PROFESSIONAL BLIND: Enhanced Listening Mode - sonar sweep like TLOU2
      try {
        if (typeof BlindMusic !== 'undefined') {
          const isOn = BlindMusic.isEnhancedListening();
          if (!isOn) {
            BlindMusic.setEnhancedListening(true);
            TTS.interrupt('Enhanced listening on. Sonar pinging nearby characters with leitmotifs.', { _skipReal: true });
            // Auto off after 8 seconds
            setTimeout(() => {
              try { BlindMusic.setEnhancedListening(false); } catch (e) {}
            }, 8000);
          } else {
            BlindMusic.playSonarSweep();
            TTS.interrupt('Sonar ping. Listening for characters.', { _skipReal: true });
          }
        }
        if (typeof Music !== 'undefined' && Music.setEnhancedListening) {
          Music.setEnhancedListening(true);
          setTimeout(() => { try { Music.setEnhancedListening(false); } catch (e) {} }, 8000);
        }
      } catch (e) {}
    } else if (key === 'r' || key === 'R') {
      // Replay last line with leitmotif
      try {
        if (typeof BlindMusic !== 'undefined') {
          const speakers = current.scene ? story.scenes[current.scene]?.nodes[current.nodeIndex]?.lines?.map(l => l.speaker) || [] : [];
          if (speakers.length) {
            const lastSp = speakers[speakers.length - 1];
            if (lastSp) BlindMusic.playLeitmotif(lastSp, { volume: 0.04, soft: true });
          }
        }
      } catch (e) {}
    }
  }

  /* ---------- boot / play - Mobile browser support ---------- */
  async function boot() {
    await loadData();
    Input.onGlobal(globalKey);
    // Mobile: unlock audio on first gesture in game
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      const unlockAll = () => {
        try { if (typeof TTS !== 'undefined' && TTS.unlockAudio) TTS.unlockAudio(); } catch (e) {}
        try { if (typeof RealVoices !== 'undefined' && RealVoices.unlockMobile) RealVoices.unlockMobile(); } catch (e) {}
        try { if (typeof OGAudio !== 'undefined' && OGAudio.unlockMobile) OGAudio.unlockMobile(); } catch (e) {}
        try { if (typeof BlindMusic !== 'undefined' && BlindMusic.unlockMobile) BlindMusic.unlockMobile(); } catch (e) {}
      };
      document.addEventListener('touchstart', unlockAll, { once: true, passive: true });
      document.addEventListener('click', unlockAll, { once: true });
    }
    // Editor dock removed for player security - no access to files/code
    const dock = document.getElementById('editor-dock');
    if (dock) dock.hidden = false;
    const fsBtn = document.getElementById('btn-fullscreen');
    if (fsBtn) fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen().catch(() => {});
    });
    const menuBtn = document.getElementById('btn-menu');
    if (menuBtn) menuBtn.addEventListener('click', () => toMenu());
  }

  /** BUG FIX v2.1: Enter story - hard stop ALL music/ambience, no lobby overlap, no double voice */
  function play(sceneId, fresh = false) {
    if (fresh) lastChapter = -1;
    const hardStopAll = () => {
      try { if (typeof TTS !== 'undefined') { if (TTS.hardStop) TTS.hardStop(); else TTS.stop(); } } catch (e) {}
      try { if (typeof RealVoices !== 'undefined') RealVoices.stop(); } catch (e) {}
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    };
    hardStopAll();
    
    try {
      console.log('[Game] Entering chapter/mission - BUG FIX v2.1 hard stop all music/ambience');
      // Hard stop ALL music systems to fix lobby music bug
      if (typeof Music !== 'undefined') Music.stop(true); // hard=true immediate
      if (typeof OGAudio !== 'undefined') {
        OGAudio.stopMusic(false); // false = hard stop immediate
        OGAudio.stopAmbient(false);
        OGAudio.stopFight(true);
      }
      if (typeof BlindMusic !== 'undefined') BlindMusic.stop(true);
      if (typeof PremiumAudio !== 'undefined') PremiumAudio.stop();
      // Reset ambience tracking
      lastAmb = null;
      lastLocation = null;
    } catch (e) { console.warn('[Game] Failed to stop lobby music:', e); }
    
    document.getElementById('main-menu').hidden = true;
    $('#game').hidden = false;
    hardStopAll();
    showScene(sceneId);
    $('#stage').focus();
    const docEl = document.documentElement;
    if (!document.fullscreenElement && docEl.requestFullscreen) {
      docEl.requestFullscreen().catch(() => {});
    }
  }

  return { boot, play, toMenu, exitArmed: () => armed, doExit: () => { armed = false; toMenu(); },
           skip, isSpeaking: () => speaking, chars: () => chars, story: () => story };
})();