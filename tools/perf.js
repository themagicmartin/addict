// Measures real frame times with rendering on, at a heavy mid/late-game load.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto(URL);
  await page.waitForTimeout(300);

  for (const at of [90, 300, 660, 1000]) {
    const r = await page.evaluate(async (AT) => {
      const OM = window.OM;
      const { G, UI, Input, step, startRun, draw } = OM;
      startRun('vector');
      Input.touch.active = true; Input.touch.ox = 0; Input.touch.oy = 0;
      let ang = 0;
      for (let i = 0; i < 60 * AT; i++) {
        ang += 0.02;
        Input.touch.x = Math.cos(ang) * 60; Input.touch.y = Math.sin(ang) * 60;
        G.player.hp = G.player.maxhp;          // immortal: we want the load, not the outcome
        if (G.state === 'play') step(1 / 60);
        else if (G.state === 'levelup') UI.chooseCard(0);
        else if (G.state === 'chest') UI.closeChest();
        else if (G.state === 'dead') startRun('vector');
      }
      // time step() and draw() explicitly — rAF is vsync-locked and hides headroom
      const N = 90;
      let ts = 0, td = 0;
      for (let i = 0; i < N; i++) {
        G.player.hp = G.player.maxhp;
        let a = performance.now();
        if (G.state === 'play') step(1 / 60); else { UI.chooseCard(0); }
        ts += performance.now() - a;
        a = performance.now();
        draw();
        td += performance.now() - a;
      }
      return {
        t: Math.round(G.t), lv: G.player.level, enemies: G.enemies.length,
        bullets: G.bullets.length, parts: G.parts.length, gems: G.gems.length,
        weapons: G.player.weapons.length,
        step: +(ts / N).toFixed(2), draw: +(td / N).toFixed(2), total: +((ts + td) / N).toFixed(2)
      };
    }, at);
    const budget = (16.7 / r.total).toFixed(1);
    console.log(`t=${String(r.t).padStart(4)}s lv=${String(r.lv).padStart(3)} en=${String(r.enemies).padStart(3)} bul=${String(r.bullets).padStart(3)} par=${String(r.parts).padStart(3)} gem=${String(r.gems).padStart(3)} w=${r.weapons} | step ${String(r.step).padStart(5)}ms  draw ${String(r.draw).padStart(5)}ms  total ${String(r.total).padStart(5)}ms  (${budget}x frame budget)`);
  }
  await browser.close();
})();
