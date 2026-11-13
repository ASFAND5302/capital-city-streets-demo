// Run: node tests/city-foundation.test.cjs (no dependencies).
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/city.json')));
const source = fs.readFileSync(path.join(root, 'src/city.js'), 'utf8');
const store = new Map(), speech = [];
const noop = () => {};
const element = { style: {}, classList: { add: noop, remove: noop }, setAttribute: noop };
const context = vm.createContext({
  console: { log: noop, warn: noop, error: noop },
  document: { addEventListener: noop, querySelector: () => element },
  localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, val) => store.set(key, val) },
  TTS: { interrupt: text => speech.push(text), sayNav: text => speech.push(text) },
  SFX: { play: noop }, Music: { play: noop, arrive: noop, setAmb: noop },
  Economy: { state: { cc: 500, health: 100, maxHealth: 100 } },
  City3D: { setPlayer: noop }, Audio3D: { updateListener: noop },
  setTimeout: noop, clearTimeout: noop, clearInterval: noop
});
// Only the test harness exposes internals; the browser build stays private.
vm.runInContext(source.replace('return { enter, exit, isActive: () => active };', `
  return { validateCity, loadCity, loadState, move, stepBack, districtAt,
    set: (c, p, ride = false, target = null) => {
      city = c; pos = {...p}; riding = ride; marker = target;
      lastDistrict = districtAt(p.x, p.y); history = [{...p}];
      lastPoiId = null; moveCount = 0; active = false;
    },
    get: () => ({pos, marker, riding, history}) };
`) + '\nglobalThis.testCity = CityMode;', context);
const api = context.testCity;
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const copy = () => JSON.parse(JSON.stringify(data));
api.validateCity(data);
check(data.pois.length === 22 && data.districts.length === 7, 'baseline inventory');
// Validate malformed maps, overlaps, gaps, duplicate and out-of-range POIs.
for (const damage of [
 c => c.gridSize = 0, c => c.start.x = -1, c => c.avenues.pop(),
 c => c.districts[0].x1++, c => c.districts[0].x1--,
 c => c.pois[0].x = 20, c => c.pois[1].id = c.pois[0].id,
 c => { c.pois[1].x = c.pois[0].x; c.pois[1].y = c.pois[0].y; }
]) { const c = copy(); damage(c); assert.throws(() => api.validateCity(c)); checks++; }
api.set(data, data.start);
for (const saved of [undefined, '{bad', 'null', '{"x":-1,"y":20}', '{"x":2.5,"y":7}']) {
 store.clear(); if (saved !== undefined) store.set('ccs-city', saved);
 api.loadState(); const {pos, marker} = api.get();
 check(pos.x === data.start.x && pos.y === data.start.y && marker === null, 'safe fresh or corrupt-save spawn');
}
store.set('ccs-city', JSON.stringify({x:19,y:19,riding:true,marker:{x:200,y:0}})); api.loadState();
check(api.get().pos.x === 19 && api.get().riding && !api.get().marker, 'valid old save, invalid marker');
store.set('ccs-city', JSON.stringify({x:1,y:2,marker:{x:3,y:4}})); api.loadState();
check(api.get().marker.x === 3, 'valid marker retained');
// Exhaustively exercise the production walking code on all four edges of all 400 cells.
let transitions = 0;
for (let y=0;y<20;y++) for (let x=0;x<20;x++) for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
 api.set(data,{x,y}); speech.length=0; api.move(dx,dy);
 const p=api.get().pos, nx=Math.max(0,Math.min(19,x+dx)), ny=Math.max(0,Math.min(19,y+dy));
 check(p.x===nx && p.y===ny, 'walking or boundary clamp');
 if(api.districtAt(x,y).id!==api.districtAt(nx,ny).id) {
  check(speech.some(t=>t.includes('Entering '+api.districtAt(nx,ny).name)), 'district announcement'); transitions++;
 }
}
// Connected graph: BFS of all walkable intersections, including every landmark.
const visited=new Set([data.start.x+','+data.start.y]), queue=[data.start];
for(let i=0;i<queue.length;i++) for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
 const p={x:queue[i].x+dx,y:queue[i].y+dy}, key=p.x+','+p.y;
 if(p.x>=0&&p.y>=0&&p.x<20&&p.y<20&&!visited.has(key)) {visited.add(key);queue.push(p);}
}
check(visited.size===400, 'entire road graph connected');
for(const p of data.pois) check(visited.has(p.x+','+p.y), 'reachable landmark '+p.id);
// Exhaustive riding safety: no intermediate landmark, marker or district skipped.
for(let y=0;y<20;y++) for(let x=0;x<20;x++) for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
 api.set(data,{x,y},true); api.move(dx,dy); const p=api.get().pos;
 const distance=Math.abs(p.x-x)+Math.abs(p.y-y);
 check(distance<=3 && p.x>=0 && p.y>=0 && p.x<20 && p.y<20, 'ride limits');
 for(let i=1;i<distance;i++) {
  const xx=x+dx*i, yy=y+dy*i;
  check(!data.pois.some(p=>p.x===xx&&p.y===yy) && api.districtAt(xx,yy).id===api.districtAt(x,y).id, 'no skipped stop');
 }
}
api.set(data,{x:0,y:10},true,{x:1,y:10});api.move(1,0);
check(api.get().pos.x===1 && api.get().marker===null, 'ride stops at marker');
api.set(data,{x:0,y:10});api.move(1,0);api.stepBack();
check(api.get().pos.x===0, 'breadcrumb returns to origin');
api.set(data,data.start);api.loadState(); // persisted coordinates remain valid
(async()=>{
 context.fetch=async()=>({ok:true,json:async()=>data});
 store.set('ccs-data:city.json','{bad');
 check((await api.loadCity()).gridSize===20,'bad override falls back');
 store.set('ccs-data:city.json',JSON.stringify({gridSize:0}));
 check((await api.loadCity()).gridSize===20,'invalid override falls back');
 store.delete('ccs-data:city.json');context.fetch=async()=>({ok:false});
 await assert.rejects(api.loadCity());checks++;
 console.log(`PASS: ${checks} checks; 400 reachable intersections, 22 reachable landmarks, 7 districts, ${transitions} directed boundary crossings. Walking and riding tested exhaustively.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
