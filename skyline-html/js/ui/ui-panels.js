// ═══════════════════════════════════════════════════════════════
//  SkyLine — ui-panels.js
//  Paneles laterales: Flota / Rutas / Mercado / Economía
//  Modales: Evento aleatorio + Reporte mensual
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  PANEL CONTROLS
// ─────────────────────────────────────────────────────────────
function togglePanel(which) {
  if (which === 'left') {
    const el  = document.getElementById('panel-left');
    const btn = document.getElementById('tog-left');
    el.classList.toggle('open');
    btn.classList.toggle('active');
  } else if (which === 'eco') {
    const el  = document.getElementById('panel-economy');
    const btn = document.getElementById('tog-eco');
    el.classList.toggle('open');
    btn.classList.toggle('active');
    if (el.classList.contains('open')) updateEconomyPanel();
  }
}

function switchTab(name) {
  document.querySelectorAll('.panel-tab').forEach((t, i) => {
    const tabs = ['fleet', 'routes', 'market', 'flights'];
    t.classList.toggle('active', tabs[i] === name);
  });
  document.querySelectorAll('.panel-section').forEach(s => s.classList.remove('active'));
  document.getElementById('tab-' + name)?.classList.add('active');

  if (name === 'fleet')   renderFleetTab();
  if (name === 'routes')  renderRoutesTab();
  if (name === 'market')  renderMarketTab();
  if (name === 'flights') renderFlightsTab();

  // Stop auto-refresh when leaving flights tab
  if (name !== 'flights' && window._flightsRefreshTimer) {
    clearInterval(window._flightsRefreshTimer);
    window._flightsRefreshTimer = null;
  }
}

// ─────────────────────────────────────────────────────────────
//  FLEET TAB
// ─────────────────────────────────────────────────────────────
function renderFleetTab() {
  const fleet   = SkyLine.game?.fleet ?? [];
  const listEl  = document.getElementById('fleet-list');
  const emptyEl = document.getElementById('fleet-empty');

  emptyEl.style.display = fleet.length ? 'none' : 'block';
  listEl.innerHTML = fleet.map(f => {
    const cond   = f.conditionPercent;
    const barCls = cond > 60 ? '' : cond > 30 ? ' warn' : ' crit';
    return `
      <div class="fleet-item">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <div class="fleet-tail">${f.tailNumber}</div>
            <div class="fleet-model">${f.aircraftDataId} · ${f.currentAirport} · ${f.isLeased ? 'Arrendado' : 'Propio'}</div>
          </div>
          <span style="font-size:0.72rem;color:${f.isOperational ? 'var(--success)' : 'var(--danger)'}">
            ${f.isOperational ? 'Operativo' : 'Mantenimiento'}
          </span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-muted);margin-top:6px">
          <span>Condición: ${cond.toFixed(0)}%</span>
          <span>Ruta: ${f.assignedRouteId ? f.assignedRouteId.replace('RT_', '').replace('_', '→') : 'Sin asignar'}</span>
        </div>
        <div class="fleet-bar-wrap"><div class="fleet-bar${barCls}" style="width:${cond}%"></div></div>
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────────────────────
//  ROUTES TAB — diseño semanal estilo Airlines Manager
// ─────────────────────────────────────────────────────────────
function renderRoutesTab() {
  const routes  = SkyLine.game?.routes ?? [];
  const listEl  = document.getElementById('route-list');
  const emptyEl = document.getElementById('routes-empty');

  const DAY_LABELS = ['L','M','X','J','V','S','D'];

  emptyEl.style.display = routes.length ? 'none' : 'block';

  listEl.innerHTML = routes.map(r => {
    // Horario semanal (fallback si viene de guardado antiguo)
    const sched = r.schedule ?? Array.from({length:7}, (_, i) => {
      const b = Math.floor((r.flightsPerWeek||7) / 7);
      const e = (r.flightsPerWeek||7) % 7;
      return b + (i < e ? 1 : 0);
    });
    const total  = sched.reduce((a,b) => a+b, 0);
    const occ    = (r.currentOccupancy * 100).toFixed(0);
    const occCls = occ > 70 ? '' : occ > 45 ? ' warn' : ' crit';

    // Badge de estado
    const PAUSE_LABELS = { manual:'PAUSADA', seasonal:'ESTACIONAL', low_demand:'BAJA DEMANDA' };
    const statusBadge = r.isPaused
      ? `<span style="font-size:0.6rem;font-weight:700;padding:2px 8px;border-radius:20px;
                      background:rgba(245,158,11,0.15);color:#f59e0b">
           ⏸ ${PAUSE_LABELS[r.pauseReason] ?? 'PAUSADA'}
         </span>`
      : `<span style="font-size:0.6rem;font-weight:700;padding:2px 8px;border-radius:20px;
                      background:rgba(34,197,94,0.12);color:#22c55e">
           ● ACTIVA
         </span>`;

    // Colores de barras por intensidad (apagado si pausada)
    const barColor = n => {
      if (r.isPaused) return '#4b5563';
      if (n === 0)    return 'var(--bg-dark)';
      if (n <= 2)     return '#22c55e';
      if (n === 3)    return '#3b82f6';
      return '#f59e0b';  // 4
    };

    const miniBars = `
      <div style="display:flex;gap:3px;margin:8px 0 4px;align-items:flex-end;height:30px">
        ${sched.map((n, i) => `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px">
            <div style="width:100%;background:${barColor(n)};
                        height:${n > 0 ? Math.max(4, Math.round(n/4*22)) : 3}px;
                        border-radius:2px 2px 0 0;transition:height 0.3s ease;
                        min-height:3px"></div>
            <span style="font-size:0.52rem;color:${n>0?'var(--text-muted)':'#374151'};
                         font-weight:${n>0?'600':'400'}">${DAY_LABELS[i]}</span>
          </div>`).join('')}
      </div>
      <div style="display:flex;gap:3px;margin-bottom:7px">
        ${sched.map(n => `
          <div style="flex:1;text-align:center;font-size:0.55rem;
                      color:${n>0?'var(--text)':'var(--text-muted)'}">
            ${n > 0 ? n : '·'}
          </div>`).join('')}
      </div>`;

    // Botones de acción
    const pauseBtn = r.isPaused
      ? `<button onclick="showResumeRoute('${r.routeId}')"
           style="flex:1;padding:6px;border-radius:6px;border:1px solid #22c55e;
                  background:rgba(34,197,94,0.08);color:#22c55e;font-size:0.68rem;
                  font-weight:600;cursor:pointer">
           ▶ Reanudar
         </button>`
      : `<button onclick="showPauseRoute('${r.routeId}')"
           style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border);
                  background:transparent;color:var(--text-muted);font-size:0.68rem;
                  font-weight:600;cursor:pointer">
           ⏸ Pausar
         </button>`;

    return `
      <div class="route-item" style="padding:10px 12px;opacity:${r.isPaused ? '0.82' : '1'}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <span class="route-code">${r.originIATA} → ${r.destinationIATA}</span>
          ${statusBadge}
        </div>
        <div class="route-meta">
          ${r.distanceKm.toLocaleString()} km &nbsp;·&nbsp;
          ${total}x/sem &nbsp;·&nbsp;
          $${Math.round(r.baseFareEconomy).toLocaleString()} eco
        </div>
        ${miniBars}
        <div class="fleet-bar-wrap" style="margin-bottom:8px">
          <div class="fleet-bar${occCls}" style="width:${occ}%"></div>
        </div>
        <div style="display:flex;gap:5px;align-items:center">
          ${pauseBtn}
          <button onclick="cancelRouteUI('${r.routeId}')"
            title="Cancelar ruta permanentemente"
            style="width:30px;height:30px;padding:0;border-radius:6px;
                   border:1px solid rgba(239,68,68,0.35);
                   background:rgba(239,68,68,0.06);color:var(--danger);
                   font-size:0.85rem;font-weight:700;cursor:pointer;
                   display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ✕
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────────────────────
//  MARKET TAB (catálogo de aviones)
// ─────────────────────────────────────────────────────────────
function renderMarketTab() {
  const rep     = SkyLine.game?.airline?.reputation ?? 50;
  const cash    = SkyLine.economy?.cash ?? 0;
  const catalog = window.AIRCRAFT_CATALOG ?? DEFAULT_AIRCRAFT_CATALOG ?? [];
  const imgMap  = window.AIRCRAFT_IMAGES ?? {};
  const listEl  = document.getElementById('market-list');

  listEl.innerHTML = catalog.map(ac => {
    const locked   = ac.reputationRequired > rep;
    const canBuy   = cash >= ac.purchasePrice && !locked;
    const canLease = cash >= ac.leasePricePerMonth && !locked;
    const imgFile  = imgMap[ac.aircraftId];
    const imgSrc   = imgFile ? `img/aviones/${imgFile}` : '';

    // Imagen del avión (ocupa el ancho total de la tarjeta, negando el padding)
    const imageBlock = imgSrc ? `
      <div style="margin:-10px -12px 10px -12px;border-radius:8px 8px 0 0;overflow:hidden;
                  height:130px;background:#070d18;cursor:pointer"
           onclick="openAircraftDetail('${ac.aircraftId}')">
        <img src="${imgSrc}" alt="${ac.displayName}"
             style="width:100%;height:100%;object-fit:cover;object-position:center;
                    opacity:${locked ? '0.4' : '0.92'};transition:opacity 0.2s"
             loading="lazy"
             onmouseover="this.style.opacity='1'"
             onmouseout="this.style.opacity='${locked ? '0.4' : '0.92'}'"
             onerror="this.parentElement.style.display='none'">
      </div>` : '';

    return `
      <div class="fleet-item" style="padding:10px 12px;${locked ? 'opacity:0.55' : ''}">
        ${imageBlock}
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <div class="fleet-tail" style="cursor:pointer" onclick="openAircraftDetail('${ac.aircraftId}')">${ac.displayName}</div>
            <div class="fleet-model">${ac.manufacturer} · ${AircraftCategory[ac.category] || ac.category}</div>
          </div>
          <span style="font-size:0.7rem;color:var(--text-muted)">${ac.minAirportClass}+</span>
        </div>
        <div style="display:flex;gap:12px;margin-top:8px;font-size:0.72rem;color:var(--text-muted)">
          <span>✈ ${ac.totalSeats} asientos</span>
          <span>⛽ ${(ac.fuelBurnPerHour / 1000).toFixed(1)}k L/h</span>
          <span>↔ ${ac.rangeKm.toLocaleString()} km</span>
        </div>
        ${locked
          ? `<div style="font-size:0.72rem;color:var(--danger);margin-top:6px">Requiere reputación ${ac.reputationRequired}</div>`
          : `<div style="display:flex;gap:6px;margin-top:10px">
               <button onclick="openSeatConfig('${ac.aircraftId}',false)"
                 style="flex:1;padding:7px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card);
                        color:${canBuy ? 'var(--text)' : 'var(--text-muted)'};font-size:0.72rem;font-weight:600;cursor:pointer">
                 Comprar $${(ac.purchasePrice / 1e6).toFixed(0)}M
               </button>
               <button onclick="openSeatConfig('${ac.aircraftId}',true)"
                 style="flex:1;padding:7px;border-radius:6px;border:1px solid var(--accent);background:transparent;
                        color:${canLease ? 'var(--accent)' : 'var(--text-muted)'};font-size:0.72rem;font-weight:600;cursor:pointer">
                 Arrendar $${Math.round(ac.leasePricePerMonth / 1000)}k/mes
               </button>
             </div>`
        }
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────────────────────
//  MODAL DETALLE DE AVIÓN (imagen grande + especificaciones)
// ─────────────────────────────────────────────────────────────
function openAircraftDetail(aircraftId) {
  const ac     = (window.AIRCRAFT_CATALOG ?? []).find(a => a.aircraftId === aircraftId);
  const imgMap = window.AIRCRAFT_IMAGES ?? {};
  if (!ac) return;

  const imgFile = imgMap[ac.aircraftId];
  const imgSrc  = imgFile ? `img/aviones/${imgFile}` : '';
  const cash    = SkyLine.economy?.cash ?? 0;
  const rep     = SkyLine.game?.airline?.reputation ?? 50;
  const locked  = ac.reputationRequired > rep;
  const canBuy  = cash >= ac.purchasePrice && !locked;
  const canLease= cash >= ac.leasePricePerMonth && !locked;

  const fmt = n => '$' + n.toLocaleString();
  const fmtM = n => '$' + (n / 1e6).toFixed(1) + 'M';

  const modal = document.getElementById('modal-aircraft-detail');
  if (!modal) {
    // Crear modal si no existe
    const m = document.createElement('div');
    m.id = 'modal-aircraft-detail';
    m.style.cssText = `position:fixed;inset:0;z-index:900;display:flex;align-items:center;
      justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px)`;
    m.innerHTML = '<div id="modal-aircraft-inner"></div>';
    m.addEventListener('click', e => { if (e.target === m) closeAircraftDetail(); });
    document.body.appendChild(m);
  }

  const inner = document.getElementById('modal-aircraft-inner');
  inner.style.cssText = `background:var(--bg-card);border:1px solid var(--border);border-radius:12px;
    width:min(480px,92vw);max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.6)`;

  inner.innerHTML = `
    <!-- Imagen grande -->
    <div style="border-radius:12px 12px 0 0;overflow:hidden;height:200px;background:#070d18;position:relative">
      ${imgSrc
        ? `<img src="${imgSrc}" alt="${ac.displayName}"
               style="width:100%;height:100%;object-fit:cover;object-position:center;opacity:0.95">`
        : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:4rem">✈</div>`}
      <!-- Botón cerrar -->
      <button onclick="closeAircraftDetail()"
        style="position:absolute;top:10px;right:12px;background:rgba(0,0,0,0.5);border:none;
               color:#fff;font-size:1.1rem;width:30px;height:30px;border-radius:50%;cursor:pointer;
               display:flex;align-items:center;justify-content:center">✕</button>
      <!-- Badge categoría -->
      <span style="position:absolute;bottom:10px;left:12px;background:rgba(0,0,0,0.6);
                   color:var(--accent);font-size:0.7rem;font-weight:700;padding:3px 8px;
                   border-radius:20px;letter-spacing:0.05em">
        ${AircraftCategory[ac.category] || ac.category}
      </span>
    </div>

    <!-- Contenido -->
    <div style="padding:16px 18px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
        <div>
          <div style="font-size:1rem;font-weight:800;color:var(--text)">${ac.displayName}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${ac.manufacturer} · ${ac.family}</div>
        </div>
        <span style="font-size:0.7rem;background:rgba(255,255,255,0.07);padding:3px 8px;
                     border-radius:20px;color:var(--text-muted)">Clase ${ac.minAirportClass}+</span>
      </div>

      <!-- Descripción -->
      <p style="font-size:0.78rem;color:var(--text-muted);margin:10px 0 14px;line-height:1.55">
        ${ac.description || ''}
      </p>

      <!-- Specs grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
        ${[
          ['✈ Asientos', ac.totalSeats],
          ['↔ Alcance', ac.rangeKm.toLocaleString() + ' km'],
          ['🚀 Velocidad', ac.cruiseSpeedKmh + ' km/h'],
          ['⛽ Consumo', (ac.fuelBurnPerHour/1000).toFixed(1) + 'k L/h'],
          ['📦 Carga', ac.cargoCapacityTons + ' t'],
          ['🔧 Mant./h', fmt(ac.maintenanceCostPerHour)],
        ].map(([label, value]) => `
          <div style="background:var(--bg-dark);border-radius:6px;padding:8px 10px">
            <div style="font-size:0.68rem;color:var(--text-muted)">${label}</div>
            <div style="font-size:0.85rem;font-weight:700;color:var(--text);margin-top:2px">${value}</div>
          </div>`).join('')}
      </div>

      <!-- Precios -->
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <div style="flex:1;background:var(--bg-dark);border-radius:6px;padding:10px 12px;text-align:center">
          <div style="font-size:0.68rem;color:var(--text-muted)">Precio de compra</div>
          <div style="font-size:0.95rem;font-weight:800;color:var(--text);margin-top:3px">${fmtM(ac.purchasePrice)}</div>
        </div>
        <div style="flex:1;background:var(--bg-dark);border-radius:6px;padding:10px 12px;text-align:center">
          <div style="font-size:0.68rem;color:var(--text-muted)">Arriendo / mes</div>
          <div style="font-size:0.95rem;font-weight:800;color:var(--accent);margin-top:3px">$${Math.round(ac.leasePricePerMonth/1000)}k</div>
        </div>
      </div>

      <!-- Botones de acción -->
      ${locked
        ? `<div style="text-align:center;color:var(--danger);font-size:0.78rem;padding:8px">
             🔒 Requiere reputación ${ac.reputationRequired}
           </div>`
        : `<div style="display:flex;gap:8px">
             <button onclick="openSeatConfig('${ac.aircraftId}',false)"
               style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);
                      background:${canBuy ? 'var(--bg-hover)' : 'var(--bg-dark)'};
                      color:${canBuy ? 'var(--text)' : 'var(--text-muted)'};
                      font-size:0.8rem;font-weight:700;cursor:pointer">
               ✦ Configurar y Comprar
             </button>
             <button onclick="openSeatConfig('${ac.aircraftId}',true)"
               style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--accent);
                      background:${canLease ? 'rgba(59,130,246,0.12)' : 'transparent'};
                      color:${canLease ? 'var(--accent)' : 'var(--text-muted)'};
                      font-size:0.8rem;font-weight:700;cursor:pointer">
               ✦ Configurar y Arrendar
             </button>
           </div>`}
    </div>
  `;

  document.getElementById('modal-aircraft-detail').style.display = 'flex';
}

function closeAircraftDetail() {
  const m = document.getElementById('modal-aircraft-detail');
  if (m) m.style.display = 'none';
}

function buyAircraft(aircraftId, isLease) {
  const g   = SkyLine.game;
  const ec  = SkyLine.economy;
  const hub = g?.airline?.hubAirports?.[0] ?? 'ORD';
  const ac  = (window.AIRCRAFT_CATALOG ?? []).find(a => a.aircraftId === aircraftId);
  if (!ac) return;

  if (isLease) {
    if (!ec.deductExpense(ac.leasePricePerMonth, `Primer mes arriendo ${ac.displayName}`)) {
      showToast('Fondos insuficientes para arrendar.', 'danger'); return;
    }
    g.addAircraftToFleet(aircraftId, hub, true, ac.leasePricePerMonth);
    showToast(`${ac.displayName} arrendado y agregado a tu flota.`, 'success');
  } else {
    if (!ec.deductExpense(ac.purchasePrice, `Compra ${ac.displayName}`)) {
      showToast('Fondos insuficientes para comprar.', 'danger'); return;
    }
    g.addAircraftToFleet(aircraftId, hub, false, 0);
    showToast(`${ac.displayName} comprado y agregado a tu flota.`, 'success');
  }
  renderMarketTab();
  renderFleetTab();
  updateHUDCash();
}

// ─────────────────────────────────────────────────────────────
//  ECONOMY PANEL
// ─────────────────────────────────────────────────────────────
function updateEconomyPanel() {
  const ec  = SkyLine.economy;
  const val = ec?.valuation;
  const lb  = ec?.getLastBalance();

  document.getElementById('eco-cash').textContent   = '$' + (ec?.cash ?? 0).toLocaleString();
  document.getElementById('eco-credit').textContent = 'Credit Score: ' + (ec?.creditScore ?? 700);
  document.getElementById('eco-gates').textContent  = '$' + (ec?.getMonthlyGateCost() ?? 0).toLocaleString();
  document.getElementById('eco-loans').textContent  = '$' + (
    (ec?.loans ?? []).filter(l => l.status === 'Active').reduce((s, l) => s + l.monthlyPayment, 0)
  ).toLocaleString();

  if (lb) {
    document.getElementById('eco-rev').textContent       = '$' + lb.totalRevenue.toLocaleString();
    document.getElementById('eco-rev-pax').textContent   = '$' + lb.revenuePassengers.toLocaleString();
    document.getElementById('eco-rev-sub').textContent   = '$' + lb.revenueSubsidiaries.toLocaleString();
    document.getElementById('eco-rev-cargo').textContent = '$' + lb.revenueCargo.toLocaleString();
    document.getElementById('eco-costs').textContent     = '$' + lb.totalCosts.toLocaleString();
    document.getElementById('eco-fuel').textContent      = '$' + lb.costFuel.toLocaleString();
    document.getElementById('eco-crew').textContent      = '$' + lb.costCrew.toLocaleString();
    document.getElementById('eco-maint').textContent     = '$' + lb.costMaintenance.toLocaleString();
  }

  document.getElementById('eco-val').textContent       = '$' + (val?.enterpriseValue ?? 0).toLocaleString();
  document.getElementById('eco-val-fleet').textContent = '$' + (val?.fleetValue ?? 0).toLocaleString();
  document.getElementById('eco-val-debt').textContent  = '$' + (val?.totalDebt ?? 0).toLocaleString();
  document.getElementById('eco-ipo').textContent       = val?.canIPO ? '¡Disponible!' : 'No (necesitas $500M)';
}

// ─────────────────────────────────────────────────────────────
//  EVENT MODAL
// ─────────────────────────────────────────────────────────────
function showEventModal(active) {
  const d = active.data;
  document.getElementById('ev-title').textContent    = d.titleES   || d.titleEN;
  document.getElementById('ev-subtitle').textContent = d.category + ' · ' + d.eventId;
  document.getElementById('ev-severity').textContent = d.severity;
  document.getElementById('ev-severity').className   = 'event-severity severity-' + d.severity;
  document.getElementById('ev-desc').textContent     = d.descriptionES || d.descriptionEN;
  document.getElementById('ev-aria').textContent     = d.ariaMessageES  || d.ariaMessageEN || 'Sin mensaje.';
  document.getElementById('ev-duration').textContent = (d.durationDays || 0) + ' días';

  const cash = d.cashImpact ?? 0;
  const rep  = d.reputationImpact ?? 0;
  const dem  = d.demandImpact ?? 0;

  const cashEl = document.getElementById('ev-cash-impact');
  cashEl.textContent = (cash < 0 ? '-' : '+') + '$' + Math.abs(cash).toLocaleString();
  cashEl.className   = 'impact-val ' + (cash < 0 ? 'neg' : cash > 0 ? 'pos' : 'neu');

  const repEl = document.getElementById('ev-rep-impact');
  repEl.textContent = (rep >= 0 ? '+' : '') + rep.toFixed(1);
  repEl.className   = 'impact-val ' + (rep < 0 ? 'neg' : rep > 0 ? 'pos' : 'neu');

  document.getElementById('ev-demand-impact').textContent  = (dem >= 0 ? '+' : '') + dem + '%';
  document.getElementById('ev-insurance-btn').style.opacity = d.hasRewardedAdOption ? '1' : '0.4';

  // Timer visual
  const timerBar = document.getElementById('event-timer-bar');
  const total    = active.timeRemainingSeconds;
  timerBar.style.width = '100%';
  if (_eventTimerInterval) clearInterval(_eventTimerInterval);

  if (d.urgency !== 'Informative' && total < 1e9) {
    const step = 100 / (total * 10);
    let pct = 100;
    _eventTimerInterval = setInterval(() => {
      pct = Math.max(0, pct - step);
      timerBar.style.width = pct + '%';
      if (pct <= 0) clearInterval(_eventTimerInterval);
    }, 100);
  }

  document.getElementById('modal-event').classList.add('open');
  if (SkyLine.game.settings.autoPause) setSpeed(0);
}

function resolveEvent(choice, optionIndex) {
  clearInterval(_eventTimerInterval);
  document.getElementById('modal-event').classList.remove('open');
  const result = SkyLine.events.resolveCurrentEvent(choice, optionIndex);
  if (result && SkyLine.game.settings.autoPause) setSpeed(1);
}

// ─────────────────────────────────────────────────────────────
//  MONTHLY REPORT MODAL
// ─────────────────────────────────────────────────────────────
function showMonthlyReport() {
  const lb = SkyLine.economy?.getLastBalance();
  if (!lb) return;

  const g         = SkyLine.game;
  const prevMonth = g.date.month === 1 ? 12 : g.date.month - 1;
  const prevYear  = g.date.month === 1 ? g.date.year - 1 : g.date.year;
  const months    = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  document.getElementById('rep-title').textContent    = `Reporte — ${months[prevMonth]} ${prevYear}`;
  document.getElementById('rep-subtitle').textContent = g.airline.airlineName;

  const fmt = n => '$' + Math.round(n).toLocaleString();
  document.getElementById('rep-rev-pax').textContent    = fmt(lb.revenuePassengers);
  document.getElementById('rep-rev-cargo').textContent  = fmt(lb.revenueCargo);
  document.getElementById('rep-rev-sub').textContent    = fmt(lb.revenueSubsidiaries);
  document.getElementById('rep-rev-total').textContent  = fmt(lb.totalRevenue);
  document.getElementById('rep-fuel').textContent       = fmt(lb.costFuel);
  document.getElementById('rep-crew').textContent       = fmt(lb.costCrew);
  document.getElementById('rep-maint').textContent      = fmt(lb.costMaintenance);
  document.getElementById('rep-gates').textContent      = fmt(lb.costGates);
  document.getElementById('rep-loans').textContent      = fmt(lb.costLoanPayments);
  document.getElementById('rep-taxes').textContent      = fmt(lb.costTaxes);
  document.getElementById('rep-cost-total').textContent = fmt(lb.totalCosts);

  const netEl = document.getElementById('rep-net');
  netEl.textContent  = fmt(lb.netProfit);
  netEl.style.color  = lb.netProfit >= 0 ? 'var(--success)' : 'var(--danger)';

  document.getElementById('modal-monthly').classList.add('open');
  setSpeed(0);
}

function closeMonthlyReport() {
  document.getElementById('modal-monthly').classList.remove('open');
  SkyLine.game?.setGameState('Playing');
  setSpeed(1);
}

// ─────────────────────────────────────────────────────────────
//  SEAT CONFIGURATION WIZARD
//  Abre antes de comprar / arrendar para personalizar cabina
// ─────────────────────────────────────────────────────────────
window._sc = null;  // estado global del wizard

function openSeatConfig(aircraftId, isLease) {
  const ac = (window.AIRCRAFT_CATALOG ?? []).find(a => a.aircraftId === aircraftId);
  if (!ac) return;

  const imgMap  = window.AIRCRAFT_IMAGES ?? {};
  const imgFile = imgMap[ac.aircraftId];
  const imgSrc  = imgFile ? `img/aviones/${imgFile}` : '';
  const total   = ac.totalSeats;

  window._sc = {
    ac,
    isLease,
    total,
    prem:     ac.seatsPremium,
    biz:      ac.seatsBusiness,
    origPrem: ac.seatsPremium,
    origBiz:  ac.seatsBusiness
  };

  const maxPrem    = Math.floor(total * 0.20);
  const maxBiz     = Math.floor(total * 0.40);
  const showSeats  = Math.min(total, 120);

  // Crear o reutilizar modal
  let modal = document.getElementById('modal-seat-config');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-seat-config';
    modal.style.cssText = [
      'position:fixed;inset:0;z-index:950;display:flex;align-items:center;',
      'justify-content:center;background:rgba(0,0,0,0.78);backdrop-filter:blur(5px)'
    ].join('');
    modal.addEventListener('click', e => { if (e.target === modal) closeSeatConfig(); });
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div id="sc-inner"
         style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;
                width:min(500px,94vw);max-height:92vh;overflow-y:auto;
                box-shadow:0 24px 64px rgba(0,0,0,0.65)">

      <!-- ── Cabecera con imagen ── -->
      <div style="border-radius:14px 14px 0 0;overflow:hidden;height:160px;
                  background:#070d18;position:relative;flex-shrink:0">
        ${imgSrc
          ? `<img src="${imgSrc}" alt="${ac.displayName}"
                  style="width:100%;height:100%;object-fit:cover;opacity:0.85">`
          : `<div style="display:flex;align-items:center;justify-content:center;
                         height:100%;font-size:3.5rem">✈</div>`}
        <div style="position:absolute;inset:0;
                    background:linear-gradient(transparent 25%,rgba(8,13,25,0.92) 100%)"></div>
        <div style="position:absolute;bottom:12px;left:14px">
          <div style="font-size:1rem;font-weight:800;color:#fff">${ac.displayName}</div>
          <div style="font-size:0.7rem;color:rgba(255,255,255,0.55)">
            ${ac.manufacturer} · ${total} asientos totales
          </div>
        </div>
        <button onclick="closeSeatConfig()"
          style="position:absolute;top:10px;right:12px;background:rgba(0,0,0,0.55);
                 border:none;color:#fff;font-size:1rem;width:28px;height:28px;
                 border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
        <span style="position:absolute;top:10px;left:12px;
                     background:${isLease ? 'rgba(59,130,246,0.75)' : 'rgba(34,197,94,0.75)'};
                     color:#fff;font-size:0.62rem;font-weight:700;padding:2px 9px;border-radius:20px">
          ${isLease ? '✦ ARRENDAMIENTO' : '✦ COMPRA'}
        </span>
      </div>

      <div style="padding:16px 18px">

        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:12px;text-align:center">
          Distribuye las clases de cabina antes de ${isLease ? 'arrendar' : 'comprar'}
        </div>

        <!-- ── Barra de cabina animada ── -->
        <div style="display:flex;border-radius:8px;overflow:hidden;height:30px;margin-bottom:12px;
                    background:var(--bg-dark)">
          <div id="sc-bar-prem"
               style="background:#f59e0b;width:0%;transition:width 0.45s ease;
                      display:flex;align-items:center;justify-content:center;overflow:hidden">
            <span id="sc-bar-prem-lbl"
                  style="font-size:0.58rem;font-weight:800;color:#000;white-space:nowrap;padding:0 4px"></span>
          </div>
          <div id="sc-bar-biz"
               style="background:#3b82f6;width:0%;transition:width 0.45s ease;
                      display:flex;align-items:center;justify-content:center;overflow:hidden">
            <span id="sc-bar-biz-lbl"
                  style="font-size:0.58rem;font-weight:800;color:#fff;white-space:nowrap;padding:0 4px"></span>
          </div>
          <div id="sc-bar-eco"
               style="background:#22c55e;flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden">
            <span id="sc-bar-eco-lbl"
                  style="font-size:0.58rem;font-weight:800;color:#000;white-space:nowrap;padding:0 4px"></span>
          </div>
        </div>

        <!-- ── Grid de asientos ── -->
        <div id="sc-grid"
             style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:14px;justify-content:center">
          ${Array.from({length: showSeats}, (_, i) =>
            `<div id="sc-seat-${i}"
                  style="width:14px;height:10px;border-radius:2px;
                         transition:background 0.35s ease;background:#22c55e"></div>`
          ).join('')}
          ${total > 120 ? `
          <div style="width:100%;text-align:center;font-size:0.62rem;
                      color:var(--text-muted);margin-top:4px">
            + ${total - 120} asientos más
          </div>` : ''}
        </div>

        <!-- ── Contadores ── -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
          <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);
                      border-radius:8px;padding:8px 6px;text-align:center">
            <div style="font-size:0.58rem;color:#f59e0b;font-weight:800;letter-spacing:0.05em;margin-bottom:2px">PRIMERA</div>
            <div id="sc-cnt-prem" style="font-size:1.15rem;font-weight:800;color:#f59e0b">0</div>
            <div style="font-size:0.55rem;color:var(--text-muted)">asientos</div>
          </div>
          <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.3);
                      border-radius:8px;padding:8px 6px;text-align:center">
            <div style="font-size:0.58rem;color:#3b82f6;font-weight:800;letter-spacing:0.05em;margin-bottom:2px">BUSINESS</div>
            <div id="sc-cnt-biz" style="font-size:1.15rem;font-weight:800;color:#3b82f6">0</div>
            <div style="font-size:0.55rem;color:var(--text-muted)">asientos</div>
          </div>
          <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);
                      border-radius:8px;padding:8px 6px;text-align:center">
            <div style="font-size:0.58rem;color:#22c55e;font-weight:800;letter-spacing:0.05em;margin-bottom:2px">ECONOMÍA</div>
            <div id="sc-cnt-eco" style="font-size:1.15rem;font-weight:800;color:#22c55e">0</div>
            <div style="font-size:0.55rem;color:var(--text-muted)">asientos</div>
          </div>
        </div>

        <!-- ── Sliders ── -->
        <div style="margin-bottom:16px">
          <!-- Primera / Premium -->
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;
                        font-size:0.7rem;margin-bottom:5px">
              <span style="color:#f59e0b;font-weight:600">✦ Primera clase</span>
              <span id="sc-lbl-prem" style="color:var(--text-muted)"></span>
            </div>
            <input type="range" id="sc-sl-prem"
                   min="0" max="${maxPrem}" value="${ac.seatsPremium}"
                   oninput="scUpdate('prem',+this.value)"
                   style="width:100%;accent-color:#f59e0b;cursor:pointer;height:4px">
            <div style="display:flex;justify-content:space-between;
                        font-size:0.58rem;color:var(--text-muted);margin-top:2px">
              <span>0</span><span>máx ${maxPrem} (20%)</span>
            </div>
          </div>
          <!-- Business -->
          <div>
            <div style="display:flex;justify-content:space-between;
                        font-size:0.7rem;margin-bottom:5px">
              <span style="color:#3b82f6;font-weight:600">◆ Business</span>
              <span id="sc-lbl-biz" style="color:var(--text-muted)"></span>
            </div>
            <input type="range" id="sc-sl-biz"
                   min="0" max="${maxBiz}" value="${ac.seatsBusiness}"
                   oninput="scUpdate('biz',+this.value)"
                   style="width:100%;accent-color:#3b82f6;cursor:pointer;height:4px">
            <div style="display:flex;justify-content:space-between;
                        font-size:0.58rem;color:var(--text-muted);margin-top:2px">
              <span>0</span><span>máx ${maxBiz} (40%)</span>
            </div>
          </div>
        </div>

        <!-- ── Resumen de costo ── -->
        <div id="sc-cost-box"
             style="background:var(--bg-dark);border-radius:8px;padding:11px 14px;
                    margin-bottom:14px;font-size:0.78rem"></div>

        <!-- ── Botón confirmar ── -->
        <button id="sc-confirm-btn"
                onclick="scConfirm('${ac.aircraftId}',${isLease})"
                style="width:100%;padding:12px;border-radius:9px;border:none;
                       background:var(--accent);color:#fff;font-size:0.85rem;
                       font-weight:700;cursor:pointer;letter-spacing:0.02em;
                       transition:opacity 0.2s"
                onmouseover="this.style.opacity='0.88'"
                onmouseout="this.style.opacity='1'">
        </button>

      </div>
    </div>
  `;

  modal.style.display = 'flex';
  scRefresh();
}

// ─────────────────────────────────────────────────────────────
//  scUpdate — llamado por oninput de los sliders
// ─────────────────────────────────────────────────────────────
function scUpdate(which, val) {
  const sc = window._sc;
  if (!sc) return;

  if (which === 'prem') sc.prem = val;
  else                  sc.biz  = val;

  // Economía mínima: 5 asientos
  const eco = sc.total - sc.prem - sc.biz;
  if (eco < 5) {
    if (which === 'prem') {
      sc.prem = Math.max(0, sc.total - sc.biz - 5);
      const sl = document.getElementById('sc-sl-prem');
      if (sl) sl.value = sc.prem;
    } else {
      sc.biz = Math.max(0, sc.total - sc.prem - 5);
      const sl = document.getElementById('sc-sl-biz');
      if (sl) sl.value = sc.biz;
    }
  }

  scRefresh();
}

// ─────────────────────────────────────────────────────────────
//  scRefresh — actualiza DOM sin tocar los sliders
// ─────────────────────────────────────────────────────────────
function scRefresh() {
  const sc = window._sc;
  if (!sc) return;

  const { total, prem, biz, isLease, origPrem, origBiz, ac } = sc;
  const eco     = total - prem - biz;
  const pct     = n => ((n / total) * 100).toFixed(1);
  const pctInt  = n => ((n / total) * 100).toFixed(0);

  // Barra animada
  const barPrem = document.getElementById('sc-bar-prem');
  const barBiz  = document.getElementById('sc-bar-biz');
  if (barPrem) barPrem.style.width = pctInt(prem) + '%';
  if (barBiz)  barBiz.style.width  = pctInt(biz)  + '%';

  const lp = document.getElementById('sc-bar-prem-lbl');
  const lb = document.getElementById('sc-bar-biz-lbl');
  const le = document.getElementById('sc-bar-eco-lbl');
  if (lp) lp.textContent = prem > 0 ? `1ª ${prem}` : '';
  if (lb) lb.textContent = biz  > 0 ? `Biz ${biz}` : '';
  if (le) le.textContent = `Eco ${eco}`;

  // Grid de asientos (hasta 120 bloques)
  const showSeats   = Math.min(total, 120);
  const dispPrem    = Math.round(prem / total * showSeats);
  const dispBiz     = Math.round(biz  / total * showSeats);
  for (let i = 0; i < showSeats; i++) {
    const el = document.getElementById(`sc-seat-${i}`);
    if (!el) continue;
    if      (i < dispPrem)             el.style.background = '#f59e0b';
    else if (i < dispPrem + dispBiz)   el.style.background = '#3b82f6';
    else                               el.style.background = '#22c55e';
  }

  // Contadores
  const cp = document.getElementById('sc-cnt-prem');
  const cb = document.getElementById('sc-cnt-biz');
  const ce = document.getElementById('sc-cnt-eco');
  if (cp) cp.textContent = prem;
  if (cb) cb.textContent = biz;
  if (ce) ce.textContent = eco;

  // Labels de sliders
  const lsPrem = document.getElementById('sc-lbl-prem');
  const lsBiz  = document.getElementById('sc-lbl-biz');
  if (lsPrem) lsPrem.textContent = `${prem} asientos (${pct(prem)}%)`;
  if (lsBiz)  lsBiz.textContent  = `${biz} asientos (${pct(biz)}%)`;

  // Costos
  const extraPrem  = Math.max(0, prem - origPrem);
  const extraBiz   = Math.max(0, biz  - origBiz);
  const reconfCost = isLease ? (extraPrem * 10_000 + extraBiz * 4_000) : 0;
  const fmt        = n => '$' + n.toLocaleString();

  const costBox = document.getElementById('sc-cost-box');
  if (costBox) {
    if (isLease) {
      const totalCost = ac.leasePricePerMonth + reconfCost;
      costBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="color:var(--text-muted)">Arriendo mensual base</span>
          <span style="color:var(--text);font-weight:600">${fmt(ac.leasePricePerMonth)}</span>
        </div>
        ${reconfCost > 0 ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="color:var(--text-muted)">Reconfiguración (${extraPrem > 0 ? '+'+extraPrem+' 1ª ' : ''}${extraBiz > 0 ? '+'+extraBiz+' Biz' : ''})</span>
          <span style="color:#f59e0b;font-weight:600">${fmt(reconfCost)}</span>
        </div>` : ''}
        <div style="border-top:1px solid var(--border);margin-top:6px;padding-top:7px;
                    display:flex;justify-content:space-between">
          <span style="font-weight:700;color:var(--text)">Pago inicial</span>
          <span style="font-weight:800;color:var(--accent)">${fmt(reconfCost > 0 ? ac.leasePricePerMonth + reconfCost : ac.leasePricePerMonth)}</span>
        </div>
        <div style="font-size:0.65rem;color:var(--text-muted);margin-top:4px">
          Luego: ${fmt(ac.leasePricePerMonth)}/mes
        </div>
      `;
      const btn = document.getElementById('sc-confirm-btn');
      if (btn) btn.textContent = `Arrendar — Pagar ${fmt(ac.leasePricePerMonth + reconfCost)}`;
    } else {
      costBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="color:var(--text-muted)">Precio de compra</span>
          <span style="font-weight:700;color:var(--text)">${fmt(ac.purchasePrice)}</span>
        </div>
        <div style="font-size:0.65rem;color:var(--text-muted);margin-top:4px">
          ✓ La personalización de cabina es gratuita al comprar
        </div>
      `;
      const btn = document.getElementById('sc-confirm-btn');
      if (btn) btn.textContent = `Comprar — ${fmt(ac.purchasePrice)}`;
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  closeSeatConfig — cierra el wizard
// ─────────────────────────────────────────────────────────────
function closeSeatConfig() {
  const modal = document.getElementById('modal-seat-config');
  if (modal) modal.style.display = 'none';
  window._sc = null;
}

// ─────────────────────────────────────────────────────────────
//  scConfirm — ejecuta la compra/arriendo con asientos custom
// ─────────────────────────────────────────────────────────────
function scConfirm(aircraftId, isLease) {
  const sc = window._sc;
  if (!sc) return;

  const g   = SkyLine.game;
  const ec  = SkyLine.economy;
  const ac  = sc.ac;
  const hub = g?.airline?.hubAirports?.[0] ?? 'ORD';

  const { prem, biz, origPrem, origBiz } = sc;
  const eco         = sc.total - prem - biz;
  const extraPrem   = Math.max(0, prem - origPrem);
  const extraBiz    = Math.max(0, biz  - origBiz);
  const reconfCost  = isLease ? (extraPrem * 10_000 + extraBiz * 4_000) : 0;
  const customSeats = { prem, biz, eco };

  if (isLease) {
    const firstPayment = ac.leasePricePerMonth + reconfCost;
    if (!ec.deductExpense(firstPayment,
          `Arriendo${reconfCost > 0 ? ' + reconf.' : ''} ${ac.displayName}`)) {
      showToast('Fondos insuficientes para arrendar.', 'danger');
      return;
    }
    g.addAircraftToFleet(aircraftId, hub, true, ac.leasePricePerMonth, customSeats);
    showToast(`${ac.displayName} arrendado con cabina personalizada. ✓`, 'success');
  } else {
    if (!ec.deductExpense(ac.purchasePrice, `Compra ${ac.displayName}`)) {
      showToast('Fondos insuficientes para comprar.', 'danger');
      return;
    }
    g.addAircraftToFleet(aircraftId, hub, false, 0, customSeats);
    showToast(`${ac.displayName} comprado con cabina personalizada. ✓`, 'success');
  }

  closeSeatConfig();
  closeAircraftDetail();
  renderMarketTab();
  renderFleetTab();
  updateHUDCash();
}

// ═══════════════════════════════════════════════════════════════
//  ROUTE MANAGEMENT — Programación semanal + Pausa + Cancelación
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  MODAL DE PROGRAMACIÓN SEMANAL
// ─────────────────────────────────────────────────────────────
window._rs = null;  // { routeId, route, schedule[], acData }

function openRouteSchedule(routeId) {
  const route = (SkyLine.game?.routes ?? []).find(r => r.routeId === routeId);
  if (!route) return;

  // Datos del avión
  const fleetEntry = (SkyLine.game?.fleet ?? []).find(f => f.aircraftId === route.assignedAircraftId);
  const acData = (window.AIRCRAFT_CATALOG ?? []).find(a => a.aircraftId === fleetEntry?.aircraftDataId);

  // Copiar horario actual (o inferir del flightsPerWeek)
  const curSched = route.schedule ?? Array.from({length:7}, (_, i) => {
    const b = Math.floor(route.flightsPerWeek / 7);
    const e = route.flightsPerWeek % 7;
    return b + (i < e ? 1 : 0);
  });

  window._rs = { routeId, route, schedule: [...curSched], acData };

  const DAY_NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const MAX_PER_DAY = 4;

  let modal = document.getElementById('modal-route-schedule');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-route-schedule';
    modal.style.cssText = 'position:fixed;inset:0;z-index:955;display:flex;align-items:center;' +
                          'justify-content:center;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px)';
    modal.addEventListener('click', e => { if (e.target === modal) closeRouteSchedule(); });
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:13px;
                width:min(440px,96vw);max-height:90vh;overflow-y:auto;
                box-shadow:0 20px 60px rgba(0,0,0,0.62)">

      <!-- Header -->
      <div style="padding:14px 16px;border-bottom:1px solid var(--border);
                  display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:0.95rem;font-weight:800;color:var(--text)">
            ✦ ${route.originIATA} → ${route.destinationIATA}
          </div>
          <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px">
            Programar vuelos semanales${acData ? ' · ' + acData.displayName : ''}
          </div>
        </div>
        <button onclick="closeRouteSchedule()"
          style="background:rgba(255,255,255,0.07);border:none;color:var(--text-muted);
                 width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:0.85rem">✕</button>
      </div>

      <div style="padding:16px 18px">

        <!-- Leyenda de colores -->
        <div style="display:flex;gap:10px;margin-bottom:14px;font-size:0.62rem;color:var(--text-muted);justify-content:center">
          <span><span style="display:inline-block;width:10px;height:8px;background:#22c55e;border-radius:2px;margin-right:3px"></span>1–2</span>
          <span><span style="display:inline-block;width:10px;height:8px;background:#3b82f6;border-radius:2px;margin-right:3px"></span>3</span>
          <span><span style="display:inline-block;width:10px;height:8px;background:#f59e0b;border-radius:2px;margin-right:3px"></span>4 (máx)</span>
          <span><span style="display:inline-block;width:10px;height:8px;background:var(--bg-dark);border:1px solid var(--border);border-radius:2px;margin-right:3px"></span>sin vuelo</span>
        </div>

        <!-- Grid de 7 días -->
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:16px">
          ${DAY_NAMES.map((day, i) => `
            <div style="text-align:center">
              <div style="font-size:0.62rem;color:var(--text-muted);font-weight:700;
                          margin-bottom:5px;letter-spacing:0.04em">${day}</div>
              <!-- Contenedor de barra (grows from bottom) -->
              <div style="height:72px;background:var(--bg-dark);border-radius:5px 5px 0 0;
                          overflow:hidden;display:flex;align-items:flex-end">
                <div id="rs-bar-${i}"
                     style="width:100%;border-radius:5px 5px 0 0;
                            transition:height 0.35s ease,background 0.25s ease;
                            height:0px"></div>
              </div>
              <!-- Contador -->
              <div id="rs-cnt-${i}"
                   style="font-size:0.92rem;font-weight:800;color:var(--text-muted);
                          padding:4px 0;background:var(--bg-dark);border-bottom:1px solid var(--border)">
                0
              </div>
              <!-- Botones +/- -->
              <div style="display:flex">
                <button onclick="rsDay(${i},1)"
                  style="flex:1;padding:5px 0;border-radius:0 0 0 5px;
                         border:1px solid var(--border);border-top:none;
                         background:rgba(59,130,246,0.08);color:var(--accent);
                         font-size:1rem;font-weight:700;cursor:pointer;transition:background 0.15s"
                  onmouseover="this.style.background='rgba(59,130,246,0.18)'"
                  onmouseout="this.style.background='rgba(59,130,246,0.08)'">+</button>
                <button onclick="rsDay(${i},-1)"
                  style="flex:1;padding:5px 0;border-radius:0 0 5px 0;
                         border:1px solid var(--border);border-top:none;border-left:none;
                         background:rgba(239,68,68,0.06);color:var(--danger);
                         font-size:1rem;font-weight:700;cursor:pointer;transition:background 0.15s"
                  onmouseover="this.style.background='rgba(239,68,68,0.16)'"
                  onmouseout="this.style.background='rgba(239,68,68,0.06)'">−</button>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Resumen -->
        <div id="rs-summary"
             style="background:var(--bg-dark);border-radius:8px;padding:10px 14px;
                    margin-bottom:14px;font-size:0.78rem"></div>

        <!-- Botones de acción -->
        <div style="display:flex;gap:8px">
          <button onclick="closeRouteSchedule()"
            style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);
                   background:transparent;color:var(--text-muted);font-size:0.78rem;cursor:pointer">
            Cancelar
          </button>
          <button id="rs-confirm-btn" onclick="rsConfirm('${routeId}')"
            style="flex:2;padding:10px;border-radius:8px;border:none;
                   background:var(--accent);color:#fff;font-size:0.8rem;
                   font-weight:700;cursor:pointer;letter-spacing:0.02em">
            ✓ Aplicar cambios
          </button>
        </div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
  rsRefresh();
}

function rsDay(day, delta) {
  const rs = window._rs;
  if (!rs) return;
  rs.schedule[day] = Math.max(0, Math.min(4, rs.schedule[day] + delta));
  rsRefresh();
}

function rsRefresh() {
  const rs = window._rs;
  if (!rs) return;
  const { schedule, route, acData } = rs;
  const total = schedule.reduce((a, b) => a + b, 0);

  const barColor = n => {
    if (n === 0) return 'transparent';
    if (n <= 2)  return '#22c55e';
    if (n === 3) return '#3b82f6';
    return '#f59e0b';
  };

  // Actualizar barras y contadores
  schedule.forEach((n, i) => {
    const barEl = document.getElementById(`rs-bar-${i}`);
    const cntEl = document.getElementById(`rs-cnt-${i}`);
    if (barEl) {
      barEl.style.height     = n > 0 ? Math.max(8, Math.round(n / 4 * 72)) + 'px' : '0px';
      barEl.style.background = barColor(n);
    }
    if (cntEl) {
      cntEl.textContent  = n;
      cntEl.style.color  = n > 0 ? 'var(--text)' : 'var(--text-muted)';
      cntEl.style.fontWeight = n > 0 ? '800' : '400';
    }
  });

  // Resumen
  const sumEl = document.getElementById('rs-summary');
  if (!sumEl) return;

  let estRevStr = '';
  if (acData && SkyLine.economy && total > 0) {
    try {
      const rev = SkyLine.economy.calculateFlightRevenue(
        acData.seatsEconomy, acData.seatsBusiness, acData.seatsPremium,
        route.currentOccupancy, route.demandMultiplier,
        route.baseFareEconomy, route.baseFareBusiness,
        route.baseFarePremium, route.distanceKm
      );
      const weekly = rev * total * 2; // *2 ida+vuelta
      estRevStr = `<span style="color:var(--text-muted)">Est. ingresos/sem: </span>` +
                  `<strong style="color:var(--accent)">$${Math.round(weekly).toLocaleString()}</strong>`;
    } catch(e) { /* sin economía → silencioso */ }
  }

  sumEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <span style="color:var(--text-muted)">Total vuelos/semana: </span>
        <strong style="color:${total===0?'var(--danger)':'var(--text)'}">${total}</strong>
        ${total === 0 ? '<span style="color:var(--danger);font-size:0.68rem;margin-left:6px">⚠ sin vuelos</span>' : ''}
      </div>
      ${estRevStr ? `<div>${estRevStr}</div>` : ''}
    </div>
    <div style="font-size:0.65rem;color:var(--text-muted);margin-top:3px">
      Distribución: ${schedule.map((n,i)=>n>0?['L','M','X','J','V','S','D'][i]+'×'+n:'').filter(Boolean).join('  ') || '—'}
    </div>
  `;
}

function rsConfirm(routeId) {
  const rs = window._rs;
  if (!rs) return;
  const total = rs.schedule.reduce((a, b) => a + b, 0);
  if (total === 0) {
    showToast('No puedes programar 0 vuelos/semana. Usa ⏸ Pausar en su lugar.', 'warning');
    return;
  }
  SkyLine.game.updateRouteSchedule(routeId, rs.schedule);
  closeRouteSchedule();
  renderRoutesTab();
  showToast(`Horario actualizado: ${total} vuelos/semana. ✓`, 'success');
}

function closeRouteSchedule() {
  const modal = document.getElementById('modal-route-schedule');
  if (modal) modal.style.display = 'none';
  window._rs = null;
}

// ─────────────────────────────────────────────────────────────
//  MODAL DE PAUSA DE RUTA
// ─────────────────────────────────────────────────────────────
window._prRouteId = null;

function showPauseRoute(routeId) {
  const route = (SkyLine.game?.routes ?? []).find(r => r.routeId === routeId);
  if (!route) return;
  window._prRouteId = routeId;

  let modal = document.getElementById('modal-pause-route');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-pause-route';
    modal.style.cssText = 'position:fixed;inset:0;z-index:960;display:flex;align-items:center;' +
                          'justify-content:center;background:rgba(0,0,0,0.72);backdrop-filter:blur(3px)';
    modal.addEventListener('click', e => { if (e.target === modal) closePauseModal(); });
    document.body.appendChild(modal);
  }

  const REASONS = [
    ['manual',     '⏸ Pausa manual',       'Por decisión propia, sin fecha específica'],
    ['seasonal',   '🌦 Temporada baja',     'La ruta se suspende por baja demanda estacional'],
    ['low_demand', '📉 Baja demanda',       'Ocupación insuficiente para ser rentable']
  ];

  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;
                width:min(360px,94vw);box-shadow:0 16px 48px rgba(0,0,0,0.55)">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border);
                  display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:0.88rem;font-weight:700;color:var(--text)">
          ⏸ Pausar ${route.originIATA} → ${route.destinationIATA}
        </div>
        <button onclick="closePauseModal()"
          style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.9rem">✕</button>
      </div>
      <div style="padding:14px 16px 18px">
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px">
          Motivo de la pausa:
        </div>
        ${REASONS.map(([val, label, desc], idx) => `
          <label style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;
                        border-radius:7px;cursor:pointer;margin-bottom:5px;
                        border:1px solid var(--border);background:var(--bg-dark)"
                 onmouseover="this.style.background='var(--bg-hover)'"
                 onmouseout="this.style.background='var(--bg-dark)'">
            <input type="radio" name="pr-reason" value="${val}" ${idx===0?'checked':''}
                   style="margin-top:3px;accent-color:var(--accent)">
            <div>
              <div style="font-size:0.78rem;font-weight:600;color:var(--text)">${label}</div>
              <div style="font-size:0.67rem;color:var(--text-muted);margin-top:1px">${desc}</div>
            </div>
          </label>
        `).join('')}
        <div style="font-size:0.67rem;color:var(--text-muted);margin:10px 0 14px;
                    padding:8px 10px;background:rgba(245,158,11,0.06);border-radius:6px;
                    border-left:2px solid #f59e0b">
          ⚠ El avión quedará libre para asignarse a otras rutas. Al reanudar deberás seleccionar uno.
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="closePauseModal()"
            style="flex:1;padding:9px;border-radius:7px;border:1px solid var(--border);
                   background:transparent;color:var(--text-muted);font-size:0.78rem;cursor:pointer">
            Cancelar
          </button>
          <button onclick="confirmPauseRoute('${routeId}')"
            style="flex:1;padding:9px;border-radius:7px;border:none;
                   background:#f59e0b;color:#000;font-size:0.78rem;
                   font-weight:700;cursor:pointer">
            ⏸ Pausar ruta
          </button>
        </div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}

function closePauseModal() {
  const modal = document.getElementById('modal-pause-route');
  if (modal) modal.style.display = 'none';
  window._prRouteId = null;
}

function confirmPauseRoute(routeId) {
  const reason = document.querySelector('input[name="pr-reason"]:checked')?.value ?? 'manual';
  SkyLine.game.pauseRoute(routeId, reason);
  closePauseModal();
  renderRoutesTab();
  updateHUDFleetRoutes();
  const route = (SkyLine.game?.routes ?? []).find(r => r.routeId === routeId);
  const label = route ? `${route.originIATA} → ${route.destinationIATA}` : '';
  const REASON_LABELS = { manual:'pausada', seasonal:'marcada como estacional', low_demand:'pausada por baja demanda' };
  showToast(`Ruta ${label} ${REASON_LABELS[reason] ?? 'pausada'}. Avión liberado.`, 'warning');
}

// ─────────────────────────────────────────────────────────────
//  MODAL DE REANUDACIÓN DE RUTA
// ─────────────────────────────────────────────────────────────
window._rrRouteId = null;

function showResumeRoute(routeId) {
  const route = (SkyLine.game?.routes ?? []).find(r => r.routeId === routeId);
  if (!route) return;
  window._rrRouteId = routeId;

  // Flota operativa (cualquier avión, ya tenga rutas asignadas o no)
  const availableFleet = (SkyLine.game?.fleet ?? []).filter(f => f.isOperational);

  let modal = document.getElementById('modal-resume-route');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-resume-route';
    modal.style.cssText = 'position:fixed;inset:0;z-index:960;display:flex;align-items:center;' +
                          'justify-content:center;background:rgba(0,0,0,0.72);backdrop-filter:blur(3px)';
    modal.addEventListener('click', e => { if (e.target === modal) closeResumeModal(); });
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;
                width:min(380px,94vw);box-shadow:0 16px 48px rgba(0,0,0,0.55)">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border);
                  display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:0.88rem;font-weight:700;color:var(--text)">
          ▶ Reanudar ${route.originIATA} → ${route.destinationIATA}
        </div>
        <button onclick="closeResumeModal()"
          style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.9rem">✕</button>
      </div>
      <div style="padding:14px 16px 18px">
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px">
          Selecciona la aeronave que operará esta ruta:
        </div>
        ${availableFleet.length === 0 ? `
          <div style="text-align:center;padding:16px;font-size:0.78rem;color:var(--text-muted)">
            Sin flota operativa. Compra una aeronave en el Mercado primero.
          </div>
        ` : `
          <select id="rr-aircraft-select"
            style="width:100%;padding:8px 10px;border-radius:7px;border:1px solid var(--border);
                   background:var(--bg-dark);color:var(--text);font-size:0.8rem;margin-bottom:12px">
            <option value="">— Seleccionar aeronave —</option>
            ${availableFleet.map(f => {
              const ac        = (window.AIRCRAFT_CATALOG ?? []).find(a => a.aircraftId === f.aircraftDataId);
              const rutasCnt  = (SkyLine.game?.routes ?? []).filter(r => r.assignedAircraftId === f.aircraftId && r.isActive).length;
              const rutasTag  = rutasCnt > 0 ? ` · ${rutasCnt} ruta${rutasCnt > 1 ? 's' : ''}` : '';
              return `<option value="${f.aircraftId}">
                ${f.tailNumber} — ${f.aircraftDataId}${ac ? ' (' + ac.totalSeats + ' asientos, ' + ac.rangeKm.toLocaleString() + ' km)' : ''}${rutasTag}
              </option>`;
            }).join('')}
          </select>
        `}
        <div style="display:flex;gap:8px">
          <button onclick="closeResumeModal()"
            style="flex:1;padding:9px;border-radius:7px;border:1px solid var(--border);
                   background:transparent;color:var(--text-muted);font-size:0.78rem;cursor:pointer">
            Cancelar
          </button>
          ${availableFleet.length > 0 ? `
          <button onclick="confirmResumeRoute('${routeId}')"
            style="flex:1;padding:9px;border-radius:7px;border:none;
                   background:#22c55e;color:#000;font-size:0.78rem;
                   font-weight:700;cursor:pointer">
            ▶ Reanudar ruta
          </button>` : ''}
        </div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}

function closeResumeModal() {
  const modal = document.getElementById('modal-resume-route');
  if (modal) modal.style.display = 'none';
  window._rrRouteId = null;
}

function confirmResumeRoute(routeId) {
  const aircraftId = document.getElementById('rr-aircraft-select')?.value;
  if (!aircraftId) {
    showToast('Selecciona una aeronave para reanudar la ruta.', 'warning');
    return;
  }
  const ok = SkyLine.game.resumeRoute(routeId, aircraftId);
  if (!ok) {
    showToast('No se pudo reanudar la ruta. El avión puede ya estar ocupado.', 'danger');
    return;
  }
  closeResumeModal();
  renderRoutesTab();
  updateHUDFleetRoutes();
  const route = (SkyLine.game?.routes ?? []).find(r => r.routeId === routeId);
  const label = route ? `${route.originIATA} → ${route.destinationIATA}` : '';
  showToast(`Ruta ${label} reanudada. ✓`, 'success');
}

// ─────────────────────────────────────────────────────────────
//  MODAL DE CANCELACIÓN DE RUTA
// ─────────────────────────────────────────────────────────────
function cancelRouteUI(routeId) {
  const route = (SkyLine.game?.routes ?? []).find(r => r.routeId === routeId);
  if (!route) return;

  let modal = document.getElementById('modal-confirm-cancel-route');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-confirm-cancel-route';
    modal.style.cssText = 'position:fixed;inset:0;z-index:965;display:flex;align-items:center;' +
                          'justify-content:center;background:rgba(0,0,0,0.78);backdrop-filter:blur(3px)';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;
                width:min(320px,90vw);text-align:center;box-shadow:0 16px 48px rgba(0,0,0,0.6)">
      <div style="padding:22px 20px">
        <div style="font-size:2rem;margin-bottom:8px">⚠️</div>
        <div style="font-size:0.92rem;font-weight:700;color:var(--text);margin-bottom:6px">
          ¿Cancelar ruta?
        </div>
        <div style="font-size:0.88rem;font-weight:800;color:var(--accent);margin-bottom:8px">
          ${route.originIATA} → ${route.destinationIATA}
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:18px">
          Esta acción es <strong>permanente</strong>. El avión asignado quedará disponible.
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="document.getElementById('modal-confirm-cancel-route').style.display='none'"
            style="flex:1;padding:9px;border-radius:7px;border:1px solid var(--border);
                   background:transparent;color:var(--text);font-size:0.8rem;cursor:pointer">
            Conservar
          </button>
          <button onclick="doCloseRoute('${routeId}')"
            style="flex:1;padding:9px;border-radius:7px;border:none;
                   background:var(--danger);color:#fff;font-size:0.8rem;
                   font-weight:700;cursor:pointer">
            Cancelar ruta
          </button>
        </div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}

function doCloseRoute(routeId) {
  const route = (SkyLine.game?.routes ?? []).find(r => r.routeId === routeId);
  const label = route ? `${route.originIATA} → ${route.destinationIATA}` : '';
  SkyLine.game.closeRoute(routeId);
  document.getElementById('modal-confirm-cancel-route').style.display = 'none';
  renderRoutesTab();
  updateHUDFleetRoutes();
  showToast(`Ruta ${label} cancelada permanentemente.`, 'info');
}

// ═══════════════════════════════════════════════════════════════
//  FLIGHTS / HORARIO TAB — Horario de vuelos diario
// ═══════════════════════════════════════════════════════════════

window._flightDay           = undefined;  // undefined = auto-select today
window._flightsRefreshTimer = null;

function renderFlightsTab() {
  const game        = SkyLine.game;
  const routes      = game?.routes ?? [];
  const activeRoutes = routes.filter(r => r.isActive && !r.isPaused);

  const listEl    = document.getElementById('flights-list');
  const daySelEl  = document.getElementById('flights-day-selector');
  const emptyEl   = document.getElementById('flights-empty');

  if (!listEl) return;

  // ── Día actual de juego (0=Lun … 6=Dom) ──────────────────────
  const gameDate  = game?.date;
  const todayDow  = gameDate
    ? (new Date(gameDate.year, gameDate.month - 1, gameDate.day).getDay() + 6) % 7
    : 0;

  if (window._flightDay === undefined || window._flightDay === null)
    window._flightDay = todayDow;

  const selectedDay = window._flightDay;
  const DAY_SHORT   = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

  // ── Selector de día ──────────────────────────────────────────
  if (daySelEl) {
    daySelEl.innerHTML = `
      <div style="display:flex;gap:3px;margin-bottom:10px">
        ${DAY_SHORT.map((d, i) => {
          const isToday    = i === todayDow;
          const isSelected = i === selectedDay;
          return `
            <button onclick="window._flightDay=${i};renderFlightsTab()"
              style="flex:1;padding:5px 1px;border-radius:6px;font-size:0.62rem;font-weight:700;
                     cursor:pointer;letter-spacing:0.01em;border:1px solid var(--border);
                     background:${isSelected ? 'var(--accent)' : 'var(--bg-dark)'};
                     color:${isSelected ? '#fff' : 'var(--text-muted)'};
                     ${isToday && !isSelected ? 'box-shadow:0 0 0 1px var(--accent);' : ''}
                     transition:all 0.15s;text-align:center;line-height:1.3">
              ${d}${isToday ? '<br><span style="display:block;width:4px;height:4px;background:var(--success);border-radius:50%;margin:0 auto"></span>' : ''}
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  // ── Sin rutas activas ─────────────────────────────────────────
  if (activeRoutes.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  // ── Progreso del día actual (para estado en-vuelo) ────────────
  const dayProgress  = (game?._dayDuration > 0 && game?._dayTimer != null)
    ? game._dayTimer / game._dayDuration
    : null;
  const currentHour  = (dayProgress !== null && selectedDay === todayDow)
    ? 6 + dayProgress * 16   // 06:00 → 22:00
    : null;

  const iataCode = game?.airline?.iataCode ?? 'SK';

  // ── Generar lista de vuelos para el día seleccionado ──────────
  const flights = [];
  let flightNum = 1;

  activeRoutes.forEach(route => {
    const flightsToday = route.schedule?.[selectedDay] ?? 0;
    if (flightsToday === 0) return;

    // FIX: buscar por tailNumber (assignedAircraftId almacena el tail, no un id interno)
    const fleetEntry  = (game?.fleet ?? []).find(f => f.tailNumber === route.assignedAircraftId);
    const acData      = (window.AIRCRAFT_CATALOG ?? []).find(a => a.aircraftId === fleetEntry?.aircraftDataId);
    const cruiseSpeed = acData?.cruiseSpeedKmh ?? 850;
    const durationH   = route.distanceKm / cruiseSpeed;

    // Asientos efectivos (personalizados o del catálogo)
    const seatsEco   = fleetEntry?.seatsEconomy  ?? acData?.seatsEconomy  ?? 150;
    const seatsBiz   = fleetEntry?.seatsBusiness ?? acData?.seatsBusiness ?? 20;
    const seatsPrem  = fleetEntry?.seatsPremium  ?? acData?.seatsPremium  ?? 0;
    const totalSeats = seatsEco + seatsBiz + (seatsPrem ?? 0);
    const baseOccupancy = route.currentOccupancy ?? 0.65;

    // FIX: usar horas del dayPlan si existen; si no, distribuir uniformemente
    const plannedHours = route.dayPlan?.[selectedDay];
    const depHours = (plannedHours?.length > 0)
      ? plannedHours
      : Array.from({ length: flightsToday }, (_, i) => 6 + (i / Math.max(1, flightsToday)) * 16);

    depHours.forEach((depHour, i) => {
      const arrHour = depHour + durationH;

      // Multiplicador de demanda por hora del día (realismo: mañana y noche = más llenos)
      const _h = depHour % 24;
      const timeMult = (_h >= 7 && _h <= 9)   ? 1.20   // mañana pico
                     : (_h >= 17 && _h <= 20)  ? 1.15   // tarde pico
                     : (_h >= 11 && _h <= 14)  ? 0.80   // mediodía valle
                     : (_h >= 21 || _h <= 5)   ? 0.60   // noche / madrugada
                     : 0.90;                             // resto
      const occupancy  = Math.min(1, baseOccupancy * timeMult);

      const passengers = Math.round(totalSeats * occupancy);

      // Vuelo de ida
      flights.push({
        flightNum:  iataCode + String(flightNum).padStart(3, '0'),
        routeId:    route.routeId,
        origin:     route.originIATA,
        dest:       route.destinationIATA,
        depHour, arrHour, durationH,
        passengers, totalSeats,
        seatsEco, seatsBiz, seatsPrem,
        tailNumber: fleetEntry?.tailNumber ?? '—',
        model:      fleetEntry?.aircraftDataId ?? '—',
        occupancy,
        distanceKm: route.distanceKm,
        isReturn:   false,
        timeMult
      });
      flightNum++;

      // Vuelo de regreso (turnaround de 30 min) — demanda basada en hora de llegada al origen
      const retDepHour = arrHour + 0.5;
      const retArrHour = retDepHour + durationH;
      const _rh = retDepHour % 24;
      const retTimeMult = (_rh >= 7 && _rh <= 9)   ? 1.20
                        : (_rh >= 17 && _rh <= 20)  ? 1.15
                        : (_rh >= 11 && _rh <= 14)  ? 0.80
                        : (_rh >= 21 || _rh <= 5)   ? 0.60
                        : 0.90;
      const retOccupancy  = Math.min(1, baseOccupancy * retTimeMult);
      const retPassengers = Math.round(totalSeats * retOccupancy);

      flights.push({
        flightNum:  iataCode + String(flightNum).padStart(3, '0'),
        routeId:    route.routeId,
        origin:     route.destinationIATA,
        dest:       route.originIATA,
        depHour:    retDepHour,
        arrHour:    retArrHour,
        durationH,
        passengers: retPassengers, totalSeats,
        seatsEco, seatsBiz, seatsPrem,
        tailNumber: fleetEntry?.tailNumber ?? '—',
        model:      fleetEntry?.aircraftDataId ?? '—',
        occupancy:  retOccupancy,
        distanceKm: route.distanceKm,
        isReturn:   true,
        timeMult:   retTimeMult
      });
      flightNum++;
    });
  });

  // Ordenar por hora de salida
  flights.sort((a, b) => a.depHour - b.depHour);

  // ── Helpers de formato ────────────────────────────────────────
  const fmtTime = h => {
    const hh = Math.floor(h) % 24;
    const mm = Math.round((h % 1) * 60);
    return String(hh).padStart(2,'0') + ':' + String(mm).padStart(2,'0');
  };
  const fmtDur = h => {
    if (h < 1) return Math.round(h * 60) + ' min';
    const hrs = Math.floor(h);
    const min = Math.round((h % 1) * 60);
    return hrs + 'h' + (min > 0 ? ' ' + min + 'm' : '');
  };

  // ── Resumen del día ───────────────────────────────────────────
  let dayHtml = '';
  if (flights.length > 0) {
    const totalPax  = flights.reduce((s, f) => s + f.passengers, 0);
    const legCount  = flights.length;   // incluye ida + regreso
    dayHtml = `
      <div style="display:flex;justify-content:space-around;padding:8px 4px 10px;
                  font-size:0.68rem;color:var(--text-muted);border-bottom:1px solid var(--border);margin-bottom:10px">
        <div style="text-align:center">
          <div style="font-size:1rem;font-weight:800;color:var(--text)">${legCount}</div>
          <div>tramos</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:1rem;font-weight:800;color:var(--text)">${totalPax.toLocaleString()}</div>
          <div>pasajeros</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:1rem;font-weight:800;color:var(--text)">${activeRoutes.length}</div>
          <div>rutas</div>
        </div>
      </div>
    `;
  }

  // ── Tarjetas de vuelo ─────────────────────────────────────────
  let cardsHtml = '';
  if (flights.length === 0) {
    cardsHtml = `
      <div style="text-align:center;padding:20px;font-size:0.78rem;color:var(--text-muted)">
        Sin vuelos programados para el ${DAY_SHORT[selectedDay]}.
      </div>
    `;
  } else {
    cardsHtml = flights.map(f => {
      // Estado del vuelo
      let statusLabel = '⏱ Programado';
      let statusColor = 'var(--text-muted)';
      let leftBorder  = f.isReturn ? 'var(--border-light)' : 'var(--border)';
      let progressBar = '';

      if (currentHour !== null) {
        if (currentHour > f.arrHour) {
          statusLabel = '✓ Aterrizado';
          statusColor = 'var(--success)';
          leftBorder  = 'var(--success)';
        } else if (currentHour >= f.depHour) {
          const pct = Math.min(100, Math.round(((currentHour - f.depHour) / f.durationH) * 100));
          statusLabel = `✈ En vuelo (${pct}%)`;
          statusColor = f.isReturn ? '#06b6d4' : '#3b82f6';
          leftBorder  = f.isReturn ? '#06b6d4' : '#3b82f6';
          progressBar = `
            <div style="height:3px;background:var(--bg-dark);border-radius:2px;margin:6px 0 4px">
              <div style="width:${pct}%;height:100%;background:${f.isReturn ? '#06b6d4' : '#3b82f6'};border-radius:2px;
                          transition:width 2s linear;box-shadow:0 0 6px ${f.isReturn ? '#06b6d466' : '#3b82f688'}"></div>
            </div>
          `;
        } else {
          const minsToDepart = Math.round((f.depHour - currentHour) * 60);
          statusLabel = minsToDepart < 60 ? `⏱ En ${minsToDepart} min` : '⏱ Programado';
        }
      }

      // Seat class icons
      const classIcons = [
        f.seatsPrem > 0 ? `<span title="Primera: ${f.seatsPrem}" style="color:#f59e0b">✦${f.seatsPrem}</span>` : '',
        f.seatsBiz  > 0 ? `<span title="Business: ${f.seatsBiz}" style="color:#3b82f6">◆${f.seatsBiz}</span>` : '',
        `<span title="Economía: ${f.seatsEco}" style="color:#22c55e">●${f.seatsEco}</span>`
      ].filter(Boolean).join(' ');

      // Badge de regreso
      const returnBadge = f.isReturn
        ? `<span style="font-size:0.58rem;color:#06b6d4;background:rgba(6,182,212,0.12);
                        padding:1px 5px;border-radius:3px;margin-left:4px;font-weight:700">↩ REGRESO</span>`
        : '';

      // Badge de hora pico / valle
      const tm = f.timeMult ?? 1.0;
      const peakBadge = tm >= 1.15
        ? `<span title="Hora pico — alta demanda" style="font-size:0.55rem;color:#4ade80;background:rgba(74,222,128,0.12);
                        padding:1px 5px;border-radius:3px;margin-left:4px">🟢 PICO</span>`
        : tm <= 0.65
        ? `<span title="Hora baja — poca demanda" style="font-size:0.55rem;color:#9ca3af;background:rgba(156,163,175,0.12);
                        padding:1px 5px;border-radius:3px;margin-left:4px">🔵 BAJO</span>`
        : '';

      return `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:9px;
                    padding:10px 12px;margin-bottom:7px;border-left:3px solid ${leftBorder};
                    ${f.isReturn ? 'opacity:0.88' : ''}">

          <!-- Cabecera: Nro vuelo + estado -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:0.72rem;font-weight:800;color:${f.isReturn ? '#06b6d4' : 'var(--accent)'};
                           letter-spacing:0.1em;background:${f.isReturn ? 'rgba(6,182,212,0.12)' : 'rgba(30,125,230,0.12)'};
                           padding:2px 6px;border-radius:4px">
                ${f.flightNum}
              </span>
              <span style="font-size:0.85rem;font-weight:800;color:var(--text)">
                ${f.origin} → ${f.dest}
              </span>
              ${returnBadge}
              ${peakBadge}
            </div>
            <span style="font-size:0.62rem;font-weight:600;color:${statusColor}">${statusLabel}</span>
          </div>

          <!-- Itinerario: Origen - duración - Destino -->
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <div style="text-align:center;min-width:40px">
              <div style="font-size:1.1rem;font-weight:800;color:var(--text);letter-spacing:-0.02em">${fmtTime(f.depHour)}</div>
              <div style="font-size:0.6rem;color:var(--text-muted);font-weight:600">${f.origin}</div>
            </div>
            <div style="flex:1;text-align:center">
              <div style="font-size:0.6rem;color:var(--text-muted)">${fmtDur(f.durationH)} · ${f.distanceKm.toLocaleString()} km</div>
              <div style="height:1px;background:var(--border-light);position:relative;margin:3px 0">
                <span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                             background:var(--bg-card);padding:0 3px;font-size:0.6rem">✈</span>
              </div>
            </div>
            <div style="text-align:center;min-width:40px">
              <div style="font-size:1.1rem;font-weight:800;color:var(--text);letter-spacing:-0.02em">${fmtTime(f.arrHour)}</div>
              <div style="font-size:0.6rem;color:var(--text-muted);font-weight:600">${f.dest}</div>
            </div>
          </div>

          ${progressBar}

          <!-- Footer: pax + clases + avión -->
          <div style="display:flex;justify-content:space-between;align-items:center;
                      font-size:0.63rem;color:var(--text-muted);margin-top:4px;flex-wrap:wrap;gap:3px">
            <div>
              👥 <strong style="color:var(--text)">${f.passengers.toLocaleString()}</strong>
              <span>/ ${f.totalSeats} pax</span>
              <span style="margin-left:4px">(${Math.round(f.occupancy * 100)}%)</span>
            </div>
            <div style="display:flex;gap:5px">${classIcons}</div>
            <div style="color:var(--text-dim)">${f.tailNumber}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  listEl.innerHTML = dayHtml + cardsHtml;

  // ── Auto-refresh cada 3 segundos mientras el tab esté activo ──
  if (!window._flightsRefreshTimer) {
    window._flightsRefreshTimer = setInterval(() => {
      if (document.getElementById('tab-flights')?.classList.contains('active')) {
        renderFlightsTab();
      } else {
        clearInterval(window._flightsRefreshTimer);
        window._flightsRefreshTimer = null;
      }
    }, 3000);
  }
}
