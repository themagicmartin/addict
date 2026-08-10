// ============================================================
//  ONE MORE — game state, entities, combat, director
// ============================================================

const CAP_ENEMIES = 340;
const CAP_PARTS = 460;
const CAP_NUMS = 55;

const G = {
  state: 'boot',        // boot | menu | play | levelup | chest | dead | paused
  t: 0,                 // run time
  player: null,
  enemies: [], bullets: [], ebullets: [], waves: [], beams: [], fields: [], lobs: [],
  gems: [], drops: [], parts: [], nums: [], bolts: [], toasts: [],
  cam: { x: 0, y: 0, sh: 0 },
  hitstop: 0, spawnAcc: 0, nextBoss: 180, bossIdx: 0, boss: null, nextReaper: 0,
  nextSwarm: 30, kills: 0, damageDealt: 0, soulsRun: 0, gemsXp: 0,
  combo: 0, comboT: 0, maxCombo: 0, bigHit: 10,
  levelQueue: 0, chestQueue: 0, cards: [], cardKind: 'level',
  flash: 0, flashCol: '#fff', slowmo: 0, runSeconds: 0,
  banner: null, bannerT: 0, newUnlocks: [], deathReason: '',
  frame: 0
};

let UID = 1;

// ------------------------------------------------------------
//  Player
// ------------------------------------------------------------
function makePlayer(charId) {
  const ch = charById(charId);
  const p = {
    ch, x: 0, y: 0, vx: 0, vy: 0, r: 12, face: -Math.PI / 2,
    level: 1, xp: 0, xpNext: xpFor(1),
    hp: 100, maxhp: 100, base: {},
    weapons: [], passives: {},
    // stats (multipliers)
    might: 1, area: 1, cdr: 1, dur: 1, pspd: 1, amount: 0, pierce: 0,
    spd: 1, armor: 0, regen: 0, magnet: 1, luck: 0, growth: 1, greed: 1,
    revives: 0, rerolls: 0, banishes: 0, wSlots: 6, pSlots: 6,
    leech: 0, iframes: 0, moveSpeed: 178, hurtFlash: 0, dashT: 0,
    totalDamage: 0, kills: 0
  };
  recalc(p);
  p.hp = p.maxhp;
  addWeapon(p, ch.weapon);
  return p;
}

function recalc(p) {
  // base
  let maxhp = 100, might = 1, area = 1, cdr = 1, dur = 1, pspd = 1, spd = 1;
  let armor = 0, regen = 0, magnet = 1, luck = 0.05, growth = 1, greed = 1;
  let amount = 0, pierce = 0, leech = 0, revives = 0, rerolls = 0, banishes = 0, wSlots = 6;

  // meta upgrades
  const acc = { maxhp: 0, might: 0, spd: 0, cdr: 0, area: 0, armor: 0, regen: 0, growth: 0, greed: 0, magnet: 0, luck: 0, rerolls: 0, banishes: 0, revives: 0, wSlots: 0 };
  for (const m of META) {
    const l = metaLv(m.id);
    if (l > 0) m.apply(acc, l);
  }
  maxhp += acc.maxhp; might += acc.might; spd += acc.spd; cdr += acc.cdr; area += acc.area;
  armor += acc.armor; regen += acc.regen; growth += acc.growth; greed += acc.greed;
  magnet += acc.magnet; luck += acc.luck;
  rerolls += acc.rerolls; banishes += acc.banishes; revives += acc.revives; wSlots += acc.wSlots;

  // character mods
  const m = p.ch.mods || {};
  maxhp += m.maxhp || 0; might += m.might || 0; area += m.area || 0;
  cdr += m.cdr || 0; dur += m.dur || 0; pspd += m.pspd || 0; spd += m.spd || 0;
  armor += m.armor || 0; magnet += m.magnet || 0;

  // passives
  const P = p.passives;
  const lvOf = id => P[id] || 0;
  spd += lvOf('momentum') * 0.08;
  might += lvOf('core') * 0.12;
  area += lvOf('resonator') * 0.10;
  cdr -= lvOf('capacitor') * 0.06;
  dur += lvOf('fuse') * 0.14;
  pspd += lvOf('lens') * 0.15;
  if (lvOf('lens') >= 3) pierce += 1;
  if (lvOf('lens') >= 5) pierce += 1;
  magnet += lvOf('tracker') * 0.30;
  luck += lvOf('tracker') * 0.07;
  maxhp += lvOf('plate') * 14;
  armor += lvOf('plate');
  regen += lvOf('siphon') * 0.5;
  leech += lvOf('siphon') * 0.04;
  greed += lvOf('greedp') * 0.15;
  growth += lvOf('greedp') * 0.08;

  const prevMax = p.maxhp || maxhp;
  p.maxhp = Math.max(10, maxhp);
  if (p.hp !== undefined) p.hp = Math.min(p.maxhp, p.hp + Math.max(0, p.maxhp - prevMax));
  p.might = might; p.area = area; p.cdr = Math.max(0.25, cdr); p.dur = dur; p.pspd = pspd;
  p.spd = spd; p.armor = armor; p.regen = regen; p.magnet = magnet; p.luck = luck;
  p.growth = growth; p.greed = greed; p.amount = amount; p.pierce = pierce; p.leech = leech;
  p.wSlots = wSlots;
  if (p.revives === undefined || p._metaRev !== revives) { p.revives = revives; p._metaRev = revives; }
  if (p._metaRr !== rerolls) { p.rerolls = rerolls; p._metaRr = rerolls; }
  if (p._metaBn !== banishes) { p.banishes = banishes; p._metaBn = banishes; }
  p.moveSpeed = 178 * p.spd;
}

function addWeapon(p, id) {
  const def = WEAPONS[id];
  if (!def) return;
  const ex = p.weapons.find(w => w.id === id);
  if (ex) { ex.lv = Math.min(def.max, ex.lv + 1); return ex; }
  const w = { id, lv: 1, t: 0, rot: rand(TAU), spin: 0, orbs: [] };
  p.weapons.push(w);
  if (!SV.weaponsSeen.includes(id)) { SV.weaponsSeen.push(id); persist(); }
  return w;
}
function addPassive(p, id) {
  const def = PASSIVES[id];
  if (!def) return;
  p.passives[id] = Math.min(def.max, (p.passives[id] || 0) + 1);
  recalc(p);
}

// ------------------------------------------------------------
//  Spatial grid
// ------------------------------------------------------------
const CELL = 70;
const grid = new Map();
const _q = [];
function buildGrid() {
  grid.clear();
  for (const e of G.enemies) {
    if (e.dead) continue;
    const k = Math.floor(e.x / CELL) + ',' + Math.floor(e.y / CELL);
    let a = grid.get(k);
    if (!a) { a = []; grid.set(k, a); }
    a.push(e);
  }
}
function query(x, y, r) {
  _q.length = 0;
  const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
  const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const a = grid.get(cx + ',' + cy);
    if (a) for (let i = 0; i < a.length; i++) _q.push(a[i]);
  }
  return _q;
}
function nearestEnemy(x, y, maxR) {
  let best = null, bd = maxR * maxR;
  // widen search rings until something is found
  for (let r = 140; r <= maxR; r *= 2) {
    const list = query(x, y, r);
    for (let i = 0; i < list.length; i++) {
      const e = list[i]; if (e.dead) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) return best;
  }
  return best;
}
function randomEnemyNear(x, y, r) {
  const list = query(x, y, r);
  const alive = [];
  for (let i = 0; i < list.length; i++) if (!list[i].dead) alive.push(list[i]);
  if (!alive.length) return null;
  return alive[(Math.random() * alive.length) | 0];
}

// ------------------------------------------------------------
//  FX helpers
// ------------------------------------------------------------
function shake(v) { G.cam.sh = Math.min(38, G.cam.sh + v * (SV.settings.shake ?? 1)); }
function hitstop(v) { G.hitstop = Math.max(G.hitstop, v); }
function flash(col, v) { G.flash = Math.max(G.flash, v); G.flashCol = col; }

function part(x, y, opts = {}) {
  if (G.parts.length >= CAP_PARTS) return;
  G.parts.push({
    x, y,
    vx: opts.vx !== undefined ? opts.vx : rand(-90, 90),
    vy: opts.vy !== undefined ? opts.vy : rand(-90, 90),
    life: opts.life || rand(0.25, 0.55), max: opts.life || 0.5,
    r: opts.r || rand(1.5, 3.6), color: opts.color || '#fff',
    drag: opts.drag ?? 2.6, glow: opts.glow ?? true, grow: opts.grow || 0
  });
}
function burst(x, y, n, color, spd = 150, life = 0.45) {
  for (let i = 0; i < n; i++) {
    const a = rand(TAU), s = rand(spd * 0.3, spd);
    part(x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: rand(life * 0.5, life) });
  }
}
function dmgNum(x, y, v, color, crit) {
  if (!SV.settings.damageNumbers) return;
  // thin out numbers when the screen is already full of them
  if (G.nums.length > 30 && !crit && Math.random() < 0.6) return;
  if (G.nums.length >= CAP_NUMS) G.nums.shift();
  G.nums.push({
    x: x + rand(-6, 6), y, vy: -46, life: crit ? 0.85 : 0.6, max: crit ? 0.85 : 0.6,
    txt: v >= 1000 ? fmtNum(v) : Math.round(v).toString(), color, crit,
    small: !crit && v < G.bigHit * 0.18
  });
  if (v > G.bigHit) G.bigHit = v;
}
function toast(txt, sub, color) {
  G.toasts.push({ txt, sub: sub || '', color: color || '#fff', life: 2.6, max: 2.6 });
  if (G.toasts.length > 4) G.toasts.shift();
}
function banner(txt, sub, color) { G.banner = { txt, sub: sub || '', color: color || '#fff' }; G.bannerT = 2.6; }

// ------------------------------------------------------------
//  Attack constructors
// ------------------------------------------------------------
function spawnBullet(o) {
  G.bullets.push({
    x: o.x, y: o.y, a: o.a, vx: Math.cos(o.a) * o.spd, vy: Math.sin(o.a) * o.spd,
    spd: o.spd, dmg: o.dmg, r: o.r, pierce: o.pierce ?? 1, life: o.life ?? 1.2,
    color: o.color, shape: o.shape || 'shard', knock: o.knock || 0, src: o.src,
    hit: {}, curve: o.curve || 0, slow: o.slow || null, homing: o.homing || 0, trail: o.trail !== false
  });
}
function spawnWave(o) {
  G.waves.push({ x: o.x, y: o.y, r: o.r0, r0: o.r0, r1: o.r1, dmg: o.dmg, color: o.color, life: o.life, max: o.life, hit: {}, knock: o.knock || 0, src: o.src, burn: o.burn || null });
}
function spawnBeam(o) {
  G.beams.push({ x: o.x, y: o.y, a: o.a, len: o.len, width: o.width, dmg: o.dmg, life: o.life, max: o.life, color: o.color, src: o.src, hit: {}, tick: 0, follow: o.follow, sweep: o.sweep || 0 });
}
function spawnField(o) {
  G.fields.push({ x: o.x, y: o.y, r: o.r, dps: o.dps, slow: o.slow, life: o.life, max: o.life, color: o.color, src: o.src, tick: 0 });
}
function spawnLob(o) {
  G.lobs.push({ x: o.x, y: o.y, sx: o.x, sy: o.y, tx: o.tx, ty: o.ty, t: -(o.delay || 0), dur: 0.62, dmg: o.dmg, radius: o.radius, color: o.color, src: o.src, cluster: o.cluster || 0 });
}

function damageArea(x, y, r, dmg, opts = {}) {
  const list = query(x, y, r + 30);
  const p = G.player;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.dead) continue;
    const rr = r + e.r;
    if (dist2(x, y, e.x, e.y) > rr * rr) continue;
    if (opts.cd) {
      const key = opts.src;
      if (e.hitT[key] && e.hitT[key] > G.t) continue;
      e.hitT[key] = G.t + opts.cd;
    }
    hurtEnemy(e, dmg, { color: opts.color, knock: opts.knock, fromX: x, fromY: y, tickDmg: opts.tick, slow: opts.slow, burn: opts.burn });
  }
  void p;
}

function chainLightning(x, y, dmg, jumps, range, color, src, stun) {
  let cx = x, cy = y;
  const used = Object.create(null);
  let any = false;
  for (let j = 0; j < jumps; j++) {
    const list = query(cx, cy, range);
    let best = null, bd = range * range;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead || used[e.uid]) continue;
      const d = dist2(cx, cy, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) break;
    used[best.uid] = 1;
    G.bolts.push({ x1: cx, y1: cy, x2: best.x, y2: best.y, life: 0.18, max: 0.18, color });
    hurtEnemy(best, dmg, { color, knock: 60, fromX: cx, fromY: cy });
    if (stun) { best.stun = Math.max(best.stun || 0, stun); }
    cx = best.x; cy = best.y;
    any = true;
  }
  if (any) AU.sfx('zap');
}

// ------------------------------------------------------------
//  Enemy damage / death
// ------------------------------------------------------------
function hurtEnemy(e, dmg, o = {}) {
  if (e.dead) return;
  const p = G.player;
  let crit = false;
  if (!o.tickDmg && Math.random() < p.luck) { crit = true; dmg *= 2 + p.luck; }
  e.hp -= dmg;
  e.flash = 0.09;
  G.damageDealt += dmg;
  p.totalDamage += dmg;
  if (!o.tickDmg || Math.random() < 0.08) dmgNum(e.x, e.y - e.r, dmg, crit ? COL.crit : (o.color || '#fff'), crit);
  if (crit) AU.sfx('crit');
  if (o.knock && !e.boss) {
    const dx = e.x - (o.fromX ?? p.x), dy = e.y - (o.fromY ?? p.y);
    const d = Math.hypot(dx, dy) || 1;
    const k = o.knock / (e.elite ? 2.4 : 1) / (1 + e.r / 20);
    e.kx += dx / d * k; e.ky += dy / d * k;
  }
  if (o.slow) { e.slowT = Math.max(e.slowT, o.slow.time); e.slowAmt = Math.max(e.slowAmt, o.slow.amt); }
  if (o.burn) { e.burnT = Math.max(e.burnT, o.burn.time); e.burnDps = Math.max(e.burnDps, o.burn.dps); }
  if (p.leech > 0 && Math.random() < p.leech && p.hp < p.maxhp) {
    p.hp = Math.min(p.maxhp, p.hp + 1);
    part(p.x, p.y, { color: COL.heal, vx: rand(-40, 40), vy: rand(-70, -20), life: 0.5 });
  }
  if (!o.tickDmg) AU.sfx('hit');
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  const p = G.player;
  G.kills++; p.kills++;
  G.combo++; G.comboT = 2.6;
  if (G.combo > G.maxCombo) G.maxCombo = G.combo;

  burst(e.x, e.y, e.boss ? 60 : e.elite ? 26 : Math.min(12, 5 + (e.r / 3) | 0), e.color, e.boss ? 420 : 190, e.boss ? 1.1 : 0.5);
  AU.sfx('kill');

  // XP gem — value scales with run time so a stalled player can still climb out
  const xpv = e.xp * (1 + Math.floor(G.t / 240));
  dropGem(e.x, e.y, xpv, e.boss ? 3 : e.elite ? 2 : (e.xp >= 4 ? 1 : 0));

  // soul coins
  let coinChance = 0.055 + p.greed * 0.012;
  if (e.elite) coinChance = 1; if (e.boss) coinChance = 1;
  if (Math.random() < coinChance) {
    const amt = e.boss ? 60 + G.bossIdx * 30 : e.elite ? randi(6, 14) : randi(1, 3);
    G.drops.push({ x: e.x, y: e.y, vx: rand(-60, 60), vy: rand(-60, 60), kind: 'coin', v: amt, life: 26, r: 7 });
  }
  if (Math.random() < 0.008 && p.hp < p.maxhp * 0.85) {
    G.drops.push({ x: e.x, y: e.y, vx: rand(-50, 50), vy: rand(-50, 50), kind: 'heal', v: Math.max(12, p.maxhp * 0.18) | 0, life: 22, r: 8 });
  }
  if (e.elite || e.boss) {
    let chests = 0;
    for (const d of G.drops) if (d.kind === 'chest') chests++;
    if (chests < 5 || e.boss) {
      G.drops.push({ x: e.x, y: e.y, vx: 0, vy: 0, kind: 'chest', v: e.boss ? 3 : 1, life: 999, r: 13 });
    } else {
      G.drops.push({ x: e.x, y: e.y, vx: rand(-60, 60), vy: rand(-60, 60), kind: 'coin', v: randi(14, 26), life: 30, r: 8 });
    }
    shake(e.boss ? 26 : 8);
  }

  // splitter
  if (e.def && e.def.split && !e.elite && G.enemies.length < CAP_ENEMIES - 6) {
    for (let i = 0; i < e.def.split; i++) {
      const a = rand(TAU);
      const s = spawnEnemy('mote', e.x + Math.cos(a) * 16, e.y + Math.sin(a) * 16);
      if (s) { s.kx = Math.cos(a) * 160; s.ky = Math.sin(a) * 160; }
    }
  }

  if (e.boss) {
    G.boss = null;
    SV.stats.bosses++;
    banner('WARDEN DOWN', '+' + (60 + G.bossIdx * 30) + ' souls', e.color);
    flash('#fff', 0.7); hitstop(0.22); AU.sfx('chest');
    checkUnlocks();
  } else if (e.elite) {
    hitstop(0.05);
  }
}

function dropGem(x, y, v, tier) {
  // Above a threshold, fold the XP into the nearest existing gem instead of
  // littering the field: same XP, a fraction of the draw cost.
  if (G.gems.length > 130) {
    let best = null, bd = 260 * 260;
    for (const g of G.gems) {
      const d = dist2(x, y, g.x, g.y);
      if (d < bd) { bd = d; best = g; }
    }
    if (best) { best.v += v; best.tier = Math.max(best.tier, tier); best.r = 4 + best.tier * 2; return; }
  }
  G.gems.push({ x, y, vx: rand(-40, 40), vy: rand(-40, 40), v, tier, r: 4 + tier * 2, life: 60 });
}

// ------------------------------------------------------------
//  Enemy spawning / director
// ------------------------------------------------------------
function difficulty() {
  const m = G.t / 60;
  // gentle early/mid ramp, then a hard shoulder past 8 minutes so even a
  // fully-evolved build eventually loses ground
  const late = Math.max(0, m - 8);
  return {
    hp: 1 + Math.pow(m, 1.55) * 0.70 + late * late * 2.4,
    dmg: 1 + m * 0.10 + late * 0.12,
    spd: 1 + Math.min(0.95, m * 0.055)
  };
}

function spawnPos() {
  const p = G.player;
  const a = rand(TAU);
  const rx = VW * 0.62 + 60, ry = VH * 0.62 + 60;
  const d = Math.max(rx, ry) + rand(0, 90);
  return { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
}

function spawnEnemy(typeId, x, y, opts = {}) {
  if (G.enemies.length >= CAP_ENEMIES) return null;
  const def = ENEMIES[typeId];
  if (!def) return null;
  const D = difficulty();
  const elite = opts.elite || false;
  const e = {
    uid: UID++, def, type: typeId, x, y, vx: 0, vy: 0, kx: 0, ky: 0,
    r: def.r * (elite ? 1.55 : 1), color: elite ? COL.elite : def.color, shape: def.shape,
    hp: def.hp * D.hp * (elite ? 7 : 1), maxhp: 1, spd: def.spd * D.spd * (elite ? 0.82 : 1),
    dmg: def.dmg * D.dmg * (elite ? 1.5 : 1), xp: def.xp * (elite ? 12 : 1),
    hitT: Object.create(null), flash: 0, slowT: 0, slowAmt: 0, burnT: 0, burnDps: 0,
    stun: 0, elite, boss: false, dead: false, t: 0, shootT: rand(0.4, 2.2), ang: rand(TAU)
  };
  e.maxhp = e.hp;
  G.enemies.push(e);
  return e;
}

function spawnBoss() {
  const bd = BOSSES[Math.min(G.bossIdx, BOSSES.length - 1)];
  const extra = Math.max(0, G.bossIdx - BOSSES.length + 1);
  const D = difficulty();
  const pos = spawnPos();
  const e = {
    uid: UID++, def: bd, type: bd.id, x: pos.x, y: pos.y, vx: 0, vy: 0, kx: 0, ky: 0,
    r: bd.r, color: bd.color, shape: 'boss',
    hp: bd.hp * (1 + D.hp * 0.22) * Math.pow(2.0, extra), maxhp: 1,
    spd: bd.spd, dmg: bd.dmg * D.dmg, xp: bd.xp,
    hitT: Object.create(null), flash: 0, slowT: 0, slowAmt: 0, burnT: 0, burnDps: 0,
    stun: 0, elite: false, boss: true, dead: false, t: 0, shootT: 2, ang: 0,
    pattern: bd.pattern, name: bd.name, phase: 0
  };
  e.maxhp = e.hp;
  G.enemies.push(e);
  G.boss = e;
  banner(bd.name, 'INCOMING', bd.color);
  AU.sfx('boss'); shake(20); flash(bd.color, 0.45);
  G.bossIdx++;
}

function pickType() {
  const t = G.t;
  const opts = [];
  for (const id in ENEMIES) {
    const d = ENEMIES[id];
    if (t >= d.from) opts.push({ id, w: d.w(t) });
  }
  const c = wpick(opts);
  return c ? c.id : 'mote';
}

function updateDirector(dt) {
  const t = G.t;
  // steady stream
  const rate = Math.min(24, 0.9 + t * 0.045);
  G.spawnAcc += dt * rate;
  const eliteChance = Math.min(0.045, 0.008 + t * 0.00004);
  while (G.spawnAcc >= 1) {
    G.spawnAcc -= 1;
    const pos = spawnPos();
    spawnEnemy(pickType(), pos.x, pos.y, { elite: Math.random() < eliteChance });
  }
  // swarm events
  if (t >= G.nextSwarm) {
    G.nextSwarm = t + Math.max(18, 34 - t * 0.012);
    const p = G.player;
    const kind = pick(['ring', 'wall', 'cluster']);
    const n = Math.min(90, 16 + (t * 0.13) | 0);
    const type = pickType();
    if (kind === 'ring') {
      const R = Math.max(VW, VH) * 0.62;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU;
        spawnEnemy(type, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R);
      }
    } else if (kind === 'wall') {
      const a = rand(TAU), px = Math.cos(a), py = Math.sin(a);
      const R = Math.max(VW, VH) * 0.6;
      for (let i = 0; i < n; i++) {
        const o = (i - n / 2) * 26;
        spawnEnemy(type, p.x + px * R - py * o, p.y + py * R + px * o);
      }
    } else {
      const a = rand(TAU), R = Math.max(VW, VH) * 0.6;
      const cx = p.x + Math.cos(a) * R, cy = p.y + Math.sin(a) * R;
      for (let i = 0; i < n; i++) spawnEnemy(type, cx + rand(-90, 90), cy + rand(-90, 90));
    }
    if (t > 40) toast('SWARM INCOMING', '', COL.enemy);
  }
  // the hunt — from 15:00 things start arriving that you cannot outrun
  if (t >= 900) {
    G.nextReaper = G.nextReaper || t;
    if (t >= G.nextReaper) {
      const wave = 1 + Math.floor((t - 900) / 90);
      G.nextReaper = t + Math.max(3, 16 - (t - 900) * 0.014);
      for (let i = 0; i < wave; i++) {
        const pos = spawnPos();
        spawnEnemy('reaper', pos.x, pos.y);
      }
      if (Math.floor(t) % 90 < 1) toast('THE HUNT THICKENS', 'they are faster than you', '#ffffff');
    }
  }

  // boss
  if (t >= G.nextBoss) {
    G.nextBoss = t + 180;
    spawnBoss();
  }
}

// ------------------------------------------------------------
//  Updates
// ------------------------------------------------------------
function updatePlayer(dt) {
  const p = G.player;
  Input.update();
  const ax = Input.ax, ay = Input.ay;
  const target = p.moveSpeed;
  p.vx = lerp(p.vx, ax * target, 1 - Math.pow(0.0008, dt));
  p.vy = lerp(p.vy, ay * target, 1 - Math.pow(0.0008, dt));
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (ax || ay) p.face = Math.atan2(ay, ax);

  if (p.regen > 0 && p.hp < p.maxhp) p.hp = Math.min(p.maxhp, p.hp + p.regen * dt);
  if (p.iframes > 0) p.iframes -= dt;
  if (p.hurtFlash > 0) p.hurtFlash -= dt;

  // weapons
  for (const w of p.weapons) {
    const def = WEAPONS[w.id];
    if (!def) continue;
    if (def.tick) def.tick(w, p, dt);
    if (!def.fire) continue;
    w.t -= dt;
    if (w.t <= 0) {
      w.t = Math.max(0.05, def.cd(w.lv) * p.cdr);
      def.fire(w, p);
    }
  }

  // combo decay
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
}

function hurtPlayer(amount, src) {
  const p = G.player;
  if (p.iframes > 0) return;
  const dmg = Math.max(1, amount - p.armor);
  p.hp -= dmg;
  p.iframes = 0.5;
  p.hurtFlash = 0.3;
  shake(6 + Math.min(12, dmg * 0.3));
  flash('#ff2b53', 0.28);
  AU.sfx('hurt');
  dmgNum(p.x, p.y - 18, dmg, '#ff5a7a', false);
  if (p.hp <= 0) {
    if (p.revives > 0) {
      p.revives--;
      p.hp = p.maxhp;
      p.iframes = 2.2;
      damageArea(p.x, p.y, 400 * p.area, 900 * p.might, { src: 'revive', color: '#fff', knock: 900 });
      spawnWave({ x: p.x, y: p.y, r0: 20, r1: 420 * p.area, dmg: 1, color: '#fff', life: 0.6, knock: 700, src: 'revive' });
      banner('SECOND WIND', 'revive consumed', '#6bffb0');
      flash('#fff', 0.9); shake(24); AU.sfx('evolve');
    } else {
      G.deathReason = src || 'the swarm';
      endRun();
    }
  }
}

function updateEnemies(dt) {
  const p = G.player;
  const arr = G.enemies;
  for (let i = arr.length - 1; i >= 0; i--) {
    const e = arr[i];
    if (e.dead) { arr.splice(i, 1); continue; }
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.burnT > 0) {
      e.burnT -= dt;
      e.hp -= e.burnDps * dt;
      if (Math.random() < dt * 12) part(e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r), { color: '#ff9d5c', vy: -50, life: 0.3, r: 2 });
      if (e.hp <= 0) { killEnemy(e); continue; }
    }
    let slow = 1;
    if (e.slowT > 0) { e.slowT -= dt; slow = 1 - e.slowAmt; if (e.slowT <= 0) e.slowAmt = 0; }
    if (e.stun > 0) { e.stun -= dt; slow = 0; }

    // despawn far strays (keeps pressure local, frees budget)
    const ddx = e.x - p.x, ddy = e.y - p.y;
    if (!e.boss && (ddx * ddx + ddy * ddy) > 2400 * 2400) { e.dead = true; continue; }

    // movement
    const d = Math.hypot(ddx, ddy) || 1;
    let tx = -ddx / d, ty = -ddy / d;
    const def = e.def;
    if (e.boss) {
      bossBrain(e, dt, d);
      tx = -ddx / d; ty = -ddy / d;
    } else if (def.orbitStrafe) {
      const a = Math.atan2(-ddy, -ddx) + Math.sin(e.t * 1.4 + e.uid) * 0.9;
      tx = Math.cos(a); ty = Math.sin(a);
    } else if (def.dash) {
      if (e.t % 2.4 < 0.45 && d < 460) { tx *= 3.4; ty *= 3.4; }
    } else if (def.ranged) {
      if (d < 230) { tx = -tx * 0.7; ty = -ty * 0.7; }
      e.shootT -= dt;
      if (e.shootT <= 0 && d < 620) {
        e.shootT = def.ranged.cd;
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        G.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * def.ranged.spd, vy: Math.sin(a) * def.ranged.spd, r: 6, dmg: e.dmg * 0.8, life: 4, color: e.color });
      }
    }
    const sp = e.spd * slow;
    e.x += (tx * sp + e.kx) * dt;
    e.y += (ty * sp + e.ky) * dt;
    e.kx *= Math.pow(0.0009, dt); e.ky *= Math.pow(0.0009, dt);

    // contact
    const rr = e.r + p.r;
    if (ddx * ddx + ddy * ddy < rr * rr) hurtPlayer(e.dmg, e.boss ? e.name : e.type);
  }

  // separation (sampled — keeps the swarm readable without O(n^2))
  const step = G.enemies.length > 220 ? 2 : 1;
  for (let i = G.frame % step; i < G.enemies.length; i += step) {
    const e = G.enemies[i];
    if (e.dead || e.boss) continue;
    const list = query(e.x, e.y, e.r + 20);
    let px = 0, py = 0, n = 0;
    for (let j = 0; j < list.length && n < 6; j++) {
      const o = list[j];
      if (o === e || o.dead) continue;
      const dx = e.x - o.x, dy = e.y - o.y;
      const dd = dx * dx + dy * dy;
      const min = (e.r + o.r) * 0.92;
      if (dd > 0.01 && dd < min * min) {
        const dl = Math.sqrt(dd);
        px += dx / dl; py += dy / dl; n++;
      }
    }
    if (n) { e.x += px / n * 42 * dt * step; e.y += py / n * 42 * dt * step; }
  }
}

function bossBrain(e, dt, d) {
  const p = G.player;
  e.shootT -= dt;
  const hpf = e.hp / e.maxhp;
  const rage = hpf < 0.4 ? 1.7 : 1;
  if (e.pattern === 'radial') {
    if (e.shootT <= 0) {
      e.shootT = 2.4 / rage;
      const n = 16;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + e.t * 0.3;
        G.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 7, dmg: e.dmg * 0.55, life: 5, color: e.color });
      }
      AU.sfx('boom');
    }
  } else if (e.pattern === 'spiral') {
    if (e.shootT <= 0) {
      e.shootT = 0.1 / rage;
      e.ang += 0.55;
      for (let k = 0; k < 2; k++) {
        const a = e.ang + k * Math.PI;
        G.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, r: 6, dmg: e.dmg * 0.45, life: 5, color: e.color });
      }
    }
  } else if (e.pattern === 'summon') {
    if (e.shootT <= 0) {
      e.shootT = 3.6 / rage;
      for (let i = 0; i < 8; i++) {
        const a = rand(TAU);
        spawnEnemy(pick(['runner', 'shade', 'wisp']), e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70);
      }
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU;
        G.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, r: 7, dmg: e.dmg * 0.5, life: 4, color: e.color });
      }
      AU.sfx('boss');
    }
  } else if (e.pattern === 'beam') {
    if (e.shootT <= 0) {
      e.shootT = 2.0 / rage;
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      for (let i = 0; i < 5; i++) {
        const aa = a + (i - 2) * 0.18;
        for (let k = 0; k < 3; k++) {
          G.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(aa) * (150 + k * 60), vy: Math.sin(aa) * (150 + k * 60), r: 6, dmg: e.dmg * 0.45, life: 4.5, color: e.color });
        }
      }
      AU.sfx('zap');
    }
  }
  void d;
}

function updateBullets(dt) {
  const arr = G.bullets;
  for (let i = arr.length - 1; i >= 0; i--) {
    const b = arr[i];
    b.life -= dt;
    if (b.life <= 0) { arr.splice(i, 1); continue; }
    if (b.curve) { b.a += b.curve * dt; b.vx = Math.cos(b.a) * b.spd; b.vy = Math.sin(b.a) * b.spd; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.trail && G.frame % 2 === 0) part(b.x, b.y, { color: b.color, vx: 0, vy: 0, life: 0.16, r: b.r * 0.6, drag: 6 });
    const list = query(b.x, b.y, b.r + 24);
    for (let j = 0; j < list.length; j++) {
      const e = list[j];
      if (e.dead || b.hit[e.uid]) continue;
      const rr = b.r + e.r;
      if (dist2(b.x, b.y, e.x, e.y) > rr * rr) continue;
      b.hit[e.uid] = 1;
      hurtEnemy(e, b.dmg, { color: b.color, knock: b.knock, fromX: b.x - b.vx * 0.01, fromY: b.y - b.vy * 0.01, slow: b.slow });
      burst(b.x, b.y, 3, b.color, 90, 0.22);
      b.pierce--;
      if (b.pierce <= 0) { arr.splice(i, 1); break; }
    }
  }
  // enemy bullets
  const p = G.player;
  for (let i = G.ebullets.length - 1; i >= 0; i--) {
    const b = G.ebullets[i];
    b.life -= dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.life <= 0) { G.ebullets.splice(i, 1); continue; }
    const rr = b.r + p.r;
    if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
      hurtPlayer(b.dmg, 'projectile');
      burst(b.x, b.y, 5, b.color, 120, 0.3);
      G.ebullets.splice(i, 1);
    }
  }
}

function updateWaves(dt) {
  for (let i = G.waves.length - 1; i >= 0; i--) {
    const w = G.waves[i];
    w.life -= dt;
    const t = 1 - w.life / w.max;
    w.r = lerp(w.r0, w.r1, Math.sqrt(clamp(t, 0, 1)));
    const list = query(w.x, w.y, w.r + 30);
    for (let j = 0; j < list.length; j++) {
      const e = list[j];
      if (e.dead || w.hit[e.uid]) continue;
      const dd = Math.hypot(e.x - w.x, e.y - w.y);
      if (dd < w.r + e.r && dd > w.r - 60) {
        w.hit[e.uid] = 1;
        if (w.dmg > 1) hurtEnemy(e, w.dmg, { color: w.color, knock: w.knock, fromX: w.x, fromY: w.y, burn: w.burn });
      }
    }
    if (w.life <= 0) G.waves.splice(i, 1);
  }
}

function updateBeams(dt) {
  const p = G.player;
  for (let i = G.beams.length - 1; i >= 0; i--) {
    const b = G.beams[i];
    b.life -= dt;
    if (b.follow) { b.x = p.x; b.y = p.y; }
    if (b.sweep) b.a += b.sweep * dt;
    b.tick -= dt;
    if (b.tick <= 0) {
      b.tick = 0.1;
      const steps = Math.ceil(b.len / 30);
      for (let s = 1; s <= steps; s++) {
        const f = s / steps;
        const x = b.x + Math.cos(b.a) * b.len * f, y = b.y + Math.sin(b.a) * b.len * f;
        damageArea(x, y, b.width * 0.55, b.dmg, { src: b.src + '-' + i, cd: 0.09, color: b.color, knock: 40, tick: true });
      }
    }
    if (b.life <= 0) G.beams.splice(i, 1);
  }
}

function updateFields(dt) {
  for (let i = G.fields.length - 1; i >= 0; i--) {
    const f = G.fields[i];
    f.life -= dt;
    f.tick -= dt;
    if (f.tick <= 0) {
      f.tick = 0.2;
      damageArea(f.x, f.y, f.r, f.dps * 0.2, { src: 'field' + i, cd: 0.18, color: f.color, tick: true, slow: { amt: f.slow, time: 0.8 } });
    }
    if (Math.random() < dt * 20) part(f.x + rand(-f.r, f.r), f.y + rand(-f.r, f.r), { color: f.color, vy: rand(-25, -5), vx: rand(-12, 12), life: 0.7, r: 2 });
    if (f.life <= 0) G.fields.splice(i, 1);
  }
}

function updateLobs(dt) {
  for (let i = G.lobs.length - 1; i >= 0; i--) {
    const l = G.lobs[i];
    l.t += dt;
    if (l.t < 0) continue;
    const f = clamp(l.t / l.dur, 0, 1);
    l.x = lerp(l.sx, l.tx, f);
    l.y = lerp(l.sy, l.ty, f);
    l.z = Math.sin(f * Math.PI) * 70;
    if (G.frame % 2 === 0) part(l.x, l.y - l.z, { color: l.color, life: 0.2, r: 2.5, vx: 0, vy: 0 });
    if (f >= 1) {
      explode(l.x, l.y, l.radius, l.dmg, l.color, l.src);
      if (l.cluster) {
        for (let k = 0; k < l.cluster; k++) {
          const a = rand(TAU), dd = rand(50, 130);
          spawnLob({ x: l.x, y: l.y, tx: l.x + Math.cos(a) * dd, ty: l.y + Math.sin(a) * dd, dmg: l.dmg * 0.55, radius: l.radius * 0.7, color: l.color, src: l.src, delay: 0 });
        }
      }
      G.lobs.splice(i, 1);
    }
  }
}

function explode(x, y, r, dmg, color, src) {
  damageArea(x, y, r, dmg, { src: src + UID++, color, knock: 260, fromX: x, fromY: y });
  spawnWave({ x, y, r0: r * 0.25, r1: r, dmg: 1, color, life: 0.3, knock: 0, src: 'fx' });
  burst(x, y, 16, color, 260, 0.5);
  AU.sfx('boom'); shake(5);
}

function updatePickups(dt) {
  const p = G.player;
  const magR = 120 * p.magnet;
  for (let i = G.gems.length - 1; i >= 0; i--) {
    const g = G.gems[i];
    g.age = (g.age || 0) + dt;
    if (g.age > 5) g.pulled = true;   // no gem is ever stranded behind the swarm
    const dx = p.x - g.x, dy = p.y - g.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < magR * magR || g.pulled) {
      g.pulled = true;
      const d = Math.sqrt(d2) || 1;
      const s = 260 + (1 - clamp(d / magR, 0, 1)) * 700;
      g.x += dx / d * s * dt; g.y += dy / d * s * dt;
    } else {
      g.x += g.vx * dt; g.y += g.vy * dt;
      g.vx *= Math.pow(0.02, dt); g.vy *= Math.pow(0.02, dt);
    }
    if (d2 < (p.r + g.r + 6) * (p.r + g.r + 6)) {
      addXP(g.v);
      AU.sfx('gem');
      part(p.x, p.y, { color: COL.xp, life: 0.3, r: 3 });
      G.gems.splice(i, 1);
    }
  }
  for (let i = G.drops.length - 1; i >= 0; i--) {
    const d0 = G.drops[i];
    d0.life -= dt;
    if (d0.life <= 0 && d0.kind !== 'chest') { G.drops.splice(i, 1); continue; }
    d0.age = (d0.age || 0) + dt;
    const dx = p.x - d0.x, dy = p.y - d0.y;
    const d2 = dx * dx + dy * dy;
    // chests drift to you once they've sat a moment; coins use the magnet
    const pullR = d0.kind === 'chest' ? (d0.age > 2 ? 1e9 : p.r + d0.r + 10) : magR * 1.15;
    if (d2 < pullR * pullR) {
      const d = Math.sqrt(d2) || 1;
      const sp = d0.kind === 'chest' ? 150 : 420;
      d0.x += dx / d * sp * dt; d0.y += dy / d * sp * dt;
    } else { d0.x += d0.vx * dt; d0.y += d0.vy * dt; d0.vx *= Math.pow(0.02, dt); d0.vy *= Math.pow(0.02, dt); }
    if (d2 < (p.r + d0.r + 6) * (p.r + d0.r + 6)) {
      if (d0.kind === 'coin') { G.soulsRun += d0.v; AU.sfx('coin'); dmgNum(p.x, p.y - 24, d0.v, COL.gold, false); }
      else if (d0.kind === 'heal') { p.hp = Math.min(p.maxhp, p.hp + d0.v); AU.sfx('pick'); dmgNum(p.x, p.y - 24, d0.v, COL.heal, false); flash(COL.heal, 0.12); }
      else if (d0.kind === 'chest') { G.chestQueue = Math.min(3, G.chestQueue + d0.v); AU.sfx('pick'); }
      G.drops.splice(i, 1);
    }
  }
}

const xpFor = lv => Math.floor(4 + 3.4 * lv + Math.pow(lv, 1.85));

function addXP(v) {
  const p = G.player;
  const gain = v * p.growth;
  G.gemsXp += gain;
  p.xp += gain;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = xpFor(p.level);
    G.levelQueue++;
    // levelling vacuums the field — chain level-ups feel like a slot machine
    for (const g of G.gems) g.pulled = true;
  }
}

function updateFX(dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const q = G.parts[i];
    q.life -= dt;
    if (q.life <= 0) { G.parts.splice(i, 1); continue; }
    q.x += q.vx * dt; q.y += q.vy * dt;
    const dr = Math.pow(0.0001, dt * (q.drag / 3));
    q.vx *= dr; q.vy *= dr;
    if (q.grow) q.r += q.grow * dt;
  }
  for (let i = G.nums.length - 1; i >= 0; i--) {
    const n = G.nums[i];
    n.life -= dt; n.y += n.vy * dt; n.vy *= Math.pow(0.02, dt);
    if (n.life <= 0) G.nums.splice(i, 1);
  }
  for (let i = G.bolts.length - 1; i >= 0; i--) {
    G.bolts[i].life -= dt;
    if (G.bolts[i].life <= 0) G.bolts.splice(i, 1);
  }
  for (let i = G.toasts.length - 1; i >= 0; i--) {
    G.toasts[i].life -= dt;
    if (G.toasts[i].life <= 0) G.toasts.splice(i, 1);
  }
  if (G.bannerT > 0) G.bannerT -= dt;
  if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 2.4);
  G.cam.sh *= Math.pow(0.0016, dt);
  if (G.cam.sh < 0.2) G.cam.sh = 0;
}

// ------------------------------------------------------------
//  Run lifecycle
// ------------------------------------------------------------
function startRun(charId) {
  G.t = 0; G.enemies.length = 0; G.bullets.length = 0; G.ebullets.length = 0;
  G.waves.length = 0; G.beams.length = 0; G.fields.length = 0; G.lobs.length = 0;
  G.gems.length = 0; G.drops.length = 0; G.parts.length = 0; G.nums.length = 0;
  G.bolts.length = 0; G.toasts.length = 0;
  G.spawnAcc = 0; G.nextBoss = 180; G.bossIdx = 0; G.boss = null; G.nextSwarm = 30; G.nextReaper = 0;
  G.kills = 0; G.damageDealt = 0; G.soulsRun = 0; G.gemsXp = 0;
  G.combo = 0; G.comboT = 0; G.maxCombo = 0; G.bigHit = 10;
  G.levelQueue = 0; G.chestQueue = 0; G.cards = [];
  G.flash = 0; G.hitstop = 0; G.cam.sh = 0; G.banner = null; G.bannerT = 0;
  G.newUnlocks = []; G.deathReason = ''; G.runSeconds = 0;
  G.player = makePlayer(charId);
  G.cam.x = 0; G.cam.y = 0;
  G.state = 'play';
  AU.init(); AU.resume(); AU.setIntensity(0.15);
  banner(G.player.ch.name, 'GO', G.player.ch.color);
  UI.syncHud();
  UI.show(null);
}

function endRun() {
  const p = G.player;
  G.state = 'dead';
  AU.sfx('die');
  AU.setIntensity(0);
  flash('#ff2b53', 0.8); shake(26);
  burst(p.x, p.y, 60, '#ff5a7a', 380, 1.1);

  // souls payout
  const comboBonus = 1 + Math.min(1.5, G.maxCombo / 260);
  const raw = (G.kills * 0.9 + G.t * 1.5 + p.level * 6 + G.soulsRun) * p.greed * comboBonus;
  const earned = Math.max(1, Math.round(raw));
  G.payout = { base: Math.round(G.kills * 0.9 + G.t * 1.5 + p.level * 6 + G.soulsRun), combo: comboBonus, greed: p.greed, total: earned };

  SV.souls += earned;
  const st = SV.stats;
  st.runs++; st.kills += G.kills; st.deaths++;
  st.totalTime += G.t; st.damage += p.totalDamage;
  const records = [];
  if (G.t > st.bestTime) { st.bestTime = G.t; records.push('LONGEST RUN'); }
  if (p.level > st.bestLevel) { st.bestLevel = p.level; records.push('HIGHEST LEVEL'); }
  if (G.kills > st.bestKills) { st.bestKills = G.kills; records.push('MOST KILLS'); }
  if (earned > st.bestSouls) { st.bestSouls = earned; records.push('BIGGEST HAUL'); }
  G.records = records;
  checkUnlocks();
  persist(true);
  UI.showDeath();
}

// ------------------------------------------------------------
//  Unlocks
// ------------------------------------------------------------
function checkUnlocks() {
  let any = false;
  for (const c of CHARS) {
    if (SV.unlocked.includes(c.id)) continue;
    if (c.unlock && c.unlock(SV)) {
      SV.unlocked.push(c.id);
      G.newUnlocks.push({ kind: 'char', name: c.name, desc: c.tag, color: c.color, glyph: c.glyph });
      toast('UNLOCKED: ' + c.name, c.tag, c.color);
      AU.sfx('unlock');
      any = true;
    }
  }
  for (const a of ACHIEVEMENTS) {
    if (SV.seenAchv.includes(a.id)) continue;
    if (a.test(SV)) {
      SV.seenAchv.push(a.id);
      G.newUnlocks.push({ kind: 'achv', name: a.name, desc: a.desc, color: COL.gold, glyph: '★' });
      toast('★ ' + a.name, a.desc, COL.gold);
      AU.sfx('unlock');
      any = true;
    }
  }
  if (any) persist(true);
  return any;
}

// "next thing you're close to" — the carrot that is always visible
function nextGoal() {
  const s = SV.stats;
  const cands = [];
  for (const c of CHARS) {
    if (SV.unlocked.includes(c.id) || !c.unlock) continue;
    if (c.id === 'orbit') cands.push({ label: 'UNLOCK ' + c.name, cur: s.bestLevel, need: 12, unit: 'best level' });
    if (c.id === 'surge') cands.push({ label: 'UNLOCK ' + c.name, cur: s.kills, need: 2500, unit: 'kills' });
    if (c.id === 'bruiser') cands.push({ label: 'UNLOCK ' + c.name, cur: s.bestTime, need: 480, unit: 'best time', time: true });
    if (c.id === 'glace') cands.push({ label: 'UNLOCK ' + c.name, cur: s.bosses, need: 1, unit: 'bosses' });
    if (c.id === 'nova') cands.push({ label: 'UNLOCK ' + c.name, cur: s.bestLevel, need: 25, unit: 'best level' });
    if (c.id === 'lancer') cands.push({ label: 'UNLOCK ' + c.name, cur: s.bestTime, need: 720, unit: 'best time', time: true });
  }
  for (const a of ACHIEVEMENTS) {
    if (SV.seenAchv.includes(a.id)) continue;
    const map = {
      k500: [s.kills, 500, 'kills'], k2500: [s.kills, 2500, 'kills'], k10000: [s.kills, 10000, 'kills'],
      lv12: [s.bestLevel, 12, 'best level'], lv25: [s.bestLevel, 25, 'best level'], lv40: [s.bestLevel, 40, 'best level'],
      t300: [s.bestTime, 300, 'best time'], t480: [s.bestTime, 480, 'best time'], t720: [s.bestTime, 720, 'best time'], t1200: [s.bestTime, 1200, 'best time'],
      boss1: [s.bosses, 1, 'bosses'], boss5: [s.bosses, 5, 'bosses'],
      evo1: [s.evolutions, 1, 'evolutions'], evo10: [s.evolutions, 10, 'evolutions'],
      chest10: [s.chests, 10, 'chests'], first: [s.runs, 1, 'runs']
    };
    const m = map[a.id];
    if (m) cands.push({ label: a.name, cur: m[0], need: m[1], unit: m[2], time: m[2] === 'best time' });
  }
  if (!cands.length) return null;
  cands.sort((a, b) => (b.cur / b.need) - (a.cur / a.need));
  return cands[0];
}

// ------------------------------------------------------------
//  Level-up card generation
// ------------------------------------------------------------
function evolutionsAvailable(p) {
  const out = [];
  for (const w of p.weapons) {
    const def = WEAPONS[w.id];
    if (!def || !def.evo || w.lv < def.max) continue;
    if ((p.passives[def.evo.need] || 0) < PASSIVES[def.evo.need].max) continue;
    out.push({ from: w, into: def.evo.into });
  }
  return out;
}

function buildCards(count) {
  const p = G.player;
  const pool = [];
  const evos = evolutionsAvailable(p);
  for (const ev of evos) {
    const def = WEAPONS[ev.into];
    pool.push({ kind: 'evo', id: ev.into, from: ev.from.id, rarity: 'evo', weight: 9999, name: def.name, glyph: def.glyph, color: def.color, desc: def.desc, sub: 'EVOLUTION · ' + WEAPONS[ev.from.id].name + ' + ' + PASSIVES[WEAPONS[ev.from.id].evo.need].name });
  }
  // upgrade existing
  for (const w of p.weapons) {
    const def = WEAPONS[w.id];
    if (!def || w.lv >= def.max) continue;
    pool.push({ kind: 'weapon', id: w.id, lv: w.lv + 1, weight: 100, name: def.name, glyph: def.glyph, color: def.color, desc: def.lvDesc(w.lv + 1), sub: 'LV ' + w.lv + ' → ' + (w.lv + 1) });
  }
  for (const id in p.passives) {
    const def = PASSIVES[id];
    if (p.passives[id] >= def.max) continue;
    pool.push({ kind: 'passive', id, lv: p.passives[id] + 1, weight: 85, name: def.name, glyph: def.glyph, color: def.color, desc: def.lvDesc(p.passives[id] + 1), sub: 'LV ' + p.passives[id] + ' → ' + (p.passives[id] + 1) });
  }
  // new weapons
  if (p.weapons.length < p.wSlots) {
    for (const id of WEAPON_IDS) {
      if (p.weapons.some(w => w.id === id || WEAPONS[w.id].base === id)) continue;
      const def = WEAPONS[id];
      pool.push({ kind: 'weapon', id, lv: 1, weight: 78, isNew: true, name: def.name, glyph: def.glyph, color: def.color, desc: def.desc, sub: 'NEW WEAPON' });
    }
  }
  // new passives
  if (Object.keys(p.passives).length < p.pSlots) {
    for (const id of PASSIVE_IDS) {
      if (p.passives[id]) continue;
      const def = PASSIVES[id];
      pool.push({ kind: 'passive', id, lv: 1, weight: 62, isNew: true, name: def.name, glyph: def.glyph, color: def.color, desc: def.desc, sub: 'NEW ITEM' });
    }
  }
  if (!pool.length) {
    return [
      { kind: 'heal', name: 'REPAIR', glyph: '✚', color: COL.heal, desc: 'Restore 40% of max HP.', sub: 'CONSUMABLE', rarity: 'common' },
      { kind: 'souls', name: 'SOUL CACHE', glyph: '$', color: COL.gold, desc: 'Gain 40 souls instantly.', sub: 'CONSUMABLE', rarity: 'common' },
      { kind: 'heal', name: 'REPAIR', glyph: '✚', color: COL.heal, desc: 'Restore 40% of max HP.', sub: 'CONSUMABLE', rarity: 'common' }
    ];
  }
  // banished filtering
  const avail = pool.filter(c => !(G.banished && G.banished[c.kind + ':' + c.id]));
  const src = avail.length ? avail : pool;
  const out = [];
  const used = Object.create(null);
  const evoCards = src.filter(c => c.kind === 'evo');
  for (const ec of evoCards) { out.push(ec); used[ec.kind + ':' + ec.id] = 1; }
  const rest = src.filter(c => !used[c.kind + ':' + c.id]);
  while (out.length < count && rest.length) {
    const c = wpick(rest, it => it.weight * (1 + (it.isNew ? p.luck * 2 : 0)));
    if (!c) break;
    rest.splice(rest.indexOf(c), 1);
    // rarity roll — pure cosmetic thrill + slight tilt from luck
    const roll = Math.random() + p.luck * 0.5;
    c.rarity = c.rarity || (roll > 0.94 ? 'epic' : roll > 0.76 ? 'rare' : 'common');
    out.push(c);
  }
  // always leave a bail-out option
  if (out.length < count) out.push({ kind: 'heal', name: 'REPAIR', glyph: '✚', color: COL.heal, desc: 'Restore 40% of max HP.', sub: 'CONSUMABLE', rarity: 'common' });
  return out.slice(0, Math.max(count, evoCards.length));
}

function applyCard(c) {
  const p = G.player;
  if (c.kind === 'weapon') {
    addWeapon(p, c.id);
    AU.sfx('pick');
  } else if (c.kind === 'passive') {
    addPassive(p, c.id);
    AU.sfx('pick');
  } else if (c.kind === 'evo') {
    const idx = p.weapons.findIndex(w => w.id === c.from);
    const oldLv = idx >= 0 ? p.weapons[idx].lv : 1;
    if (idx >= 0) p.weapons.splice(idx, 1);
    const w = addWeapon(p, c.id);
    if (w) w.lv = Math.max(1, Math.min(WEAPONS[c.id].max, Math.floor(oldLv / 2) + 1));
    SV.stats.evolutions++;
    banner(WEAPONS[c.id].name, 'EVOLVED', WEAPONS[c.id].color);
    flash(WEAPONS[c.id].color, 0.6); shake(16);
    AU.sfx('evolve');
    checkUnlocks(); persist(true);
  } else if (c.kind === 'heal') {
    p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.4);
    AU.sfx('pick');
  } else if (c.kind === 'souls') {
    G.soulsRun += 40; AU.sfx('coin');
  }
  recalc(p);
}
