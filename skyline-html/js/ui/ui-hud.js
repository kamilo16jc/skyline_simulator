// ═══════════════════════════════════════════════════════════════
//  SkyLine — ui-hud.js
//  HUD updates, velocidad, toasts, atajos de teclado, guardado
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  HUD UPDATES
// ─────────────────────────────────────────────────────────────
function updateHUDCash() {
  const cash = SkyLine.economy?.cash ?? 0;
  document.getElementById('hud-cash').textContent = '$' + Math.round(cash).toLocaleString();
  document.getElementById('eco-cash').textContent = '$' + Math.round(cash).toLocaleString();
}

function updateHUDDate(date) {
  document.getElementById('hud-date').textContent = date.toShortString();
}

function updateHUDTime(hour) {
  const el = document.getElementById('hud-time');
  if (el) el.textContent = String(hour).padStart(2, '0') + ':00';
}

function updateHUDRep(rep) {
  document.getElementById('hud-rep').textContent     = Math.round(rep);
  document.getElementById('hud-rep-bar').style.width = rep + '%';
}

function updateHUDSeason(season) {
  const map = { Spring:'Primavera', Summer:'Verano', Fall:'Otoño', Winter:'Invierno' };
  document.getElementById('hud-season').textContent = map[season] || season;
}

function updateHUDFleetRoutes() {
  document.getElementById('hud-fleet').textContent  = SkyLine.game?.fleet?.length ?? 0;
  document.getElementById('hud-routes').textContent = (SkyLine.game?.routes ?? []).filter(r => r.isActive).length;
}

function updateHubTag(iataOrArray) {
  const el = document.getElementById('hub-tags');
  if (!el) return;
  const hubs = Array.isArray(iataOrArray) ? iataOrArray : [iataOrArray];
  el.innerHTML = hubs
    .filter(Boolean)
    .map(h => `<span class="hub-chip">${h}</span>`)
    .join('');
}

function refreshAllPanels() {
  updateHUDCash();
  updateHUDFleetRoutes();
  if (document.getElementById('panel-economy').classList.contains('open'))
    updateEconomyPanel();
}

// ─────────────────────────────────────────────────────────────
//  SPEED CONTROL
// ─────────────────────────────────────────────────────────────
function setSpeed(s) {
  SkyLine.game?.setGameSpeed(s);
  document.getElementById('sp-pause').classList.toggle('active', s === 0);
  document.getElementById('sp-1x').classList.toggle('active',   s !== 0);
}

// ─────────────────────────────────────────────────────────────
//  TOASTS
// ─────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

// ─────────────────────────────────────────────────────────────
//  SAVE
// ─────────────────────────────────────────────────────────────
function saveAndNotify() {
  SkyLine.save();
  showToast('Partida guardada correctamente.', 'success');
}

// ─────────────────────────────────────────────────────────────
//  KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (document.getElementById('screen-game').classList.contains('active')) {
    if (e.key === ' ') {
      e.preventDefault();
      SkyLine.game?.togglePause();
      // Sincronizar botones tras el toggle
      const paused = (SkyLine.game?._gameSpeed === 0);
      document.getElementById('sp-pause').classList.toggle('active',  paused);
      document.getElementById('sp-1x').classList.toggle('active', !paused);
    }
    if (e.key === 'Escape') closeAirportPanel();
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveAndNotify(); }
  }
});
