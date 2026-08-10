// Clicks and types through every screen the way a player would.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + ' :: ' + (e.stack||'').split('\n')[1]));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await page.goto('http://127.0.0.1:8137/index.html');
  await page.waitForTimeout(400);
  const st = () => page.evaluate(() => window.OM.G.state);
  const cur = () => page.evaluate(() => window.OM.UI.cur);
  const log = [];
  const check = async (label, want, getter) => {
    const got = await getter();
    log.push(`${got === want ? 'ok  ' : 'FAIL'} ${label}: ${got}${got === want ? '' : ' (expected ' + want + ')'}`);
  };

  // menu navigation
  await page.click('#btn-meta'); await page.waitForTimeout(150);
  await check('opens upgrades', 'scr-meta', cur);
  await page.click('#scr-meta [data-back]'); await page.waitForTimeout(150);
  await page.click('#btn-codex'); await page.waitForTimeout(150);
  await check('opens codex', 'scr-codex', cur);
  await page.click('#scr-codex [data-back]'); await page.waitForTimeout(150);

  // buy an upgrade with granted souls
  await page.evaluate(() => window.OM.grantSouls(5000));
  await page.click('#btn-meta'); await page.waitForTimeout(150);
  const before = await page.evaluate(() => window.OM.SV.souls);
  await page.click('#meta-grid .mcard'); await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.OM.SV.souls);
  log.push(`${after < before ? 'ok  ' : 'FAIL'} buying an upgrade spends souls: ${before} -> ${after}`);
  await page.click('#scr-meta [data-back]'); await page.waitForTimeout(150);

  // start a run
  await page.click('#btn-play'); await page.waitForTimeout(150);
  await page.click('#char-list .char:not(.locked)'); await page.waitForTimeout(100);
  await page.click('#btn-start'); await page.waitForTimeout(300);
  await check('run starts', 'play', st);

  // move with the keyboard
  const p0 = await page.evaluate(() => ({ x: window.OM.G.player.x, y: window.OM.G.player.y }));
  await page.keyboard.down('d'); await page.waitForTimeout(400); await page.keyboard.up('d');
  const p1 = await page.evaluate(() => ({ x: window.OM.G.player.x, y: window.OM.G.player.y }));
  log.push(`${p1.x > p0.x + 5 ? 'ok  ' : 'FAIL'} WASD moves the player: dx=${(p1.x - p0.x).toFixed(1)}`);

  // pause via Escape
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await check('Escape pauses', 'paused', st);
  await page.click('#btn-resume'); await page.waitForTimeout(200);
  await check('resume returns to play', 'play', st);

  // force a level-up, pick with the keyboard
  await page.evaluate(() => { window.OM.G.levelQueue = 1; });
  await page.waitForTimeout(300);
  await check('level-up opens', 'levelup', st);
  const nCards = await page.evaluate(() => document.querySelectorAll('#cards .card').length);
  log.push(`${nCards === 3 ? 'ok  ' : 'FAIL'} draft shows 3 cards: ${nCards}`);
  const wBefore = await page.evaluate(() => window.OM.G.player.weapons.length + Object.keys(window.OM.G.player.passives).length);
  await page.keyboard.press('1'); await page.waitForTimeout(300);
  const wAfter = await page.evaluate(() => window.OM.G.player.weapons.length + Object.keys(window.OM.G.player.passives).length);
  await check('picking a card resumes play', 'play', st);
  log.push(`${wAfter >= wBefore ? 'ok  ' : 'FAIL'} card applied (items ${wBefore} -> ${wAfter})`);

  // reroll + banish
  await page.evaluate(() => { window.OM.G.player.rerolls = 2; window.OM.G.player.banishes = 2; window.OM.G.levelQueue = 1; });
  await page.waitForTimeout(300);
  const r0 = await page.evaluate(() => window.OM.G.player.rerolls);
  await page.keyboard.press('r'); await page.waitForTimeout(200);
  const r1 = await page.evaluate(() => window.OM.G.player.rerolls);
  log.push(`${r1 === r0 - 1 ? 'ok  ' : 'FAIL'} reroll consumes a charge: ${r0} -> ${r1}`);
  await page.keyboard.press('b'); await page.waitForTimeout(150);
  await page.click('#cards .card'); await page.waitForTimeout(200);
  const bn = await page.evaluate(() => window.OM.G.player.banishes);
  log.push(`${bn === 1 ? 'ok  ' : 'FAIL'} banish consumes a charge: ${bn}`);
  await page.click('#cards .card'); await page.waitForTimeout(250);

  // chest
  await page.evaluate(() => { window.OM.G.chestQueue = 1; });
  await page.waitForTimeout(300);
  await check('chest opens', 'chest', st);
  await page.waitForTimeout(2800);
  await page.click('#btn-chest-collect'); await page.waitForTimeout(250);
  await check('chest collect resumes play', 'play', st);

  // death + restart
  await page.evaluate(() => { const G = window.OM.G; G.player.revives = 0; G.player.hp = 0.01; window.OM.endRun(); });
  await page.waitForTimeout(400);
  await check('death screen', 'dead', st);
  await page.keyboard.press(' '); await page.waitForTimeout(400);
  await check('space starts one more run', 'play', st);

  // save persistence across reload
  const soulsPre = await page.evaluate(() => window.OM.SV.souls);
  await page.evaluate(() => window.OM.persist(true));
  await page.reload(); await page.waitForTimeout(500);
  const soulsPost = await page.evaluate(() => window.OM.SV.souls);
  log.push(`${soulsPost === soulsPre ? 'ok  ' : 'FAIL'} save survives reload: ${soulsPre} -> ${soulsPost}`);

  console.log(log.join('\n'));
  console.log(errs.length ? '\nERRORS:\n' + errs.slice(0, 8).join('\n') : '\nno runtime errors');
  await b.close();
  process.exit(log.some(l => l.startsWith('FAIL')) || errs.length ? 1 : 0);
})();
