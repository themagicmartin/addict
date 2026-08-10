// ============================================================
//  ONE MORE — main loop & boot
// ============================================================

let lastT = 0, acc = 0;
const STEP = 1 / 60;

function hotkeys() {
  const st = G.state;
  if (st === 'levelup') {
    for (let i = 1; i <= 4; i++) if (Input.wasPressed(String(i))) UI.chooseCard(i - 1);
    if (Input.wasPressed('r')) UI.reroll();
    if (Input.wasPressed('b')) UI.startBanish();
    return;
  }
  if (st === 'chest') {
    if ((Input.wasPressed(' ') || Input.wasPressed('Enter')) && $('btn-chest-collect').style.visibility !== 'hidden') UI.closeChest();
    return;
  }
  if (st === 'dead') {
    if (Input.wasPressed(' ') || Input.wasPressed('Enter')) startRun(UI.selectedChar);
    if (Input.wasPressed('Escape')) $('btn-death-menu').click();
    return;
  }
  if (st === 'play' || st === 'paused') {
    if (Input.wasPressed('Escape') || Input.wasPressed('p')) UI.togglePause();
    return;
  }
  if (st === 'menu' || st === 'boot') {
    if (Input.wasPressed(' ') || Input.wasPressed('Enter')) {
      AU.init();
      if (UI.cur === 'scr-chars') startRun(UI.selectedChar);
      else if (UI.cur === 'scr-menu') { UI.renderChars(); UI.show('scr-chars'); }
    }
    if (Input.wasPressed('Escape') && UI.cur !== 'scr-menu') { UI.renderMenu(); UI.show('scr-menu'); }
  }
}

function step(dt) {
  G.frame++;
  G.t += dt;
  G.runSeconds += dt;
  buildGrid();
  updatePlayer(dt);
  updateDirector(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateWaves(dt);
  updateBeams(dt);
  updateFields(dt);
  updateLobs(dt);
  updatePickups(dt);
  updateFX(dt);

  // music intensity tracks pressure
  const pressure = clamp(G.t / 420, 0, 1) * 0.6 + clamp(G.enemies.length / 220, 0, 1) * 0.4;
  AU.setIntensity(G.boss ? 1 : pressure);

  // interrupts
  if (G.levelQueue > 0) { UI.openLevelUp(); return; }
  if (G.chestQueue > 0) { UI.openChest(); return; }
}

function frame(ts) {
  requestAnimationFrame(frame);
  if (!lastT) lastT = ts;
  let dt = (ts - lastT) / 1000;
  lastT = ts;
  if (dt > 0.25) dt = 0.25;

  if (G.state === 'play') {
    if (G.hitstop > 0) { G.hitstop -= dt; dt *= 0.06; }
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 5) {
      acc -= STEP;
      if (G.state !== 'play') break;
      step(STEP);
    }
    if (acc > STEP * 5) acc = 0;
    UI.syncHud();
    SV.stats.playSeconds += dt;
    if (G.frame % 240 === 0) persist();
  } else if (G.player && (G.state === 'levelup' || G.state === 'chest' || G.state === 'paused' || G.state === 'dead')) {
    // keep the world breathing behind overlays (FX only)
    updateFX(Math.min(dt, 0.05));
  }

  hotkeys();
  Input.endFrame();
  draw();
}

function boot() {
  loadSave();
  // probe storage up front so the warning is accurate before anything is at stake
  try {
    localStorage.setItem(SAVE_KEY + '.probe', '1');
    localStorage.removeItem(SAVE_KEY + '.probe');
  } catch (e) { storageOK = false; }
  initCanvas();
  Input.init(cvs);
  UI.init();
  G.state = 'menu';

  // daily streak nudge
  const day = 86400000;
  const today = Math.floor(Date.now() / day);
  if (SV.lastPlayed !== today) {
    SV.streak = (today - SV.lastPlayed === 1) ? (SV.streak || 0) + 1 : 1;
    SV.lastPlayed = today;
    const bonus = 25 * SV.streak;
    SV.souls += bonus;
    persist(true);
    setTimeout(() => {
      banner('DAY ' + SV.streak, '+' + bonus + ' souls', COL.gold);
      UI.renderMenu();
    }, 400);
  }

  const unlockAudio = () => { AU.init(); AU.resume(); };
  addEventListener('pointerdown', unlockAudio, { once: true });
  addEventListener('keydown', unlockAudio, { once: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.state === 'play') UI.togglePause();
    persist(true);
  });
  addEventListener('beforeunload', () => persist(true));

  requestAnimationFrame(frame);
}

// Debug handle — used by tools/playtest.js and handy in the console.
window.OM = {
  G, SV, UI, AU, Input, WEAPONS, PASSIVES, ENEMIES, META, CHARS,
  step, startRun, endRun, buildCards, recalc, nextGoal, persist, pick, draw,
  grantSouls: n => { SV.souls += n; persist(true); UI.renderMenu(); },
  wipe: () => { localStorage.removeItem(SAVE_KEY); location.reload(); }
};

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
else boot();
