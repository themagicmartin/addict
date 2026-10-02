// Headless smoke test without a browser: loads dist/index.html's script into a
// node vm with a stub DOM/canvas, then plays a run (steering bot), dies,
// restarts through the same UI handlers the buttons use, and reports errors.
// Usage: node build.js && node tools/headless-check.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');
const code = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

const NUM = { clientWidth: 900, clientHeight: 600, innerWidth: 900, innerHeight: 600, width: 900, height: 600 };
function fake(store) {
  const t = function () {};
  Object.assign(t, store || {});
  return new Proxy(t, {
    get(o, p) {
      if (p in o) return o[p];
      if (p === Symbol.iterator) return function* () {};
      if (p === Symbol.toPrimitive) return () => 0;
      if (p in NUM) return NUM[p];
      if (p === 'then') return undefined;
      return fake();
    },
    set(o, p, v) { o[p] = v; return true; },
    apply() { return fake(); },
    construct() { return fake(); }
  });
}
const els = {};
const listeners = {};
const doc = {
  readyState: 'complete', hidden: false,
  getElementById: id => els[id] || (els[id] = fake()),
  createElement: () => fake(),
  querySelectorAll: () => [], querySelector: () => fake(),
  addEventListener: () => {}
};
const store = {};
const win = {
  document: doc, devicePixelRatio: 1, innerWidth: 900, innerHeight: 600,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); },
  requestAnimationFrame: () => 0, setTimeout: () => 0, performance: { now: () => 0 },
  console, Math, Date, JSON, Object, Array, Number, String, Map, Set, Float32Array, Uint8Array, Uint16Array, Int32Array, Float64Array
};
win.window = win; win.self = win;
win.location = { reload() {} };
Object.assign(win, { addEventListener: win.addEventListener });
const ctx = vm.createContext(new Proxy(win, { get: (o, p) => (p in o ? o[p] : (p in globalThis ? globalThis[p] : undefined)), has: () => true }));
const errors = [];
try { vm.runInContext(code, ctx, { filename: 'bundle.js' }); } catch (e) { errors.push('LOAD: ' + e.stack); }
const OM = win.OM;
if (!OM) { console.error('FAIL: OM not defined', errors); process.exit(1); }

const { G, UI, Input, step, startRun } = OM;
const click = id => { try { els[id].onclick(); } catch (e) { errors.push(id + ': ' + e.stack.split('\n').slice(0, 3).join(' | ')); } };
const guard = (label, fn) => { try { fn(); } catch (e) { errors.push(label + ': ' + e.stack.split('\n').slice(0, 4).join(' | ')); } };

// menu -> character select -> begin
click('btn-play'); click('btn-meta'); click('btn-codex');
guard('renderChars', () => UI.renderChars());
guard('startRun', () => startRun(UI.selectedChar));
if (G.state !== 'play') errors.push('state after start: ' + G.state);

function playOnce(maxSec) {
  let drew = 0, levels = 0, chests = 0;
  for (let i = 0; i < 60 * maxSec && G.state !== 'dead'; i++) {
    if (G.state === 'levelup') { levels++; guard('card', () => UI.chooseCard(0)); continue; }
    if (G.state === 'chest') { chests++; guard('chest', () => { UI.closeChest(); }); G.state = G.state === 'chest' ? 'play' : G.state; continue; }
    if (G.state !== 'play') break;
    Input.keys = Object.create(null);
    Input.keys[['a', 'd', 'w', 's'][(i >> 5) & 3]] = true;
    guard('step', () => step(1 / 60));
    if (i % 30 === 0) guard('draw', () => { OM.draw(); drew++; });
    if (i % 10 === 0) guard('hud', () => UI.syncHud());
    if (errors.length > 8) break;
  }
  return { state: G.state, t: G.t.toFixed(0), levels, chests, drew };
}
const out = [];
out.push(playOnce(60 * 4));
// force death, check death screen + restart paths
if (G.state === 'play') G.player.hp = 0, guard('die', () => { OM.endRun && OM.endRun(); });
guard('step-after-death', () => { for (let i = 0; i < 120; i++) step(1 / 60); });
out.push({ afterDeath: G.state, cur: UI.cur });
click('btn-again');
out.push({ afterRestart: G.state, t: G.t.toFixed(2) });
out.push(playOnce(60 * 2));
click('btn-quit'); click('btn-play');

console.log(JSON.stringify(out));
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('headless-check OK');
