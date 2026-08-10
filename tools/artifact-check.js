const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const errs = [];
  const page = await b.newPage({ viewport: { width: 1200, height: 780 } });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type()==='error') errs.push('CONSOLE ' + m.text()); });
  await page.goto('file:///tmp/art-test.html');
  await page.waitForTimeout(700);
  const info = await page.evaluate(() => ({
    hasOM: typeof window.OM !== 'undefined',
    state: window.OM && window.OM.G.state,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    canvasW: document.getElementById('game').width,
    menuVisible: getComputedStyle(document.getElementById('scr-menu')).display,
    docScrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth
  }));
  console.log(info);
  // play a little through the real loop
  await page.click('#btn-play'); await page.waitForTimeout(200);
  await page.click('#btn-start'); await page.waitForTimeout(1500);
  await page.keyboard.down('d'); await page.waitForTimeout(600); await page.keyboard.up('d');
  const live = await page.evaluate(() => ({ state: window.OM.G.state, t: +window.OM.G.t.toFixed(1), kills: window.OM.G.kills }));
  console.log('after 2s of play:', live);
  await page.screenshot({ path: 'shots/12-artifact.png' });
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  await b.close();
})();
