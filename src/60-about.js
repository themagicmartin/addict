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
})();
