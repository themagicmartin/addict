const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await b.newPage();
  const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
  await page.goto(url); await page.waitForTimeout(500);
  const wrote = await page.evaluate(() => {
    window.OM.SV.souls = 4321; window.OM.persist(true);
    try { return localStorage.getItem('onemore.save.v1') ? 'localStorage write OK' : 'write returned null'; }
    catch (e) { return 'localStorage THREW: ' + e.message; }
  });
  await page.reload(); await page.waitForTimeout(500);
  const after = await page.evaluate(() => ({ souls: window.OM.SV.souls, warn: getComputedStyle(document.getElementById('storage-warn')).display }));
  console.log('file:// ->', wrote, '| after reload souls =', after.souls, '| warning banner:', after.warn);
  await b.close();
})();
