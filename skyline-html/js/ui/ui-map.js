// ═══════════════════════════════════════════════════════════════
//  SkyLine — ui-map.js
//  Inicialización de Leaflet, marcadores de aeropuertos,
//  dibujo y eliminación de rutas en el mapa
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  INIT MAP (Leaflet + MarkerCluster)
// ─────────────────────────────────────────────────────────────
function initMap() {
  if (_map) {
    stopFlightAnimations();
    _map.remove();
    _map = null; _airportMarkers = {}; _routeLines = {}; _clusterGroup = null;
  }

  _map = L.map('map', {
    center: [20, 0], zoom: 3,
    zoomControl: true,
    minZoom: 2, maxZoom: 12,
    worldCopyJump: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd', maxZoom: 19, attribution: '© CartoDB'
  }).addTo(_map);

  // MarkerCluster — agrupa marcadores cercanos, se desactiva en zoom ≥ 6
  _clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 40,
    disableClusteringAtZoom: 6,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction: function(cluster) {
      const count = cluster.getChildCount();
      const size  = count < 10 ? 'small' : count < 50 ? 'medium' : 'large';
      return L.divIcon({
        html: `<div><span>${count}</span></div>`,
        className: `marker-cluster marker-cluster-${size}`,
        iconSize: L.point(40, 40)
      });
    }
  });

  // Añadir todos los aeropuertos al cluster
  _airports.forEach(airport => addAirportMarker(airport));
  _map.addLayer(_clusterGroup);

  // Iniciar animación de aeronaves en ruta
  startFlightAnimations();

  console.log(`[Map] ${_airports.length} aeropuertos cargados en cluster (${_airports.filter(a => a.isUnlockedAtStart).length} desbloqueados).`);
}

// ─────────────────────────────────────────────────────────────
//  MARCADORES
// ─────────────────────────────────────────────────────────────
function addAirportMarker(airport) {
  const isUnlocked = airport.isUnlockedAtStart || airport.airportClass === 'F' || airport.airportClass === 'E';
  const el = document.createElement('div');
  el.className = isUnlocked ? 'airport-dot' : 'airport-dot locked';

  const size   = isUnlocked ? [8, 8]     : [5, 5];
  const anchor = isUnlocked ? [4, 4]     : [2.5, 2.5];

  const icon = L.divIcon({ html: el.outerHTML, className: '', iconSize: size, iconAnchor: anchor });

  const marker = L.marker([airport.latitude, airport.longitude], { icon })
    .on('click', () => openAirportPanel(airport));

  _clusterGroup.addLayer(marker);
  _airportMarkers[airport.iataCode] = { marker, airport, el };
}

function updateMarkerStyle(iata, cssClass) {
  const entry = _airportMarkers[iata];
  if (!entry) return;

  const ap = entry.airport;
  const isLocked = !ap.isUnlockedAtStart && ap.airportClass !== 'F' && ap.airportClass !== 'E';

  // Aeropuertos D/C no se tocan si el estilo es el por defecto (evita sobreescribir el dot gris)
  if (isLocked && !cssClass) return;

  const el = document.createElement('div');
  el.className = 'airport-dot ' + cssClass;

  const isHub  = cssClass.includes('hub');
  const size   = isHub ? [12, 12] : isLocked ? [5, 5]   : [8, 8];
  const anchor = isHub ? [6, 6]   : isLocked ? [2.5, 2.5] : [4, 4];

  const icon = L.divIcon({ html: el.outerHTML, className: '', iconSize: size, iconAnchor: anchor });
  entry.marker.setIcon(icon);
}

// ─────────────────────────────────────────────────────────────
//  RUTAS EN MAPA
// ─────────────────────────────────────────────────────────────
function drawRoute(originIATA, destIATA, routeId) {
  const a = _airports.find(ap => ap.iataCode === originIATA);
  const b = _airports.find(ap => ap.iataCode === destIATA);
  if (!a || !b) return;

  if (_routeLines[routeId]) { _map.removeLayer(_routeLines[routeId]); }

  const line = L.polyline(
    [[a.latitude, a.longitude], [b.latitude, b.longitude]],
    { color: '#3b82f6', weight: 1.5, opacity: 0.7, dashArray: '5,5' }
  ).addTo(_map);

  _routeLines[routeId] = line;
}

function removeRouteFromMap(routeId) {
  if (_routeLines[routeId]) {
    _map.removeLayer(_routeLines[routeId]);
    delete _routeLines[routeId];
  }
  // Quitar todos los marcadores de avión de esta ruta (key: routeId_i)
  Object.keys(_flightMarkers).forEach(key => {
    if (key === routeId || key.startsWith(routeId + '_')) {
      try { _map.removeLayer(_flightMarkers[key]); } catch(e) {}
      delete _flightMarkers[key];
    }
  });
}

// ─────────────────────────────────────────────────────────────
//  ANIMACIÓN DE AERONAVES EN MAPA
// ─────────────────────────────────────────────────────────────

let _flightMarkers  = {};   // routeId → L.marker
let _flightAnimTimer = null;

// Bearing (ángulo de rumbo) entre dos puntos geográficos
function _mapBearing(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const y  = Math.sin(Δλ) * Math.cos(φ2);
  const x  = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Interpolar posición (maneja antimeridiano)
function _interpLatLng(lat1, lon1, lat2, lon2, t) {
  let dLon = lon2 - lon1;
  if (dLon >  180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  return [lat1 + (lat2 - lat1) * t, lon1 + dLon * t];
}

// Color único por ruta (usa colores del planner si están disponibles, sino hash)
const _PLANE_COLORS = [
  '#1e7de6','#e53935','#43a047','#fb8c00','#8e24aa',
  '#00897b','#f4511e','#1565c0','#2e7d32','#e91e63'
];
function _routeColor(routeId) {
  if (typeof _routeColors !== 'undefined' && _routeColors[routeId]) {
    return _routeColors[routeId];
  }
  let h = 0;
  for (let i = 0; i < routeId.length; i++) h = (h * 31 + routeId.charCodeAt(i)) >>> 0;
  return _PLANE_COLORS[h % _PLANE_COLORS.length];
}

// Icono SVG de avión con color por ruta y rotación de rumbo
function _makePlaneIcon(bearing, routeId) {
  const color = _routeColor(routeId ?? '');
  return L.divIcon({
    html: `
      <div style="transform:rotate(${bearing}deg);width:26px;height:26px;
                  filter:drop-shadow(0 1px 5px rgba(0,0,0,0.65))">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
             fill="${color}" width="26" height="26">
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10
                   3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13
                   19v-5.5l8 2.5z"/>
        </svg>
      </div>`,
    className:  '',
    iconSize:   [26, 26],
    iconAnchor: [13, 13]
  });
}

// Inicia el bucle de animación (llamado desde initMap)
function startFlightAnimations() {
  if (_flightAnimTimer) clearInterval(_flightAnimTimer);
  updateFlightAnimations();                          // primera llamada inmediata
  _flightAnimTimer = setInterval(updateFlightAnimations, 2000); // cada 2 s
}

// Detiene animaciones y limpia todos los marcadores
function stopFlightAnimations() {
  if (_flightAnimTimer) { clearInterval(_flightAnimTimer); _flightAnimTimer = null; }
  Object.values(_flightMarkers).forEach(m => { try { _map.removeLayer(m); } catch(e) {} });
  _flightMarkers = {};
}

// Actualiza posición de todos los aviones en vuelo
function updateFlightAnimations() {
  const game = SkyLine?.game;
  if (!game || !_map) return;

  const routes       = game.routes ?? [];
  const activeRoutes = routes.filter(r => r.isActive && !r.isPaused);

  // Hora actual del juego (06:00 → 22:00)
  const dayProgress = (game._dayDuration > 0 && game._dayTimer != null)
    ? (game._dayTimer / game._dayDuration)
    : ((Date.now() % 86400000) / 86400000);
  const currentHour = 6 + dayProgress * 16;

  // Día de la semana actual (0=Lun … 6=Dom)
  const gd = game.date;
  const todayDow = gd
    ? (new Date(gd.year, gd.month - 1, gd.day).getDay() + 6) % 7
    : 0;

  const activePlaneKeys = new Set();

  activeRoutes.forEach(route => {
    const flightsToday = route.schedule?.[todayDow] ?? 0;
    if (flightsToday === 0) return;

    // FIX: buscar por tailNumber (assignedAircraftId almacena el tail, no un id interno)
    const fleet       = game.fleet ?? game._fleet ?? [];
    const fleetEntry  = fleet.find(f => f.tailNumber === route.assignedAircraftId);
    const acData      = (window.AIRCRAFT_CATALOG ?? []).find(a => a.aircraftId === fleetEntry?.aircraftDataId);
    const cruiseSpeed = acData?.cruiseSpeedKmh ?? 850;
    const durationH   = route.distanceKm / cruiseSpeed;

    // Usar horas del dayPlan si existen; si no, distribuir uniformemente
    const plannedHours = route.dayPlan?.[todayDow];
    const depHours = (plannedHours?.length > 0)
      ? plannedHours
      : Array.from({ length: flightsToday }, (_, i) => 6 + (i / Math.max(1, flightsToday)) * 16);

    // Coordenadas origen/destino
    const apOrigin = _airports.find(a => a.iataCode === route.originIATA);
    const apDest   = _airports.find(a => a.iataCode === route.destinationIATA);
    if (!apOrigin || !apDest) return;

    depHours.forEach((depH, i) => {
      const arrH   = depH + durationH;
      const retDep = arrH + 0.5;          // turnaround 30 min
      const retArr = retDep + durationH;

      let fraction = null;
      let isReturn = false;

      if (currentHour >= depH && currentHour <= arrH) {
        fraction = (currentHour - depH) / durationH;
        isReturn = false;
      } else if (currentHour >= retDep && currentHour <= retArr) {
        fraction = (currentHour - retDep) / durationH;
        isReturn = true;
      }

      // Key única por vuelo individual
      const planeKey = `${route.routeId}_${i}${isReturn ? 'r' : ''}`;

      if (fraction === null) {
        if (_flightMarkers[planeKey]) {
          try { _map.removeLayer(_flightMarkers[planeKey]); } catch(e) {}
          delete _flightMarkers[planeKey];
        }
        return;
      }

      const lat1 = isReturn ? apDest.latitude    : apOrigin.latitude;
      const lon1 = isReturn ? apDest.longitude   : apOrigin.longitude;
      const lat2 = isReturn ? apOrigin.latitude  : apDest.latitude;
      const lon2 = isReturn ? apOrigin.longitude : apDest.longitude;

      const t   = Math.max(0, Math.min(1, fraction));
      const pos = _interpLatLng(lat1, lon1, lat2, lon2, t);
      const brg = _mapBearing(lat1, lon1, lat2, lon2);

      // Tooltip informativo: ruta, tail, hora estimada de llegada
      const fromIATA = isReturn ? route.destinationIATA : route.originIATA;
      const toIATA   = isReturn ? route.originIATA      : route.destinationIATA;
      const estArr   = isReturn ? retArr : arrH;
      const arrHH    = Math.floor(estArr % 24);
      const arrMM    = String(Math.round((estArr % 1) * 60)).padStart(2, '0');
      const tail     = fleetEntry?.tailNumber ?? '';
      const tooltip  = `✈ ${fromIATA} → ${toIATA}${tail ? '\n' + tail : ''}\nLlegada ~${arrHH}:${arrMM}`;

      activePlaneKeys.add(planeKey);

      if (_flightMarkers[planeKey]) {
        _flightMarkers[planeKey].setLatLng(pos);
        _flightMarkers[planeKey].setIcon(_makePlaneIcon(brg, route.routeId));
      } else {
        const m = L.marker(pos, {
          icon:         _makePlaneIcon(brg, route.routeId),
          zIndexOffset: 500,
          interactive:  true,
          title:        tooltip
        })
        .bindTooltip(tooltip.replace(/\n/g, '<br>'), {
          permanent: false, direction: 'top', offset: [0, -14]
        })
        .addTo(_map);
        _flightMarkers[planeKey] = m;
      }
    });
  });

  // Limpiar marcadores de vuelos que ya no están activos
  Object.keys(_flightMarkers).forEach(key => {
    if (!activePlaneKeys.has(key)) {
      try { _map.removeLayer(_flightMarkers[key]); } catch(e) {}
      delete _flightMarkers[key];
    }
  });
}
