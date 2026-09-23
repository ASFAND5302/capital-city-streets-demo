/* ============================================================
   CAPITAL CITY STREETS — src/city.js
   Open-world free-roam mode. Grid-based city navigation:
   arrow keys move block-by-block, the Smart Glasses announce
   every intersection, and landmarks (POIs) are interactable.

   ALL city content lives in data/city.json — streets, avenues,
   districts, landmarks, prices, dialogue. Nothing here is story.

   Keys:
     ↑↓←→ / WASD  move      Enter/Space  interact at a landmark
     L  look around          M  set marker        N  navigate to marker
     X  clear marker         B  ride Bonnie (3 blocks per step)
     Esc  back to main menu
   ============================================================ */

const CityMode = (() => {
  const $ = sel => document.querySelector(sel);
  const CELL = 44;
  const BUILD = 'v1.0';   // shown in the key bar — submission build
  const VOICE = { pitch: 1.1, rate: 1.15, slot: 1 }; // Smart Glasses voice
  // Location-specific music: now each district and POI has its own music field in city.json
  // Fallback map for old saves or missing fields
  const DIST_MOOD_FALLBACK = { old_chapel: 'chapel', midtown: 'midtown', southside: 'southside',
                      harborfront: 'pier', garden: 'garden', industrial: 'industrial', upperhills: 'mansion' };
  const DIST_ARRIVE = { old_chapel: 'church', midtown: 'club', southside: 'south',
                        harborfront: 'harbor', garden: 'garden', industrial: 'industrial', upperhills: 'mansion' };
  // POI-specific arrival sounds
  const POI_ARRIVE = {
    safehouse: 'room', salena_apartment: 'radio', st_verity_church: 'church',
    pawnshop_ledger: 'radio', velvet_room: 'club', diner_blue_note: 'radio',
    movie_theater: 'mansion', basketball_court: 'court', corner_store: 'radio',
    bonnie_garage: 'boat', marlow_pier: 'harbor', fish_market: 'night',
    mansion: 'mansion', tess_workshop: 'industrial', carwash: 'rain', greenhouse: 'garden'
  };

  function getDistrictMusic(d) {
    if (!d) return 'noir';
    return d.music || DIST_MOOD_FALLBACK[d.id] || 'midtown';
  }
  function getPoiMusic(p) {
    if (!p) return null;
    return p.music || null;
  }

  let city = null;
  let active = false;
  let pos = { x: 0, y: 0 };
  let riding = false;
  let marker = null;
  let lastDistrict = null;
  let history = [];        // breadcrumb trail of visited intersections
  let moveCount = 0;
  let gotoActive = false;  // Go-to landmark menu listening for a number key
  let gotoOptions = [];
  let facing = { x: 0, y: 1 };   // last movement direction (grid units)
  let view3d = false;
  let spatialOn = true;
  let stepSide = -1;             // alternating footstep pan

  /* ---------- loading ---------- */
  async function loadCity() {
    const override = localStorage.getItem('ccs-data:city.json');
    if (override) return JSON.parse(override);
    const res = await fetch('data/city.json');
    return res.json();
  }

  /* ---------- helpers ---------- */
  const N = () => city.gridSize;
  function intersectionName(x, y) {
    return `${city.avenues[x]} Ave & ${city.streets[y]} St`;
  }
  function districtAt(x, y) {
    return city.districts.find(d => x >= d.x0 && x <= d.x1 && y >= d.y0 && y <= d.y1) || null;
  }
  function poiAt(x, y) {
    return city.pois.find(p => p.x === x && p.y === y) || null;
  }
  /* Compass direction from the player to a target tile. */
  function dirTo(tx, ty) {
    const dx = tx - pos.x, dy = ty - pos.y;
    const parts = [];
    if (dy !== 0) parts.push(dy < 0 ? 'north' : 'south');
    if (dx !== 0) parts.push(dx > 0 ? 'east' : 'west');
    return parts.join('-') || 'right here';
  }
  const distTo = (tx, ty) => Math.abs(tx - pos.x) + Math.abs(ty - pos.y);
  function say(text) {
    caption(text);
    TTS.interrupt(text, VOICE);
  }
  function caption(text) {
    const cap = $('#city-caption');
    cap.textContent = text;
    cap.classList.remove('flash'); void cap.offsetWidth; cap.classList.add('flash');
  }

  /* ---------- HUD ---------- */
  function paintHUD() {
    const s = Economy.state;
    $('#city-loc').textContent = '📍 ' + intersectionName(pos.x, pos.y);
    $('#city-cc').textContent = `🪙 ${s.cc.toLocaleString()} CC`;
    $('#city-health-fill').style.width = Math.max(0, (s.health / s.maxHealth) * 100) + '%';
    const ride = $('#city-ride');
    ride.hidden = !riding;
    const mk = $('#city-marker-chip');
    mk.hidden = !marker;
    if (marker) mk.textContent = `🎯 Marker: ${intersectionName(marker.x, marker.y)}`;
  }

  /* ---------- SVG world ---------- */
  function buildWorld() {
    const world = $('#city-world');
    const size = N() * CELL;
    let svg = '';

    // base
    svg += `<rect x="0" y="0" width="${size}" height="${size}" fill="#191926"/>`;

    // district tints + names (bright, readable)
    for (const d of city.districts) {
      const x = d.x0 * CELL, y = d.y0 * CELL;
      const w = (d.x1 - d.x0 + 1) * CELL, h = (d.y1 - d.y0 + 1) * CELL;
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${d.color}" opacity="0.9" stroke="#565d86" stroke-width="1.5"/>`;
      svg += `<text x="${x + w / 2}" y="${y + 20}" text-anchor="middle" font-size="15" font-weight="bold" fill="#c9c2e8" letter-spacing="3" opacity="0.95">${d.name.toUpperCase()}</text>`;
    }

    // street grid (lines through cell centers) — bright lanes
    for (let i = 0; i < N(); i++) {
      const c = i * CELL + CELL / 2;
      const major = i % 5 === 0;
      const wcol = major ? '#9aa2cc' : '#5d648c';
      const w = major ? 5 : 2.5;
      svg += `<line x1="${c}" y1="0" x2="${c}" y2="${size}" stroke="${wcol}" stroke-width="${w}"/>`;
      svg += `<line x1="0" y1="${c}" x2="${size}" y2="${c}" stroke="${wcol}" stroke-width="${w}"/>`;
    }

    // POIs — glow halo + big icon + white label
    for (const p of city.pois) {
      const cx = p.x * CELL + CELL / 2, cy = p.y * CELL + CELL / 2;
      svg += `<circle cx="${cx}" cy="${cy}" r="17" fill="#f5b942" opacity="0.22"/>`;
      svg += `<text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="26">${p.icon}</text>`;
      svg += `<text x="${cx}" y="${cy + 24}" text-anchor="middle" font-size="9" font-weight="bold" fill="#ffffff">${p.name}</text>`;
    }

    // marker (hidden until set)
    svg += `<g id="city-marker" style="display:none">
      <path d="M0,-10 L8,0 L0,10 L-8,0 Z" fill="#7fd4ff" stroke="#fff" stroke-width="1.5"/>
    </g>`;

    // player: gold dot with Smart Glasses glint
    svg += `<g id="city-player">
      <circle r="13" fill="none" stroke="#f5b942" stroke-width="2" opacity="0.45">
        <animate attributeName="r" values="13;20;13" dur="2.2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.45;0;0.45" dur="2.2s" repeatCount="indefinite"/>
      </circle>
      <circle r="9" fill="#f5b942" stroke="#0c0c12" stroke-width="2"/>
      <rect x="-5" y="-4" width="10" height="3" rx="1.5" fill="#0c0c12"/>
    </g>`;

    world.innerHTML = svg;
  }

  function paintWorld(animated = true) {
    const world = $('#city-world');
    world.style.transition = animated ? 'transform .18s ease' : 'none';
    world.style.transform = `translate(${360 - (pos.x * CELL + CELL / 2)}px, ${270 - (pos.y * CELL + CELL / 2)}px)`;

    const player = $('#city-player');
    player.style.transition = animated ? 'transform .18s ease' : 'none';
    player.style.transform = `translate(${pos.x * CELL + CELL / 2}px, ${pos.y * CELL + CELL / 2}px)`;

    const mk = $('#city-marker');
    if (marker) {
      mk.style.display = '';
      mk.setAttribute('transform', `translate(${marker.x * CELL + CELL / 2}, ${marker.y * CELL + CELL / 2})`);
    } else mk.style.display = 'none';
  }

  /* ---------- narration - location-specific music vibe ---------- */
  let lastPoiId = null;
  function describeMove(dirWord, wrongWay) {
    const d = districtAt(pos.x, pos.y);
    const poi = poiAt(pos.x, pos.y);
    let line = `${dirWord} — ${intersectionName(pos.x, pos.y)}.`;

    // District change -> play district's own music vibe
    if (lastDistrict && d && d.id !== lastDistrict.id) {
      line += ` Entering ${d.name}. ${d.ambience}`;
      SFX.play('chapter');
      const dm = getDistrictMusic(d);
      Music.play(dm);
      Music.arrive(DIST_ARRIVE[d.id] || 'night');
      console.log(`[City] District vibe: ${d.name} -> music ${dm}`);
    }
    lastDistrict = d;

    // POI-specific music: when you arrive on a landmark, its own vibe takes over
    if (poi) {
      const poiMusic = getPoiMusic(poi);
      if (poiMusic && lastPoiId !== poi.id) {
        // New POI - switch to its unique vibe
        Music.play(poiMusic);
        const arriveSound = POI_ARRIVE[poi.id] || DIST_ARRIVE[d?.id] || 'room';
        Music.arrive(arriveSound);
        console.log(`[City] POI vibe: ${poi.name} -> music ${poiMusic} + arrive ${arriveSound}`);
      }
      lastPoiId = poi.id;
      line += ` ${poi.name} is here — press Enter. Its own ${poi.music || getDistrictMusic(d)} vibe is playing.`;
      SFX.play('arrive');
    } else {
      // Left POI - go back to district music if we were on POI before
      if (lastPoiId !== null) {
        const dm = getDistrictMusic(d);
        Music.play(dm);
        console.log(`[City] Left POI, back to district: ${d?.name} -> ${dm}`);
      }
      lastPoiId = null;
    }

    if (wrongWay) line += ' Note: that step takes you farther from your marker.';

    // Occasional street flavor — the city talking to itself.
    moveCount++;
    if (!poi && d && d.flavor && d.flavor.length && moveCount % 4 === 0) {
      line += ' ' + d.flavor[Math.floor(Math.random() * d.flavor.length)];
    }

    if (marker) line += ' ' + markerStatus();
    say(line);
    if (marker && marker.x === pos.x && marker.y === pos.y) {
      marker = null; saveState();
      setTimeout(() => say('You have reached your marker. Marker cleared.'), 1600);
    }
  }

  function markerStatus() {
    const dx = marker.x - pos.x, dy = marker.y - pos.y;
    const parts = [];
    if (dy !== 0) parts.push(`${Math.abs(dy)} blocks ${dy < 0 ? 'north' : 'south'}`);
    if (dx !== 0) parts.push(`${Math.abs(dx)} blocks ${dx > 0 ? 'east' : 'west'}`);
    return parts.length ? `Marker: ${parts.join(', ')}.` : '';
  }

  function lookAround() {
    const d = districtAt(pos.x, pos.y);
    let line = `${intersectionName(pos.x, pos.y)}, ${d ? d.name : 'the city'}. ${d ? d.ambience : ''}`;
    const nearest = city.pois
      .map(p => ({ p, dist: distTo(p.x, p.y) }))
      .sort((a, b) => a.dist - b.dist).slice(0, 3);
    line += ' Nearest landmarks: ' + nearest.map(({ p, dist }) =>
      `${p.name}, ${dist} blocks ${dirTo(p.x, p.y)}`).join('. ') + '.';
    say(line);
  }

  /* Echo-ping sonar: pings audibly toward the nearest landmark
     (stereo pan = direction) and lists what's in range. */
  function echoPing() {
    const range = city.sonarRange || 7;
    const near = city.pois
      .map(p => ({ p, dist: distTo(p.x, p.y) }))
      .filter(o => o.dist > 0 && o.dist <= range)
      .sort((a, b) => a.dist - b.dist).slice(0, 3);
    if (!near.length) {
      SFX.panPing(0);
      say('Sonar ping. Open streets — no landmarks in range.');
      return;
    }
    const dx = near[0].p.x - pos.x;
    // Spatial ping FROM the landmark itself; stereo fallback if 3D audio off.
    if (spatialOn && Audio3D.pingAt(near[0].p.x, near[0].p.y)) {
      // pinged in 3D
    } else {
      SFX.panPing(Math.max(-1, Math.min(1, dx / 6)));
    }
    say('Sonar: ' + near.map(({ p, dist }) =>
      `${p.name}, ${dist} blocks ${dirTo(p.x, p.y)}`).join('. ') + '.');
  }

  /* Full guide to the district you're standing in. */
  function districtGuide() {
    const d = districtAt(pos.x, pos.y);
    if (!d) return say('You are between districts.');
    const list = city.pois.filter(p =>
      p.x >= d.x0 && p.x <= d.x1 && p.y >= d.y0 && p.y <= d.y1);
    if (!list.length) return say(`${d.name} has no landmarks yet.`);
    SFX.play('ping');
    say(`${d.name} guide. ` + list.map(p =>
      `${p.name}, ${distTo(p.x, p.y)} blocks ${dirTo(p.x, p.y)}`).join('. ') + '.');
  }

  /* Go-to menu: hear a numbered landmark list, press its number. */
  function openGoto() {
    if (gotoActive) { gotoActive = false; return say('Go-to cancelled.'); }
    gotoOptions = city.pois.slice(0, 9);
    gotoActive = true;
    SFX.play('ping');
    say('Go to. ' + gotoOptions.map((p, i) => `${i + 1}: ${p.name}`).join('. ') +
      '. Press a number key to set a marker there. Press G to cancel.');
  }
  function pickGoto(n) {
    const p = gotoOptions[n - 1];
    if (!p) return say('No landmark on that number.');
    gotoActive = false;
    marker = { x: p.x, y: p.y };
    saveState(); paintHUD(); City3D.setMarker(marker);
    SFX.play('success');
    say(`Marker set on ${p.name} — ${distTo(p.x, p.y)} blocks ${dirTo(p.x, p.y)}. I will call out the way as you move.`);
  }

  /* Where have you been — the last five intersections. */
  function breadcrumbs() {
    if (history.length < 2) return say('You have barely moved. No trail yet.');
    const trail = history.slice(-6, -1).reverse()
      .map(h => intersectionName(h.x, h.y));
    say('Your trail, newest first: ' + trail.join('. ') + '.');
  }

  function move(dx, dy) {
    const step = riding ? 3 : 1;
    const nx = Math.max(0, Math.min(N() - 1, pos.x + dx * step));
    const ny = Math.max(0, Math.min(N() - 1, pos.y + dy * step));
    if (nx === pos.x && ny === pos.y) {
      // GHLT MOVE - edge of city, halki awaz for wrong
      try {
        if (typeof OGAudio !== 'undefined' && OGAudio.isEnabled()) {
          OGAudio.playRealSFX('wrong');
        } else {
          SFX.play('fail');
        }
      } catch (e) { SFX.play('fail'); }
      say('Edge of the mapped city. The rest waits for a future chapter.');
      return;
    }
    const dirWord = { '0,-1': 'Heading north', '0,1': 'Heading south', '-1,0': 'Heading west', '1,0': 'Heading east' }[`${dx},${dy}`] || 'Moving';
    const before = marker ? distTo(marker.x, marker.y) : null;
    pos.x = nx; pos.y = ny;
    facing = { x: dx, y: dy };
    const after = marker ? distTo(marker.x, marker.y) : null;
    const wrongWay = before !== null && after > before;
    history.push({ x: pos.x, y: pos.y });
    if (history.length > 30) history.shift();
    paintWorld(); paintHUD(); saveState();
    City3D.setPlayer(pos.x, pos.y, facing.x, facing.y);
    if (!view3d) Audio3D.updateListener(pos.x, pos.y, facing.x, facing.y);
    if (riding) {
      SFX.play('tick');
      try { if (typeof OGAudio !== 'undefined') OGAudio.stopFootsteps(); } catch (e) {}
    } else {
      stepSide = -stepSide;
      const d = districtAt(pos.x, pos.y);
      // BLIND-FRIENDLY: Realistic footstep sounds from Mixkit/OGA CC0 (real recorded)
      try {
        if (typeof Realistic !== 'undefined' && Realistic.isEnabled()) {
          // Choose footstep surface based on district for realism
          let surface = 'concrete';
          if (d) {
            if (d.id === 'harborfront' || d.id === 'industrial') surface = 'stone';
            else if (d.id === 'old_chapel' || d.id === 'upperhills' || d.id === 'garden') surface = 'grass';
            else if (d.id === 'midtown') surface = 'concrete';
          }
          Realistic.playFootstep(surface);
          console.log(`[City] Realistic footstep: ${surface} from Mixkit/OGA`);
          // Ambient city life based on district
          if (moveCount % 8 === 0 && d) {
            if (d.id === 'midtown') Realistic.playCityAmbience('city');
            else if (d.id === 'industrial') Realistic.play('city_traffic');
            else if (d.id === 'harborfront') Realistic.playCityAmbience('rain');
          }
        } else if (typeof OGAudio !== 'undefined' && OGAudio.isEnabled()) {
          // Fallback to OGA
          if (d && (d.id === 'harborfront' || d.id === 'industrial')) {
            OGAudio.playRealSFX('step_wet');
          } else if (d && (d.id === 'old_chapel' || d.id === 'upperhills')) {
            OGAudio.playRealSFX('step_wood');
          } else {
            OGAudio.playRealSFX('step');
          }
          if (moveCount % 8 === 0 && d) {
            if (d.id === 'midtown') OGAudio.playAmbient('city');
            else if (d.id === 'industrial') OGAudio.playAmbient('construction');
            else if (d.id === 'harborfront') OGAudio.playAmbient('water');
            else if (d.id === 'southside') OGAudio.playAmbient('machine');
          }
        } else if (typeof Spatial !== 'undefined' && Spatial.isEnabled()) {
          Spatial.footstep();
        } else {
          SFX.play('step', stepSide * 0.45);
        }
      } catch (e) {
        if (typeof Spatial !== 'undefined' && Spatial.isEnabled()) Spatial.footstep();
        else SFX.play('step', stepSide * 0.45);
      }
    }
    describeMove(dirWord, wrongWay);
  }

  /* ---------- POI interaction - with wrong sound ---------- */
  function interact() {
    const poi = poiAt(pos.x, pos.y);
    if (!poi) { 
      // GHLT - empty block, halki awaz
      try {
        if (typeof OGAudio !== 'undefined' && OGAudio.isEnabled()) {
          OGAudio.playRealSFX('wrong');
        } else {
          SFX.play('fail');
        }
      } catch (e) { SFX.play('fail'); }
      say('An empty block. Brick, streetlight, and wind.'); 
      return; 
    }
    const a = poi.action || {};
    const speakLines = () => (a.speakerLines || [{ speaker: 'glasses', text: poi.describe }])
      .reduce((acc, l) => acc + ' ' + l.text, poi.name + '.');

    if (a.type === 'heal') {
      Economy.apply({ health: Economy.state.maxHealth });
      SFX.play('success');
      say(speakLines());
    } else if (a.type === 'buff') {
      if (Economy.state.cc < a.cost) {
        SFX.play('fail');
        say(a.notEnough || `You need ${a.cost} CC.`);
        return;
      }
      Economy.apply({ cc: -a.cost, health: a.health || 0, setFlag: a.flag });
      Economy.save();
      SFX.play('coin');
      say(speakLines());
    } else {
      SFX.play('ping');
      say(speakLines());
    }
    paintHUD();
  }

  /* ---------- markers & Bonnie ---------- */
  function setMarker() {
    marker = { x: pos.x, y: pos.y };
    saveState(); paintHUD(); City3D.setMarker(marker);
    SFX.play('success');
    say(`Marker set at ${intersectionName(pos.x, pos.y)}. Press N anytime to hear the way.`);
  }
  function navigate() {
    if (!marker) { say('No marker set. Press M to mark where you stand.'); return; }
    const st = markerStatus();
    say(st ? `${st} I will call it out as we move.` : 'You are standing on your marker.');
  }
  function clearMarker() {
    if (!marker) { say('No marker to clear.'); return; }
    marker = null; saveState(); paintHUD(); City3D.setMarker(null);
    say('Marker cleared.');
  }
  function toggleBonnie() {
    riding = !riding;
    saveState(); paintHUD();
    if (riding) {
      SFX.startEngine();
      SFX.play('success');
      say('Bonnie rolls up. Riding — three blocks with every step. Press B to stop.');
    } else {
      SFX.stopEngine();
      say('You step out of Bonnie. On foot again.');
    }
  }

  function sayInventory() {
    const s = Economy.state;
    const names = {
      'data-drive': 'the FIRST ECHO data drive', 'case-files': "Salena's case files",
      'music-box': "Mama's music box", 'the-hurricane': 'The Hurricane hand cannon',
      'iron-chef': 'Iron Chef armor', 'precinct-ledger': 'the precinct ledger',
    };
    const items = s.items.map(i => names[i] || i);
    SFX.play('pickup');
    say(`Case file. ${s.cc.toLocaleString()} CC, level ${s.level}. Carrying: ${items.length ? items.join(', ') : 'nothing yet'}. Health ${s.health} of ${s.maxHealth}.`);
  }

  /* ---------- persistence ---------- */
  function saveState() {
    localStorage.setItem('ccs-city', JSON.stringify({ x: pos.x, y: pos.y, riding, marker }));
  }
  function loadState() {
    try {
      const raw = localStorage.getItem('ccs-city');
      if (raw) {
        const s = JSON.parse(raw);
        if (Number.isInteger(s.x) && Number.isInteger(s.y)) pos = { x: s.x, y: s.y };
        riding = !!s.riding;
        marker = s.marker || null;
      }
    } catch (e) {}
  }

  /* ---------- enter / exit ---------- */
  async function enter() {
    if (!city) city = await loadCity();
    loadState();

    // FIX: Stop lobby loud music when entering city free roam
    try { if (typeof Music !== 'undefined') Music.stop(); if (typeof OGAudio !== 'undefined') OGAudio.stopMusic(true); } catch (e) {}

    // First visit: the crew advances a small stake so the sandbox isn't broke.
    if (Economy.state.cc === 0 && !localStorage.getItem('ccs-city-starter')) {
      Economy.apply({ cc: city.starterCC || 500 });
      Economy.save();
      localStorage.setItem('ccs-city-starter', '1');
    }

    document.getElementById('main-menu').hidden = true;
    $('#game').hidden = true;
    document.getElementById('city').hidden = false;
    active = true;
    gotoActive = false;
    lastDistrict = districtAt(pos.x, pos.y);
    const startPoi = poiAt(pos.x, pos.y);
    const startDistrictMusic = getDistrictMusic(lastDistrict);
    const startMusic = startPoi ? (getPoiMusic(startPoi) || startDistrictMusic) : startDistrictMusic;
    Music.play(startMusic);
    const startArrive = startPoi ? (POI_ARRIVE[startPoi.id] || DIST_ARRIVE[lastDistrict ? lastDistrict.id : 'midtown']) : (DIST_ARRIVE[lastDistrict ? lastDistrict.id : 'midtown'] || 'night');
    Music.arrive(startArrive);
    console.log(`[City] Enter - District: ${lastDistrict?.name} (${startDistrictMusic}) POI: ${startPoi?.name} (${startMusic})`);
    if (!history.length) history.push({ x: pos.x, y: pos.y });

    /* Face the nearest landmark on entry so the first view has a beacon in it */
    const near0 = city.pois.map(p => ({ p, d: distTo(p.x, p.y) }))
      .sort((a, b) => a.d - b.d)[0]?.p;
    if (near0 && (near0.x !== pos.x || near0.y !== pos.y)) {
      const dx = near0.x - pos.x, dy = near0.y - pos.y;
      facing = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
    }

    /* Reclaim the shared 3D canvas from story mode */
    const cv3 = $('#city-3d');
    const cityStage = document.getElementById('city-stage');
    if (cv3 && cv3.parentNode !== cityStage) cityStage.appendChild(cv3);

    /* 3D world + spatial audio (built from the same city.json) + NEW Spatial system */
    City3D.setFree();
    Audio3D.init();
    Audio3D.buildFrom(city);
    Audio3D.setEnabled(spatialOn);
    // New spatial system for footsteps and fight feel
    if (typeof Spatial !== 'undefined') {
      Spatial.init();
      Spatial.setListener(pos.x, pos.y, 0);
      Spatial.setEnabled(spatialOn);
    }
    if (!City3D.isReady()) City3D.init($('#city-3d'), city);
    view3d = City3D.isReady();
    applyView();
    City3D.setPlayer(pos.x, pos.y, facing.x, facing.y, true);
    City3D.setMarker(marker);
    if (!view3d) Audio3D.updateListener(pos.x, pos.y, facing.x, facing.y);
    setTimeout(checkBlackFrame, 2000);
    const ver = $('#city-ver');
    if (ver) ver.textContent = BUILD;

    buildWorld();
    paintWorld(false);
    paintHUD();
    $('#city-stage').focus();

    const docEl = document.documentElement;
    if (!document.fullscreenElement && docEl.requestFullscreen) {
      docEl.requestFullscreen().catch(() => {});
    }

    say(`Free roam. You are at ${intersectionName(pos.x, pos.y)}, ${lastDistrict ? lastDistrict.name : 'Capitol City'}. ` +
      (view3d ? 'You are in the 3D street view — press C for the overhead map. ' : '') +
      'Listen: every landmark makes its own sound around you — church bells, club bass, a bouncing ball. Wear headphones for true direction. ' +
      'Arrow keys move. P is sonar, G is go-to, K district guide, L look around, B Bonnie, Escape for the menu.');
  }

  /* Switch between 3D street view and 2D overhead map. */
  function applyView() {
    const cityRoot = document.getElementById('city');
    const canvas = $('#city-3d');
    const chip = $('#city-mode');
    if (view3d && City3D.isReady()) {
      cityRoot.classList.add('view3d');
      canvas.hidden = false;
      City3D.resize();
      City3D.start();
      if (chip) chip.textContent = '🎥 3D street view';
    } else {
      cityRoot.classList.remove('view3d');
      canvas.hidden = true;
      City3D.pause();
      if (chip) chip.textContent = '🗺 2D map';
    }
  }

  /* Self-healing: after ~2s of 3D, sample the rendered frame. If the
     device's GL output is black, fall back to the map and say so. */
  function checkBlackFrame() {
    if (!active || !view3d) return;
    const lum = City3D.sampleLuminance();
    if (lum >= 0 && lum < 6) {
      view3d = false;
      applyView();
      Audio3D.updateListener(pos.x, pos.y, facing.x, facing.y);
      say('The 3D view rendered black on this device, so I switched to the bright city map. All navigation still works the same.');
    }
  }
  function toggleView() {
    if (!City3D.isReady()) return say('3D view is not available in this browser. Staying on the map.');
    view3d = !view3d;
    applyView();
    City3D.setPlayer(pos.x, pos.y, facing.x, facing.y, true);
    if (!view3d) Audio3D.updateListener(pos.x, pos.y, facing.x, facing.y);
    say(view3d ? '3D street view.' : '2D overhead map.');
  }
  function toggleSpatial() {
    spatialOn = !spatialOn;
    Audio3D.setEnabled(spatialOn);
    say(spatialOn ? '3D city sound on.' : '3D city sound muted. Narration stays.');
  }

  function exit() {
    if (!active) return;
    active = false;
    saveState();
    TTS.stop();
    SFX.stopEngine();
    City3D.pause();
    Audio3D.stop();
    document.getElementById('city').hidden = true;
    Menu.open();
  }

  /* ---------- input ---------- */
  document.addEventListener('keydown', e => {
    if (!active) return;
    const K = e.key;

    // Go-to menu listens for a landmark number
    if (gotoActive && /^[1-9]$/.test(K)) { e.preventDefault(); pickGoto(Number(K)); return; }

    const handled = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D',
                     'Enter',' ','l','L','m','M','n','N','x','X','b','B','p','P','g','G','k','K','u','U',
                     'c','C','o','O','i','I','Escape'];
    if (!handled.includes(K)) return;
    e.preventDefault();

    switch (K) {
      case 'ArrowUp': case 'w': case 'W': move(0, -1); break;
      case 'ArrowDown': case 's': case 'S': move(0, 1); break;
      case 'ArrowLeft': case 'a': case 'A': move(-1, 0); break;
      case 'ArrowRight': case 'd': case 'D': move(1, 0); break;
      case 'Enter': case ' ': interact(); break;
      case 'l': case 'L': lookAround(); break;
      case 'p': case 'P': echoPing(); break;
      case 'g': case 'G': openGoto(); break;
      case 'k': case 'K': districtGuide(); break;
      case 'u': case 'U': breadcrumbs(); break;
      case 'm': case 'M': setMarker(); break;
      case 'n': case 'N': navigate(); break;
      case 'x': case 'X': clearMarker(); break;
      case 'b': case 'B': toggleBonnie(); break;
      case 'c': case 'C': toggleView(); break;
      case 'o': case 'O': toggleSpatial(); break;
      case 'i': case 'I': sayInventory(); break;
      case 'Escape': gotoActive ? (gotoActive = false, say('Go-to cancelled.')) : exit(); break;
    }
  });

  return { enter, exit };
})();
