// Runs every character through a fixed-length simulated run with a
// build-focused bot, and prints a balance table.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
const MINUTES = Number(process.argv[2] || 10);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL);
  await page.waitForTimeout(300);

  const rows = await page.evaluate(async (MIN) => {
    const OM = window.OM;
    const { G, UI, Input, SV, step, startRun } = OM;
    SV.unlocked = OM.CHARS.map(c => c.id);
    const out = [];

    const drive = () => {
      Input.keys = Object.create(null);
      let sx = 0, sy = 0;
      const pl = G.player;
      let bg = null, bd = 1e9;
      for (const g of G.gems) { const d = (g.x - pl.x) ** 2 + (g.y - pl.y) ** 2; if (d < bd) { bd = d; bg = g; } }
      for (const g of G.drops) { const d = (g.x - pl.x) ** 2 + (g.y - pl.y) ** 2; if (d < bd * 0.7) { bd = d; bg = g; } }
      if (bg) { const d = Math.sqrt(bd) || 1; sx += (bg.x - pl.x) / d * 0.85; sy += (bg.y - pl.y) / d * 0.85; }
      for (const e of G.enemies) {
        const dx = pl.x - e.x, dy = pl.y - e.y, d2 = dx * dx + dy * dy;
        if (d2 > 190 * 190 || d2 < 1) continue;
        const d = Math.sqrt(d2), wgt = (190 - d) / 190;
        sx += dx / d * wgt * 2.4; sy += dy / d * wgt * 2.4;
      }
      for (const b of G.ebullets) {
        const dx = pl.x - b.x, dy = pl.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > 110 * 110 || d2 < 1) continue;
        const d = Math.sqrt(d2);
        sx += dx / d * 2.2; sy += dy / d * 2.2;
      }
      if (!sx && !sy) { sx = 1; }
      const sm = Math.hypot(sx, sy) || 1;
      Input.touch.active = true; Input.touch.ox = 0; Input.touch.oy = 0;
      Input.touch.x = sx / sm * 60; Input.touch.y = sy / sm * 60;
    };

    const draft = () => {
      const pl = G.player;
      const lvOf = id => (pl.weapons.find(w => w.id === id) || {}).lv || 0;
      const score = c => {
        if (c.kind === 'evo') return 1000;
        if (c.kind === 'weapon') { const cur = lvOf(c.id); return cur > 0 ? 100 + cur * 12 : (pl.weapons.length < 4 ? 90 : 20); }
        if (c.kind === 'passive') {
          const w0 = OM.WEAPONS[pl.weapons[0] && pl.weapons[0].id];
          const need = w0 && w0.evo && w0.evo.need === c.id;
          return (need ? 200 : 60) + (pl.passives[c.id] || 0) * 10;
        }
        return pl.hp < pl.maxhp * 0.5 ? 150 : 5;
      };
      let bi = 0, bs = -1;
      G.cards.forEach((c, i) => { const s = score(c); if (s > bs) { bs = s; bi = i; } });
      UI.chooseCard(bi);
    };

    for (const ch of OM.CHARS) {
      startRun(ch.id);
      const STEP = 1 / 60;
      const marks = {};
      let died = null, picks = 0, bossKills0 = SV.stats.bosses, evo0 = SV.stats.evolutions;
      for (let i = 0; i < 60 * 60 * MIN; i++) {
        if (G.state === 'play') {
          drive();
          step(STEP);
          const s = Math.floor(G.t);
          if (s === 60 || s === 180 || s === 300) { if (!marks[s]) marks[s] = { lv: G.player.level, kills: G.kills, en: G.enemies.length }; }
        } else if (G.state === 'levelup') { draft(); picks++; }
        else if (G.state === 'chest') UI.closeChest();
        else if (G.state === 'dead') { died = +G.t.toFixed(0); break; }
      }
      const p = G.player;
      out.push({
        char: ch.name, weapon: ch.weapon,
        survived: died === null ? '>' + MIN * 60 : died,
        lv: p.level, kills: G.kills, picks,
        m1: marks[60] || null, m3: marks[180] || null, m5: marks[300] || null,
        en: G.enemies.length,
        bosses: SV.stats.bosses - bossKills0, evos: SV.stats.evolutions - evo0,
        build: p.weapons.map(w => w.id + ':' + w.lv).join(' '),
        dps: Math.round(p.totalDamage / Math.max(1, G.t))
      });
      if (G.state !== 'dead') { G.state = 'dead'; }
    }
    return out;
  }, MINUTES);

  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('CHAR', 9), pad('WEAPON', 8), pad('DIED', 6), pad('LV', 4), pad('KILLS', 7), pad('DPS', 6), pad('B', 3), pad('E', 3), pad('1min', 12), pad('3min', 12), 'BUILD');
  for (const r of rows) {
    const m = x => x ? `lv${x.lv}/${x.kills}` : '-';
    console.log(pad(r.char, 9), pad(r.weapon, 8), pad(r.survived, 6), pad(r.lv, 4), pad(r.kills, 7), pad(r.dps, 6), pad(r.bosses, 3), pad(r.evos, 3), pad(m(r.m1), 12), pad(m(r.m3), 12), r.build);
  }
  if (errs.length) console.log('\nERRORS:', errs.slice(0, 5));
  await browser.close();
})();
