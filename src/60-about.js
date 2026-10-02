// ============================================================
//  Sonder demo overlay — "i" button + about panel
// ============================================================
(() => {
  const info = document.getElementById('sd-info');
  const panel = document.getElementById('sd-about');
  if (!info || !panel) return;
  const open = v => {
    panel.hidden = !v;
    panel.classList.toggle('on', v);
    (v ? document.getElementById('sd-close') : info).focus();
  };
  info.addEventListener('click', () => open(true));
  document.getElementById('sd-close').addEventListener('click', () => open(false));
  panel.addEventListener('click', e => { if (e.target === panel) open(false); });
  // Capture phase: Esc closes the panel without also toggling the game's pause.
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('on')) { e.stopPropagation(); e.preventDefault(); open(false); }
  }, true);

  // ---- sound button: all on -> music off -> all muted. Mirrors the menu toggles + their saved settings. ----
  const OMx = window.OM, snd = document.getElementById('sd-snd');
  if (!OMx || !snd) return;
  const { SV, AU, UI, persist } = OMx;
  const LABEL = { on: 'Sound: all on', music: 'Sound: music off', mute: 'Sound: muted' };
  const state = () => SV.settings.sfx ? (SV.settings.music ? 'on' : 'music') : 'mute';
  const refresh = () => { const s = state(); snd.dataset.state = s; snd.setAttribute('aria-label', LABEL[s]); snd.title = LABEL[s]; };
  const apply = (sfx, music) => {
    AU.init();
    SV.settings.sfx = sfx; AU.sfxOn = sfx;
    SV.settings.music = music; AU.setMusic(music);
    persist(true); UI.syncToggles();
  };
  const origSync = UI.syncToggles;
  UI.syncToggles = function () { origSync.call(this); refresh(); };
  refresh();
  snd.addEventListener('click', () => {
    const s = state();
    if (s === 'on') apply(true, false); else if (s === 'music') apply(false, false); else apply(true, true);
    snd.blur(); // keep Space/Enter with the game, not this button
  });
  // M = mute / unmute everything
  addEventListener('keydown', e => {
    if (e.key.toLowerCase() !== 'm' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (SV.settings.sfx || SV.settings.music) apply(false, false); else apply(true, true);
  });
})();
