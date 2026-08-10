// ============================================================
//  ONE MORE — content: characters, weapons, passives, enemies,
//  meta upgrades, unlock conditions
// ============================================================

const COL = {
  shard: '#7cf3ff', halo: '#b78bff', pulse: '#ff8bd1', arc: '#ffe66d',
  mortar: '#ff9d5c', lance: '#8bff9d', rime: '#9ddcff',
  gold: '#ffd166', xp: '#5ef2c0', crit: '#fff27a', heal: '#6bffb0',
  enemy: '#ff5a7a', elite: '#ffb03a', boss: '#ff3b6b'
};

// ------------------------------------------------------------
//  CHARACTERS
// ------------------------------------------------------------
const CHARS = [
  {
    id: 'vector', name: 'VECTOR', glyph: '◆', color: '#7cf3ff',
    tag: 'Balanced. Fires piercing shards.', weapon: 'shard',
    mods: {}, unlock: null, unlockText: 'Available from the start.'
  },
  {
    id: 'orbit', name: 'ORBIT', glyph: '⬡', color: '#b78bff',
    tag: '+15% Area, +20 HP, −8% Speed.', weapon: 'halo',
    mods: { area: 0.15, maxhp: 20, spd: -0.08 },
    unlock: s => s.stats.bestLevel >= 12, unlockText: 'Reach level 12 in a single run.'
  },
  {
    id: 'surge', name: 'SURGE', glyph: '⚡', color: '#ffe66d',
    tag: '−18% Cooldown, −20 HP.', weapon: 'arc',
    mods: { cdr: -0.18, maxhp: -20 },
    unlock: s => s.stats.kills >= 2500, unlockText: 'Defeat 2,500 enemies (lifetime).'
  },
  {
    id: 'bruiser', name: 'BRUISER', glyph: '⬢', color: '#ff9d5c',
    tag: '+30% Area, +40 HP, −12% Speed.', weapon: 'mortar',
    mods: { area: 0.30, maxhp: 40, spd: -0.12 },
    unlock: s => s.stats.bestTime >= 480, unlockText: 'Survive 8:00 in a single run.'
  },
  {
    id: 'glace', name: 'GLACE', glyph: '❄', color: '#9ddcff',
    tag: '+25% Duration, +15% Magnet.', weapon: 'rime',
    mods: { dur: 0.25, magnet: 0.15 },
    unlock: s => s.stats.bosses >= 1, unlockText: 'Destroy a Warden.'
  },
  {
    id: 'nova', name: 'NOVA', glyph: '✹', color: '#ff8bd1',
    tag: '+25% Might, −25 HP.', weapon: 'pulse',
    mods: { might: 0.25, maxhp: -25 },
    unlock: s => s.stats.bestLevel >= 25, unlockText: 'Reach level 25 in a single run.'
  },
  {
    id: 'lancer', name: 'LANCER', glyph: '➤', color: '#8bff9d',
    tag: '+20% Proj. Speed, +12% Might, +1 Armor.', weapon: 'lance',
    mods: { pspd: 0.20, might: 0.12, armor: 1 },
    unlock: s => s.stats.bestTime >= 720, unlockText: 'Survive 12:00 in a single run.'
  }
];
const charById = id => CHARS.find(c => c.id === id) || CHARS[0];

// ------------------------------------------------------------
//  WEAPONS
//  fire(w, p) is called when the weapon's timer elapses.
//  cd(lv) returns base cooldown in seconds (before player cdr).
// ------------------------------------------------------------
const WEAPONS = {
  // ---------- SHARD ----------
  shard: {
    id: 'shard', name: 'Shard', glyph: '◆', color: COL.shard, max: 8,
    desc: 'Launches piercing shards at the nearest foe.',
    lvDesc: lv => `Dmg ${12 + 5 * (lv - 1)} · ${1 + Math.floor(lv / 2)} shard(s) · pierce ${1 + Math.floor(lv / 3)}`,
    evo: { into: 'tempest', need: 'momentum' },
    cd: lv => 0.75 * Math.pow(0.92, lv - 1),
    fire(w, p) {
      const lv = w.lv;
      const n = 1 + Math.floor(lv / 2) + p.amount;
      const dmg = (12 + 5 * (lv - 1)) * p.might;
      const target = nearestEnemy(p.x, p.y, 900);
      const base = target ? Math.atan2(target.y - p.y, target.x - p.x) : p.face;
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.16;
        spawnBullet({
          x: p.x, y: p.y, a, spd: 470 * p.pspd, dmg, r: 5 * p.area,
          pierce: 1 + Math.floor(lv / 3) + p.pierce, life: 1.3 * p.dur,
          color: COL.shard, shape: 'shard', knock: 90, src: 'shard'
        });
      }
      AU.sfx('shoot');
    }
  },
  tempest: {
    id: 'tempest', name: 'TEMPEST', glyph: '✦', color: '#aef8ff', max: 8, evolved: true, base: 'shard',
    desc: 'An endless spiral of shards, forever outward.',
    lvDesc: lv => `Dmg ${34 + 12 * (lv - 1)} · spiral volley · pierce ${4 + Math.floor(lv / 2)}`,
    cd: lv => 0.30 * Math.pow(0.95, lv - 1),
    fire(w, p) {
      const lv = w.lv;
      w.spin = (w.spin || 0) + 0.62;
      const n = 3 + Math.floor(lv / 3) + p.amount;
      const dmg = (34 + 12 * (lv - 1)) * p.might;
      for (let i = 0; i < n; i++) {
        const a = w.spin + i * (TAU / n);
        spawnBullet({
          x: p.x, y: p.y, a, spd: 400 * p.pspd, dmg, r: 6 * p.area,
          pierce: 4 + Math.floor(lv / 2) + p.pierce, life: 1.5 * p.dur,
          color: '#aef8ff', shape: 'shard', knock: 100, src: 'tempest', curve: 1.1
        });
      }
      AU.sfx('shoot');
    }
  },

  // ---------- HALO (orbiting) ----------
  halo: {
    id: 'halo', name: 'Halo', glyph: '⬡', color: COL.halo, max: 8,
    desc: 'Blades orbit you, shredding whatever touches them.',
    lvDesc: lv => `Dmg ${12 + 5 * lv} · ${3 + Math.floor(lv / 2)} blades · hunts to ${((64 + 8 * lv) * 2.4) | 0}`,
    evo: { into: 'horizon', need: 'resonator' },
    persistent: true,
    cd: () => 999,
    tick(w, p, dt) {
      const lv = w.lv;
      w.rot = (w.rot || 0) + dt * (2.1 + lv * 0.1);
      w.breathe = (w.breathe || 0) + dt * 1.5;
      const n = 3 + Math.floor(lv / 2) + p.amount;
      const R = (64 + 8 * lv) * p.area;
      const orbR = (15 + 1.4 * lv) * p.area;
      const dmg = (12 + 5 * lv) * p.might;
      const near = nearestEnemy(p.x, p.y, 620);
      const want = near ? clamp(Math.hypot(near.x - p.x, near.y - p.y), R * 0.28, R * 2.4) : R * 0.75;
      w.curR = lerp(w.curR === undefined ? R : w.curR, want, 1 - Math.pow(0.008, dt));
      w.orbs = [];
      for (let i = 0; i < n; i++) {
        const a = w.rot + i * (TAU / n);
        const rr = w.curR * (0.82 + 0.24 * Math.sin(w.breathe + i * 1.7));
        const ox = p.x + Math.cos(a) * rr, oy = p.y + Math.sin(a) * rr;
        w.orbs.push({ x: ox, y: oy, r: orbR });
        damageArea(ox, oy, orbR, dmg, { src: 'halo', cd: 0.35, color: COL.halo, knock: 150, tick: true });
      }
    }
  },
  horizon: {
    id: 'horizon', name: 'EVENT HORIZON', glyph: '◉', color: '#d9b3ff', max: 8, evolved: true, base: 'halo',
    desc: 'Collapsing singularities drag the swarm into the grind.',
    lvDesc: lv => `Dmg ${28 + 12 * lv} · ${4 + Math.floor(lv / 2)} orbs · drags enemies in`,
    persistent: true,
    cd: () => 999,
    tick(w, p, dt) {
      const lv = w.lv;
      w.rot = (w.rot || 0) + dt * (1.7 + lv * 0.08);
      w.breathe = (w.breathe || 0) + dt * 1.2;
      const n = 4 + Math.floor(lv / 2) + p.amount;
      const R = (78 + 10 * lv) * p.area;
      const orbR = (24 + 1.8 * lv) * p.area;
      const dmg = (28 + 12 * lv) * p.might;
      const near = nearestEnemy(p.x, p.y, 700);
      const want = near ? clamp(Math.hypot(near.x - p.x, near.y - p.y), R * 0.25, R * 2.2) : R * 0.7;
      w.curR = lerp(w.curR === undefined ? R : w.curR, want, 1 - Math.pow(0.008, dt));
      w.orbs = [];
      for (let i = 0; i < n; i++) {
        const a = w.rot + i * (TAU / n);
        const rr = w.curR * (0.8 + 0.26 * Math.sin(w.breathe + i * 1.4));
        const ox = p.x + Math.cos(a) * rr, oy = p.y + Math.sin(a) * rr;
        w.orbs.push({ x: ox, y: oy, r: orbR, big: true });
        damageArea(ox, oy, orbR, dmg, { src: 'horizon', cd: 0.26, color: '#d9b3ff', knock: -260, tick: true });
      }
    }
  },

  // ---------- PULSE ----------
  pulse: {
    id: 'pulse', name: 'Pulse', glyph: '◎', color: COL.pulse, max: 8,
    desc: 'A shockwave rips outward from your core.',
    lvDesc: lv => `Dmg ${24 + 10 * (lv - 1)} · radius ${(104 + 22 * lv) | 0} · knockback`,
    evo: { into: 'supernova', need: 'core' },
    cd: lv => 2.2 * Math.pow(0.93, lv - 1),
    fire(w, p) {
      const lv = w.lv;
      const R = (104 + 22 * lv) * p.area;
      spawnWave({ x: p.x, y: p.y, r0: 18, r1: R, dmg: (24 + 10 * (lv - 1)) * p.might, color: COL.pulse, life: 0.42 * p.dur, knock: 330, src: 'pulse' });
      AU.sfx('boom'); shake(4);
    }
  },
  supernova: {
    id: 'supernova', name: 'SUPERNOVA', glyph: '✹', color: '#ffb3e0', max: 8, evolved: true, base: 'pulse',
    desc: 'You detonate. Everything in the blast keeps burning.',
    lvDesc: lv => `Dmg ${58 + 24 * (lv - 1)} · radius ${(150 + 30 * lv) | 0} · ignites`,
    cd: lv => 2.2 * Math.pow(0.93, lv - 1),
    fire(w, p) {
      const lv = w.lv;
      const R = (150 + 30 * lv) * p.area;
      spawnWave({ x: p.x, y: p.y, r0: 24, r1: R, dmg: (58 + 24 * (lv - 1)) * p.might, color: '#ffb3e0', life: 0.5 * p.dur, knock: 480, src: 'supernova', burn: { dps: (12 + 5 * lv) * p.might, time: 3 * p.dur } });
      AU.sfx('boom'); shake(11);
    }
  },

  // ---------- ARC ----------
  arc: {
    id: 'arc', name: 'Arc', glyph: '⚡', color: COL.arc, max: 8,
    desc: 'Lightning leaps between the closest bodies.',
    lvDesc: lv => `Dmg ${18 + 8 * (lv - 1)} · ${2 + Math.floor(lv * 0.9)} jumps`,
    evo: { into: 'cascade', need: 'capacitor' },
    cd: lv => 1.4 * Math.pow(0.92, lv - 1),
    fire(w, p) {
      const lv = w.lv;
      chainLightning(p.x, p.y, (18 + 8 * (lv - 1)) * p.might, 2 + Math.floor(lv * 0.9) + p.amount, 240 * p.area, COL.arc, 'arc');
    }
  },
  cascade: {
    id: 'cascade', name: 'TESLA CASCADE', glyph: '⌁', color: '#fff3a8', max: 8, evolved: true, base: 'arc',
    desc: 'The storm never stops looking for a new body.',
    lvDesc: lv => `Dmg ${44 + 17 * (lv - 1)} · ${6 + lv} jumps · stuns`,
    cd: lv => 0.75 * Math.pow(0.93, lv - 1),
    fire(w, p) {
      const lv = w.lv;
      chainLightning(p.x, p.y, (44 + 17 * (lv - 1)) * p.might, 6 + lv + p.amount, 300 * p.area, '#fff3a8', 'cascade', 0.55 * p.dur);
    }
  },

  // ---------- MORTAR ----------
  mortar: {
    id: 'mortar', name: 'Mortar', glyph: '◍', color: COL.mortar, max: 8,
    desc: 'Lobs charges that detonate on impact.',
    lvDesc: lv => `Dmg ${38 + 15 * (lv - 1)} · ${1 + Math.floor(lv / 3)} shell(s) · blast ${(66 + 10 * lv) | 0}`,
    evo: { into: 'clusterfall', need: 'fuse' },
    cd: lv => 2.1 * Math.pow(0.93, lv - 1),
    fire(w, p) {
      const lv = w.lv;
      const n = 1 + Math.floor(lv / 3) + p.amount;
      for (let i = 0; i < n; i++) {
        const t = randomEnemyNear(p.x, p.y, 460) || { x: p.x + rand(-260, 260), y: p.y + rand(-260, 260) };
        spawnLob({
          x: p.x, y: p.y, tx: t.x + rand(-24, 24), ty: t.y + rand(-24, 24),
          dmg: (38 + 15 * (lv - 1)) * p.might, radius: (66 + 10 * lv) * p.area,
          color: COL.mortar, src: 'mortar', delay: i * 0.08
        });
      }
    }
  },
  clusterfall: {
    id: 'clusterfall', name: 'CLUSTERFALL', glyph: '⁂', color: '#ffc59d', max: 8, evolved: true, base: 'mortar',
    desc: 'Every shell blooms into more shells. It rains.',
    lvDesc: lv => `Dmg ${68 + 26 * (lv - 1)} · ${2 + Math.floor(lv / 2)} shells · splits ×4`,
    cd: lv => 1.9 * Math.pow(0.93, lv - 1),
    fire(w, p) {
      const lv = w.lv;
      const n = 2 + Math.floor(lv / 2) + p.amount;
      for (let i = 0; i < n; i++) {
        const t = randomEnemyNear(p.x, p.y, 520) || { x: p.x + rand(-300, 300), y: p.y + rand(-300, 300) };
        spawnLob({
          x: p.x, y: p.y, tx: t.x + rand(-30, 30), ty: t.y + rand(-30, 30),
          dmg: (68 + 26 * (lv - 1)) * p.might, radius: (82 + 11 * lv) * p.area,
          color: '#ffc59d', src: 'clusterfall', delay: i * 0.07, cluster: 4
        });
      }
    }
  },

  // ---------- LANCE ----------
  lance: {
    id: 'lance', name: 'Lance', glyph: '➤', color: COL.lance, max: 8,
    desc: 'A beam that burns straight through the line.',
    lvDesc: lv => `Dmg ${16 + 7 * lv}/tick · length ${(340 + 42 * lv) | 0} · ${1 + Math.floor(lv / 4)} beam(s)`,
    evo: { into: 'prism', need: 'lens' },
    cd: lv => 1.8 * Math.pow(0.93, lv - 1),
    fire(w, p) {
      const lv = w.lv;
      const n = 1 + Math.floor(lv / 4) + p.amount;
      const target = nearestEnemy(p.x, p.y, 900);
      const base = target ? Math.atan2(target.y - p.y, target.x - p.x) : p.face;
      for (let i = 0; i < n; i++) {
        spawnBeam({
          x: p.x, y: p.y, a: base + (i - (n - 1) / 2) * 0.45,
          len: (340 + 42 * lv) * p.area, width: (16 + 2 * lv) * p.area,
          dmg: (16 + 7 * lv) * p.might, life: 0.34 * p.dur, color: COL.lance, src: 'lance', follow: true
        });
      }
      AU.sfx('zap');
    }
  },
  prism: {
    id: 'prism', name: 'PRISM', glyph: '✳', color: '#c6ffd0', max: 8, evolved: true, base: 'lance',
    desc: 'Light splits in every direction at once.',
    lvDesc: lv => `Dmg ${26 + 11 * lv}/tick · ${4 + Math.floor(lv / 2)} beams · full sweep`,
    cd: lv => 1.7 * Math.pow(0.93, lv - 1),
    fire(w, p) {
      const lv = w.lv;
      const n = 4 + Math.floor(lv / 2) + p.amount;
      w.spin = (w.spin || 0) + 0.4;
      for (let i = 0; i < n; i++) {
        spawnBeam({
          x: p.x, y: p.y, a: w.spin + i * (TAU / n),
          len: (400 + 50 * lv) * p.area, width: (18 + 2 * lv) * p.area,
          dmg: (26 + 11 * lv) * p.might, life: 0.5 * p.dur, color: '#c6ffd0', src: 'prism', follow: true, sweep: 0.9
        });
      }
      AU.sfx('zap'); shake(3);
    }
  },

  // ---------- RIME ----------
  rime: {
    id: 'rime', name: 'Rime', glyph: '❄', color: COL.rime, max: 8,
    desc: 'Frost fields that chill everything to a crawl.',
    lvDesc: lv => `Dmg ${11 + 5 * lv}/s · ${1 + Math.floor(lv / 3)} field(s) · slow ${(30 + 4 * lv)}%`,
    evo: { into: 'zero', need: 'tracker' },
    cd: lv => 2.2 * Math.pow(0.94, lv - 1),
    fire(w, p) {
      const lv = w.lv;
      const n = 1 + Math.floor(lv / 3) + p.amount;
      for (let i = 0; i < n; i++) {
        const t = randomEnemyNear(p.x, p.y, 400) || { x: p.x + rand(-200, 200), y: p.y + rand(-200, 200) };
        spawnField({
          x: t.x, y: t.y, r: (70 + 9 * lv) * p.area, dps: (11 + 5 * lv) * p.might,
          slow: clamp(0.30 + 0.04 * lv, 0, 0.85), life: 3.4 * p.dur, color: COL.rime, src: 'rime'
        });
      }
      AU.sfx('freeze');
    }
  },
  zero: {
    id: 'zero', name: 'ABSOLUTE ZERO', glyph: '❅', color: '#dff3ff', max: 8, evolved: true, base: 'rime',
    desc: 'The field follows you. Nothing moves in it.',
    lvDesc: lv => `Dmg ${26 + 11 * lv}/s · aura + shards · slow ${(55 + 4 * lv)}%`,
    cd: lv => 1.6 * Math.pow(0.94, lv - 1),
    persistent: true,
    tick(w, p, dt) {
      const lv = w.lv;
      const R = (110 + 12 * lv) * p.area;
      w.aura = R;
      damageArea(p.x, p.y, R, (26 + 11 * lv) * p.might * dt * 2.2, {
        src: 'zero-aura', cd: 0.45, color: '#dff3ff', knock: 0, tick: true,
        slow: { amt: clamp(0.55 + 0.04 * lv, 0, 0.92), time: 1.1 }
      });
    },
    fire(w, p) {
      const lv = w.lv;
      const n = 3 + Math.floor(lv / 2) + p.amount;
      for (let i = 0; i < n; i++) {
        const a = rand(TAU);
        spawnBullet({
          x: p.x, y: p.y, a, spd: 330 * p.pspd, dmg: (34 + 14 * lv) * p.might, r: 7 * p.area,
          pierce: 3 + p.pierce, life: 1.6 * p.dur, color: '#dff3ff', shape: 'flake', knock: 60, src: 'zero',
          slow: { amt: 0.6, time: 1.4 }
        });
      }
      AU.sfx('freeze');
    }
  }
};

const WEAPON_IDS = ['shard', 'halo', 'pulse', 'arc', 'mortar', 'lance', 'rime'];

// ------------------------------------------------------------
//  PASSIVES
// ------------------------------------------------------------
const PASSIVES = {
  momentum: { id: 'momentum', name: 'Momentum', glyph: '»', color: '#7cf3ff', max: 5, desc: '+8% Move Speed per level.', lvDesc: lv => `+${lv * 8}% move speed` },
  core: { id: 'core', name: 'Core', glyph: '❖', color: '#ff8bd1', max: 5, desc: '+12% Might per level.', lvDesc: lv => `+${lv * 12}% damage` },
  resonator: { id: 'resonator', name: 'Resonator', glyph: '◌', color: '#b78bff', max: 5, desc: '+10% Area per level.', lvDesc: lv => `+${lv * 10}% area` },
  capacitor: { id: 'capacitor', name: 'Capacitor', glyph: '⚙', color: '#ffe66d', max: 5, desc: '−6% Cooldown per level.', lvDesc: lv => `−${lv * 6}% cooldown` },
  fuse: { id: 'fuse', name: 'Fuse', glyph: '∞', color: '#ff9d5c', max: 5, desc: '+14% Duration per level.', lvDesc: lv => `+${lv * 14}% duration` },
  lens: { id: 'lens', name: 'Lens', glyph: '◇', color: '#8bff9d', max: 5, desc: '+15% Proj. Speed. +1 pierce at 3 & 5.', lvDesc: lv => `+${lv * 15}% proj speed, +${(lv >= 5 ? 2 : lv >= 3 ? 1 : 0)} pierce` },
  tracker: { id: 'tracker', name: 'Tracker', glyph: '◈', color: '#9ddcff', max: 5, desc: '+30% Magnet, +7% Luck per level.', lvDesc: lv => `+${lv * 30}% magnet, +${lv * 7}% luck` },
  plate: { id: 'plate', name: 'Plate', glyph: '▣', color: '#c9d6e3', max: 5, desc: '+14 Max HP, +1 Armor per level.', lvDesc: lv => `+${lv * 14} HP, +${lv} armor` },
  siphon: { id: 'siphon', name: 'Siphon', glyph: '♥', color: '#6bffb0', max: 5, desc: '+0.5 HP/s regen, +4% lifesteal chance.', lvDesc: lv => `+${(lv * 0.5).toFixed(1)} HP/s, ${lv * 4}% leech` },
  greedp: { id: 'greedp', name: 'Avarice', glyph: '$', color: '#ffd166', max: 5, desc: '+15% Souls, +8% XP per level.', lvDesc: lv => `+${lv * 15}% souls, +${lv * 8}% XP` }
};
const PASSIVE_IDS = Object.keys(PASSIVES);

const itemById = id => WEAPONS[id] || PASSIVES[id];

// ------------------------------------------------------------
//  ENEMIES
// ------------------------------------------------------------
const ENEMIES = {
  mote: { id: 'mote', hp: 11, spd: 82, dmg: 7, r: 10, xp: 1, color: '#ff5a7a', shape: 'tri', from: 0, w: () => 100 },
  runner: { id: 'runner', hp: 9, spd: 128, dmg: 6, r: 8, xp: 1, color: '#ff8fa8', shape: 'dart', from: 40, w: t => 40 + t * 0.1 },
  brute: { id: 'brute', hp: 58, spd: 62, dmg: 14, r: 17, xp: 4, color: '#c0407a', shape: 'hex', from: 95, w: t => 22 + t * 0.07 },
  spitter: { id: 'spitter', hp: 26, spd: 66, dmg: 9, r: 11, xp: 4, color: '#a86bff', shape: 'diamond', from: 150, w: t => 18 + t * 0.05, ranged: { cd: 3.1, spd: 190, dmg: 9 } },
  splitter: { id: 'splitter', hp: 38, spd: 86, dmg: 10, r: 14, xp: 4, color: '#5affc0', shape: 'square', from: 210, w: t => 16 + t * 0.05, split: 3 },
  shade: { id: 'shade', hp: 32, spd: 105, dmg: 12, r: 10, xp: 5, color: '#e0e6ff', shape: 'tri', from: 280, w: t => 16 + t * 0.05, dash: true },
  jugger: { id: 'jugger', hp: 300, spd: 54, dmg: 24, r: 27, xp: 18, color: '#ff3b3b', shape: 'hex', from: 380, w: t => 8 + t * 0.03 },
  reaper: { id: 'reaper', hp: 260, spd: 196, dmg: 34, r: 14, xp: 20, color: '#ffffff', shape: 'dart', from: 900, w: t => 6 + (t - 900) * 0.02 },
  wisp: { id: 'wisp', hp: 20, spd: 142, dmg: 8, r: 8, xp: 3, color: '#ffe66d', shape: 'dart', from: 300, w: t => 14 + t * 0.04, orbitStrafe: true }
};

const BOSSES = [
  { id: 'warden', name: 'THE WARDEN', hp: 1500, spd: 74, dmg: 30, r: 44, xp: 220, color: '#ff3b6b', pattern: 'radial' },
  { id: 'sentinel', name: 'SENTINEL PRIME', hp: 3600, spd: 80, dmg: 36, r: 50, xp: 380, color: '#b78bff', pattern: 'spiral' },
  { id: 'devourer', name: 'THE DEVOURER', hp: 7000, spd: 86, dmg: 44, r: 58, xp: 620, color: '#ffb03a', pattern: 'summon' },
  { id: 'null', name: 'NULL', hp: 13000, spd: 92, dmg: 55, r: 64, xp: 1000, color: '#7cf3ff', pattern: 'beam' }
];

// ------------------------------------------------------------
//  META UPGRADES (permanent, bought with Souls)
// ------------------------------------------------------------
const META = [
  { id: 'might', name: 'MIGHT', glyph: '❖', max: 10, base: 26, desc: l => `+${l * 5}% damage`, apply: (p, l) => p.might += l * 0.05 },
  { id: 'vitality', name: 'VITALITY', glyph: '♥', max: 10, base: 22, desc: l => `+${l * 10} max HP`, apply: (p, l) => p.maxhp += l * 10 },
  { id: 'haste', name: 'HASTE', glyph: '»', max: 6, base: 30, desc: l => `+${l * 3}% move speed`, apply: (p, l) => p.spd += l * 0.03 },
  { id: 'cool', name: 'COOLING', glyph: '⚙', max: 6, base: 40, desc: l => `−${l * 3}% cooldown`, apply: (p, l) => p.cdr -= l * 0.03 },
  { id: 'area', name: 'RESONANCE', glyph: '◌', max: 6, base: 34, desc: l => `+${l * 4}% area`, apply: (p, l) => p.area += l * 0.04 },
  { id: 'armor', name: 'PLATING', glyph: '▣', max: 6, base: 34, desc: l => `+${l} armor`, apply: (p, l) => p.armor += l },
  { id: 'regen', name: 'MENDING', glyph: '✚', max: 6, base: 36, desc: l => `+${(l * 0.25).toFixed(2)} HP/s`, apply: (p, l) => p.regen += l * 0.25 },
  { id: 'growth', name: 'GROWTH', glyph: '▲', max: 6, base: 32, desc: l => `+${l * 6}% XP gained`, apply: (p, l) => p.growth += l * 0.06 },
  { id: 'greed', name: 'GREED', glyph: '$', max: 10, base: 24, desc: l => `+${l * 8}% souls earned`, apply: (p, l) => p.greed += l * 0.08 },
  { id: 'magnet', name: 'MAGNET', glyph: '◈', max: 5, base: 28, desc: l => `+${l * 20}% pickup range`, apply: (p, l) => p.magnet += l * 0.20 },
  { id: 'luck', name: 'LUCK', glyph: '✦', max: 8, base: 34, desc: l => `+${l * 4}% crit & rare odds`, apply: (p, l) => p.luck += l * 0.04 },
  { id: 'reroll', name: 'REROLLS', glyph: '↻', max: 4, base: 70, desc: l => `+${l} reroll per run`, apply: (p, l) => p.rerolls += l },
  { id: 'banish', name: 'BANISH', glyph: '✕', max: 4, base: 70, desc: l => `+${l} banish per run`, apply: (p, l) => p.banishes += l },
  { id: 'revive', name: 'REVIVE', glyph: '☥', max: 2, base: 260, desc: l => `+${l} extra life`, apply: (p, l) => p.revives += l },
  { id: 'slots', name: 'ARSENAL', glyph: '⊞', max: 1, base: 320, desc: l => `+${l} weapon slot`, apply: (p, l) => p.wSlots += l }
];
const metaCost = (m, lv) => Math.round(m.base * Math.pow(1.62, lv));
const metaLv = id => SV.meta[id] || 0;

// ------------------------------------------------------------
//  ACHIEVEMENTS / UNLOCK FEED
// ------------------------------------------------------------
const ACHIEVEMENTS = [
  { id: 'first', name: 'FIRST BLOOD', desc: 'Finish your first run.', test: s => s.stats.runs >= 1 },
  { id: 'k500', name: 'CROWD CONTROL', desc: 'Defeat 500 enemies.', test: s => s.stats.kills >= 500 },
  { id: 'k2500', name: 'MASS DRIVER', desc: 'Defeat 2,500 enemies.', test: s => s.stats.kills >= 2500 },
  { id: 'k10000', name: 'EXTINCTION', desc: 'Defeat 10,000 enemies.', test: s => s.stats.kills >= 10000 },
  { id: 'lv12', name: 'ASCENDING', desc: 'Reach level 12 in a run.', test: s => s.stats.bestLevel >= 12 },
  { id: 'lv25', name: 'OVERCLOCKED', desc: 'Reach level 25 in a run.', test: s => s.stats.bestLevel >= 25 },
  { id: 'lv40', name: 'SINGULARITY', desc: 'Reach level 40 in a run.', test: s => s.stats.bestLevel >= 40 },
  { id: 't300', name: 'FIVE MINUTES', desc: 'Survive 5:00.', test: s => s.stats.bestTime >= 300 },
  { id: 't480', name: 'EIGHT MINUTES', desc: 'Survive 8:00.', test: s => s.stats.bestTime >= 480 },
  { id: 't720', name: 'TWELVE MINUTES', desc: 'Survive 12:00.', test: s => s.stats.bestTime >= 720 },
  { id: 't1200', name: 'THE LONG DARK', desc: 'Survive 20:00.', test: s => s.stats.bestTime >= 1200 },
  { id: 'boss1', name: 'WARDEN SLAIN', desc: 'Destroy a Warden.', test: s => s.stats.bosses >= 1 },
  { id: 'boss5', name: 'GIANTKILLER', desc: 'Destroy 5 bosses.', test: s => s.stats.bosses >= 5 },
  { id: 'evo1', name: 'METAMORPHOSIS', desc: 'Evolve a weapon.', test: s => s.stats.evolutions >= 1 },
  { id: 'evo10', name: 'PERFECTED', desc: 'Evolve 10 weapons.', test: s => s.stats.evolutions >= 10 },
  { id: 'chest10', name: 'TREASURE HUNTER', desc: 'Open 10 chests.', test: s => s.stats.chests >= 10 }
];
