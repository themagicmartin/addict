const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html'));
  await page.waitForTimeout(600);
  const dir = path.join(__dirname, '..', 'shots');
  require('fs').mkdirSync(dir, { recursive: true });

  await page.screenshot({ path: dir + '/1-menu.png' });
  await page.click('#btn-play'); await page.waitForTimeout(300);
  await page.screenshot({ path: dir + '/2-chars.png' });
  await page.click('#btn-start'); await page.waitForTimeout(300);

  // simulate to a busy moment, then let the real loop render a frame
  await page.evaluate(() => {
    const { G, UI, Input, step } = window.OM;
    Input.touch.active = true; Input.touch.ox = 0; Input.touch.oy = 0;
    let ang = 0;
    for (let i = 0; i < 60 * 300; i++) {
      ang += 0.021;
      Input.touch.x = Math.cos(ang) * 60; Input.touch.y = Math.sin(ang) * 60;
      G.player.hp = G.player.maxhp;
      if (G.state === 'play') step(1/60);
      else if (G.state === 'levelup') UI.chooseCard(0);
      else if (G.state === 'chest') UI.closeChest();
    }
    Input.touch.active = false;
    G.levelQueue = 0; G.chestQueue = 0; G.state = 'play'; UI.show(null);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: dir + '/3-gameplay.png' });

  await page.evaluate(() => { window.OM.G.levelQueue = 1; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: dir + '/4-levelup.png' });
  await page.evaluate(() => window.OM.UI.chooseCard(0));
  await page.waitForTimeout(200);

  await page.evaluate(() => { window.OM.UI.togglePause(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: dir + '/5-pause.png' });
  await page.evaluate(() => { window.OM.UI.togglePause(); });

  await page.evaluate(() => { window.OM.G.chestQueue = 1; });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: dir + '/6-chest.png' });
  await page.click('#btn-chest-collect'); await page.waitForTimeout(200);

  await page.evaluate(() => { window.OM.G.player.hp = -1; window.OM.G.deathReason = 'the swarm'; window.OM.endRun(); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: dir + '/7-death.png' });

  await page.click('#btn-death-meta'); await page.waitForTimeout(300);
  await page.screenshot({ path: dir + '/8-meta.png' });

  // phone
  const m = await b.newPage({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  await m.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html'));
  await m.waitForTimeout(500);
  await m.screenshot({ path: dir + '/9-mobile-menu.png' });
  await m.click('#btn-play'); await m.waitForTimeout(200);
  await m.click('#btn-start'); await m.waitForTimeout(200);
  await m.evaluate(() => {
    const { G, UI, Input, step } = window.OM;
    Input.touch.active = true; Input.touch.ox = 0; Input.touch.oy = 0;
    let ang = 0;
    for (let i = 0; i < 60 * 200; i++) {
      ang += 0.021; Input.touch.x = Math.cos(ang)*60; Input.touch.y = Math.sin(ang)*60;
      G.player.hp = G.player.maxhp;
      if (G.state === 'play') step(1/60);
      else if (G.state === 'levelup') UI.chooseCard(0);
      else if (G.state === 'chest') UI.closeChest();
    }
    Input.touch.active = false;
    G.levelQueue = 0; G.chestQueue = 0; G.state = 'play'; UI.show(null);
  });
  await m.waitForTimeout(400);
  await m.screenshot({ path: dir + '/10-mobile-play.png' });
  await m.evaluate(() => { window.OM.G.levelQueue = 1; });
  await m.waitForTimeout(500);
  await m.screenshot({ path: dir + '/11-mobile-levelup.png' });
  console.log('shots written');
  await b.close();
})();
