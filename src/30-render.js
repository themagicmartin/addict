// ============================================================
//  ONE MORE — rendering
// ============================================================

let cvs, ctx, DPR = 1, CW = 0, CH = 0, ZOOM = 1, VW = 1040, VH = 620;

function initCanvas() {
  cvs = document.getElementById('game');
  ctx = cvs.getContext('2d', { alpha: false });
  resize();
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 120));
}
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  const cw = cvs.clientWidth || window.innerWidth;
  const chh = cvs.clientHeight || window.innerHeight;
  CW = cw; CH = chh;
  cvs.width = Math.round(cw * DPR);
  cvs.height = Math.round(chh * DPR);
  ZOOM = clamp(Math.sqrt((cw * chh) / (1040 * 620)), 0.5, 2.1);
  VW = cw / ZOOM; VH = chh / ZOOM;
}

function worldToScreen(x, y) {
  return { x: (x - G.cam.x) * ZOOM + CW / 2, y: (y - G.cam.y) * ZOOM + CH / 2 };
}

function shapePath(c, shape, x, y, r, ang, begin) {
  if (begin !== false) c.beginPath();
  switch (shape) {
    case 'tri':
      for (let i = 0; i < 3; i++) { const a = ang + i * TAU / 3 - Math.PI / 2; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? c.lineTo(px, py) : c.moveTo(px, py); }
      c.closePath(); break;
    case 'square':
      c.save(); c.translate(x, y); c.rotate(ang); c.rect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6); c.restore(); break;
    case 'diamond':
      c.moveTo(x, y - r); c.lineTo(x + r * 0.75, y); c.lineTo(x, y + r); c.lineTo(x - r * 0.75, y); c.closePath(); break;
    case 'hex':
      for (let i = 0; i < 6; i++) { const a = ang + i * TAU / 6; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? c.lineTo(px, py) : c.moveTo(px, py); }
      c.closePath(); break;
    case 'dart':
      c.save(); c.translate(x, y); c.rotate(ang);
      c.moveTo(r * 1.4, 0); c.lineTo(-r * 0.7, r * 0.85); c.lineTo(-r * 0.2, 0); c.lineTo(-r * 0.7, -r * 0.85);
      c.closePath(); c.restore(); break;
    case 'boss':
      for (let i = 0; i < 8; i++) { const a = ang + i * TAU / 8; const rr = i % 2 ? r * 0.72 : r; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? c.lineTo(px, py) : c.moveTo(px, py); }
      c.closePath(); break;
    case 'flake':
      c.save(); c.translate(x, y); c.rotate(ang);
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; c.moveTo(-Math.cos(a) * r, -Math.sin(a) * r); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      c.restore(); return 'stroke';
    case 'shard':
      c.save(); c.translate(x, y); c.rotate(ang);
      c.moveTo(r * 1.9, 0); c.lineTo(-r, r * 0.8); c.lineTo(-r * 0.4, 0); c.lineTo(-r, -r * 0.8);
      c.closePath(); c.restore(); break;
    default:
      c.arc(x, y, r, 0, TAU);
  }
  return 'fill';
}

function drawEntity(c, shape, x, y, r, ang, color, glow) {
  if (glow) {
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.22;
    c.fillStyle = color;
    const m = shapePath(c, shape, x, y, r * 1.9, ang);
    if (m === 'stroke') { c.lineWidth = 5; c.strokeStyle = color; c.stroke(); } else c.fill();
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }
  const mode = shapePath(c, shape, x, y, r, ang);
  if (mode === 'stroke') { c.lineWidth = 2.4; c.strokeStyle = color; c.stroke(); }
  else {
    c.fillStyle = color;
    c.fill();
    c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
  }
}

// Slow drifting grid + motes behind the menus, so the game never looks "off".
const idleMotes = [];
function drawIdleBackdrop(c) {
  const t = performance.now() / 1000;
  const ox = (t * 14) % 80, oy = (t * 9) % 80;
  c.lineWidth = 1;
  c.strokeStyle = 'rgba(90,140,220,.08)';
  c.beginPath();
  for (let x = -ox; x < CW + 80; x += 80) { c.moveTo(x, 0); c.lineTo(x, CH); }
  for (let y = -oy; y < CH + 80; y += 80) { c.moveTo(0, y); c.lineTo(CW, y); }
  c.stroke();
  if (idleMotes.length < 46) {
    idleMotes.push({ x: rand(CW), y: rand(CH), vx: rand(-16, 16), vy: rand(-16, 16), r: rand(1, 3), c: pick(['#7cf3ff', '#b78bff', '#ff8bd1', '#ffd166']) });
  }
  c.globalCompositeOperation = 'lighter';
  for (const m of idleMotes) {
    m.x += m.vx / 60; m.y += m.vy / 60;
    if (m.x < -20) m.x = CW + 20; if (m.x > CW + 20) m.x = -20;
    if (m.y < -20) m.y = CH + 20; if (m.y > CH + 20) m.y = -20;
    c.globalAlpha = 0.5;
    c.fillStyle = m.c;
    c.beginPath(); c.arc(m.x, m.y, m.r, 0, TAU); c.fill();
    c.globalAlpha = 0.12;
    c.beginPath(); c.arc(m.x, m.y, m.r * 6, 0, TAU); c.fill();
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}

const batch = new Map();
let gridPat = null;
function draw() {
  const p = G.player;
  const c = ctx;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);

  // background
  c.fillStyle = '#05060d';
  c.fillRect(0, 0, CW, CH);

  if (!p) { drawIdleBackdrop(c); return; }

  // camera
  const targetX = p.x + p.vx * 0.12, targetY = p.y + p.vy * 0.12;
  G.cam.x = lerp(G.cam.x, targetX, 0.14);
  G.cam.y = lerp(G.cam.y, targetY, 0.14);
  const sh = G.cam.sh;
  const shx = sh ? rand(-sh, sh) : 0, shy = sh ? rand(-sh, sh) : 0;

  c.save();
  c.translate(CW / 2 + shx, CH / 2 + shy);
  c.scale(ZOOM, ZOOM);
  c.translate(-G.cam.x, -G.cam.y);

  const L = G.cam.x - VW / 2, R = G.cam.x + VW / 2, T = G.cam.y - VH / 2, B = G.cam.y + VH / 2;

  // --- grid ---
  const gs = 80;
  c.lineWidth = 1 / ZOOM;
  c.strokeStyle = 'rgba(90,140,220,.085)';
  c.beginPath();
  for (let x = Math.floor(L / gs) * gs; x < R; x += gs) { c.moveTo(x, T); c.lineTo(x, B); }
  for (let y = Math.floor(T / gs) * gs; y < B; y += gs) { c.moveTo(L, y); c.lineTo(R, y); }
  c.stroke();
  // bigger grid
  c.strokeStyle = 'rgba(120,170,255,.07)';
  c.beginPath();
  for (let x = Math.floor(L / (gs * 5)) * gs * 5; x < R; x += gs * 5) { c.moveTo(x, T); c.lineTo(x, B); }
  for (let y = Math.floor(T / (gs * 5)) * gs * 5; y < B; y += gs * 5) { c.moveTo(L, y); c.lineTo(R, y); }
  c.stroke();

  // --- fields ---
  for (const f of G.fields) {
    const a = clamp(f.life / f.max, 0, 1);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.13 * a;
    c.fillStyle = f.color;
    c.beginPath(); c.arc(f.x, f.y, f.r, 0, TAU); c.fill();
    c.globalAlpha = 0.5 * a;
    c.lineWidth = 2; c.strokeStyle = f.color;
    c.beginPath(); c.arc(f.x, f.y, f.r, 0, TAU); c.stroke();
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  // --- zero aura ---
  for (const w of p.weapons) {
    if (w.aura) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.10; c.fillStyle = '#dff3ff';
      c.beginPath(); c.arc(p.x, p.y, w.aura, 0, TAU); c.fill();
      c.globalAlpha = 0.45; c.lineWidth = 2; c.strokeStyle = '#dff3ff';
      c.beginPath(); c.arc(p.x, p.y, w.aura, 0, TAU); c.stroke();
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
  }

  // --- waves ---
  c.globalCompositeOperation = 'lighter';
  for (const w of G.waves) {
    const a = clamp(w.life / w.max, 0, 1);
    c.globalAlpha = a * 0.9;
    c.lineWidth = 4 + 12 * a;
    c.strokeStyle = w.color;
    c.beginPath(); c.arc(w.x, w.y, w.r, 0, TAU); c.stroke();
    c.globalAlpha = a * 0.12;
    c.fillStyle = w.color;
    c.beginPath(); c.arc(w.x, w.y, w.r, 0, TAU); c.fill();
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';

  // --- beams ---
  for (const b of G.beams) {
    const a = clamp(b.life / b.max, 0, 1);
    c.save();
    c.translate(b.x, b.y); c.rotate(b.a);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.25 * a;
    c.fillStyle = b.color;
    c.fillRect(0, -b.width * 1.5 / 2 * a, b.len, b.width * 1.5 * a);
    c.globalAlpha = 0.95 * a;
    c.fillRect(0, -b.width * 0.35 * a, b.len, b.width * 0.7 * a);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.restore();
  }

  // --- gems (batched by colour) ---
  if (G.gems.length) {
    batch.clear();
    for (const g of G.gems) {
      if (g.x < L - 40 || g.x > R + 40 || g.y < T - 40 || g.y > B + 40) continue;
      const col = g.tier >= 3 ? '#ffd166' : g.tier === 2 ? '#b78bff' : g.tier === 1 ? '#7cf3ff' : COL.xp;
      let a = batch.get(col);
      if (!a) { a = []; batch.set(col, a); }
      a.push(g);
    }
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.3;
    for (const [col, list] of batch) {
      c.fillStyle = col;
      c.beginPath();
      for (const g of list) { c.moveTo(g.x + g.r * 2.4, g.y); c.arc(g.x, g.y, g.r * 2.4, 0, TAU); }
      c.fill();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    for (const [col, list] of batch) {
      c.fillStyle = col;
      c.beginPath();
      for (const g of list) {
        c.moveTo(g.x, g.y - g.r); c.lineTo(g.x + g.r * 0.8, g.y);
        c.lineTo(g.x, g.y + g.r); c.lineTo(g.x - g.r * 0.8, g.y); c.closePath();
      }
      c.fill();
    }
  }

  // --- drops ---
  for (const d of G.drops) {
    const pulse = 1 + Math.sin(G.t * 6 + d.x) * 0.12;
    if (d.kind === 'coin') drawEntity(c, 'circle', d.x, d.y, d.r * pulse, 0, COL.gold, true);
    else if (d.kind === 'heal') drawEntity(c, 'square', d.x, d.y, d.r * pulse, 0, COL.heal, true);
    else {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35; c.fillStyle = COL.gold;
      c.beginPath(); c.arc(d.x, d.y, d.r * 3 * pulse, 0, TAU); c.fill();
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.fillStyle = COL.gold;
      c.fillRect(d.x - d.r, d.y - d.r * 0.8, d.r * 2, d.r * 1.6);
      c.fillStyle = '#5a3d00';
      c.fillRect(d.x - d.r, d.y - 2, d.r * 2, 4);
      c.strokeStyle = '#fff8e0'; c.lineWidth = 1.4;
      c.strokeRect(d.x - d.r, d.y - d.r * 0.8, d.r * 2, d.r * 1.6);
    }
  }

  // --- lobs ---
  for (const l of G.lobs) {
    if (l.t < 0) continue;
    c.globalAlpha = 0.3; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(l.x, l.y, 7, 3, 0, 0, TAU); c.fill();
    c.globalAlpha = 1;
    drawEntity(c, 'circle', l.x, l.y - (l.z || 0), 6, 0, l.color, true);
  }

  // --- enemies (batched: glow only for elites/bosses, one fill per colour) ---
  batch.clear();
  const special = [];
  for (const e of G.enemies) {
    if (e.x < L - 60 || e.x > R + 60 || e.y < T - 60 || e.y > B + 60) continue;
    let col = e.color;
    if (e.slowT > 0) col = '#9ddcff';
    if (e.flash > 0) col = '#ffffff';
    const key = e.shape + '|' + col;
    let a = batch.get(key);
    if (!a) { a = []; batch.set(key, a); }
    a.push(e);
    if (e.elite || e.boss) special.push(e);
  }
  const angOf = e => (e.def && e.def.shape === 'dart' ? Math.atan2(p.y - e.y, p.x - e.x) : e.t * 1.2 + e.uid);
  if (special.length) {
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.22;
    for (const e of special) {
      c.fillStyle = e.color;
      shapePath(c, e.shape, e.x, e.y, e.r * 1.9, angOf(e));
      c.fill();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
  c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,.55)';
  for (const [key, list] of batch) {
    c.fillStyle = key.slice(key.indexOf('|') + 1);
    c.beginPath();
    for (const e of list) shapePath(c, e.shape, e.x, e.y, e.r, angOf(e), false);
    c.fill();
    c.stroke();
  }
  for (const e of special) {
    if (e.elite && !e.boss) {
      c.strokeStyle = 'rgba(255,209,102,.85)'; c.lineWidth = 2;
      c.beginPath(); c.arc(e.x, e.y, e.r + 6, 0, TAU); c.stroke();
    }
    if (e.boss || e.hp < e.maxhp) {
      const w = e.r * 2.2, hpf = clamp(e.hp / e.maxhp, 0, 1);
      c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(e.x - w / 2, e.y - e.r - 12, w, 5);
      c.fillStyle = e.boss ? '#ff3b6b' : COL.elite; c.fillRect(e.x - w / 2, e.y - e.r - 12, w * hpf, 5);
    }
  }

  // --- enemy bullets: always hostile red, never confusable with loot ---
  if (G.ebullets.length) {
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.3; c.fillStyle = '#ff2b53';
    c.beginPath();
    for (const b of G.ebullets) { c.moveTo(b.x + b.r * 2.6, b.y); c.arc(b.x, b.y, b.r * 2.6, 0, TAU); }
    c.fill();
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#ff2b53';
    c.beginPath();
    for (const b of G.ebullets) { c.moveTo(b.x + b.r, b.y); c.arc(b.x, b.y, b.r, 0, TAU); }
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    for (const b of G.ebullets) { c.moveTo(b.x + b.r * 0.42, b.y); c.arc(b.x, b.y, b.r * 0.42, 0, TAU); }
    c.fill();
  }

  // --- halo orbs ---
  for (const w of p.weapons) {
    if (!w.orbs) continue;
    if (w.curR) {
      c.globalAlpha = 0.10; c.lineWidth = 1.5; c.strokeStyle = WEAPONS[w.id].color;
      c.beginPath(); c.arc(p.x, p.y, w.curR, 0, TAU); c.stroke();
      c.globalAlpha = 1;
    }
    for (const o of w.orbs) {
      const col = WEAPONS[w.id].color;
      drawEntity(c, o.big ? 'circle' : 'diamond', o.x, o.y, o.r, G.t * 4, col, true);
    }
  }

  // --- player bullets (batched by shape+colour) ---
  if (G.bullets.length) {
    batch.clear();
    for (const b of G.bullets) {
      const key = b.shape + '|' + b.color;
      let a = batch.get(key);
      if (!a) { a = []; batch.set(key, a); }
      a.push(b);
    }
    for (const [key, list] of batch) {
      const bar = key.indexOf('|');
      const shape = key.slice(0, bar), col = key.slice(bar + 1);
      const stroked = shape === 'flake';
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.22; c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 5;
      c.beginPath();
      for (const b of list) shapePath(c, shape, b.x, b.y, b.r * 1.9, b.a, false);
      if (stroked) c.stroke(); else c.fill();
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.beginPath();
      for (const b of list) shapePath(c, shape, b.x, b.y, b.r, b.a, false);
      if (stroked) { c.lineWidth = 2.4; c.stroke(); }
      else { c.fillStyle = col; c.fill(); c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke(); }
    }
  }

  // --- bolts (lightning) ---
  c.globalCompositeOperation = 'lighter';
  for (const b of G.bolts) {
    const a = b.life / b.max;
    c.globalAlpha = a;
    c.strokeStyle = b.color;
    c.lineWidth = 2 + 5 * a;
    c.beginPath();
    const segs = 6;
    c.moveTo(b.x1, b.y1);
    for (let i = 1; i < segs; i++) {
      const f = i / segs;
      const nx = lerp(b.x1, b.x2, f) + rand(-9, 9);
      const ny = lerp(b.y1, b.y2, f) + rand(-9, 9);
      c.lineTo(nx, ny);
    }
    c.lineTo(b.x2, b.y2);
    c.stroke();
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';

  // --- particles (batched by colour + quantised alpha: one fill per bucket) ---
  if (G.parts.length) {
    c.globalCompositeOperation = 'lighter';
    batch.clear();
    for (const q of G.parts) {
      const a = clamp(q.life / q.max, 0, 1);
      const k = q.color + '|' + (a * 3 | 0);
      let g = batch.get(k);
      if (!g) { g = []; batch.set(k, g); }
      g.push(q, a);
    }
    for (const [k, g] of batch) {
      const bar = k.indexOf('|');
      c.fillStyle = k.slice(0, bar);
      c.globalAlpha = (+k.slice(bar + 1) + 0.5) / 3.5;
      c.beginPath();
      for (let i = 0; i < g.length; i += 2) {
        const q = g[i], a = g[i + 1];
        const rr = q.r * (0.5 + a * 0.7);
        c.moveTo(q.x + rr, q.y);
        c.arc(q.x, q.y, rr, 0, TAU);
      }
      c.fill();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  // --- player ---
  {
    const inv = p.iframes > 0 && (G.frame % 8 < 4);
    const col = p.hurtFlash > 0 ? '#ffffff' : p.ch.color;
    if (!inv) {
      // dark backing so the ship separates from whatever is glowing under it
      c.fillStyle = 'rgba(3,5,12,.78)';
      c.beginPath(); c.arc(p.x, p.y, p.r * 1.9, 0, TAU); c.fill();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.42; c.fillStyle = col;
      c.beginPath(); c.arc(p.x, p.y, p.r * 3.2, 0, TAU); c.fill();
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      // pulsing locator ring
      const pu = 1 + Math.sin(performance.now() / 220) * 0.08;
      c.strokeStyle = col; c.lineWidth = 2; c.globalAlpha = 0.85;
      c.beginPath(); c.arc(p.x, p.y, p.r * 1.85 * pu, 0, TAU); c.stroke();
      c.globalAlpha = 1;
      drawEntity(c, 'tri', p.x, p.y, p.r, Math.atan2(p.vy, p.vx) + Math.PI / 2, col, false);
      c.lineWidth = 2.2; c.strokeStyle = '#ffffff';
      shapePath(c, 'tri', p.x, p.y, p.r, Math.atan2(p.vy, p.vx) + Math.PI / 2);
      c.stroke();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(p.x, p.y, 3.4, 0, TAU); c.fill();
    }
    // magnet ring hint
    c.globalAlpha = 0.08; c.strokeStyle = p.ch.color; c.lineWidth = 1.5;
    c.beginPath(); c.arc(p.x, p.y, 120 * p.magnet, 0, TAU); c.stroke();
    c.globalAlpha = 1;
  }

  // --- damage numbers ---
  if (G.nums.length) {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const n of G.nums) {
      const a = clamp(n.life / n.max, 0, 1);
      c.globalAlpha = a;
      if (n.small) c.globalAlpha = a * 0.5;
      const size = (n.crit ? 22 : n.small ? 10 : 15) * (1 + (1 - a) * 0.25);
      c.font = `900 ${size}px ui-monospace, monospace`;
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.75)';
      c.strokeText(n.txt, n.x, n.y);
      c.fillStyle = n.color;
      c.fillText(n.txt, n.x, n.y);
    }
    c.globalAlpha = 1;
  }

  c.restore();

  // --- combo counter (screen space) ---
  if (G.combo >= 5) {
    const a = clamp(G.comboT / 2.6, 0, 1);
    const scale = 1 + Math.min(1.3, G.combo / 90);
    c.save();
    c.textAlign = 'right'; c.textBaseline = 'middle';
    c.globalAlpha = 0.35 + a * 0.65;
    c.translate(CW - 26, CH * 0.42);
    c.scale(scale, scale);
    c.font = '900 30px ui-monospace, monospace';
    c.fillStyle = G.combo > 60 ? '#ffd166' : G.combo > 25 ? '#ff8bd1' : '#7cf3ff';
    c.fillText('×' + G.combo, 0, 0);
    c.font = '700 10px ui-monospace, monospace';
    c.globalAlpha *= 0.7;
    c.fillStyle = '#9fb0c9';
    c.fillText('COMBO', 0, 20);
    c.restore();
  }

  // --- banner ---
  if (G.bannerT > 0 && G.banner) {
    const t = G.bannerT / 2.6;
    const a = t > 0.8 ? (1 - t) / 0.2 : Math.min(1, t / 0.3);
    c.save();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.globalAlpha = clamp(a, 0, 1);
    c.font = '900 44px ui-monospace, monospace';
    c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.7)';
    c.strokeText(G.banner.txt, CW / 2, CH * 0.28);
    c.fillStyle = G.banner.color;
    c.fillText(G.banner.txt, CW / 2, CH * 0.28);
    if (G.banner.sub) {
      c.font = '700 15px ui-monospace, monospace';
      c.fillStyle = '#cfe0f5';
      c.fillText(G.banner.sub, CW / 2, CH * 0.28 + 34);
    }
    c.restore();
  }

  // --- screen flash ---
  if (G.flash > 0) {
    c.globalAlpha = Math.min(0.65, G.flash);
    c.fillStyle = G.flashCol;
    c.fillRect(0, 0, CW, CH);
    c.globalAlpha = 1;
  }

  // --- vignette ---
  if (!gridPat) {
    gridPat = c.createRadialGradient(CW / 2, CH / 2, Math.min(CW, CH) * 0.35, CW / 2, CH / 2, Math.max(CW, CH) * 0.78);
    gridPat.addColorStop(0, 'rgba(0,0,0,0)');
    gridPat.addColorStop(1, 'rgba(0,0,0,.72)');
  }
  c.fillStyle = gridPat;
  c.fillRect(0, 0, CW, CH);

  // low-HP pulse
  const hpf = p.hp / p.maxhp;
  if (hpf < 0.32) {
    c.globalAlpha = (0.32 - hpf) * (0.9 + Math.sin(performance.now() / 130) * 0.5);
    c.fillStyle = 'rgba(255,20,60,.55)';
    c.fillRect(0, 0, CW, CH);
    c.globalAlpha = 1;
  }

  // touch stick
  if (Input.touch.active) {
    c.globalAlpha = 0.2; c.strokeStyle = '#7cf3ff'; c.lineWidth = 3;
    c.beginPath(); c.arc(Input.touch.ox, Input.touch.oy, 56, 0, TAU); c.stroke();
    c.globalAlpha = 0.4;
    c.beginPath(); c.arc(Input.touch.ox + clamp(Input.touch.x - Input.touch.ox, -56, 56), Input.touch.oy + clamp(Input.touch.y - Input.touch.oy, -56, 56), 22, 0, TAU); c.fill();
    c.globalAlpha = 1;
  }
}
addEventListener('resize', () => { gridPat = null; });
