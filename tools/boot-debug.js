const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
  p.on('pageerror', e => console.log('PAGEERROR:', e.message, '\n', (e.stack||'').split('\n').slice(0,5).join('\n')));
  p.on('console', m => console.log('CONSOLE['+m.type()+']:', m.text()));
  await p.goto('file://' + path.join('/home/user/addict', 'dist', 'index.html'));
  await p.waitForTimeout(800);
  console.log(await p.evaluate(() => ({
    state: typeof G !== 'undefined' ? G.state : 'no G',
    overlayOn: document.getElementById('overlay').className,
    menuOn: document.getElementById('scr-menu').className,
    disp: getComputedStyle(document.getElementById('overlay')).display
  })));
  await b.close();
})();
