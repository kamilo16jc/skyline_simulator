// ═══════════════════════════════════════════════════════════════
//  SkyLine — ui-new-route.js
//  Modal de creación de nueva ruta:
//  selector de país (dropdown custom), aeropuertos, aeronave,
//  validación de alcance y gate, confirmación.
// ═══════════════════════════════════════════════════════════════

let _routeOrigin      = null;  // AirportData del hub (origen fijo)
let _nrAllValidDests  = [];    // Cache de destinos válidos actuales

// ─────────────────────────────────────────────────────────────
//  ABRIR MODAL
// ─────────────────────────────────────────────────────────────
function openNewRouteModal(preselectedDestIATA = null, originHubIATA = null) {
  if (!SkyLine.economy || !SkyLine.game) {
    showToast('El juego no ha cargado correctamente.', 'danger'); return;
  }

  // Usar el hub pasado como parámetro; si no, usar el hub principal
  const hubs    = SkyLine.game.airline?.hubAirports ?? [];
  const hubIATA = (originHubIATA && hubs.includes(originHubIATA))
    ? originHubIATA
    : hubs[0];
  _routeOrigin  = _airports.find(a => a.iataCode === hubIATA);
  if (!_routeOrigin) {
    showToast('No se encontró tu hub en los aeropuertos cargados.', 'danger'); return;
  }

  // Flota operativa (cualquier avión, ya tenga rutas asignadas o no)
  const availableFleet = (SkyLine.game.fleet ?? []).filter(f => f.isOperational);
  if (availableFleet.length === 0) {
    showToast('Necesitas al menos una aeronave operativa. Ve a Mercado.', 'warning');
    switchTab('market'); togglePanel('left'); return;
  }

  // Mostrar origen (hub)
  document.getElementById('nr-origin').textContent      = _routeOrigin.iataCode;
  document.getElementById('nr-origin-city').textContent = _routeOrigin.city;
  document.getElementById('nr-dest-iata').textContent   = '—';
  document.getElementById('nr-dest-city').textContent   = 'Sin seleccionar';
  document.getElementById('nr-subtitle').textContent    = `Rutas desde ${_routeOrigin.displayName}`;

  // Construir lista de destinos (todos excepto hub y rutas activas)
  const activeRouteDests = new Set(
    (SkyLine.game.routes ?? [])
      .filter(r => (r.isActive || r.isPaused) && r.originIATA === hubIATA)
      .map(r => r.destinationIATA)
  );
  const validDests = _airports.filter(a =>
    a.iataCode !== hubIATA && !activeRouteDests.has(a.iataCode)
  );

  nrBuildCountryMenu(validDests);

  // Reset country display
  document.getElementById('nr-country-display').innerHTML = '— Seleccionar país —';
  document.getElementById('nr-country-menu').style.display = 'none';
  document.getElementById('nr-apt-search').style.display = 'none';
  document.getElementById('nr-dest-city').innerHTML = 'Sin seleccionar';

  const destSel = document.getElementById('nr-dest');
  destSel.innerHTML = '<option value="">— Selecciona un país primero —</option>';

  // Destino pre-seleccionado (ej. desde panel de aeropuerto)
  if (preselectedDestIATA) {
    const preApt = validDests.find(a => a.iataCode === preselectedDestIATA);
    if (preApt) {
      const cnt = validDests.filter(a => a.country === preApt.country).length;
      document.getElementById('nr-country-display').textContent = `${countryFlag(preApt.country)}  ${preApt.country}  (${cnt})`;
      _nrPopulateAirports(validDests, preApt.country);
      destSel.value = preselectedDestIATA;
      _nrUpdateDestDisplay(preApt);
    }
  }

  // Llenar aeronaves (todas operativas; indicar cuántas rutas ya opera cada una)
  const acSel = document.getElementById('nr-aircraft');
  acSel.innerHTML = '<option value="">— Seleccionar aeronave —</option>';
  availableFleet.forEach(f => {
    const ac        = (window.AIRCRAFT_CATALOG ?? []).find(a => a.aircraftId === f.aircraftDataId);
    const routesCnt = (SkyLine.game.routes ?? []).filter(r => r.assignedAircraftId === f.aircraftId && r.isActive).length;
    const routeTag  = routesCnt > 0 ? ` · ${routesCnt} ruta${routesCnt > 1 ? 's' : ''}` : '';
    const opt = document.createElement('option');
    opt.value = f.aircraftId;
    opt.textContent = `${f.tailNumber} — ${f.aircraftDataId}` +
                      (ac ? ` (${ac.totalSeats} asientos, ${ac.rangeKm.toLocaleString()} km)` : '') +
                      routeTag;
    acSel.appendChild(opt);
  });

  // Reset inputs
  document.getElementById('nr-fare').value = 200;
  document.getElementById('nr-freq').value = 7;
  document.getElementById('nr-info').textContent = 'Selecciona país, destino y aeronave.';
  const confirmBtn = document.getElementById('nr-confirm-btn');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.style.opacity = '0.45'; }

  document.getElementById('modal-newroute').classList.add('active');
}

// ─────────────────────────────────────────────────────────────
//  HELPERS — DESTINOS VÁLIDOS
// ─────────────────────────────────────────────────────────────
function _nrGetValidDests() {
  // Usar el hub origen actual del modal (ya guardado en _routeOrigin)
  const hubIATA = _routeOrigin?.iataCode ?? SkyLine.game?.airline?.hubAirports?.[0];
  const activeRouteDests = new Set(
    (SkyLine.game?.routes ?? [])
      .filter(r => (r.isActive || r.isPaused) && r.originIATA === hubIATA)
      .map(r => r.destinationIATA)
  );
  return _airports.filter(a => a.iataCode !== hubIATA && !activeRouteDests.has(a.iataCode));
}

// ─────────────────────────────────────────────────────────────
//  DROPDOWN DE PAÍSES (custom)
// ─────────────────────────────────────────────────────────────
function nrBuildCountryMenu(validDests) {
  _nrAllValidDests = validDests;
  const countMap = {};
  validDests.forEach(a => { countMap[a.country] = (countMap[a.country] || 0) + 1; });
  window._nrCountryData = Object.entries(countMap)
    .map(([c, n]) => ({ country: c, count: n }))
    .sort((a, b) => a.country.localeCompare(b.country));
  nrFilterCountries();
}

function nrFilterCountries() {
  const q    = (document.getElementById('nr-country-search')?.value || '').toLowerCase();
  const list = document.getElementById('nr-country-list');
  if (!list) return;
  list.innerHTML = '';

  const items = (window._nrCountryData || []).filter(d => !q || d.country.toLowerCase().includes(q));
  if (items.length === 0) {
    list.innerHTML = '<div style="padding:10px;text-align:center;opacity:0.5;font-size:0.8rem">Sin resultados</div>';
    return;
  }

  items.forEach(d => {
    const div = document.createElement('div');
    div.style.cssText = 'padding:7px 10px;cursor:pointer;border-radius:5px;display:flex;align-items:center;gap:10px;font-size:0.83rem';
    div.innerHTML =
      `<span style="width:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${flagImg(d.country)}</span>` +
      `<span style="flex:1">${d.country}</span>` +
      `<span style="opacity:0.5;font-size:0.72rem;background:rgba(255,255,255,0.07);padding:1px 7px;border-radius:10px">${d.count}</span>`;
    div.onmouseenter = () => div.style.background = 'rgba(255,255,255,0.07)';
    div.onmouseleave = () => div.style.background = '';
    div.onclick = () => nrSelectCountry(d.country, d.count);
    list.appendChild(div);
  });
}

function nrToggleCountryMenu() {
  const menu   = document.getElementById('nr-country-menu');
  const search = document.getElementById('nr-country-search');
  const isOpen = menu.style.display !== 'none';
  if (isOpen) {
    menu.style.display = 'none';
    document.getElementById('nr-country-arrow').textContent = '▾';
  } else {
    _nrAllValidDests = _nrGetValidDests();
    nrBuildCountryMenu(_nrAllValidDests);
    menu.style.display = 'block';
    document.getElementById('nr-country-arrow').textContent = '▴';
    setTimeout(() => search?.focus(), 50);
  }
}

function nrSelectCountry(country, count) {
  const display = document.getElementById('nr-country-display');
  display.innerHTML =
    `${flagImg(country, 18, 13)}&ensp;<strong>${country}</strong>&ensp;<span style="opacity:0.5;font-size:0.75rem">(${count})</span>`;
  document.getElementById('nr-country-menu').style.display  = 'none';
  document.getElementById('nr-country-arrow').textContent   = '▾';
  document.getElementById('nr-dest-iata').textContent = '—';
  document.getElementById('nr-dest-city').innerHTML   = 'Sin seleccionar';
  document.getElementById('nr-info').textContent      = 'Selecciona un aeropuerto.';
  _nrPopulateAirports(_nrAllValidDests, country);
}

// Cerrar dropdown al hacer clic fuera
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('nr-country-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const menu = document.getElementById('nr-country-menu');
    if (menu) {
      menu.style.display = 'none';
      document.getElementById('nr-country-arrow').textContent = '▾';
    }
  }
});

// ─────────────────────────────────────────────────────────────
//  LISTA DE AEROPUERTOS
// ─────────────────────────────────────────────────────────────
function _nrPopulateAirports(validDests, country) {
  const destSel   = document.getElementById('nr-dest');
  const searchBox = document.getElementById('nr-apt-search');
  const filtered  = (validDests || _nrGetValidDests()).filter(a => a.country === country);

  const classOrder = { F:0, E:1, D:2, C:3 };
  filtered.sort((a, b) =>
    (classOrder[a.airportClass] ?? 9) - (classOrder[b.airportClass] ?? 9) || a.city.localeCompare(b.city)
  );

  destSel.innerHTML = '<option value="">— Seleccionar aeropuerto —</option>';
  filtered.forEach(a => {
    const hasGate = SkyLine.economy?.hasGateAt(a.iataCode);
    const opt = document.createElement('option');
    opt.value = a.iataCode;
    opt.textContent = `${a.city} (${a.iataCode}) · Clase ${a.airportClass}${hasGate ? ' ✓ Gate' : ' — Sin gate'}`;
    destSel.appendChild(opt);
  });

  if (searchBox) {
    const big = filtered.length > 10;
    searchBox.style.display    = big ? 'block' : 'none';
    searchBox.value            = '';
    destSel.style.borderRadius = big ? '0 0 6px 6px' : '6px';
  }
  destSel._allOptions = Array.from(destSel.options);
}

function nrFilterAirports() {
  const q        = document.getElementById('nr-apt-search').value.toLowerCase();
  const destSel  = document.getElementById('nr-dest');
  const selected = destSel.value;
  if (!destSel._allOptions) return;
  destSel.innerHTML = '';
  destSel._allOptions
    .filter(o => !o.value || !q || o.textContent.toLowerCase().includes(q))
    .forEach(o => destSel.appendChild(o.cloneNode(true)));
  destSel.value = selected;
}

function onNrDestChange() {
  const destIATA = document.getElementById('nr-dest').value;
  if (!destIATA) {
    document.getElementById('nr-dest-iata').textContent = '—';
    document.getElementById('nr-dest-city').textContent = 'Sin seleccionar';
    document.getElementById('nr-info').textContent = '';
    return;
  }
  const dest = _airports.find(a => a.iataCode === destIATA);
  if (dest) _nrUpdateDestDisplay(dest);
  updateNewRouteInfo();
}

function _nrUpdateDestDisplay(dest) {
  document.getElementById('nr-dest-iata').textContent = dest.iataCode;
  document.getElementById('nr-dest-city').innerHTML =
    `${flagImg(dest.country, 16, 12)}&ensp;${dest.city}, ${dest.country}`;
}

// ─────────────────────────────────────────────────────────────
//  INFO + VALIDACIÓN EN TIEMPO REAL
// ─────────────────────────────────────────────────────────────
function updateNewRouteInfo() {
  const destIATA = document.getElementById('nr-dest').value;
  const fleetId  = document.getElementById('nr-aircraft').value;
  const fare     = parseInt(document.getElementById('nr-fare').value) || 0;

  if (!destIATA || !_routeOrigin) {
    document.getElementById('nr-info').textContent = 'Selecciona destino y aeronave.'; return;
  }
  const dest = _airports.find(a => a.iataCode === destIATA);
  if (!dest) return;

  // Distancia Haversine
  const R    = 6371;
  const dLat = (dest.latitude  - _routeOrigin.latitude)  * Math.PI / 180;
  const dLon = (dest.longitude - _routeOrigin.longitude) * Math.PI / 180;
  const av   = Math.sin(dLat/2)**2 +
               Math.cos(_routeOrigin.latitude * Math.PI/180) *
               Math.cos(dest.latitude * Math.PI/180) *
               Math.sin(dLon/2)**2;
  const distKm = Math.round(R * 2 * Math.atan2(Math.sqrt(av), Math.sqrt(1-av)));

  const suggestedFare = distKm < 1000 ? 120 : distKm < 3000 ? 220 : distKm < 7000 ? 380 : 520;
  const fareOk  = fare >= 50;
  const isIntl  = dest.country !== _routeOrigin.country;
  const hasGate = SkyLine.economy?.hasGateAt(destIATA);

  // Validación de alcance
  let rangeOk = false, acRange = null, acName = null;
  if (fleetId) {
    const fleetItem = (SkyLine.game?.fleet ?? []).find(f => f.aircraftId === fleetId);
    const acData    = (window.AIRCRAFT_CATALOG ?? []).find(a => a.aircraftId === fleetItem?.aircraftDataId);
    if (acData) { acRange = acData.rangeKm; acName = acData.displayName; rangeOk = acRange >= distKm; }
  }

  // Actualizar botón
  const confirmBtn = document.getElementById('nr-confirm-btn');
  if (confirmBtn) {
    const canConfirm = hasGate && fareOk && fleetId && rangeOk;
    confirmBtn.disabled      = !canConfirm;
    confirmBtn.style.opacity = canConfirm ? '1' : '0.45';
  }

  // Línea de gate
  const gateLine = hasGate
    ? '<span style="color:var(--success)">✓ Gate operativo</span>'
    : `<span style="color:var(--danger)">✗ Sin gate en ${destIATA}</span> ` +
      `<button onclick="nrGoRentGate('${destIATA}')" ` +
      `style="margin-left:6px;padding:2px 10px;font-size:0.75rem;background:rgba(239,68,68,0.15);` +
      `border:1px solid var(--danger);border-radius:4px;color:var(--danger);cursor:pointer;` +
      `vertical-align:middle;transition:background 0.2s" ` +
      `onmouseenter="this.style.background='rgba(239,68,68,0.30)'" ` +
      `onmouseleave="this.style.background='rgba(239,68,68,0.15)'"` +
      `>🔑 Ir a ${destIATA} y rentar gate →</button>`;

  // Línea de alcance
  const rangeLine = !fleetId
    ? '<span style="color:var(--text-muted)">Selecciona una aeronave</span>'
    : !rangeOk
      ? `<span style="color:var(--danger)">✗ Alcance insuficiente — ${acName} solo alcanza ${acRange?.toLocaleString()} km</span>`
      : `<span style="color:var(--success)">✓ Alcance OK (${acRange?.toLocaleString()} km)</span>`;

  document.getElementById('nr-info').innerHTML =
    `<strong>${distKm.toLocaleString()} km</strong> &nbsp;·&nbsp; ` +
    `${isIntl ? '🌐 Internacional' : '🏠 Doméstica'} &nbsp;·&nbsp; Clase ${dest.airportClass}` +
    `<br>${gateLine} &nbsp;·&nbsp; ${rangeLine}` +
    ` &nbsp;·&nbsp; Tarifa: <strong>$${fare}</strong> (sug. $${suggestedFare})` +
    (fareOk ? '' : ' <span style="color:var(--danger)">✗ Mín. $50</span>');
}

// ─────────────────────────────────────────────────────────────
//  ATAJO: IR A RENTAR GATE
// ─────────────────────────────────────────────────────────────
function nrGoRentGate(iataCode) {
  const airport = _airports.find(a => a.iataCode === iataCode);
  if (!airport) return;
  closeNewRouteModal();
  _map.flyTo([airport.latitude, airport.longitude], 10, { animate: true, duration: 1.5 });
  setTimeout(() => openAirportPanel(airport), 350);
}

function closeNewRouteModal() {
  document.getElementById('modal-newroute').classList.remove('active');
  document.getElementById('nr-country-menu').style.display = 'none';
  _routeOrigin = null;
}

// ─────────────────────────────────────────────────────────────
//  CONFIRMAR RUTA
// ─────────────────────────────────────────────────────────────
function confirmNewRoute() {
  try {
    const destIATA = document.getElementById('nr-dest').value;
    const fleetId  = document.getElementById('nr-aircraft').value;
    const freq     = parseInt(document.getElementById('nr-freq').value) || 7;
    const fare     = parseInt(document.getElementById('nr-fare').value) || 200;

    if (!destIATA)     { showToast('Selecciona un aeropuerto destino.', 'warning'); return; }
    if (!fleetId)      { showToast('Selecciona una aeronave.', 'warning'); return; }
    if (fare < 50)     { showToast('La tarifa mínima es $50.', 'warning'); return; }
    if (!_routeOrigin) { showToast('Error interno: hub no definido.', 'danger'); return; }

    // Gate obligatorio
    if (!SkyLine.economy?.hasGateAt(destIATA)) {
      showToast(`Necesitas un gate en ${destIATA} para operar.`, 'danger'); return;
    }

    const dest      = _airports.find(a => a.iataCode === destIATA);
    const fleetItem = (SkyLine.game?.fleet ?? []).find(f => f.aircraftId === fleetId);
    if (!dest)      { showToast('Destino no encontrado.', 'danger'); return; }
    if (!fleetItem) { showToast('Aeronave no encontrada.', 'danger'); return; }

    // Alcance obligatorio
    const acData = (window.AIRCRAFT_CATALOG ?? []).find(a => a.aircraftId === fleetItem.aircraftDataId);
    if (acData) {
      const R    = 6371;
      const dLat = (dest.latitude  - _routeOrigin.latitude)  * Math.PI / 180;
      const dLon = (dest.longitude - _routeOrigin.longitude) * Math.PI / 180;
      const av   = Math.sin(dLat/2)**2 +
                   Math.cos(_routeOrigin.latitude  * Math.PI/180) *
                   Math.cos(dest.latitude * Math.PI/180) *
                   Math.sin(dLon/2)**2;
      const distKm = Math.round(R * 2 * Math.atan2(Math.sqrt(av), Math.sqrt(1-av)));
      if (acData.rangeKm < distKm) {
        showToast(`${acData.displayName} no puede volar ${distKm.toLocaleString()} km — máximo: ${acData.rangeKm.toLocaleString()} km.`, 'danger');
        return;
      }
    }

    // Abrir ruta en motores
    const gmRoute = SkyLine.game.openRoute(_routeOrigin.iataCode, destIATA, fleetItem.aircraftId, freq, fare);
    if (!gmRoute) { showToast('No se pudo abrir la ruta. ¿El avión ya tiene ruta asignada?', 'danger'); return; }

    SkyLine.routes.openRoute(
      _routeOrigin.iataCode, destIATA,
      _routeOrigin.city, dest.city,
      fleetItem.aircraftDataId, freq, fare
    );

    // UI
    const originIATA = _routeOrigin.iataCode;
    drawRoute(originIATA, destIATA, gmRoute.routeId);
    updateMarkerStyle(originIATA, 'hub');
    updateMarkerStyle(destIATA, 'route');
    updateHUDFleetRoutes();
    renderRoutesTab();
    closeNewRouteModal();
    showToast(`✈ Ruta ${originIATA} → ${destIATA} abierta.`, 'success');

  } catch(err) {
    console.error('[Route] Error al crear ruta:', err);
    showToast('Error al crear ruta: ' + err.message, 'danger');
  }
}
