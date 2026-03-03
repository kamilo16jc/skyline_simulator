// ═══════════════════════════════════════════════════════════════
//  SkyLine — ui-planner.js
//  Planificador semanal de vuelos — drag & drop sobre cuadrícula 24h × 7 días
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  CONSTANTES
// ─────────────────────────────────────────────────────────────

const PLANNER_COLORS = [
  '#e53935','#e91e63','#8e24aa','#1e88e5','#00897b',
  '#43a047','#fb8c00','#f4511e','#6d4c41','#546e7a',
  '#c0392b','#d81b60','#7b1fa2','#1565c0','#00695c',
  '#2e7d32','#e65100','#0277bd','#4e342e','#37474f'
];

const DAY_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

// ─────────────────────────────────────────────────────────────
//  ESTADO DEL PLANIFICADOR
// ─────────────────────────────────────────────────────────────

let _routeColors   = {};  // routeId → color hex
let _plan          = [[], [], [], [], [], [], []];  // 7 días × [{routeId, depHour}]
let _dragRouteId   = null;   // routeId arrastrándose (desde chip o bloque)
let _dragSourceDay = null;   // día origen si es un bloque existente
let _dragSourceIdx = null;   // índice en _plan[day] del bloque origen

// ─────────────────────────────────────────────────────────────
//  OPEN / CLOSE
// ─────────────────────────────────────────────────────────────

function openPlanner() {
  _assignColors();
  _buildPlanFromRoutes();
  renderPlanner();
  document.getElementById('planner-overlay').classList.add('active');
}

function closePlanner() {
  document.getElementById('planner-overlay').classList.remove('active');
}

// ─────────────────────────────────────────────────────────────
//  HELPERS DE DATOS
// ─────────────────────────────────────────────────────────────

function _assignColors() {
  const routes = _activeRoutes();
  let ci = Object.keys(_routeColors).length;
  routes.forEach(r => {
    if (!_routeColors[r.routeId]) {
      _routeColors[r.routeId] = PLANNER_COLORS[ci % PLANNER_COLORS.length];
      ci++;
    }
  });
}

function _activeRoutes() {
  return (SkyLine.game?.routes ?? []).filter(r => r.isActive && !r.isPaused);
}

function _getRoute(id) {
  return (SkyLine.game?.routes ?? []).find(r => r.routeId === id) ?? null;
}

function _durationH(route) {
  // Velocidad de crucero desde el avión asignado, o 850 km/h por defecto
  const fleetEntry = (SkyLine.game?._fleet ?? []).find(f => f.assignedRouteId === route.routeId);
  const acData = fleetEntry
    ? (window.AIRCRAFT_CATALOG ?? []).find(a => a.aircraftId === fleetEntry.aircraftDataId)
    : null;
  const speed = acData?.cruiseSpeedKmh ?? 850;
  return route.distanceKm / speed;
}

function _getSeats(routeId) {
  const fleetEntry = (SkyLine.game?._fleet ?? []).find(f => f.assignedRouteId === routeId);
  if (!fleetEntry) return { eco: 150, bus: 20, prem: 8 };
  const acData = (window.AIRCRAFT_CATALOG ?? []).find(a => a.aircraftId === fleetEntry.aircraftDataId);
  return {
    eco:  fleetEntry.seatsEconomy  ?? acData?.seatsEconomy  ?? 150,
    bus:  fleetEntry.seatsBusiness ?? acData?.seatsBusiness ?? 20,
    prem: fleetEntry.seatsPremium  ?? acData?.seatsPremium  ?? 8,
  };
}

// Formatea hora decimal → "7h30"
function _timeLabel(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  return `${hh}h${mm.toString().padStart(2,'0')}`;
}

// Formatea duración → "15h00"
function _durationLabel(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h${mm.toString().padStart(2,'0')}`;
}

// ─────────────────────────────────────────────────────────────
//  CONSTRUIR _plan DESDE LOS DATOS DE RUTA
// ─────────────────────────────────────────────────────────────

function _buildPlanFromRoutes() {
  _plan = [[], [], [], [], [], [], []];
  _activeRoutes().forEach(r => {
    // Solo cargar bloques si el usuario guardó un dayPlan manual
    // Nunca auto-generar desde schedule (el jugador decide cuándo vuelan)
    if (r.dayPlan && Array.isArray(r.dayPlan)) {
      r.dayPlan.forEach((dayHours, dayIdx) => {
        (dayHours ?? []).forEach(depHour => {
          _plan[dayIdx].push({ routeId: r.routeId, depHour });
        });
      });
    }
    // Si no hay dayPlan, la cuadrícula queda vacía para esa ruta
  });
}

// ─────────────────────────────────────────────────────────────
//  RENDER PRINCIPAL
// ─────────────────────────────────────────────────────────────

function renderPlanner() {
  _renderChips();
  _renderFleet();
  _renderGrid();
  _renderDemand();
}

// ─────────────────────────────────────────────────────────────
//  CHIPS
// ─────────────────────────────────────────────────────────────

function _getFilteredRoutes() {
  const routes    = _activeRoutes();
  const durFilter = document.getElementById('pf-dur')?.value ?? '';
  const distFilter= document.getElementById('pf-dist')?.value ?? '';
  const search    = (document.getElementById('pf-search')?.value ?? '').toLowerCase().trim();
  const sort      = document.querySelector('input[name="psort"]:checked')?.value ?? 'duration';

  const filtered = routes.filter(r => {
    const dur  = _durationH(r);
    const dist = r.distanceKm;
    if (durFilter === 'short'  && dur  >= 3)     return false;
    if (durFilter === 'medium' && (dur < 3  || dur  >= 7))  return false;
    if (durFilter === 'long'   && dur  < 7)     return false;
    if (distFilter === 'regional'         && dist >= 2000) return false;
    if (distFilter === 'continental'      && (dist < 2000 || dist >= 7000)) return false;
    if (distFilter === 'intercontinental' && dist < 7000)  return false;
    if (search) {
      const label = `${r.originIATA}${r.destinationIATA}`.toLowerCase();
      if (!label.includes(search)) return false;
    }
    return true;
  });

  if (sort === 'duration') {
    filtered.sort((a, b) => _durationH(b) - _durationH(a));
  } else {
    filtered.sort((a, b) =>
      `${a.originIATA}/${a.destinationIATA}`.localeCompare(`${b.originIATA}/${b.destinationIATA}`)
    );
  }
  return filtered;
}

function _renderChips() {
  const el = document.getElementById('planner-chips');
  if (!el) return;
  const routes = _getFilteredRoutes();
  if (!routes.length) {
    el.innerHTML = `<span style="color:var(--text-muted);font-size:0.82rem;font-style:italic">
      Sin rutas activas. Crea una ruta para planificar vuelos.</span>`;
    return;
  }
  const fleet = SkyLine.game?._fleet ?? [];
  el.innerHTML = routes.map(r => {
    const color = _routeColors[r.routeId] ?? '#1e7de6';
    const dur   = _durationH(r);
    const plane = fleet.find(f => f.assignedRouteId === r.routeId);
    const acBadge = plane
      ? `<span class="chip-ac">✈ ${plane.tailNumber}</span>`
      : `<span class="chip-ac chip-ac-warn">⚠ Sin avión</span>`;
    return `<div class="route-chip" style="background:${color}"
      draggable="true"
      ondragstart="plannerChipDragStart(event,'${r.routeId}')"
      ondragend="plannerDragEnd(event)"
      ontouchstart="plannerChipTouchStart(event,'${r.routeId}')">
      <span class="chip-route">${r.originIATA} / ${r.destinationIATA} &mdash; ${_durationLabel(dur)}</span>
      ${acBadge}
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────
//  FLOTA
// ─────────────────────────────────────────────────────────────

function _renderFleet() {
  const el = document.getElementById('planner-fleet');
  if (!el) return;
  const fleet  = SkyLine.game?._fleet ?? [];
  const routes = _activeRoutes();

  if (!fleet.length) {
    el.innerHTML = `<div class="planner-fleet-title">✈ Flota</div>
      <span style="color:var(--text-muted);font-size:0.8rem;font-style:italic">
        Sin flota disponible. Compra o arrienda un avión.</span>`;
    return;
  }

  const routeOptions = routes.map(r =>
    `<option value="${r.routeId}">${r.originIATA} → ${r.destinationIATA}</option>`
  ).join('');

  el.innerHTML = `<div class="planner-fleet-title">✈ Flota — asignación de aviones</div>
    <div class="fleet-cards-row">
      ${fleet.map(f => {
        const ac        = (window.AIRCRAFT_CATALOG ?? []).find(a => a.aircraftId === f.aircraftDataId);
        const modelName = ac?.displayName ?? f.aircraftDataId;
        const assigned  = f.assignedRouteId ?? '';
        return `<div class="planner-fc">
          <div class="pfc-info">
            <span class="pfc-tail">${f.tailNumber}</span>
            <span class="pfc-model">${modelName}</span>
          </div>
          <select class="pfc-select" onchange="plannerAssignAircraft('${f.tailNumber}', this.value)">
            <option value="" ${!assigned ? 'selected' : ''}>Sin ruta</option>
            ${routes.map(r => `<option value="${r.routeId}" ${r.routeId === assigned ? 'selected' : ''}>
              ${r.originIATA} → ${r.destinationIATA}
            </option>`).join('')}
          </select>
        </div>`;
      }).join('')}
    </div>`;
}

function plannerAssignAircraft(tailNumber, newRouteId) {
  const fleet  = SkyLine.game?._fleet ?? [];
  const routes = SkyLine.game?.routes ?? [];
  const plane  = fleet.find(f => f.tailNumber === tailNumber);
  if (!plane) return;

  // Desasignar de la ruta anterior
  if (plane.assignedRouteId) {
    const oldRoute = routes.find(r => r.routeId === plane.assignedRouteId);
    if (oldRoute && oldRoute.assignedAircraftId === tailNumber) {
      oldRoute.assignedAircraftId = null;
    }
  }

  if (newRouteId) {
    // Si la ruta destino ya tiene avión, liberar ese avión primero
    const newRoute = routes.find(r => r.routeId === newRouteId);
    if (newRoute) {
      if (newRoute.assignedAircraftId && newRoute.assignedAircraftId !== tailNumber) {
        const prevPlane = fleet.find(f => f.tailNumber === newRoute.assignedAircraftId);
        if (prevPlane) prevPlane.assignedRouteId = null;
      }
      newRoute.assignedAircraftId = tailNumber;
    }
    plane.assignedRouteId = newRouteId;
  } else {
    plane.assignedRouteId = null;
  }

  // Re-renderizar chips y flota para reflejar cambios
  _renderChips();
  _renderFleet();
}

// ─────────────────────────────────────────────────────────────
//  CUADRÍCULA
// ─────────────────────────────────────────────────────────────

// Horas pico de demanda (mañana y noche son las más llenas)
const _PEAK_MORN = new Set([7, 8, 9]);       // mañana alta demanda
const _PEAK_EVE  = new Set([17, 18, 19, 20]); // tarde alta demanda

function _renderGrid() {
  const el = document.getElementById('planner-grid');
  if (!el) return;

  // Cabecera de horas con indicadores de demanda
  let html = `<div class="pg-hours">`;
  for (let h = 0; h < 24; h++) {
    const cls = _PEAK_MORN.has(h) ? 'pg-hour peak-morn'
              : _PEAK_EVE.has(h)  ? 'pg-hour peak-eve'
              : 'pg-hour';
    html += `<div class="${cls}">${h}</div>`;
  }
  html += `</div>`;

  // Filas de días
  DAY_NAMES.forEach((day, dayIdx) => {
    html += `
    <div class="pg-row">
      <div class="pg-day-label">
        <button class="pg-copy-btn" onclick="copyDay(${dayIdx})" title="Copiar este día a todos">⎘</button>
        <span class="pg-day-name">${day}</span>
      </div>
      <div class="pg-timeline" id="ptl-${dayIdx}"
        ondragover="plannerDragOver(event,${dayIdx})"
        ondragleave="plannerDragLeave(event,${dayIdx})"
        ondrop="plannerDrop(event,${dayIdx})">
        ${_plan[dayIdx].map((f, fi) => _flightBlockHTML(f, dayIdx, fi) + _returnGhostHTML(f)).join('')}
      </div>
    </div>`;
  });

  // Leyenda de horas pico
  html += `
    <div class="pg-legend">
      <span>📗 <span style="color:#4ade80">07–09h</span> Mañana (alta demanda)</span>
      <span>🟠 <span style="color:#fb923c">17–20h</span> Tarde (alta demanda)</span>
      <span>⬜ Resto → demanda media/baja</span>
      <span style="margin-left:auto;opacity:0.5">↩ bloque punteado = vuelo de regreso</span>
    </div>`;

  el.innerHTML = html;
}

function _flightBlockHTML(f, dayIdx, fi) {
  const route = _getRoute(f.routeId);
  if (!route) return '';
  const color   = _routeColors[f.routeId] ?? '#1e7de6';
  const dur     = _durationH(route);
  const leftPct = (f.depHour / 24) * 100;
  const wPct    = Math.max((dur / 24) * 100, 0.5);
  const arrHour = f.depHour + dur;
  const label   = `${route.originIATA} / ${route.destinationIATA} - ${_timeLabel(f.depHour)} / ${_timeLabel(arrHour)}`;

  return `<div class="flight-block"
    style="left:${leftPct.toFixed(2)}%;width:${wPct.toFixed(2)}%;background:${color}"
    draggable="true"
    ondragstart="plannerBlockDragStart(event,'${f.routeId}',${dayIdx},${fi})"
    ondragend="plannerDragEnd(event)"
    ontouchstart="plannerBlockTouchStart(event,'${f.routeId}',${dayIdx},${fi})"
    title="${label}">
    <span class="fb-label">${label}</span>
    <div class="fb-close" onclick="removeBlock(event,${dayIdx},${fi})">✕</div>
  </div>`;
}

// Ghost semitransparente del vuelo de regreso (no interactivo)
function _returnGhostHTML(f) {
  const route = _getRoute(f.routeId);
  if (!route) return '';

  const hex     = _routeColors[f.routeId] ?? '#1e7de6';
  const dur     = _durationH(route);
  const arrHour = f.depHour + dur;
  const retDep  = arrHour + 0.5;   // turnaround 30 min
  const retArr  = retDep + dur;

  // Si el vuelo de regreso empieza fuera del día, no mostrarlo
  if (retDep >= 24) return '';

  const leftPct = (retDep / 24) * 100;
  // Recortar ancho si sobrepasa medianoche; mínimo 2% para ser visible
  const visibleDur = Math.min(dur, 24 - retDep);
  const wPct = Math.max((visibleDur / 24) * 100, 2.0);

  // Convertir hex a rgb para usar rgba()
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);

  const label = `↩ ${route.destinationIATA} → ${route.originIATA}  ${_timeLabel(retDep)} / ${_timeLabel(retArr)}`;

  return `<div class="flight-block-return"
    style="left:${leftPct.toFixed(2)}%;width:${wPct.toFixed(2)}%;
           background:rgba(${r},${g},${b},0.30);
           border:2px dashed rgba(${r},${g},${b},0.80)"
    title="${label}">
    <span style="color:rgba(${r},${g},${b},1);pointer-events:none;
                 white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:0.5rem">↩ ${route.destinationIATA}→${route.originIATA}</span>
  </div>`;
}

// ─────────────────────────────────────────────────────────────
//  DEMANDA RESTANTE
// ─────────────────────────────────────────────────────────────

function _renderDemand() {
  const tbody = document.getElementById('demand-tbody');
  if (!tbody) return;

  const routes = _activeRoutes();

  const rows = DAY_NAMES.map((day, dayIdx) => {
    let remEco = 0, remBus = 0, remPrem = 0;

    // Suma capacidad total disponible del día
    routes.forEach(r => {
      const s  = _getSeats(r.routeId);
      const dm = r.demandMultiplier ?? 1.0;
      // Demanda diaria estimada = asientos × multiplicador × 2 (ida+vuelta)
      remEco  += Math.round(s.eco  * dm * 2);
      remBus  += Math.round(s.bus  * dm * 2);
      remPrem += Math.round(s.prem * dm * 2);
    });

    // Resta pasajeros de vuelos ya planificados ese día
    _plan[dayIdx].forEach(f => {
      const route = _getRoute(f.routeId);
      if (!route) return;
      const s   = _getSeats(f.routeId);
      const occ = route.currentOccupancy ?? 0.65;
      remEco  -= Math.round(s.eco  * occ);
      remBus  -= Math.round(s.bus  * occ);
      remPrem -= Math.round(s.prem * occ);
    });

    remEco  = Math.max(0, remEco);
    remBus  = Math.max(0, remBus);
    remPrem = Math.max(0, remPrem);

    return `<tr>
      <td><span class="day-pill">${day}</span></td>
      <td class="eco">${remEco.toLocaleString()} Pax</td>
      <td class="bus">${remBus.toLocaleString()} Pax</td>
      <td class="prem">${remPrem.toLocaleString()} Pax</td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rows;
}

// ─────────────────────────────────────────────────────────────
//  DRAG & DROP
// ─────────────────────────────────────────────────────────────

// Drag desde un CHIP (ruta nueva)
function plannerChipDragStart(e, routeId) {
  _dragRouteId   = routeId;
  _dragSourceDay = null;
  _dragSourceIdx = null;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('text/plain', routeId);
}

// Drag desde un BLOQUE existente (moverlo)
function plannerBlockDragStart(e, routeId, dayIdx, fi) {
  _dragRouteId   = routeId;
  _dragSourceDay = dayIdx;
  _dragSourceIdx = fi;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', routeId);
  e.stopPropagation();
}

function plannerDragEnd(e) {
  _dragRouteId   = null;
  _dragSourceDay = null;
  _dragSourceIdx = null;
  document.querySelectorAll('.route-chip').forEach(c => c.classList.remove('dragging'));
  document.querySelectorAll('.pg-timeline').forEach(t => t.classList.remove('drag-over'));
}

function plannerDragOver(e, dayIdx) {
  e.preventDefault();
  e.dataTransfer.dropEffect = _dragSourceDay !== null ? 'move' : 'copy';
  document.getElementById('ptl-' + dayIdx)?.classList.add('drag-over');
}

function plannerDragLeave(e, dayIdx) {
  // Solo quitar si el cursor realmente salió del timeline
  if (!e.currentTarget.contains(e.relatedTarget)) {
    document.getElementById('ptl-' + dayIdx)?.classList.remove('drag-over');
  }
}

function plannerDrop(e, dayIdx) {
  e.preventDefault();
  document.getElementById('ptl-' + dayIdx)?.classList.remove('drag-over');

  if (!_dragRouteId) return;

  // Calcular hora de salida a partir de la posición X del drop
  const tl   = document.getElementById('ptl-' + dayIdx);
  if (!tl) return;
  const rect = tl.getBoundingClientRect();
  const x    = Math.max(0, e.clientX - rect.left);
  let depHour = (x / rect.width) * 24;

  // Snap a 30 min
  depHour = Math.round(depHour * 2) / 2;
  depHour = Math.max(0, Math.min(23.5, depHour));

  // Si era un bloque existente, eliminarlo de su posición original
  if (_dragSourceDay !== null && _dragSourceIdx !== null) {
    _plan[_dragSourceDay].splice(_dragSourceIdx, 1);
  }

  _plan[dayIdx].push({ routeId: _dragRouteId, depHour });

  _renderGrid();
  _renderDemand();
}

// ─────────────────────────────────────────────────────────────
//  ELIMINAR BLOQUE
// ─────────────────────────────────────────────────────────────

function removeBlock(e, dayIdx, fi) {
  e.stopPropagation();
  e.preventDefault();
  _plan[dayIdx].splice(fi, 1);
  _renderGrid();
  _renderDemand();
}

// ─────────────────────────────────────────────────────────────
//  COPIAR DÍA → TODOS LOS DÍAS
// ─────────────────────────────────────────────────────────────

function copyDay(srcDayIdx) {
  const template = _plan[srcDayIdx].map(f => ({ ...f }));
  for (let d = 0; d < 7; d++) {
    if (d !== srcDayIdx) _plan[d] = template.map(f => ({ ...f }));
  }
  _renderGrid();
  _renderDemand();
}

// ─────────────────────────────────────────────────────────────
//  BORRAR / GUARDAR
// ─────────────────────────────────────────────────────────────

function clearPlan() {
  _plan = [[], [], [], [], [], [], []];
  _renderGrid();
  _renderDemand();
}

function savePlan() {
  const routes = SkyLine.game?.routes ?? [];

  routes.forEach(r => {
    // dayPlan: array de 7 días, cada uno con los depHour de esa ruta
    const newDayPlan = _plan.map(dayFlights =>
      dayFlights.filter(f => f.routeId === r.routeId).map(f => f.depHour)
    );
    r.dayPlan  = newDayPlan;
    // Actualizar schedule (cantidad de vuelos por día) para que el tab Vuelos lo refleje
    r.schedule = newDayPlan.map(d => d.length);
    r.flightsPerWeek = r.schedule.reduce((s, n) => s + n, 0);
  });

  if (typeof SkyLine.game?.saveGame === 'function') {
    // No forzamos save automático, el usuario lo hace con 💾
  }

  showToast('Planning guardado correctamente.', 'success');
  closePlanner();
}

// ─────────────────────────────────────────────────────────────
//  FILTROS
// ─────────────────────────────────────────────────────────────

function plannerFilter() {
  _renderChips();
}

// ─────────────────────────────────────────────────────────────
//  TOUCH DRAG & DROP (soporte móvil)
// ─────────────────────────────────────────────────────────────

let _touchClone = null;  // elemento visual clonado que sigue el dedo

function plannerChipTouchStart(e, routeId) {
  e.preventDefault();
  _dragRouteId   = routeId;
  _dragSourceDay = null;
  _dragSourceIdx = null;
  _createTouchClone(e.currentTarget, e.touches[0]);
}

function plannerBlockTouchStart(e, routeId, dayIdx, fi) {
  e.preventDefault();
  _dragRouteId   = routeId;
  _dragSourceDay = dayIdx;
  _dragSourceIdx = fi;
  _createTouchClone(e.currentTarget, e.touches[0]);
}

function _createTouchClone(el, touch) {
  if (_touchClone) _touchClone.remove();
  _touchClone = el.cloneNode(true);
  _touchClone.style.cssText = `position:fixed;z-index:9999;opacity:0.85;pointer-events:none;
    transform:scale(1.05);border-radius:6px;max-width:200px;font-size:0.72rem;`;
  document.body.appendChild(_touchClone);
  _moveTouchClone(touch);
}

function _moveTouchClone(touch) {
  if (!_touchClone) return;
  _touchClone.style.left = (touch.clientX - 60) + 'px';
  _touchClone.style.top  = (touch.clientY - 20) + 'px';
}

// Listeners globales de touch (se activan solo cuando hay drag activo)
document.addEventListener('touchmove', e => {
  if (!_dragRouteId) return;
  e.preventDefault();
  const t = e.touches[0];
  _moveTouchClone(t);
  // Resaltar el timeline bajo el dedo
  document.querySelectorAll('.pg-timeline').forEach(tl => tl.classList.remove('drag-over'));
  const el = document.elementFromPoint(t.clientX, t.clientY);
  const tl = el?.closest('.pg-timeline');
  if (tl) tl.classList.add('drag-over');
}, { passive: false });

document.addEventListener('touchend', e => {
  if (!_dragRouteId) return;
  if (_touchClone) { _touchClone.remove(); _touchClone = null; }
  document.querySelectorAll('.pg-timeline').forEach(tl => tl.classList.remove('drag-over'));

  const t  = e.changedTouches[0];
  const el = document.elementFromPoint(t.clientX, t.clientY);
  const tl = el?.closest('.pg-timeline');

  if (tl) {
    const dayIdx = parseInt(tl.id.replace('ptl-', ''));
    const rect   = tl.getBoundingClientRect();
    let depHour  = ((t.clientX - rect.left) / rect.width) * 24;
    depHour = Math.round(depHour * 2) / 2;
    depHour = Math.max(0, Math.min(23.5, depHour));

    if (_dragSourceDay !== null && _dragSourceIdx !== null) {
      _plan[_dragSourceDay].splice(_dragSourceIdx, 1);
    }
    _plan[dayIdx].push({ routeId: _dragRouteId, depHour });
    _renderGrid();
    _renderDemand();
  }

  _dragRouteId = _dragSourceDay = _dragSourceIdx = null;
});
