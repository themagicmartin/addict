// Attributes draw() cost to individual layers by emptying one at a time.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1440, height: 860 } });
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html'));
  await page.waitForTimeout(300);
  const out = await page.evaluate(async () => {
    const { G, UI, Input, step, startRun, draw } = window.OM;
    startRun('vector');
    Input.touch.active = true; Input.touch.ox = 0; Input.touch.oy = 0;
    let ang = 0;
    for (let i = 0; i < 60 * 660; i++) {
      ang += 0.02;
      Input.touch.x = Math.cos(ang) * 60; Input.touch.y = Math.sin(ang) * 60;
      G.player.hp = G.player.maxhp;
      if (G.state === 'play') step(1/60);
      else if (G.state === 'levelup') UI.chooseCard(0);
      else if (G.state === 'chest') UI.closeChest();
      else if (G.state === 'dead') startRun('vector');
    }
    const layers = ['parts','beams','waves','fields','gems','enemies','bullets','nums','bolts','drops','lobs'];
    const snap = {};
    for (const k of layers) snap[k] = G[k].slice();
    const time = () => { let t = performance.now(); for (let i=0;i<40;i++) draw(); return +((performance.now()-t)/40).toFixed(2); };
    const base = time();
    const res = { base, counts: {}, savedBy: {} };
    for (const k of layers) res.counts[k] = snap[k].length;
    for (const k of layers) {
      G[k].length = 0;
      res.savedBy[k] = +(base - time()).toFixed(2);
      for (const e of snap[k]) G[k].push(e);
    }
    // aura is drawn from weapon state, not an array
    const auras = G.player.weapons.filter(w => w.aura);
    const saveA = auras.map(w => w.aura); auras.forEach(w => w.aura = 0);
    res.savedBy['zeroAura'] = +(base - time()).toFixed(2);
    auras.forEach((w,i) => w.aura = saveA[i]);
    return res;
  });
  console.log('baseline draw:', out.base, 'ms');
  const rows = Object.entries(out.savedBy).sort((a,b)=>b[1]-a[1]);
  for (const [k,v] of rows) console.log(`  ${k.padEnd(10)} n=${String(out.counts[k]??'-').padStart(4)}  costs ${String(v).padStart(6)} ms`);
  await b.close();
})();
