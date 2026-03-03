// ═══════════════════════════════════════════════════════════════
//  SkyLine — ui-game.js
//  Inicialización del juego, navegación de pantallas,
//  menú principal, dificultad, carga de aeropuertos,
//  y suscripción a todos los eventos de los motores
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  STARS DECORATION (Main Menu)
// ─────────────────────────────────────────────────────────────
(function createStars() {
  const container = document.getElementById('stars');
  for (let i = 0; i < 120; i++) {
    const s    = document.createElement('div');
    s.className = 'star';
    const size  = Math.random() * 2.5 + 0.5;
    s.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%; top:${Math.random() * 100}%;
      animation-delay:${Math.random() * 3}s;
      animation-duration:${2 + Math.random() * 3}s;
    `;
    container.appendChild(s);
  }
})();

// ─────────────────────────────────────────────────────────────
//  SCREEN NAVIGATION
// ─────────────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

// ─────────────────────────────────────────────────────────────
//  HUB SELECTOR — pantalla nueva partida
// ─────────────────────────────────────────────────────────────
let _ngSelectedHub    = null;   // IATA seleccionado
let _ngAirportCache   = [];     // aeropuertos precargados para búsqueda

// Pre-carga aeropuertos en background para el selector de hub
async function _preloadNgAirports() {
  if (_ngAirportCache.length > 0) return;
  try {
    const res = await fetch('data/airports.json');
    if (res.ok) {
      const data = await res.json();
      // Solo clase F y E (aeropuertos grandes/medianos — buenos hubs de inicio)
      _ngAirportCache = data.filter(a => a.airportClass === 'F' || a.airportClass === 'E');
    }
  } catch {
    // Fallback: usar aeropuertos de muestra
    _ngAirportCache = getSampleAirports().map(a => ({
      iataCode: a.iataCode, displayName: a.displayName,
      city: a.city, country: a.country, airportClass: a.airportClass
    }));
  }
}

function ngHubSearch(query) {
  const dropdown = document.getElementById('ng-hub-dropdown');
  if (!dropdown) return;

  const q = (query || '').trim().toLowerCase();
  if (!q) { dropdown.style.display = 'none'; return; }

  const results = _ngAirportCache
    .filter(a =>
      a.iataCode.toLowerCase().startsWith(q) ||
      (a.city        || '').toLowerCase().includes(q) ||
      (a.country     || '').toLowerCase().includes(q) ||
      (a.displayName || '').toLowerCase().includes(q)
    )
    .slice(0, 9);

  if (results.length === 0) { dropdown.style.display = 'none'; return; }

  dropdown.innerHTML = results.map(a => {
    const city  = (a.city    || '').replace(/'/g, "\\'");
    const name  = (a.displayName || '').replace(/'/g, "\\'");
    const cntry = (a.country || '');
    return `
      <div class="ng-hub-item"
           onclick="ngSelectHub('${a.iataCode}','${name}','${city}','${cntry}')">
        <span class="ng-hub-item-iata">${a.iataCode}</span>
        <div>
          <div class="ng-hub-item-city">${a.city}, ${cntry}</div>
          <div class="ng-hub-item-cls">Clase ${a.airportClass} · ${a.displayName || ''}</div>
        </div>
      </div>`;
  }).join('');

  dropdown.style.display = 'block';
}

function ngSelectHub(iata, name, city, country) {
  _ngSelectedHub = iata;
  const input    = document.getElementById('ng-hub-input');
  const dropdown = document.getElementById('ng-hub-dropdown');
  const badge    = document.getElementById('ng-hub-badge');

  if (input)    input.value = '';
  if (dropdown) dropdown.style.display = 'none';
  if (badge) {
    badge.style.display = 'flex';
    badge.innerHTML = `
      <span class="ng-hub-badge-iata">${iata}</span>
      <div class="ng-hub-badge-info">${city}, ${country}<br><span style="color:var(--text-dim)">${name}</span></div>
      <button class="ng-hub-badge-clear" onclick="ngClearHub()" title="Cambiar hub">✕</button>`;
  }
}

function ngClearHub() {
  _ngSelectedHub = null;
  const badge = document.getElementById('ng-hub-badge');
  if (badge) badge.style.display = 'none';
  const input = document.getElementById('ng-hub-input');
  if (input) { input.value = ''; input.focus(); }
}

// Cierra dropdown al hacer clic fuera
document.addEventListener('click', e => {
  if (!e.target.closest('.ng-hub-wrap')) {
    const d = document.getElementById('ng-hub-dropdown');
    if (d) d.style.display = 'none';
  }
});

// ─────────────────────────────────────────────────────────────
//  MAIN MENU
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const continueBtn = document.getElementById('btn-continue');
  if (SaveSystem.hasSave()) {
    continueBtn.disabled    = false;
    continueBtn.textContent = 'Continuar — ' + SaveSystem.getSaveInfo().split('—')[0].trim();
  }

  document.getElementById('btn-newgame').addEventListener('click', () => {
    showScreen('newgame');
    selectMode('Tycoon');
    // Resetear hub selector
    _ngSelectedHub = null;
    const badge = document.getElementById('ng-hub-badge');
    if (badge) badge.style.display = 'none';
    const input = document.getElementById('ng-hub-input');
    if (input) input.value = '';
    // Pre-cargar aeropuertos en background para el selector
    _preloadNgAirports();
  });
  document.getElementById('btn-continue').addEventListener('click', continueSave);
});

// ─────────────────────────────────────────────────────────────
//  MODE SELECTION (Tycoon / Realista)
// ─────────────────────────────────────────────────────────────
function selectMode(mode) {
  _gameMode = mode;
  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById('mode-' + mode);
  if (card) card.classList.add('selected');
}

// Auto-genera código IATA a partir del nombre (iniciales, máx 3 letras)
function autoIATA(name) {
  const code = name.trim()
    .split(/\s+/)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 3);
  return code.length >= 2 ? code : (code + 'SL').slice(0, 3);
}

// Actualiza el preview del código IATA bajo el campo de nombre
function updateIataPreview() {
  const name    = document.getElementById('ng-name')?.value ?? '';
  const iata    = name.trim() ? autoIATA(name) : '—';
  const preview = document.getElementById('ng-iata-preview');
  if (preview) preview.innerHTML = `Código IATA: <span>${iata}</span>`;
}

// ─────────────────────────────────────────────────────────────
//  START NEW GAME
// ─────────────────────────────────────────────────────────────
document.getElementById('btn-start').addEventListener('click', async () => {
  try {
    const name = document.getElementById('ng-name').value.trim();
    if (!name) { showToast('Ingresa el nombre de tu aerolínea', 'warning'); return; }
    if (!_ngSelectedHub) { showToast('Selecciona un aeropuerto hub para tu aerolínea', 'warning'); return; }

    const iata = autoIATA(name);
    const hub  = _ngSelectedHub;

    // Mostrar pantalla ANTES de init para que Leaflet pueda medir el div del mapa
    showScreen('game');
    updateHubTag([hub]);
    showToast('Cargando aeropuertos...', 'info');

    await initGame();
    SkyLine.newGame(name, iata, hub, _gameMode);
    showToast(`¡Bienvenido, ${name}! Tu aerolínea está lista para despegar.`, 'success');
  } catch (err) {
    console.error('[SkyLine] Error al iniciar partida:', err);
    showScreen('newgame');
    showToast('Error al iniciar: ' + err.message, 'danger');
  }
});

// ─────────────────────────────────────────────────────────────
//  CONTINUE SAVE
// ─────────────────────────────────────────────────────────────
async function continueSave() {
  showScreen('game');
  await initGame();
  if (SkyLine.load()) {
    refreshAllPanels();
    updateHubTag(SkyLine.game?.airline?.hubAirports ?? []);
    showToast('Partida cargada correctamente.', 'success');
  } else {
    showToast('Error al cargar la partida.', 'danger');
  }
}

// ─────────────────────────────────────────────────────────────
//  INIT GAME (inicializa motores y mapa)
// ─────────────────────────────────────────────────────────────
async function initGame() {
  const airports = await loadAirports();
  _airports = airports;
  SkyLine.init(_airports, []);
  subscribeToEvents();
  initMap();
  // Forzar que Leaflet recalcule el tamaño del contenedor
  if (_map) setTimeout(() => _map.invalidateSize(), 100);
  renderMarketTab();
}

async function loadAirports() {
  try {
    const res = await fetch('data/airports.json');
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();
    return data.map(a => new AirportData(a));
  } catch {
    console.warn('[UI] airports.json no encontrado. Usando aeropuertos de muestra.');
    return getSampleAirports();
  }
}

// ─────────────────────────────────────────────────────────────
//  SAMPLE AIRPORTS (demo si no hay airports.json)
// ─────────────────────────────────────────────────────────────
function getSampleAirports() {
  const data = [
    { iataCode:'ORD', displayName:"Chicago O'Hare International",   city:'Chicago',         country:'United States', region:'North America', airportClass:'F', latitude:41.9742,  longitude:-87.9073,  landingFeePerFlight:18000, demandMultiplier:1.4,  isUnlockedAtStart:true },
    { iataCode:'ATL', displayName:'Atlanta Hartsfield-Jackson',      city:'Atlanta',         country:'United States', region:'North America', airportClass:'F', latitude:33.6407,  longitude:-84.4277,  landingFeePerFlight:18000, demandMultiplier:1.4,  isUnlockedAtStart:true },
    { iataCode:'LAX', displayName:'Los Angeles International',       city:'Los Angeles',     country:'United States', region:'North America', airportClass:'F', latitude:33.9425,  longitude:-118.4081, landingFeePerFlight:18000, demandMultiplier:1.4,  isUnlockedAtStart:true },
    { iataCode:'JFK', displayName:'John F. Kennedy International',   city:'New York',        country:'United States', region:'North America', airportClass:'F', latitude:40.6413,  longitude:-73.7781,  landingFeePerFlight:18000, demandMultiplier:1.4,  isUnlockedAtStart:true },
    { iataCode:'DFW', displayName:'Dallas Fort Worth International', city:'Dallas',          country:'United States', region:'North America', airportClass:'F', latitude:32.8998,  longitude:-97.0403,  landingFeePerFlight:18000, demandMultiplier:1.35, isUnlockedAtStart:true },
    { iataCode:'LHR', displayName:'London Heathrow Airport',         city:'London',          country:'United Kingdom',region:'Europe',        airportClass:'F', latitude:51.4775,  longitude:-0.4614,   landingFeePerFlight:18000, demandMultiplier:1.5,  isUnlockedAtStart:true },
    { iataCode:'CDG', displayName:'Paris Charles de Gaulle',         city:'Paris',           country:'France',        region:'Europe',        airportClass:'F', latitude:49.0097,  longitude:2.5479,    landingFeePerFlight:18000, demandMultiplier:1.45, isUnlockedAtStart:true },
    { iataCode:'FRA', displayName:'Frankfurt Airport',               city:'Frankfurt',       country:'Germany',       region:'Europe',        airportClass:'F', latitude:50.0379,  longitude:8.5622,    landingFeePerFlight:18000, demandMultiplier:1.4,  isUnlockedAtStart:true },
    { iataCode:'AMS', displayName:'Amsterdam Schiphol',              city:'Amsterdam',       country:'Netherlands',   region:'Europe',        airportClass:'F', latitude:52.3086,  longitude:4.7639,    landingFeePerFlight:18000, demandMultiplier:1.35, isUnlockedAtStart:true },
    { iataCode:'DXB', displayName:'Dubai International Airport',     city:'Dubai',           country:'UAE',           region:'Middle East',   airportClass:'F', latitude:25.2532,  longitude:55.3657,   landingFeePerFlight:18000, demandMultiplier:1.5,  isUnlockedAtStart:true },
    { iataCode:'HND', displayName:'Tokyo Haneda Airport',            city:'Tokyo',           country:'Japan',         region:'Asia',          airportClass:'F', latitude:35.5494,  longitude:139.7798,  landingFeePerFlight:18000, demandMultiplier:1.45, isUnlockedAtStart:true },
    { iataCode:'SIN', displayName:'Singapore Changi Airport',        city:'Singapore',       country:'Singapore',     region:'Asia',          airportClass:'F', latitude:1.3644,   longitude:103.9915,  landingFeePerFlight:18000, demandMultiplier:1.4,  isUnlockedAtStart:true },
    { iataCode:'MIA', displayName:'Miami International Airport',     city:'Miami',           country:'United States', region:'North America', airportClass:'E', latitude:25.7959,  longitude:-80.287,   landingFeePerFlight:9500,  demandMultiplier:1.2,  isUnlockedAtStart:true },
    { iataCode:'MAD', displayName:'Adolfo Suárez Madrid-Barajas',    city:'Madrid',          country:'Spain',         region:'Europe',        airportClass:'E', latitude:40.4983,  longitude:-3.5676,   landingFeePerFlight:9500,  demandMultiplier:1.2,  isUnlockedAtStart:true },
    { iataCode:'BCN', displayName:'Barcelona El Prat Airport',       city:'Barcelona',       country:'Spain',         region:'Europe',        airportClass:'E', latitude:41.2971,  longitude:2.0785,    landingFeePerFlight:9500,  demandMultiplier:1.15, isUnlockedAtStart:true },
    { iataCode:'GRU', displayName:'São Paulo Guarulhos International',city:'São Paulo',       country:'Brazil',        region:'South America', airportClass:'E', latitude:-23.4356, longitude:-46.4731,  landingFeePerFlight:9500,  demandMultiplier:1.1,  isUnlockedAtStart:true },
    { iataCode:'BOG', displayName:'El Dorado International Airport', city:'Bogotá',          country:'Colombia',      region:'South America', airportClass:'E', latitude:4.7016,   longitude:-74.1469,  landingFeePerFlight:9500,  demandMultiplier:1.05, isUnlockedAtStart:true },
    { iataCode:'MEX', displayName:'Benito Juárez International Airport', city:'Ciudad de México', country:'Mexico',  region:'North America', airportClass:'E', latitude:19.4363,  longitude:-99.0721,  landingFeePerFlight:9500,  demandMultiplier:1.1,  isUnlockedAtStart:true },
    { iataCode:'SCL', displayName:'Arturo Merino Benítez International', city:'Santiago',    country:'Chile',         region:'South America', airportClass:'E', latitude:-33.3928, longitude:-70.7856,  landingFeePerFlight:9500,  demandMultiplier:1.0,  isUnlockedAtStart:true },
    { iataCode:'LIM', displayName:'Jorge Chávez International Airport',  city:'Lima',        country:'Peru',          region:'South America', airportClass:'D', latitude:-12.0219, longitude:-77.1143,  landingFeePerFlight:4200,  demandMultiplier:0.9,  isUnlockedAtStart:true },
    { iataCode:'MDE', displayName:'José María Córdova International',    city:'Medellín',    country:'Colombia',      region:'South America', airportClass:'D', latitude:6.1645,   longitude:-75.4231,  landingFeePerFlight:4200,  demandMultiplier:0.85, isUnlockedAtStart:true },
    { iataCode:'EZE', displayName:'Ministro Pistarini International',    city:'Buenos Aires',country:'Argentina',     region:'South America', airportClass:'D', latitude:-34.8222, longitude:-58.5358,  landingFeePerFlight:4200,  demandMultiplier:0.9,  isUnlockedAtStart:true },
    { iataCode:'PTY', displayName:'Tocumen International Airport',       city:'Panama City', country:'Panama',        region:'Central America',airportClass:'D', latitude:9.0714,   longitude:-79.3835,  landingFeePerFlight:4200,  demandMultiplier:0.9,  isUnlockedAtStart:true },
    { iataCode:'SYD', displayName:'Sydney Kingsford Smith Airport',      city:'Sydney',      country:'Australia',     region:'Oceania',       airportClass:'E', latitude:-33.9399, longitude:151.1753,  landingFeePerFlight:9500,  demandMultiplier:1.15, isUnlockedAtStart:true },
    { iataCode:'NRT', displayName:'Narita International Airport',        city:'Tokyo',       country:'Japan',         region:'Asia',          airportClass:'F', latitude:35.7720,  longitude:140.3929,  landingFeePerFlight:18000, demandMultiplier:1.4,  isUnlockedAtStart:true },
    { iataCode:'ICN', displayName:'Incheon International Airport',       city:'Seoul',       country:'South Korea',   region:'Asia',          airportClass:'F', latitude:37.4602,  longitude:126.4407,  landingFeePerFlight:18000, demandMultiplier:1.35, isUnlockedAtStart:true },
    { iataCode:'PVG', displayName:'Shanghai Pudong International',       city:'Shanghai',    country:'China',         region:'Asia',          airportClass:'F', latitude:31.1443,  longitude:121.8083,  landingFeePerFlight:18000, demandMultiplier:1.45, isUnlockedAtStart:true },
    { iataCode:'CAI', displayName:'Cairo International Airport',         city:'Cairo',       country:'Egypt',         region:'Africa',        airportClass:'E', latitude:30.1219,  longitude:31.4056,   landingFeePerFlight:9500,  demandMultiplier:1.0,  isUnlockedAtStart:true },
    { iataCode:'JNB', displayName:'O.R. Tambo International Airport',    city:'Johannesburg',country:'South Africa',  region:'Africa',        airportClass:'E', latitude:-26.1367, longitude:28.2411,   landingFeePerFlight:9500,  demandMultiplier:1.05, isUnlockedAtStart:true },
    { iataCode:'MCO', displayName:'Orlando International Airport',       city:'Orlando',     country:'United States', region:'North America', airportClass:'D', latitude:28.4312,  longitude:-81.3081,  landingFeePerFlight:4200,  demandMultiplier:1.0,  isUnlockedAtStart:true },
  ];
  return data.map(a => new AirportData(a));
}

// ─────────────────────────────────────────────────────────────
//  EVENTS (suscripción a todos los motores)
// ─────────────────────────────────────────────────────────────
function subscribeToEvents() {
  const g  = SkyLine.game;
  const ec = SkyLine.economy;
  const re = SkyLine.routes;
  const ev = SkyLine.events;

  g.on('onDayAdvanced',       date  => updateHUDDate(date));
  g.on('onHourChanged',       hour  => updateHUDTime(hour));
  g.on('onMonthChanged',      ()    => updateHUDFleetRoutes());
  g.on('onReputationChanged', rep   => updateHUDRep(rep));
  g.on('onFleetUpdated',      ()    => updateHUDFleetRoutes());
  g.on('onRoutesUpdated',     ()    => updateHUDFleetRoutes());

  g.on('onGameStateChanged', state => {
    if (state === 'MonthlyReport') showMonthlyReport();
    if (state === 'Playing')       closeMonthlyReport();
  });

  ec.on('onCashChanged', () => updateHUDCash());

  re.on('onSeasonChanged', season => updateHUDSeason(season));
  re.on('onRouteOpened',   route  => {
    // confirmNewRoute() ya dibuja y muestra toast; este listener cubre casos externos
    if (!document.getElementById('modal-newroute').classList.contains('active')) {
      drawRoute(route.originIATA, route.destinationIATA, route.routeId);
      updateMarkerStyle(route.originIATA, 'route');
      updateMarkerStyle(route.destinationIATA, 'route');
      updateHUDFleetRoutes();
    }
  });
  re.on('onRouteClosed', route => {
    removeRouteFromMap(route.routeId);
    showToast(`Ruta ${route.originIATA}→${route.destinationIATA} cerrada.`, 'warning');
  });
  re.on('onRouteProfitAlert', route =>
    showToast(`⚠ Ruta ${route.originIATA}→${route.destinationIATA} tiene pérdidas.`, 'warning'));

  ev.on('onEventTriggered', active => showEventModal(active));
  ev.on('onEventExpired',   active =>
    showToast(`Evento expirado: ${active.data.titleES}. Consecuencias máximas aplicadas.`, 'danger'));
  ev.on('onEventResolved',  result =>
    showToast(result.messageES, result.success ? 'success' : 'warning'));

  ec.on('onLoanApproved',  loan => showToast(`Préstamo aprobado: $${loan.principal.toLocaleString()}`, 'success'));
  ec.on('onLoanDefaulted', ()   => showToast('⚠ DEFAULT en préstamo. Reputación penalizada.', 'danger'));
}
