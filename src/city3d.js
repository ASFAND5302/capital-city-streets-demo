/* ============================================================
   CAPITAL CITY STREETS — src/city3d.js
   First-person 3D city (Three.js/WebGL), built from data/city.json.
   v2 — detailed city: textured facades with window grids, roof
   props (water tanks, antennas, AC units), sidewalks, dashed
   lanes, crosswalks, parked cars, neon signs, street lamps.
   ============================================================ */

const City3D = (() => {
  const S = 6;                 // world units per block (matches Audio3D)
  const EYE = 1.7;
  let renderer, scene, camera, markerMesh, poiGroup;
  let ready = false, running = false;
  let target = { x: 0, z: 0, yaw: 0 };
  let lastTime = 0;
  let traffic = [], trafficBody = null, headGeo = null, tailGeo = null, cityN = 0;
  let peds = [], pedMesh = null;
  let neonMesh = null, neonBase = [], flickerT = 0;
  let bobPhase = 0;
  let mode = 'free';                 // 'free' | 'story' | 'ride'
  let storyYaw = 0, idleT = 0;
  let ridePts = null, rideT = 0, rideDur = 6;
  let shakeT = 0;

  function seededRand(i, j, k) {
    let h = (i * 374761393 + j * 668265263 + k * 2147483647) >>> 0;
    h = (h ^ (h >> 13)) * 1274126177 >>> 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  }

  function glowTexture(color) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, color);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }

  /* Procedural facade: wall + window grid (some lit) + street door */
  function facadeTexture(wall, palette, rows, cols, litProb, seed) {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = wall; g.fillRect(0, 0, 128, 256);
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, 'rgba(255,255,255,0.07)');
    grd.addColorStop(1, 'rgba(0,0,0,0.30)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 256);
    const cw = 128 / cols, ch = 256 / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = seededRand(seed + r, c, 5) < litProb;
        if (lit) {
          const col = palette[Math.floor(seededRand(seed + r, c, 8) * palette.length) % palette.length];
          g.fillStyle = col;
          g.globalAlpha = 0.55 + seededRand(seed + r, c, 9) * 0.45;
        } else {
          g.fillStyle = 'rgba(8,10,18,0.92)';
          g.globalAlpha = 1;
        }
        g.fillRect(c * cw + cw * 0.22, r * ch + ch * 0.2, cw * 0.56, ch * 0.6);
        g.globalAlpha = 1;
      }
    }
    g.fillStyle = '#070910';
    g.fillRect(56, 230, 16, 26);                       // entrance
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    return tex;
  }

  function init(canvas, city) {
    if (!window.THREE) return false;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;   // cinematic contrast
      renderer.toneMappingExposure = 1.15;
    } catch (e) { return false; }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x16162a);
    scene.fog = new THREE.FogExp2(0x16162a, 0.010);

    camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.1, 500);
    camera.position.set(0, EYE, 0);

    scene.add(new THREE.HemisphereLight(0xcdd6f2, 0x58475e, 1.3));
    const moon = new THREE.DirectionalLight(0xb7c4ea, 1.0);
    moon.position.set(-50, 70, -40);
    scene.add(moon);
    const warmFill = new THREE.DirectionalLight(0xffd9a0, 0.4);
    warmFill.position.set(40, 25, 50);
    scene.add(warmFill);

    buildSky();
    buildCity(city);
    resize();
    ready = true;
    return true;
  }

  function buildSky() {
    /* dusk gradient dome */
    const skyCv = document.createElement('canvas');
    skyCv.width = 2; skyCv.height = 256;
    const sg2 = skyCv.getContext('2d');
    const grad = sg2.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#05050f');
    grad.addColorStop(0.45, '#101024');
    grad.addColorStop(0.66, '#241b3a');
    grad.addColorStop(0.76, '#4a2f4e');   // dusk band
    grad.addColorStop(0.82, '#7a4a52');   // warm city-glow horizon
    grad.addColorStop(0.90, '#1a1426');
    grad.addColorStop(1.0, '#0a0812');
    sg2.fillStyle = grad;
    sg2.fillRect(0, 0, 2, 256);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(430, 24, 16),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(skyCv), side: THREE.BackSide, fog: false }));
    scene.add(dome);

    const starPos = [];
    for (let i = 0; i < 900; i++) {
      const a = seededRand(i, 1, 7) * Math.PI * 2;
      const r = 200 + seededRand(i, 2, 7) * 120;
      const y = 40 + seededRand(i, 3, 7) * 200;
      starPos.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({
      color: 0xcdd6ff, size: 1.1, transparent: true, opacity: 0.8, fog: false })));

    /* moon: cratered disc + halo */
    const mCv = document.createElement('canvas');
    mCv.width = mCv.height = 128;
    const mg = mCv.getContext('2d');
    mg.fillStyle = '#e8ecf7';
    mg.beginPath(); mg.arc(64, 64, 58, 0, 7); mg.fill();
    mg.fillStyle = 'rgba(160,170,200,0.5)';
    [[40,50,10],[78,42,7],[66,80,12],[46,86,6],[88,70,5]].forEach(([x,y,r]) => {
      mg.beginPath(); mg.arc(x, y, r, 0, 7); mg.fill();
    });
    const moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(mCv), transparent: true, fog: false }));
    moonDisc.scale.set(26, 26, 1);
    moonDisc.position.set(-160, 130, -190);
    scene.add(moonDisc);
    const moonSp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(220,230,255,0.8)'), transparent: true, opacity: 0.55, fog: false }));
    moonSp.scale.set(70, 70, 1);
    moonSp.position.set(-160, 130, -190);
    scene.add(moonSp);
  }

  function buildCity(city) {
    const n = city.gridSize;
    cityN = n;
    const size = n * S;
    const cx = (n - 1) * S / 2, cz = (n - 1) * S / 2;
    const dummy = new THREE.Object3D();
    const GAP = 1.5;

    /* ---------- ground ---------- */
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size + 260, size + 260),
      new THREE.MeshLambertMaterial({ color: 0x1b1b28 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(cx, 0, cz);
    scene.add(ground);

    /* ---------- roads: asphalt strips (instanced planes) ---------- */
    const roadGeo = new THREE.PlaneGeometry(1, 1);
    const roads = new THREE.InstancedMesh(roadGeo,
      new THREE.MeshLambertMaterial({ color: 0x2a2a3a }), n * 2);
    let ri = 0;
    for (let i = 0; i < n; i++) {
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(2.7, size + 2 * S, 1);
      dummy.position.set(i * S, 0.02, cz); dummy.updateMatrix();
      roads.setMatrixAt(ri++, dummy.matrix);
      dummy.scale.set(size + 2 * S, 2.7, 1);
      dummy.position.set(cx, 0.02, i * S); dummy.updateMatrix();
      roads.setMatrixAt(ri++, dummy.matrix);
    }
    scene.add(roads);

    /* ---------- sidewalks: raised strips both sides of each road ---------- */
    const walks = new THREE.InstancedMesh(roadGeo,
      new THREE.MeshLambertMaterial({ color: 0x3c3c52 }), n * 4);
    let wi = 0;
    for (let i = 0; i < n; i++) {
      for (const off of [-1.75, 1.75]) {
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(0.8, size + 2 * S, 1);
        dummy.position.set(i * S + off, 0.06, cz); dummy.updateMatrix();
        walks.setMatrixAt(wi++, dummy.matrix);
        dummy.scale.set(size + 2 * S, 0.8, 1);
        dummy.position.set(cx, 0.06, i * S + off); dummy.updateMatrix();
        walks.setMatrixAt(wi++, dummy.matrix);
      }
    }
    scene.add(walks);

    /* ---------- center lane dashes ---------- */
    const dashPts = [];
    for (let i = 0; i < n; i++) {
      for (let t = 0; t < size; t += 3) {
        dashPts.push(i * S, 0.05, t, i * S, 0.05, Math.min(size, t + 1.3));
        dashPts.push(t, 0.05, i * S, Math.min(size, t + 1.3), 0.05, i * S);
      }
    }
    const dashGeo = new THREE.BufferGeometry();
    dashGeo.setAttribute('position', new THREE.Float32BufferAttribute(dashPts, 3));
    scene.add(new THREE.LineSegments(dashGeo,
      new THREE.LineBasicMaterial({ color: 0xd8c98c, transparent: true, opacity: 0.4 })));

    /* ---------- crosswalks at major intersections ---------- */
    const cw = [];
    const Y = 0.07;
    const quad = (qx, qz, w, d) => {
      const x0 = qx - w / 2, x1 = qx + w / 2, z0 = qz - d / 2, z1 = qz + d / 2;
      cw.push(x0, Y, z0, x1, Y, z0, x1, Y, z1, x0, Y, z0, x1, Y, z1, x0, Y, z1);
    };
    for (let i = 0; i < n; i += 5) for (let j = 0; j < n; j += 5) {
      for (let s = -3; s <= 3; s++) {          // zebra bars on each approach
        quad(i * S + s * 0.5, j * S - 2.1, 0.3, 1.2);
        quad(i * S + s * 0.5, j * S + 2.1, 0.3, 1.2);
        quad(i * S - 2.1, j * S + s * 0.5, 1.2, 0.3);
        quad(i * S + 2.1, j * S + s * 0.5, 1.2, 0.3);
      }
    }
    const cwGeo = new THREE.BufferGeometry();
    cwGeo.setAttribute('position', new THREE.Float32BufferAttribute(cw, 3));
    scene.add(new THREE.Mesh(cwGeo,
      new THREE.MeshBasicMaterial({ color: 0xbfc4dd, transparent: true, opacity: 0.5 })));

    /* ---------- buildings: facade-textured, bucketed ---------- */
    const WALLS = { old_chapel: '#2c2738', midtown: '#243044', southside: '#362c26' };
    const PALS = {
      old_chapel: ['#ffd98c', '#e8d9a8', '#c9b8ff'],
      midtown:    ['#ffd98c', '#ff6ec7', '#7fd4ff', '#bfe3ff'],
      southside:  ['#ffb46b', '#ffd98c', '#ff8a5c'],
    };
    const buckets = {};   // key district|bucket -> boxes[]
    const roofProps = { tank: [], ant: [], ac: [] };
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - 1; j++) {
        const d = districtFor(city, i, j);
        const dist = d ? d.id : 'old_chapel';
        const count = 1 + Math.floor(seededRand(i, j, 1) * 2.4);
        for (let b = 0; b < count; b++) {
          const w = 1.6 + seededRand(i, j, b + 2) * (S - 2 * GAP - 1.6);
          const h = 4 + seededRand(i, j, b + 9) * 18;
          const maxOff = Math.max(0, (S - 2 * GAP - w) / 2);
          const x = (i + 0.5) * S + (seededRand(i, j, b + 20) - 0.5) * 2 * maxOff;
          const z = (j + 0.5) * S + (seededRand(i, j, b + 30) - 0.5) * 2 * maxOff;
          const bucket = h < 8 ? 0 : h < 14 ? 1 : 2;
          (buckets[dist + '|' + bucket] = buckets[dist + '|' + bucket] || [])
            .push({ x, z, w, h });
          // roof props
          const r = seededRand(i, j, b + 50);
          if (r < 0.3) roofProps.tank.push([x + (seededRand(i, j, b + 51) - .5) * w * .5, h, z + (seededRand(i, j, b + 52) - .5) * w * .5]);
          if (r > 0.55) roofProps.ant.push([x, h, z]);
          if (r > 0.3 && r < 0.75) roofProps.ac.push([x - w * .25, h, z + w * .25]);
        }
      }
    }
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x14141d });
    const rowsFor = [6, 10, 14];
    for (const [key, boxes] of Object.entries(buckets)) {
      const [dist, bucket] = key.split('|');
      const tex = facadeTexture(WALLS[dist] || WALLS.old_chapel,
        PALS[dist] || PALS.old_chapel, rowsFor[+bucket], 6, 0.42, +bucket * 17 + dist.length);
      const fac = new THREE.MeshLambertMaterial({ map: tex });
      const mesh = new THREE.InstancedMesh(boxGeo,
        [fac, fac, roofMat, roofMat, fac, fac], boxes.length);
      boxes.forEach((b, idx) => {
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(b.w, b.h, b.w);
        dummy.position.set(b.x, b.h / 2, b.z);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
      });
      scene.add(mesh);
    }

    /* ---------- distant skyline ring (no more void at the map edge) ---------- */
    const ringCount = 110;
    const skyMesh = new THREE.InstancedMesh(boxGeo,
      new THREE.MeshLambertMaterial({ color: 0x1a1a28 }), ringCount);
    for (let i2 = 0; i2 < ringCount; i2++) {
      const a = (i2 / ringCount) * Math.PI * 2 + seededRand(i2, 21, 4) * 0.2;
      const r = size * 0.72 + seededRand(i2, 11, 4) * 110;
      const h = 8 + seededRand(i2, 12, 4) * 28;
      const w = 6 + seededRand(i2, 13, 4) * 9;
      dummy.rotation.set(0, seededRand(i2, 14, 4) * Math.PI, 0);
      dummy.scale.set(w, h, w);
      dummy.position.set(cx + Math.cos(a) * r, h / 2, cz + Math.sin(a) * r);
      dummy.updateMatrix();
      skyMesh.setMatrixAt(i2, dummy.matrix);
    }
    scene.add(skyMesh);
    // a few lit specks on the far skyline
    const farPts = [];
    for (let i2 = 0; i2 < 240; i2++) {
      const a = seededRand(i2, 31, 4) * Math.PI * 2;
      const r = size * 0.72 + seededRand(i2, 32, 4) * 105;
      farPts.push(cx + Math.cos(a) * r, 2 + seededRand(i2, 33, 4) * 22, cz + Math.sin(a) * r);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(farPts, 3));
    scene.add(new THREE.Points(fg, new THREE.PointsMaterial({
      color: 0xffd98c, size: 0.7, transparent: true, opacity: 0.5 })));

    /* ---------- roof props ---------- */
    const tankMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.4, 0.9, 8),
      new THREE.MeshLambertMaterial({ color: 0x4a3a2c }), Math.max(1, roofProps.tank.length));
    roofProps.tank.forEach(([x, h, z], i2) => {
      dummy.scale.set(1, 1, 1); dummy.position.set(x, h + 0.45, z); dummy.updateMatrix();
      tankMesh.setMatrixAt(i2, dummy.matrix);
    });
    scene.add(tankMesh);
    const antMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.04, 2.4, 4),
      new THREE.MeshLambertMaterial({ color: 0x666a80 }), Math.max(1, roofProps.ant.length));
    roofProps.ant.forEach(([x, h, z], i2) => {
      dummy.position.set(x, h + 1.2, z); dummy.updateMatrix();
      antMesh.setMatrixAt(i2, dummy.matrix);
    });
    scene.add(antMesh);
    const acMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.3, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x555a70 }), Math.max(1, roofProps.ac.length));
    roofProps.ac.forEach(([x, h, z], i2) => {
      dummy.position.set(x, h + 0.15, z); dummy.updateMatrix();
      acMesh.setMatrixAt(i2, dummy.matrix);
    });
    scene.add(acMesh);

    /* ---------- parked cars ---------- */
    const carCols = [0x5c2e2e, 0x2e4a5c, 0x3a3a42, 0x4a4436, 0x2f3a2f];
    const carCount = 60;
    const carBody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.5, 2.0),
      new THREE.MeshLambertMaterial({ color: 0xffffff }), carCount);
    const carTop = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 0.4, 1.1),
      new THREE.MeshLambertMaterial({ color: 0x11131c }), carCount);
    for (let cIdx = 0; cIdx < carCount; cIdx++) {
      const vertical = seededRand(cIdx, 3, 1) < 0.5;
      const line = Math.floor(seededRand(cIdx, 4, 1) * n);
      const t = seededRand(cIdx, 5, 1) * (n - 1) * S;
      const side = seededRand(cIdx, 6, 1) < 0.5 ? 1 : -1;
      const x = vertical ? line * S + side * 1.0 : t;
      const z = vertical ? t : line * S + side * 1.0;
      dummy.rotation.set(0, vertical ? 0 : Math.PI / 2, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(x, 0.35, z); dummy.updateMatrix();
      carBody.setMatrixAt(cIdx, dummy.matrix);
      carBody.setColorAt(cIdx, new THREE.Color(carCols[cIdx % carCols.length]));
      dummy.position.y = 0.75; dummy.updateMatrix();
      carTop.setMatrixAt(cIdx, dummy.matrix);
    }
    scene.add(carBody); scene.add(carTop);

    /* ---------- neon signs (Midtown flavor) ---------- */
    const neonCols = [0xff6ec7, 0x7fd4ff, 0xffd166, 0x66ffb2];
    const neonBoxes = [];
    (buckets['midtown|1'] || []).concat(buckets['midtown|2'] || []).forEach((b, i2) => {
      if (seededRand(i2, 7, 3) < 0.55) {
        const side = Math.floor(seededRand(i2, 8, 3) * 4);
        const e = b.w / 2 + 0.06;
        const x = b.x + (side === 0 ? e : side === 1 ? -e : 0);
        const z = b.z + (side === 2 ? e : side === 3 ? -e : 0);
        neonBoxes.push({ x, z, ry: side * Math.PI / 2, c: neonCols[i2 % 4], h: 2 + seededRand(i2, 9, 3) * 2, y: 2 + seededRand(i2, 10, 3) * 3 });
      }
    });
    if (neonBoxes.length) {
      neonMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 1, 0.6),
        new THREE.MeshBasicMaterial({ color: 0xffffff }), neonBoxes.length);
      neonBoxes.forEach((nb, i2) => {
        dummy.rotation.set(0, nb.ry, 0);
        dummy.scale.set(1, nb.h, 1);
        dummy.position.set(nb.x, nb.y, nb.z); dummy.updateMatrix();
        neonMesh.setMatrixAt(i2, dummy.matrix);
        const c = new THREE.Color(nb.c);
        neonMesh.setColorAt(i2, c);
        neonBase.push(c.clone());
      });
      scene.add(neonMesh);
    }

    /* ---------- living traffic: cars with head/tail lights ---------- */
    const T = 14;
    trafficBody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.5, 2.0),
      new THREE.MeshLambertMaterial({ color: 0xffffff }), T);
    traffic = [];
    for (let t = 0; t < T; t++) {
      traffic.push({
        axis: seededRand(t, 41, 5) < 0.5 ? 0 : 1,
        line: Math.floor(seededRand(t, 42, 5) * n),
        dir: seededRand(t, 43, 5) < 0.5 ? 1 : -1,
        speed: 5 + seededRand(t, 44, 5) * 5,
        pos: seededRand(t, 45, 5) * (n - 1) * S,
        col: new THREE.Color([0x3a3a42, 0x5c2e2e, 0x2e4a5c, 0x4a4436][t % 4]),
      });
    }
    scene.add(trafficBody);
    const mkDyn = (color, sz) => {
      const ggeo = new THREE.BufferGeometry();
      ggeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(T * 2 * 3), 3));
      ggeo.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
      scene.add(new THREE.Points(ggeo, new THREE.PointsMaterial({
        color, size: sz, transparent: true, opacity: 0.95 })));
      return ggeo;
    };
    headGeo = mkDyn(0xfff2c9, 0.5);
    tailGeo = mkDyn(0xff4040, 0.42);

    /* ---------- pedestrians on the sidewalks ---------- */
    const P = 12;
    pedMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.22, 1.7, 6),
      new THREE.MeshLambertMaterial({ color: 0xffffff }), P);
    peds = [];
    for (let i2 = 0; i2 < P; i2++) {
      peds.push({
        axis: seededRand(i2, 61, 6) < .5 ? 0 : 1,
        line: Math.floor(seededRand(i2, 62, 6) * n),
        dir: seededRand(i2, 63, 6) < .5 ? 1 : -1,
        speed: .8 + seededRand(i2, 64, 6) * .8,
        pos: seededRand(i2, 65, 6) * (n - 1) * S,
      });
      pedMesh.setColorAt(i2, new THREE.Color().setHSL(seededRand(i2, 66, 6), .3, .22 + seededRand(i2, 67, 6) * .15));
    }
    scene.add(pedMesh);

    /* ---------- street lamps (instanced + glow points) ---------- */
    const lampPos = [];
    for (let i = 0; i < n; i += 3) for (let j = 0; j < n; j += 3) {
      lampPos.push([i * S + 1.9, j * S + 1.9]);
    }
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.09, 3.4, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a3a4a }), lampPos.length);
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd98c }), lampPos.length);
    const glowPts = [];
    lampPos.forEach(([x, z], i2) => {
      dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      dummy.position.set(x, 1.7, z); dummy.updateMatrix();
      poles.setMatrixAt(i2, dummy.matrix);
      dummy.position.set(x, 3.45, z); dummy.updateMatrix();
      bulbs.setMatrixAt(i2, dummy.matrix);
      glowPts.push(x, 3.45, z);
    });
    scene.add(poles); scene.add(bulbs);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(glowPts, 3));
    scene.add(new THREE.Points(gg, new THREE.PointsMaterial({
      map: glowTexture('rgba(255,214,140,1)'), size: 2.8, transparent: true,
      opacity: 0.5, depthWrite: false })));

    /* ---------- landmarks ---------- */
    poiGroup = new THREE.Group();
    for (const p of city.pois) {
      const x = p.x * S, z = p.y * S;
      const plaza = new THREE.Mesh(new THREE.CircleGeometry(2.3, 24),
        new THREE.MeshBasicMaterial({ color: 0x3d3450, transparent: true, opacity: 0.9 }));
      plaza.rotation.x = -Math.PI / 2;
      plaza.position.set(x, 0.09, z);
      poiGroup.add(plaza);
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 9, 10),
        new THREE.MeshBasicMaterial({ color: 0xf5b942, transparent: true, opacity: 0.8 }));
      beacon.position.set(x, 4.5, z);
      poiGroup.add(beacon);
      const light = new THREE.PointLight(0xf5b942, 1.1, 20);
      light.position.set(x, 3.5, z);
      poiGroup.add(light);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture('rgba(245,185,66,1)'), transparent: true, opacity: 0.5, depthWrite: false }));
      gl.scale.set(5, 5, 1);
      gl.position.set(x, 1.4, z);
      poiGroup.add(gl);
      poiGroup.add(makeLabel(p.icon, p.name, x, z));
      buildLandmark(p);
    }
    scene.add(poiGroup);

    markerMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.85 }));
    markerMesh.visible = false;
    scene.add(markerMesh);
  }

  function districtFor(city, i, j) {
    return city.districts.find(d => i >= d.x0 && i <= d.x1 && j >= d.y0 && j <= d.y1) || null;
  }

  /* ---------- unique landmark structures ---------- */
  function buildLandmark(p) {
    const x = p.x * S, z = p.y * S;
    const g = new THREE.Group();
    const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
    const glow = (c) => new THREE.MeshBasicMaterial({ color: c });
    const box = (w, h, d, m, px, py, pz) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(px, py, pz); g.add(b); return b;
    };
    switch (p.id) {
      case 'st_verity_church': {
        box(3.4, 4.2, 5, lam(0x57506b), 0, 2.1, 0);                       // nave
        box(1.4, 6.5, 1.4, lam(0x645c78), 0, 3.2, -2.2);                 // tower
        const spire = new THREE.Mesh(new THREE.ConeGeometry(1.0, 3.2, 4), lam(0x3a3350));
        spire.position.set(0, 8, -2.2); spire.rotation.y = Math.PI / 4; g.add(spire);
        box(0.12, 1.1, 0.12, glow(0xfff2c9), 0, 10, -2.2);               // cross v
        box(0.6, 0.12, 0.12, glow(0xfff2c9), 0, 9.7, -2.2);              // cross h
        break;
      }
      case 'velvet_room': {
        box(4, 3.4, 4, lam(0x2c2138), 0, 1.7, 0);
        box(4.4, 0.7, 0.25, glow(0xff2f8e), 0, 3.2, 2.1);                // marquee
        box(0.2, 3, 0.2, glow(0xff6ec7), -2.1, 1.6, 2.1);
        box(0.2, 3, 0.2, glow(0xff6ec7), 2.1, 1.6, 2.1);
        break;
      }
      case 'movie_theater': {
        box(4.4, 4.4, 4, lam(0x28303f), 0, 2.2, 0);
        box(4.8, 1, 0.3, glow(0x7fd4ff), 0, 4, 2.1);                     // marquee
        box(3.4, 2.2, 0.12, glow(0x1a2b3a), 0, 2.4, 2.05);               // poster wall
        break;
      }
      case 'basketball_court': {
        const court = new THREE.Mesh(new THREE.PlaneGeometry(5, 7),
          new THREE.MeshLambertMaterial({ color: 0x2e4a3a }));
        court.rotation.x = -Math.PI / 2; court.position.y = 0.1; g.add(court);
        for (const s of [-1, 1]) {
          box(0.1, 3, 0.1, lam(0x888), 0, 1.5, s * 3.4);                 // pole
          box(1.1, 0.8, 0.08, glow(0xdde3f2), 0, 2.7, s * 3.32);         // board
          box(0.5, 0.06, 0.4, glow(0xff7a2e), 0, 2.35, s * 3.1);         // rim
        }
        break;
      }
      case 'diner_blue_note': {
        box(4, 2.4, 4, lam(0x34405c), 0, 1.2, 0);
        box(4.2, 0.5, 0.3, glow(0x66c7ff), 0, 2.5, 2.05);                // sign
        box(4.2, 0.35, 1, lam(0x7a2f3a), 0, 2, 2.4);                     // awning
        break;
      }
      case 'corner_store': {
        box(3, 2.4, 3, lam(0x4a3a30), 0, 1.2, 0);
        box(3.2, 0.4, 0.9, lam(0xb0562f), 0, 2.2, 1.8);                  // awning
        box(1.6, 0.5, 0.12, glow(0xffd166), 0, 2.6, 1.55);               // sign
        break;
      }
      case 'bonnie_garage': {
        box(5, 2.6, 4.4, lam(0x2c2c38), 0, 1.3, 0);
        box(3, 1.8, 0.12, glow(0x3a4a5c), 0, 0.95, 2.21);                // shutter
        box(3, 0.25, 0.14, glow(0x9fd4ff), 0, 2.1, 2.22);                // strip light
        break;
      }
      case 'pawnshop_ledger': {
        box(3, 3, 3, lam(0x3c3428), 0, 1.5, 0);
        box(1.4, 0.9, 0.14, glow(0xf5b942), 0, 2.6, 1.55);               // gold sign
        break;
      }
      case 'safehouse': {
        box(3, 2.8, 3, lam(0x33304a), 0, 1.4, 0);
        const porch = new THREE.PointLight(0xffd98c, 0.7, 8);
        porch.position.set(0, 2.2, 1.7); g.add(porch);
        box(0.2, 0.2, 0.2, glow(0xffd98c), 0, 2.2, 1.6);
        break;
      }
      case 'salena_apartment': {
        box(3.4, 6.5, 3.4, lam(0x3a3550), 0, 3.25, 0);
        box(2, 0.12, 0.12, glow(0xffe066), -0.6, 1.1, 1.75);             // police tape
        box(2, 0.12, 0.12, glow(0xffe066), 0.6, 1.3, 1.75);
        break;
      }
    }
    g.position.set(x, 0, z);
    scene.add(g);
  }

  function makeLabel(icon, text, x, z) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d');
    g.font = '64px serif';
    g.textAlign = 'center';
    g.fillText(icon, 128, 66);
    g.font = '600 20px system-ui, sans-serif';
    g.fillStyle = '#f2efe6';
    g.strokeStyle = '#000'; g.lineWidth = 4;
    g.strokeText(text, 128, 108);
    g.fillText(text, 128, 108);
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sp.scale.set(7, 3.5, 1);
    sp.position.set(x, 9.6, z);
    return sp;
  }

  /* ---------- runtime ---------- */
  function setPlayer(gx, gz, fx, fz, instant = false) {
    if (!renderer) return;
    target.x = gx * S; target.z = gz * S;
    if (fx !== 0 || fz !== 0) target.yaw = Math.atan2(fx, -fz);
    if (instant || !running) {
      camera.position.set(target.x, EYE, target.z);
      applyYaw(target.yaw);
    }
  }

  function applyYaw(yaw) {
    camera.lookAt(camera.position.x + Math.sin(yaw), camera.position.y, camera.position.z - Math.cos(yaw));
  }

  function setMarker(g) {
    if (!markerMesh) return;
    if (!g) { markerMesh.visible = false; return; }
    markerMesh.visible = true;
    markerMesh.position.set(g.x * S, 8, g.y * S);
  }

  /* ---------- story-mode camera: fixed shot, cinematic idle ---------- */
  function storyShot(gx, gy, lx, ly) {
    if (!renderer) return;
    mode = 'story';
    target.x = gx * S; target.z = gy * S;
    storyYaw = Math.atan2((lx - gx), -(ly - gy));
    camera.position.set(target.x, EYE, target.z);
    applyYaw(storyYaw);
    resize();
    start();
  }

  /* ---------- ride: camera drives along a polyline of grid points ---------- */
  function ridePath(gridPts, seconds) {
    if (!renderer) return;
    mode = 'ride';
    ridePts = gridPts.map(([x, y]) => ({ x: x * S, z: y * S }));
    rideT = 0;
    rideDur = seconds || 6;
    camera.position.set(ridePts[0].x, EYE, ridePts[0].z);
    resize();
    start();
  }

  function setFree() { mode = 'free'; }

  /* camera kick on combat damage */
  function shake() { shakeT = 0.5; }

  function resize() {
    if (!renderer) return;
    const cv = renderer.domElement;
    const w = cv.clientWidth || cv.parentNode.clientWidth || 800;
    const h = cv.clientHeight || cv.parentNode.clientHeight || 450;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function start() {
    if (!ready || running) return;
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
  function pause() { running = false; }

  const _dummy = { m: null };
  function loop(t) {
    if (!running) return;
    const dt = Math.min(50, t - lastTime) / 1000;
    lastTime = t;

    const k = 1 - Math.pow(0.0001, dt);

    if (mode === 'story') {
      // locked cinematic shot with a slow handheld sway
      idleT += dt;
      camera.position.x += (target.x - camera.position.x) * k;
      camera.position.z += (target.z - camera.position.z) * k;
      camera.position.y = EYE + Math.sin(idleT * 0.8) * 0.02;
      const sway = Math.sin(idleT * 0.25) * 0.03;
      applyYaw(storyYaw + sway);
    } else if (mode === 'ride' && ridePts && ridePts.length > 1) {
      rideT += dt;
      const u = Math.min(1, rideT / rideDur);
      // arc-length position along the polyline
      const segs = [];
      let total = 0;
      for (let i2 = 0; i2 < ridePts.length - 1; i2++) {
        const L = Math.hypot(ridePts[i2 + 1].x - ridePts[i2].x, ridePts[i2 + 1].z - ridePts[i2].z);
        segs.push(L); total += L;
      }
      let dist = u * total, i2 = 0;
      while (i2 < segs.length - 1 && dist > segs[i2]) { dist -= segs[i2]; i2++; }
      const a = ridePts[i2], b = ridePts[i2 + 1];
      const f = segs[i2] ? dist / segs[i2] : 0;
      camera.position.x = a.x + (b.x - a.x) * f;
      camera.position.z = a.z + (b.z - a.z) * f;
      camera.position.y = EYE + Math.sin(rideT * 7) * 0.02;   // road hum
      applyYaw(Math.atan2(b.x - a.x, -(b.z - a.z)));
      if (u >= 1) mode = 'story', storyYaw = currentYaw(), target.x = camera.position.x, target.z = camera.position.z;
    } else {
      camera.position.x += (target.x - camera.position.x) * k;
      camera.position.z += (target.z - camera.position.z) * k;

      // subtle walking head-bob
      const moving = Math.hypot(target.x - camera.position.x, target.z - camera.position.z) > 0.1;
      if (moving) bobPhase += dt * 9;
      camera.position.y = EYE + Math.sin(bobPhase) * 0.035;

      let dy = target.yaw - currentYaw();
      while (dy > Math.PI) dy -= 2 * Math.PI;
      while (dy < -Math.PI) dy += 2 * Math.PI;
      applyYaw(currentYaw() + dy * k);
    }

    // damage shake
    if (shakeT > 0) {
      shakeT -= dt;
      camera.position.x += (Math.random() - 0.5) * shakeT * 0.3;
      camera.position.y += (Math.random() - 0.5) * shakeT * 0.2;
    }

    updateTraffic(dt);
    updatePeds(dt);
    flickerT += dt;
    if (flickerT > 0.13 && neonMesh) {          // neon signs buzz and flicker
      flickerT = 0;
      const i2 = Math.floor(Math.random() * neonBase.length);
      const dim = 0.35 + Math.random() * 0.85;
      neonMesh.setColorAt(i2, neonBase[i2].clone().multiplyScalar(dim));
      neonMesh.instanceColor.needsUpdate = true;
    }

    Audio3D.updateListener(camera.position.x / S, camera.position.z / S,
      Math.sin(currentYaw()), -Math.cos(currentYaw()));

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  function updateTraffic(dt) {
    if (!trafficBody || !traffic.length) return;
    const d = _dummy.m || (_dummy.m = new THREE.Object3D());
    const span = (cityN - 1) * S;
    const hp = headGeo.attributes.position.array;
    const tp = tailGeo.attributes.position.array;
    traffic.forEach((c, i2) => {
      c.pos += c.speed * dt * c.dir;
      if (c.pos > span + S) c.pos = -S;
      if (c.pos < -S) c.pos = span + S;
      const lane = 0.9 * c.dir;
      let x, z, fx, fz, lx, lz, ry;
      if (c.axis === 0) { x = c.line * S + lane; z = c.pos; fx = 0; fz = c.dir; lx = 1; lz = 0; ry = fz > 0 ? 0 : Math.PI; }
      else { z = c.line * S - lane; x = c.pos; fx = c.dir; fz = 0; lx = 0; lz = 1; ry = fx > 0 ? Math.PI / 2 : -Math.PI / 2; }
      d.rotation.set(0, ry, 0); d.scale.set(1, 1, 1);
      d.position.set(x, 0.35, z); d.updateMatrix();
      trafficBody.setMatrixAt(i2, d.matrix);
      trafficBody.setColorAt(i2, c.col);
      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? 0.32 : -0.32;
        hp[(i2 * 2 + s) * 3]     = x + fx * 1.05 + lx * side;
        hp[(i2 * 2 + s) * 3 + 1] = 0.45;
        hp[(i2 * 2 + s) * 3 + 2] = z + fz * 1.05 + lz * side;
        tp[(i2 * 2 + s) * 3]     = x - fx * 1.05 + lx * side;
        tp[(i2 * 2 + s) * 3 + 1] = 0.45;
        tp[(i2 * 2 + s) * 3 + 2] = z - fz * 1.05 + lz * side;
      }
    });
    trafficBody.instanceMatrix.needsUpdate = true;
    if (trafficBody.instanceColor) trafficBody.instanceColor.needsUpdate = true;
    headGeo.attributes.position.needsUpdate = true;
    tailGeo.attributes.position.needsUpdate = true;
  }

  function updatePeds(dt) {
    if (!pedMesh || !peds.length) return;
    const d = _dummy.m || (_dummy.m = new THREE.Object3D());
    const span = (cityN - 1) * S;
    peds.forEach((p, i2) => {
      p.pos += p.speed * dt * p.dir;
      if (p.pos > span + S) p.pos = -S;
      if (p.pos < -S) p.pos = span + S;
      const off = 1.75 * p.dir;
      const x = p.axis === 0 ? p.line * S + off : p.pos;
      const z = p.axis === 0 ? p.pos : p.line * S + off;
      d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1);
      d.position.set(x, 0.85, z); d.updateMatrix();
      pedMesh.setMatrixAt(i2, d.matrix);
    });
    pedMesh.instanceMatrix.needsUpdate = true;
  }

  function currentYaw() {
    const d = new THREE.Vector3();
    camera.getWorldDirection(d);
    return Math.atan2(d.x, -d.z);
  }

  function sampleLuminance() {
    if (!renderer) return -1;
    try {
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      if (!w || !h) return 0;
      const px = new Uint8Array(4 * 64);
      gl.readPixels((w >> 1) - 4, (h >> 1) - 4, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      return sum / 64;
    } catch (e) { return -1; }
  }

  return { init, setPlayer, setMarker, resize, start, pause, sampleLuminance,
           storyShot, ridePath, setFree, shake, isReady: () => ready };
})();
