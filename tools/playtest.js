// Headless smoke test: boots the game, plays a run with fake input,
// force-advances the clock, and reports any console/page errors.
const { chromium } = require('playwright');
const path = require('path');

const URL = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));

  await page.goto(URL);
  await page.waitForTimeout(400);

  // menu -> chars -> start
  await page.click('#btn-play');
  await page.waitForTimeout(200);
  await page.click('#btn-start');
  await page.waitForTimeout(400);

  const report = { steps: [] };

  // Simulate ~14 minutes of gameplay by driving the fixed-step loop directly,
  // with a wandering input vector and auto-resolving overlays.
  const res = await page.evaluate(async () => {
    const { G, UI, Input, SV, step, startRun, pick } = window.OM;
    const out = { errors: [], samples: [], picks: 0, chests: 0, evos: 0, bosses: 0 };
    const origErr = console.error;
    let t = 0;
    const STEP = 1 / 60;
    let ang = 0;
    for (let i = 0; i < 60 * 60 * 14; i++) {
      // --- steering bot: seek gems/drops, flee local enemy density ---
      Input.keys = Object.create(null);
      let sx = 0, sy = 0;
      const pl = G.player;
      if (pl) {
        // attraction: nearest gem or drop
        let bg = null, bd = 1e9;
        for (const g of G.gems) { const d = (g.x - pl.x) ** 2 + (g.y - pl.y) ** 2; if (d < bd) { bd = d; bg = g; } }
        for (const g of G.drops) { const d = (g.x - pl.x) ** 2 + (g.y - pl.y) ** 2; if (d < bd * 0.7) { bd = d; bg = g; } }
        if (bg) { const d = Math.sqrt(bd) || 1; sx += (bg.x - pl.x) / d * 0.85; sy += (bg.y - pl.y) / d * 0.85; }
        // repulsion: weighted by proximity, only things that can actually reach us
        for (const e of G.enemies) {
          const dx = pl.x - e.x, dy = pl.y - e.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 190 * 190 || d2 < 1) continue;
          const d = Math.sqrt(d2);
          const wgt = (190 - d) / 190;
          sx += dx / d * wgt * 2.4; sy += dy / d * wgt * 2.4;
        }
        for (const b of G.ebullets) {
          const dx = pl.x - b.x, dy = pl.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 110 * 110 || d2 < 1) continue;
          const d = Math.sqrt(d2);
          sx += dx / d * 2.2; sy += dy / d * 2.2;
        }
      }
      if (Math.abs(sx) < 0.01 && Math.abs(sy) < 0.01) { ang += (Math.random() - 0.5) * 0.4; sx = Math.cos(ang); sy = Math.sin(ang); }
      const sm = Math.hypot(sx, sy) || 1;
      Input.touch.active = true;
      Input.touch.ox = 0; Input.touch.oy = 0;
      Input.touch.x = sx / sm * 60; Input.touch.y = sy / sm * 60;

      if (G.state === 'play') {
        try { step(STEP); } catch (e) { out.errors.push('step@' + G.t.toFixed(1) + ': ' + e.message + ' | ' + (e.stack || '').split('\n')[1]); break; }
        t += STEP;
      } else if (G.state === 'levelup') {
        // Draft like a human: chase the evolution, then deepen the build.
        try {
          const pl = G.player;
          const lvOf = id => (pl.weapons.find(w => w.id === id) || {}).lv || 0;
          const score = c => {
            if (c.kind === 'evo') return 1000;
            if (c.kind === 'weapon') {
              const cur = lvOf(c.id);
              // prefer the weapon we've already invested in; fill slots early
              return cur > 0 ? 100 + cur * 12 : (pl.weapons.length < 4 ? 90 : 20);
            }
            if (c.kind === 'passive') {
              const want = window.OM.WEAPONS[pl.weapons[0] && pl.weapons[0].id];
              const need = want && want.evo && want.evo.need === c.id;
              return (need ? 200 : 60) + (pl.passives[c.id] || 0) * 10;
            }
            return pl.hp < pl.maxhp * 0.5 ? 150 : 5;
          };
          let bi = 0, bs = -1;
          G.cards.forEach((c, i) => { const s2 = score(c); if (s2 > bs) { bs = s2; bi = i; } });
          UI.chooseCard(bi); out.picks++;
        } catch (e) { out.errors.push('card: ' + e.message + ' | ' + (e.stack || '').split('\n')[1]); break; }
      } else if (G.state === 'chest') {
        try { UI.closeChest(); out.chests++; } catch (e) { out.errors.push('chest: ' + e.message + ' | ' + (e.stack || '').split('\n')[1]); break; }
      } else if (G.state === 'dead') {
        out.samples.push({ died: +G.t.toFixed(1), lv: G.player.level, kills: G.kills, souls: G.payout && G.payout.total });
        // restart immediately for another sample
        try { startRun(pick(SV.unlocked)); } catch (e) { out.errors.push('restart: ' + e.message); break; }
      }
      if (i % (60 * 30) === 0 && G.player) {
        out.samples.push({
          t: +G.t.toFixed(0), lv: G.player.level, hp: Math.round(G.player.hp), maxhp: Math.round(G.player.maxhp),
          enemies: G.enemies.length, bullets: G.bullets.length, parts: G.parts.length,
          kills: G.kills, dps: Math.round(G.damageDealt / Math.max(1, G.t)),
          weapons: G.player.weapons.map(w => w.id + ':' + w.lv).join(','),
          gems: G.gems.length
        });
      }
    }
    out.evos = SV.stats.evolutions; out.bosses = SV.stats.bosses;
    out.souls = SV.souls; out.runs = SV.stats.runs; out.unlocked = SV.unlocked.slice();
    void origErr;
    return out;
  });

  console.log(JSON.stringify(res, null, 1));
  if (errors.length) { console.log('\n--- PAGE ERRORS ---'); errors.slice(0, 12).forEach(e => console.log(e)); }
  else console.log('\nno page errors');
  void report;
  await browser.close();
  process.exit(res.errors.length || errors.length ? 1 : 0);
})();
