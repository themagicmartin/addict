// ============================================================
//  ONE MORE — DOM user interface
// ============================================================

const $ = id => document.getElementById(id);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

const UI = {
  cur: null,
  selectedChar: 'vector',
  chestState: null,

  init() {
    this.bind();
    this.renderMenu();
    this.show('scr-menu');
  },

  show(id) {
    const ov = $('overlay');
    for (const s of ov.children) s.classList.toggle('on', s.id === id);
    ov.classList.toggle('on', !!id);
    this.cur = id;
    $('hud').classList.toggle('on', G.state === 'play' || G.state === 'levelup' || G.state === 'chest' || G.state === 'paused');
  },

  bind() {
    $('btn-play').onclick = () => { AU.init(); this.renderChars(); this.show('scr-chars'); AU.sfx('pick'); };
    $('btn-meta').onclick = () => { AU.init(); this.renderMeta(); this.show('scr-meta'); AU.sfx('pick'); };
    $('btn-codex').onclick = () => { AU.init(); this.renderCodex(); this.show('scr-codex'); AU.sfx('pick'); };
    for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => { this.renderMenu(); this.show('scr-menu'); AU.sfx('pick'); };

    $('btn-resume').onclick = () => this.togglePause();
    $('btn-quit').onclick = () => { G.state = 'menu'; G.player = null; this.renderMenu(); this.show('scr-menu'); AU.setIntensity(0); };

    $('btn-again').onclick = () => { startRun(this.selectedChar); };
    $('btn-death-meta').onclick = () => { this.renderMeta(); this.show('scr-meta'); this.metaFrom = 'death'; };
    $('btn-death-menu').onclick = () => { G.state = 'menu'; G.player = null; this.renderMenu(); this.show('scr-menu'); };

    $('btn-reroll').onclick = () => this.reroll();
    $('btn-banish').onclick = () => this.startBanish();
    $('btn-chest-collect').onclick = () => this.closeChest();

    for (const t of document.querySelectorAll('[data-toggle]')) {
      t.onclick = () => {
        const k = t.dataset.toggle;
        AU.init();
        if (k === 'sfx') { SV.settings.sfx = !SV.settings.sfx; AU.sfxOn = SV.settings.sfx; }
        if (k === 'music') { SV.settings.music = !SV.settings.music; AU.setMusic(SV.settings.music); }
        if (k === 'shake') { SV.settings.shake = SV.settings.shake ? 0 : 1; }
        if (k === 'dmg') { SV.settings.damageNumbers = !SV.settings.damageNumbers; }
        persist(true); this.syncToggles(); AU.sfx('pick');
      };
    }
    this.syncToggles();
  },

  syncToggles() {
    const set = (k, v) => { const e = document.querySelector(`[data-toggle="${k}"]`); if (e) { e.classList.toggle('off', !v); e.querySelector('.tg-state').textContent = v ? 'ON' : 'OFF'; } };
    set('sfx', SV.settings.sfx); set('music', SV.settings.music);
    set('shake', !!SV.settings.shake); set('dmg', SV.settings.damageNumbers);
  },

  // ----------------------------------------------------------
  //  MENU
  // ----------------------------------------------------------
  renderMenu() {
    $('menu-souls').textContent = fmtNum(SV.souls);
    const s = SV.stats;
    $('menu-stats').innerHTML = `
      <div class="stat"><b>${fmtTime(s.bestTime)}</b><span>BEST TIME</span></div>
      <div class="stat"><b>${s.bestLevel}</b><span>BEST LEVEL</span></div>
      <div class="stat"><b>${fmtNum(s.kills)}</b><span>TOTAL KILLS</span></div>
      <div class="stat"><b>${s.runs}</b><span>RUNS</span></div>`;
    const g = nextGoal();
    if (g) {
      const pct = clamp(g.cur / g.need, 0, 1);
      $('goal-wrap').style.display = '';
      $('goal-label').textContent = g.label;
      $('goal-val').textContent = (g.time ? fmtTime(g.cur) + ' / ' + fmtTime(g.need) : fmtNum(g.cur) + ' / ' + fmtNum(g.need)) + ' ' + (g.time ? '' : g.unit);
      $('goal-fill').style.width = (pct * 100).toFixed(1) + '%';
    } else $('goal-wrap').style.display = 'none';

    const spendable = META.some(m => metaLv(m.id) < m.max && metaCost(m, metaLv(m.id)) <= SV.souls);
    $('btn-meta').classList.toggle('pip', spendable);
    const warn = $('storage-warn');
    if (warn) warn.style.display = storageOK ? 'none' : '';
  },

  // ----------------------------------------------------------
  //  CHARACTER SELECT
  // ----------------------------------------------------------
  renderChars() {
    const wrap = $('char-list');
    wrap.innerHTML = '';
    for (const c of CHARS) {
      const un = SV.unlocked.includes(c.id);
      const el = h('div', 'char ui-click' + (un ? '' : ' locked') + (this.selectedChar === c.id ? ' sel' : ''));
      el.innerHTML = `
        <div class="char-glyph" style="color:${c.color}">${un ? c.glyph : '🔒'}</div>
        <div class="char-name" style="color:${un ? c.color : '#5c6c82'}">${un ? c.name : '???'}</div>
        <div class="char-tag">${un ? c.tag : c.unlockText}</div>
        <div class="char-weap">${un ? 'STARTS WITH ' + WEAPONS[c.weapon].name.toUpperCase() : ''}</div>`;
      if (un) el.onclick = () => {
        this.selectedChar = c.id;
        AU.sfx('pick');
        this.renderChars();
      };
      el.onmouseenter = () => un && AU.sfx('hover');
      wrap.appendChild(el);
    }
    $('btn-start').onclick = () => { AU.init(); startRun(this.selectedChar); };
  },

  // ----------------------------------------------------------
  //  META SHOP
  // ----------------------------------------------------------
  renderMeta() {
    $('meta-souls').textContent = fmtNum(SV.souls);
    const wrap = $('meta-grid');
    wrap.innerHTML = '';
    for (const m of META) {
      const lv = metaLv(m.id);
      const maxed = lv >= m.max;
      const cost = maxed ? 0 : metaCost(m, lv);
      const afford = !maxed && SV.souls >= cost;
      const el = h('div', 'mcard ui-click' + (maxed ? ' maxed' : afford ? ' afford' : ' poor'));
      let pips = '';
      for (let i = 0; i < m.max; i++) pips += `<i class="${i < lv ? 'on' : ''}"></i>`;
      el.innerHTML = `
        <div class="mtop"><span class="mglyph">${m.glyph}</span><span class="mname">${m.name}</span></div>
        <div class="mdesc">${m.desc(Math.max(1, lv || 1))}${lv > 0 && !maxed ? ` <em>→ ${m.desc(lv + 1)}</em>` : ''}</div>
        <div class="mpips">${pips}</div>
        <div class="mcost">${maxed ? 'MAX' : '◆ ' + fmtNum(cost)}</div>`;
      if (!maxed) el.onclick = () => {
        const c = metaCost(m, metaLv(m.id));
        if (SV.souls < c) { AU.sfx('nope'); el.classList.add('shakeit'); setTimeout(() => el.classList.remove('shakeit'), 300); return; }
        SV.souls -= c;
        SV.meta[m.id] = metaLv(m.id) + 1;
        persist(true);
        AU.sfx('buy');
        this.renderMeta();
      };
      el.onmouseenter = () => AU.sfx('hover');
      wrap.appendChild(el);
    }
    const spent = META.reduce((a, m) => { let t = 0; for (let i = 0; i < metaLv(m.id); i++) t += metaCost(m, i); return a + t; }, 0);
    $('btn-respec').innerHTML = `RESET ALL · REFUND ◆${fmtNum(spent)}`;
    $('btn-respec').onclick = () => {
      if (spent <= 0) { AU.sfx('nope'); return; }
      SV.souls += spent; SV.meta = {}; persist(true); AU.sfx('chest'); this.renderMeta();
    };
  },

  // ----------------------------------------------------------
  //  CODEX
  // ----------------------------------------------------------
  renderCodex() {
    const wrap = $('codex-body');
    let html = '<h3>WEAPONS</h3><div class="cx-grid">';
    for (const id of WEAPON_IDS) {
      const w = WEAPONS[id];
      const seen = SV.weaponsSeen.includes(id);
      const ev = WEAPONS[w.evo.into];
      html += `<div class="cx ${seen ? '' : 'dim'}">
        <div class="cx-h"><span style="color:${w.color}">${w.glyph}</span> ${w.name}</div>
        <div class="cx-d">${w.desc}</div>
        <div class="cx-e">↳ <b style="color:${ev.color}">${seen ? ev.name : '???'}</b> · needs ${w.name} MAX + ${PASSIVES[w.evo.need].name} MAX</div>
      </div>`;
    }
    html += '</div><h3>ITEMS</h3><div class="cx-grid">';
    for (const id of PASSIVE_IDS) {
      const p = PASSIVES[id];
      html += `<div class="cx"><div class="cx-h"><span style="color:${p.color}">${p.glyph}</span> ${p.name}</div><div class="cx-d">${p.desc}</div></div>`;
    }
    html += '</div><h3>TRIALS</h3><div class="cx-grid">';
    for (const a of ACHIEVEMENTS) {
      const done = SV.seenAchv.includes(a.id);
      html += `<div class="cx ${done ? 'done' : 'dim'}"><div class="cx-h">${done ? '★' : '☆'} ${a.name}</div><div class="cx-d">${a.desc}</div></div>`;
    }
    html += '</div><h3>RECORD</h3><div class="cx-grid">';
    const s = SV.stats;
    const rows = [
      ['Runs', s.runs], ['Total kills', fmtNum(s.kills)], ['Total damage', fmtNum(s.damage)],
      ['Bosses felled', s.bosses], ['Evolutions', s.evolutions], ['Chests opened', s.chests],
      ['Best time', fmtTime(s.bestTime)], ['Best level', s.bestLevel],
      ['Best kills', fmtNum(s.bestKills)], ['Best haul', '◆' + fmtNum(s.bestSouls)],
      ['Time in the dark', fmtTime(s.totalTime)]
    ];
    for (const r of rows) html += `<div class="cx"><div class="cx-h">${r[0]}</div><div class="cx-d big">${r[1]}</div></div>`;
    html += '</div>';
    wrap.innerHTML = html;
  },

  // ----------------------------------------------------------
  //  HUD
  // ----------------------------------------------------------
  syncHud() {
    const p = G.player;
    if (!p) return;
    const hpf = clamp(p.hp / p.maxhp, 0, 1);
    $('hp-fill').style.width = (hpf * 100) + '%';
    $('hp-text').textContent = Math.ceil(Math.max(0, p.hp)) + ' / ' + Math.round(p.maxhp);
    $('xp-fill').style.width = clamp(p.xp / p.xpNext, 0, 1) * 100 + '%';
    $('lv-text').textContent = 'LV ' + p.level;
    $('time').textContent = fmtTime(G.t);
    $('kills').textContent = fmtNum(G.kills);
    $('souls-run').textContent = fmtNum(G.soulsRun);
    // next boss
    const tb = Math.max(0, G.nextBoss - G.t);
    $('nextboss').textContent = fmtTime(tb);
    // weapons
    const wl = $('weap');
    let html = '';
    for (const w of p.weapons) {
      const d = WEAPONS[w.id];
      html += `<div class="wi ${d.evolved ? 'evo' : ''}" style="--c:${d.color}"><span>${d.glyph}</span><i>${d.evolved ? '★' : w.lv}</i></div>`;
    }
    html += '<div class="wsep"></div>';
    for (const id in p.passives) {
      const d = PASSIVES[id];
      html += `<div class="wi pas" style="--c:${d.color}"><span>${d.glyph}</span><i>${p.passives[id]}</i></div>`;
    }
    if (wl.dataset.sig !== html) { wl.innerHTML = html; wl.dataset.sig = html; }
    // boss bar
    const bb = $('boss-bar');
    if (G.boss && !G.boss.dead) {
      bb.classList.add('on');
      $('boss-name').textContent = G.boss.name;
      $('boss-fill').style.width = clamp(G.boss.hp / G.boss.maxhp, 0, 1) * 100 + '%';
    } else bb.classList.remove('on');
    // toasts
    const tw = $('toasts');
    if (G.toasts.length !== +tw.dataset.n) {
      tw.dataset.n = G.toasts.length;
      tw.innerHTML = G.toasts.map(t => `<div class="toast" style="--c:${t.color}"><b>${t.txt}</b>${t.sub ? '<span>' + t.sub + '</span>' : ''}</div>`).join('');
    }
    // revive pips
    $('revives').innerHTML = p.revives > 0 ? '☥'.repeat(p.revives) : '';
  },

  // ----------------------------------------------------------
  //  LEVEL UP
  // ----------------------------------------------------------
  openLevelUp() {
    const p = G.player;
    G.state = 'levelup';
    this.banishMode = false;
    G.cards = buildCards(3);
    this.renderCards();
    this.show('scr-cards');
    AU.sfx('levelup');
    flash('#fff', 0.22);
  },

  renderCards() {
    const p = G.player;
    $('cards-lv').textContent = 'LEVEL ' + p.level;
    const wrap = $('cards');
    wrap.innerHTML = '';
    G.cards.forEach((c, i) => {
      const el = h('div', 'card ui-click r-' + (c.rarity || 'common') + (this.banishMode ? ' banishing' : ''));
      el.innerHTML = `
        <div class="ckey">${i + 1}</div>
        <div class="cglyph" style="color:${c.color}">${c.glyph}</div>
        <div class="cname" style="color:${c.color}">${c.name}</div>
        <div class="csub">${c.sub || ''}</div>
        <div class="cdesc">${c.desc}</div>
        ${c.rarity === 'epic' ? '<div class="cflag">EPIC</div>' : c.rarity === 'rare' ? '<div class="cflag rare">RARE</div>' : ''}
        ${c.kind === 'evo' ? '<div class="cflag evo">EVOLUTION</div>' : ''}`;
      el.onclick = () => this.chooseCard(i);
      el.onmouseenter = () => AU.sfx('hover');
      wrap.appendChild(el);
    });
    $('btn-reroll').innerHTML = `↻ REROLL <i>${p.rerolls}</i>`;
    $('btn-banish').innerHTML = `✕ BANISH <i>${p.banishes}</i>`;
    $('btn-reroll').classList.toggle('dead', p.rerolls <= 0);
    $('btn-banish').classList.toggle('dead', p.banishes <= 0 || this.banishMode);
  },

  chooseCard(i) {
    const c = G.cards[i];
    if (!c) return;
    if (this.banishMode) {
      G.banished = G.banished || {};
      G.banished[c.kind + ':' + c.id] = 1;
      G.player.banishes--;
      this.banishMode = false;
      G.cards = buildCards(3);
      this.renderCards();
      AU.sfx('nope');
      return;
    }
    applyCard(c);
    this.afterChoice();
  },

  afterChoice() {
    G.levelQueue = Math.max(0, G.levelQueue - 1);
    this.syncHud();
    if (G.levelQueue > 0) { this.openLevelUp(); return; }
    if (G.chestQueue > 0) { this.openChest(); return; }
    G.state = 'play';
    this.show(null);
  },

  reroll() {
    const p = G.player;
    if (p.rerolls <= 0) { AU.sfx('nope'); return; }
    p.rerolls--;
    G.cards = buildCards(3);
    this.renderCards();
    AU.sfx('pick');
  },
  startBanish() {
    const p = G.player;
    if (p.banishes <= 0) { AU.sfx('nope'); return; }
    this.banishMode = true;
    this.renderCards();
    AU.sfx('hover');
  },

  // ----------------------------------------------------------
  //  CHEST
  // ----------------------------------------------------------
  openChest() {
    const p = G.player;
    G.state = 'chest';
    G.chestQueue--;
    SV.stats.chests++;
    persist();
    // how many rewards?
    const roll = Math.random() + p.luck * 0.6;
    const n = roll > 0.965 ? 5 : roll > 0.80 ? 3 : 1;
    const rewards = [];
    // A chest always pays out a pending evolution first — the single best
    // moment in the game should never be gated behind another level-up.
    const evos = evolutionsAvailable(p);
    if (evos.length) {
      const ev = evos[0];
      applyCard({ kind: 'evo', id: ev.into, from: ev.from.id });
      const d = WEAPONS[ev.into];
      rewards.push({ glyph: d.glyph, color: d.color, name: d.name, sub: 'EVOLVED' });
    }
    for (let i = rewards.length; i < n; i++) {
      const pool = p.weapons.filter(w => w.lv < WEAPONS[w.id].max);
      if (pool.length) {
        const w = pick(pool);
        w.lv++;
        rewards.push({ glyph: WEAPONS[w.id].glyph, color: WEAPONS[w.id].color, name: WEAPONS[w.id].name, sub: 'LV ' + w.lv });
      } else {
        const amt = randi(20, 45);
        G.soulsRun += amt;
        rewards.push({ glyph: '$', color: COL.gold, name: 'SOULS', sub: '+' + amt });
      }
    }
    this.chestState = { rewards, n, spin: 1.1 + n * 0.22 };
    $('chest-title').textContent = n === 5 ? 'JACKPOT!!' : n === 3 ? 'BIG HAUL!' : 'CHEST';
    $('chest-title').className = 'chest-title n' + n;
    $('btn-chest-collect').style.visibility = 'hidden';
    const reels = $('chest-reels');
    reels.innerHTML = '';
    const glyphs = WEAPON_IDS.map(i => WEAPONS[i]);
    for (let i = 0; i < n; i++) {
      const r = h('div', 'reel spinning');
      r.innerHTML = `<div class="rg">${pick(glyphs).glyph}</div>`;
      reels.appendChild(r);
    }
    this.show('scr-chest');
    AU.sfx('chest');
    // spin animation
    const start = performance.now();
    const dur = this.chestState.spin * 1000;
    const tickAudio = () => AU.tone(600 + rand(0, 500), 0.03, { type: 'square', gain: 0.04 });
    const spin = () => {
      if (!this.chestState) return;
      const el = performance.now() - start;
      const reelEls = reels.children;
      for (let i = 0; i < reelEls.length; i++) {
        const settleAt = dur * (0.45 + 0.55 * (i + 1) / reelEls.length);
        if (el < settleAt) {
          if (Math.random() < 0.55) {
            const g = pick(glyphs);
            reelEls[i].firstChild.textContent = g.glyph;
            reelEls[i].firstChild.style.color = g.color;
          }
        } else if (!reelEls[i].classList.contains('done')) {
          reelEls[i].classList.remove('spinning');
          reelEls[i].classList.add('done');
          const rw = this.chestState.rewards[i];
          reelEls[i].innerHTML = `<div class="rg" style="color:${rw.color}">${rw.glyph}</div><div class="rn">${rw.name}</div><div class="rs">${rw.sub}</div>`;
          AU.sfx('pick'); shake(4);
        }
      }
      if (el < dur) { if (Math.random() < 0.4) tickAudio(); requestAnimationFrame(spin); }
      else {
        $('btn-chest-collect').style.visibility = 'visible';
        if (n >= 3) { flash(COL.gold, 0.4); shake(10); AU.sfx('evolve'); }
      }
    };
    requestAnimationFrame(spin);
  },

  closeChest() {
    this.chestState = null;
    recalc(G.player);
    this.syncHud();
    checkUnlocks();
    if (G.levelQueue > 0) { this.openLevelUp(); return; }
    if (G.chestQueue > 0) { this.openChest(); return; }
    G.state = 'play';
    this.show(null);
    AU.sfx('pick');
  },

  // ----------------------------------------------------------
  //  PAUSE
  // ----------------------------------------------------------
  togglePause() {
    if (G.state === 'play') { G.state = 'paused'; this.renderPause(); this.show('scr-pause'); AU.setIntensity(0.05); }
    else if (G.state === 'paused') { G.state = 'play'; this.show(null); }
  },
  renderPause() {
    const p = G.player;
    let html = '';
    for (const w of p.weapons) {
      const d = WEAPONS[w.id];
      html += `<div class="prow"><span style="color:${d.color}">${d.glyph}</span><b>${d.name}</b><i>${d.evolved ? 'EVOLVED' : 'Lv ' + w.lv + '/' + d.max}</i><em>${d.lvDesc(w.lv)}</em></div>`;
    }
    for (const id in p.passives) {
      const d = PASSIVES[id];
      html += `<div class="prow"><span style="color:${d.color}">${d.glyph}</span><b>${d.name}</b><i>Lv ${p.passives[id]}/${d.max}</i><em>${d.lvDesc(p.passives[id])}</em></div>`;
    }
    $('pause-build').innerHTML = html;
    const st = [
      ['Might', (p.might * 100).toFixed(0) + '%'], ['Area', (p.area * 100).toFixed(0) + '%'],
      ['Cooldown', (p.cdr * 100).toFixed(0) + '%'], ['Duration', (p.dur * 100).toFixed(0) + '%'],
      ['Move', (p.spd * 100).toFixed(0) + '%'], ['Armor', p.armor.toFixed(0)],
      ['Regen', p.regen.toFixed(2) + '/s'], ['Luck', (p.luck * 100).toFixed(0) + '%'],
      ['Magnet', (p.magnet * 100).toFixed(0) + '%'], ['Greed', (p.greed * 100).toFixed(0) + '%']
    ];
    $('pause-stats').innerHTML = st.map(s => `<div class="pstat"><span>${s[0]}</span><b>${s[1]}</b></div>`).join('');
  },

  // ----------------------------------------------------------
  //  DEATH
  // ----------------------------------------------------------
  showDeath() {
    const p = G.player;
    const pay = G.payout;
    $('death-time').textContent = fmtTime(G.t);
    $('death-sub').textContent = 'slain by ' + (G.deathReason || 'the swarm');
    $('death-stats').innerHTML = `
      <div class="stat"><b>${p.level}</b><span>LEVEL</span></div>
      <div class="stat"><b>${fmtNum(G.kills)}</b><span>KILLS</span></div>
      <div class="stat"><b>×${G.maxCombo}</b><span>BEST COMBO</span></div>
      <div class="stat"><b>${fmtNum(p.totalDamage)}</b><span>DAMAGE</span></div>`;
    $('death-souls').innerHTML = `
      <div class="pay"><span>run value</span><b>◆ ${fmtNum(pay.base)}</b></div>
      <div class="pay"><span>combo bonus</span><b>× ${pay.combo.toFixed(2)}</b></div>
      <div class="pay"><span>greed</span><b>× ${pay.greed.toFixed(2)}</b></div>
      <div class="pay total"><span>EARNED</span><b>◆ ${fmtNum(pay.total)}</b></div>
      <div class="pay bank"><span>BANK</span><b>◆ ${fmtNum(SV.souls)}</b></div>`;
    let extra = '';
    if (G.records && G.records.length) extra += G.records.map(r => `<div class="rec">★ NEW RECORD · ${r}</div>`).join('');
    const shown = G.newUnlocks.slice(0, 4);
    for (const u of shown) extra += `<div class="rec unlock" style="--c:${u.color}">${u.glyph} ${u.kind === 'char' ? 'NEW SURVIVOR' : 'TRIAL'} · ${u.name}<span>${u.desc}</span></div>`;
    if (G.newUnlocks.length > shown.length) extra += `<div class="rec">+ ${G.newUnlocks.length - shown.length} MORE UNLOCKED · SEE CODEX</div>`;
    const g = nextGoal();
    if (g) {
      const pct = clamp(g.cur / g.need, 0, 1);
      extra += `<div class="nextgoal"><div class="ng-top"><span>${g.label}</span><b>${g.time ? fmtTime(g.cur) + ' / ' + fmtTime(g.need) : fmtNum(g.cur) + ' / ' + fmtNum(g.need)}</b></div><div class="ng-bar"><i style="width:${pct * 100}%"></i></div></div>`;
    }
    $('death-extra').innerHTML = extra;
    const spendable = META.some(m => metaLv(m.id) < m.max && metaCost(m, metaLv(m.id)) <= SV.souls);
    $('btn-death-meta').classList.toggle('pip', spendable);
    this.show('scr-death');
  }
};
