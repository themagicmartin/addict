// ============================================================
//  ONE MORE — core: math, input, audio, save
// ============================================================
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b));
const pick = arr => arr[(Math.random() * arr.length) | 0];
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const now = () => performance.now() / 1000;
const fmtTime = s => {
  s = Math.max(0, Math.floor(s));
  return (s / 60 | 0).toString().padStart(2, '0') + ':' + (s % 60).toString().padStart(2, '0');
};
const fmtNum = n => {
  n = Math.floor(n);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return n.toLocaleString('en-US');
};
// weighted pick: items = [{w:..}, ..]
function wpick(items, wkey = 'w') {
  let total = 0;
  for (const it of items) total += (typeof wkey === 'function' ? wkey(it) : it[wkey]) || 0;
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const it of items) {
    r -= (typeof wkey === 'function' ? wkey(it) : it[wkey]) || 0;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

// ------------------------------------------------------------
//  Input
// ------------------------------------------------------------
const Input = {
  keys: Object.create(null),
  pressed: Object.create(null),
  ax: 0, ay: 0,             // movement axis (-1..1)
  touch: { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 },
  init(canvas) {
    addEventListener('keydown', e => {
      // Keys inside the Sonder demo overlay (link, "i", about panel) belong to the page, not the game.
      if (e.target.closest && e.target.closest('.sd')) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) e.preventDefault();
    });
    addEventListener('keyup', e => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys[k] = false;
    });
    addEventListener('blur', () => { this.keys = Object.create(null); this.touch.active = false; });

    const tstart = e => {
      for (const t of e.changedTouches) {
        if (this.touch.active) break;
        if (t.target.closest && t.target.closest('.ui-click')) return;
        this.touch.active = true; this.touch.id = t.identifier;
        this.touch.ox = t.clientX; this.touch.oy = t.clientY;
        this.touch.x = t.clientX; this.touch.y = t.clientY;
      }
    };
    const tmove = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.id) { this.touch.x = t.clientX; this.touch.y = t.clientY; e.preventDefault(); }
      }
    };
    const tend = e => {
      for (const t of e.changedTouches) if (t.identifier === this.touch.id) { this.touch.active = false; this.touch.id = -1; }
    };
    canvas.addEventListener('touchstart', tstart, { passive: true });
    canvas.addEventListener('touchmove', tmove, { passive: false });
    canvas.addEventListener('touchend', tend, { passive: true });
    canvas.addEventListener('touchcancel', tend, { passive: true });
  },
  update() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k['a'] || k['ArrowLeft']) x -= 1;
    if (k['d'] || k['ArrowRight']) x += 1;
    if (k['w'] || k['ArrowUp']) y -= 1;
    if (k['s'] || k['ArrowDown']) y += 1;
    if (this.touch.active) {
      const dx = this.touch.x - this.touch.ox, dy = this.touch.y - this.touch.oy;
      const d = Math.hypot(dx, dy);
      if (d > 6) { const m = Math.min(1, d / 56); x = dx / d * m; y = dy / d * m; }
    }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    this.ax = x; this.ay = y;
  },
  wasPressed(k) { return !!this.pressed[k]; },
  endFrame() { this.pressed = Object.create(null); }
};

// ------------------------------------------------------------
//  Audio — pure WebAudio synthesis, no assets
// ------------------------------------------------------------
const AU = {
  ctx: null, master: null, musicGain: null, sfxGain: null,
  sfxOn: true, musicOn: true, ready: false,
  _last: Object.create(null),
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.85; this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.5; this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.0; this.musicGain.connect(this.master);
    // shared noise buffer
    const len = this.ctx.sampleRate * 0.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.ready = true;
    this.startMusic();
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  // throttle identical sfx so swarms don't blow out the mix
  _gate(tag, ms) {
    const t = performance.now();
    if (this._last[tag] && t - this._last[tag] < ms) return false;
    this._last[tag] = t; return true;
  },
  tone(freq, dur, { type = 'square', gain = 0.2, slide = 0, delay = 0, detune = 0 } = {}) {
    if (!this.ready || !this.sfxOn) return;
    const c = this.ctx, t0 = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  noise(dur, { gain = 0.2, freq = 1200, q = 1, type = 'bandpass', slide = 0, delay = 0 } = {}) {
    if (!this.ready || !this.sfxOn) return;
    const c = this.ctx, t0 = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + slide), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain);
    s.start(t0); s.stop(t0 + dur + 0.02);
  },
  sfx(name) {
    if (!this.ready || !this.sfxOn) return;
    switch (name) {
      case 'shoot': if (this._gate('shoot', 45)) this.tone(760, 0.07, { type: 'square', gain: 0.05, slide: -420 }); break;
      case 'hit': if (this._gate('hit', 30)) this.noise(0.05, { gain: 0.06, freq: 2600, q: 2, slide: -1600 }); break;
      case 'kill': if (this._gate('kill', 35)) this.noise(0.11, { gain: 0.09, freq: 900, q: 1.2, slide: -700 }); break;
      case 'boom': this.noise(0.34, { gain: 0.2, freq: 420, q: 0.8, slide: -340, type: 'lowpass' }); this.tone(90, 0.25, { type: 'sine', gain: 0.16, slide: -60 }); break;
      case 'zap': if (this._gate('zap', 60)) { this.tone(1500, 0.09, { type: 'sawtooth', gain: 0.07, slide: -1100 }); this.noise(0.07, { gain: 0.05, freq: 4200, q: 3 }); } break;
      case 'gem': if (this._gate('gem', 28)) this.tone(1180 + rand(-90, 130), 0.05, { type: 'triangle', gain: 0.045, slide: 420 }); break;
      case 'coin': if (this._gate('coin', 40)) { this.tone(1400, 0.05, { type: 'square', gain: 0.05 }); this.tone(2100, 0.07, { type: 'square', gain: 0.04, delay: 0.05 }); } break;
      case 'hurt': this.tone(180, 0.22, { type: 'sawtooth', gain: 0.2, slide: -110 }); this.noise(0.2, { gain: 0.16, freq: 500, q: 0.7, type: 'lowpass' }); break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', gain: 0.16, delay: i * 0.06 })); break;
      case 'pick': this.tone(880, 0.09, { type: 'square', gain: 0.11, slide: 320 }); break;
      case 'hover': if (this._gate('hover', 40)) this.tone(1500, 0.03, { type: 'square', gain: 0.025 }); break;
      case 'chest': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', gain: 0.15, delay: i * 0.075 })); break;
      case 'evolve': [523, 622, 784, 932, 1245, 1568].forEach((f, i) => { this.tone(f, 0.7, { type: 'sawtooth', gain: 0.12, delay: i * 0.08 }); this.tone(f / 2, 0.7, { type: 'sine', gain: 0.1, delay: i * 0.08 }); }); break;
      case 'boss': this.tone(58, 1.4, { type: 'sawtooth', gain: 0.3, slide: 26 }); this.noise(1.2, { gain: 0.18, freq: 220, q: 0.6, type: 'lowpass' }); break;
      case 'die': [440, 349, 262, 196, 131].forEach((f, i) => this.tone(f, 0.6, { type: 'sawtooth', gain: 0.16, delay: i * 0.14 })); break;
      case 'unlock': [659, 784, 988, 1319, 1568].forEach((f, i) => this.tone(f, 0.5, { type: 'square', gain: 0.13, delay: i * 0.09 })); break;
      case 'buy': this.tone(660, 0.08, { type: 'square', gain: 0.1 }); this.tone(990, 0.12, { type: 'square', gain: 0.09, delay: 0.07 }); break;
      case 'nope': this.tone(150, 0.14, { type: 'square', gain: 0.09, slide: -50 }); break;
      case 'crit': if (this._gate('crit', 60)) this.tone(1900, 0.07, { type: 'square', gain: 0.06, slide: 900 }); break;
      case 'freeze': if (this._gate('freeze', 120)) this.noise(0.3, { gain: 0.07, freq: 5200, q: 4, slide: -3000 }); break;
    }
  },

  // --- procedural music: driving 16th-note pulse, intensity-scaled ---
  music: { step: 0, next: 0, bpm: 138, intensity: 0, timer: null },
  startMusic() {
    if (!this.ready) return;
    this.music.next = this.ctx.currentTime + 0.1;
    if (this.music.timer) clearInterval(this.music.timer);
    this.music.timer = setInterval(() => this._sched(), 25);
    this.setMusic(this.musicOn);
  },
  setMusic(on) {
    this.musicOn = on;
    if (this.ready) this.musicGain.gain.setTargetAtTime(on ? 0.32 : 0.0, this.ctx.currentTime, 0.15);
  },
  setIntensity(v) { this.music.intensity = clamp(v, 0, 1); },
  _voice(freq, dur, type, gain, dest, { slide = 0, filter = 0 } = {}) {
    const c = this.ctx, t0 = this.music.next;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    let node = o;
    if (filter) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); node = f; }
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g); g.connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  _kick() {
    const c = this.ctx, t0 = this.music.next;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t0);
    o.frequency.exponentialRampToValueAtTime(42, t0 + 0.11);
    g.gain.setValueAtTime(0.5, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);
    o.connect(g); g.connect(this.musicGain); o.start(t0); o.stop(t0 + 0.22);
  },
  _hat(open) {
    const c = this.ctx, t0 = this.music.next;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000;
    const g = c.createGain(); const d = open ? 0.11 : 0.032;
    g.gain.setValueAtTime(open ? 0.09 : 0.06, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f); f.connect(g); g.connect(this.musicGain); s.start(t0); s.stop(t0 + d + 0.02);
  },
  _sched() {
    if (!this.ready) return;
    const c = this.ctx;
    const spb = 60 / this.music.bpm / 4; // 16th
    // A minor pentatonic-ish
    const bass = [55, 55, 82.4, 55, 65.4, 55, 73.4, 82.4];
    const arp = [440, 523.25, 659.25, 523.25, 587.33, 659.25, 783.99, 659.25];
    while (this.music.next < c.currentTime + 0.12) {
      const s = this.music.step, I = this.music.intensity;
      const bar = (s >> 4) & 7;
      if (s % 4 === 0) this._kick();
      if (I > 0.12 && s % 2 === 1) this._hat(s % 8 === 7);
      if (s % 2 === 0) {
        const n = bass[(bar + (s >> 1)) % bass.length] * (bar >= 4 ? 1.1892 : 1);
        this._voice(n, spb * 1.7, 'sawtooth', 0.13 + I * 0.07, this.musicGain, { filter: 300 + I * 900 });
      }
      if (I > 0.3) {
        const n = arp[s % arp.length] * (bar >= 4 ? 1.1892 : 1);
        this._voice(n, spb * 1.1, 'square', 0.028 + I * 0.045, this.musicGain, { filter: 2200 + I * 3500 });
      }
      if (I > 0.62 && s % 8 === 6) this._voice(arp[(s + 3) % arp.length] * 2, spb * 2.4, 'triangle', 0.05, this.musicGain);
      this.music.next += spb;
      this.music.step = (s + 1) % 128;
    }
  }
};

// ------------------------------------------------------------
//  Save
// ------------------------------------------------------------
const SAVE_KEY = 'onemore.save.v1';
const defaultSave = () => ({
  souls: 0,
  meta: {},            // metaId -> level
  unlocked: ['vector'],
  weaponsSeen: [],
  stats: {
    runs: 0, kills: 0, bestTime: 0, bestLevel: 0, bestKills: 0, bestSouls: 0,
    totalTime: 0, damage: 0, bosses: 0, evolutions: 0, chests: 0, deaths: 0, playSeconds: 0
  },
  seenAchv: [],
  lastPlayed: 0, streak: 0,
  settings: { sfx: true, music: true, shake: 1, damageNumbers: true }
});
// SV is never reassigned — it is mutated in place, so any reference taken to
// it stays live. (Reassigning silently strands every existing holder.)
const SV = defaultSave();
let storageOK = true;

function loadSave() {
  let d = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) d = JSON.parse(raw);
  } catch (e) { d = null; storageOK = false; }
  const merged = Object.assign(defaultSave(), d || {});
  merged.stats = Object.assign(defaultSave().stats, (d && d.stats) || {});
  merged.settings = Object.assign(defaultSave().settings, (d && d.settings) || {});
  merged.meta = (d && d.meta) || {};
  merged.unlocked = (d && d.unlocked && d.unlocked.length) ? d.unlocked.slice() : ['vector'];
  merged.seenAchv = (d && d.seenAchv) || [];
  merged.weaponsSeen = (d && d.weaponsSeen) || [];
  for (const k in SV) delete SV[k];
  Object.assign(SV, merged);
  AU.sfxOn = SV.settings.sfx; AU.musicOn = SV.settings.music;
  return SV;
}

let _saveT = 0;
function persist(force) {
  const t = performance.now();
  if (!force && t - _saveT < 400) return;
  _saveT = t;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(SV));
    storageOK = true;
  } catch (e) {
    // private browsing / quota / blocked cookies: say so rather than
    // quietly throwing away the player's progress
    storageOK = false;
  }
}
