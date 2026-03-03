// ═══════════════════════════════════════════════════════════════
//  SkyLine — ui-airport-panel.js
//  Panel lateral de información del aeropuerto seleccionado.
//  Incluye diccionario ISO de países y generador de banderas.
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  BANDERAS DE PAÍSES
//  Diccionario nombre → código ISO-2 (155 países)
// ─────────────────────────────────────────────────────────────
const COUNTRY_ISO = {
  // A
  'Afghanistan':'AF','Albania':'AL','Algeria':'DZ','Argentina':'AR',
  'Armenia':'AM','Australia':'AU','Austria':'AT','Azerbaijan':'AZ',
  // B
  'Bahamas':'BS','Bahrain':'BH','Bangladesh':'BD','Belgium':'BE',
  'Benin':'BJ','Bolivia':'BO','Bosnia':'BA','Botswana':'BW',
  'Brazil':'BR','Bulgaria':'BG','Burkina Faso':'BF','Burundi':'BI',
  // C
  'Cambodia':'KH','Cameroon':'CM','Canada':'CA','Chile':'CL',
  'China':'CN','CNMI':'MP','Colombia':'CO','Congo':'CG',
  'Costa Rica':'CR','Croatia':'HR','Cuba':'CU','Cyprus':'CY',
  'Czech Republic':'CZ',
  // D
  'Denmark':'DK','Djibouti':'DJ','Dominican Republic':'DO',
  // E
  'Ecuador':'EC','Egypt':'EG','El Salvador':'SV','Estonia':'EE',
  'Ethiopia':'ET',
  // F
  'Fiji':'FJ','Finland':'FI','France':'FR','French Polynesia':'PF',
  // G
  'Gabon':'GA','Georgia':'GE','Germany':'DE','Ghana':'GH',
  'Gibraltar':'GI','Greece':'GR','Greenland':'GL','Guam':'GU',
  'Guatemala':'GT','Guinea':'GN','Guyana':'GY',
  // H
  'Honduras':'HN','Hungary':'HU',
  // I
  'Iceland':'IS','India':'IN','Indonesia':'ID','Iran':'IR',
  'Iraq':'IQ','Ireland':'IE','Israel':'IL','Italy':'IT',
  'Ivory Coast':'CI',
  // J
  'Jamaica':'JM','Japan':'JP','Jordan':'JO',
  // K
  'Kazakhstan':'KZ','Kenya':'KE','Kosovo':'XK','Kuwait':'KW',
  'Kyrgyzstan':'KG',
  // L
  'Laos':'LA','Latvia':'LV','Lebanon':'LB','Libya':'LY',
  'Lithuania':'LT',
  // M
  'Madagascar':'MG','Malawi':'MW','Malaysia':'MY','Maldives':'MV',
  'Mali':'ML','Malta':'MT','Marshall Islands':'MH','Mexico':'MX',
  'Mongolia':'MN','Montenegro':'ME','Morocco':'MA','Mozambique':'MZ',
  'Myanmar':'MM',
  // N
  'Namibia':'NA','Nepal':'NP','Netherlands':'NL','New Zealand':'NZ',
  'Nicaragua':'NI','Nigeria':'NG','North Macedonia':'MK','Norway':'NO',
  // O
  'Oman':'OM',
  // P
  'Pakistan':'PK','Palau':'PW','Panama':'PA','Papua New Guinea':'PG',
  'Paraguay':'PY','Peru':'PE','Philippines':'PH','Poland':'PL',
  'Portugal':'PT','Puerto Rico':'PR',
  // Q
  'Qatar':'QA',
  // R
  'Romania':'RO','Russia':'RU','Rwanda':'RW',
  // S
  'Samoa':'WS','Saudi Arabia':'SA','Senegal':'SN','Serbia':'RS',
  'Sierra Leone':'SL','Singapore':'SG','Slovakia':'SK','Slovenia':'SI',
  'Solomon Islands':'SB','Somalia':'SO','South Africa':'ZA',
  'South Korea':'KR','South Sudan':'SS','Spain':'ES','Sri Lanka':'LK',
  'Sudan':'SD','Sweden':'SE','Switzerland':'CH','Syria':'SY',
  // T
  'Taiwan':'TW','Tajikistan':'TJ','Tanzania':'TZ','Thailand':'TH',
  'Tonga':'TO','Trinidad and Tobago':'TT','Tunisia':'TN','Turkey':'TR',
  'Turkmenistan':'TM',
  // U
  'UAE':'AE','Uganda':'UG','UK':'GB','Ukraine':'UA','USA':'US',
  'Uruguay':'UY','Uzbekistan':'UZ',
  // V
  'Venezuela':'VE','Vietnam':'VN',
  // Y
  'Yemen':'YE',
  // Z
  'Zambia':'ZM','Zimbabwe':'ZW'
};

// Emoji de bandera Unicode (fallback para entornos que lo soporten)
function countryFlag(countryName) {
  const iso = COUNTRY_ISO[countryName];
  if (!iso || iso.length !== 2) return '🌐';
  return String.fromCodePoint(
    0x1F1E6 + (iso.charCodeAt(0) - 65),
    0x1F1E6 + (iso.charCodeAt(1) - 65)
  );
}

// Imagen real de bandera via flagcdn.com (funciona en Windows)
function flagImg(countryName, w = 20, h = 15) {
  const iso = COUNTRY_ISO[countryName];
  if (!iso) return '<span style="font-size:1rem;line-height:1">🌐</span>';
  return `<img src="https://flagcdn.com/${w}x${h}/${iso.toLowerCase()}.png" `
       + `width="${w}" height="${h}" `
       + `style="border-radius:2px;object-fit:cover;vertical-align:middle;flex-shrink:0" `
       + `loading="lazy" onerror="this.replaceWith(document.createTextNode('🌐'))">`;
}

// ─────────────────────────────────────────────────────────────
//  COSTOS DE APERTURA DE HUB (pago único, por clase de aeropuerto)
// ─────────────────────────────────────────────────────────────
const HUB_SETUP_COST = {
  'F': 2_500_000,   // Hub clase F — aeropuerto mega (ORD, LHR, CDG…)
  'E': 1_000_000,   // Hub clase E — aeropuerto grande (BOG, MIA, MAD…)
  'D':   400_000,   // Hub clase D — aeropuerto mediano
  'C':   150_000,   // Hub clase C — aeropuerto pequeño
};

function _hubCost(airport) {
  return HUB_SETUP_COST[airport.airportClass] ?? 400_000;
}

// ─────────────────────────────────────────────────────────────
//  AIRPORT PANEL
// ─────────────────────────────────────────────────────────────
function openAirportPanel(airport) {
  _selectedAirport = airport;

  // Resetear selección visual en todos los marcadores
  Object.keys(_airportMarkers).forEach(iata => {
    const g = SkyLine.game;
    const isHub    = g?.airline?.hubAirports?.includes(iata) ?? false;
    const hasRoute = g?.routes?.some(r => (r.originIATA === iata || r.destinationIATA === iata) && r.isActive);
    const cls = isHub ? 'hub' : hasRoute ? 'route' : '';
    updateMarkerStyle(iata, cls);
  });
  updateMarkerStyle(airport.iataCode, 'selected');

  // Datos del aeropuerto
  document.getElementById('apt-iata').textContent = airport.iataCode;
  document.getElementById('apt-name').textContent = airport.displayName;
  document.getElementById('apt-location').textContent = `${airport.city}, ${airport.country}`;
  document.getElementById('apt-coords').textContent =
    `${airport.latitude.toFixed(2)}°, ${airport.longitude.toFixed(2)}°`;
  document.getElementById('apt-region').textContent   = airport.region || '–';
  document.getElementById('apt-fee').textContent      = '$' + (airport.landingFeePerFlight || 0).toLocaleString();
  document.getElementById('apt-demand').textContent   = ((airport.demandMultiplier || 1) * 100).toFixed(0) + '%';
  document.getElementById('apt-minplane').textContent = airport.minAircraftClass || 'C';

  // Clase badge
  const badge = document.getElementById('apt-class');
  badge.textContent = 'Clase ' + airport.airportClass;
  badge.className   = 'apt-class-badge class-' + airport.airportClass;

  // Gate status
  const hasGate   = SkyLine.economy?.hasGateAt(airport.iataCode);
  const hubAirports = SkyLine.game?.airline?.hubAirports ?? [];
  const isHub     = hubAirports.includes(airport.iataCode);
  const isPrimary = hubAirports[0] === airport.iataCode;
  const classNum  = airport.classNumber;
  const gateCostMap = { 1:'$850,000/mes', 2:'$280,000/mes', 3:'$95,000/mes', 4:'$22,000/mes' };
  const gateCostStr = gateCostMap[classNum] || '$22,000/mes';

  document.getElementById('apt-gate-status').textContent =
    isPrimary ? '★ Hub Principal'
    : isHub   ? '⭐ Hub Secundario'
    : hasGate ? '✓ Gate operativo'
              : '✗ Sin gate';
  document.getElementById('apt-gate-status').style.color =
    isHub ? 'var(--accent)' : hasGate ? 'var(--success)' : 'var(--danger)';

  const btnGate = document.getElementById('apt-btn-gate');
  if (isHub) {
    btnGate.textContent = '★ Hub — Gate incluido';
    btnGate.disabled = true;
  } else if (hasGate) {
    btnGate.textContent = '✓ Gate ya rentado';
    btnGate.disabled = true;
  } else {
    btnGate.textContent = `Rentar Gate — ${gateCostStr}`;
    btnGate.disabled = false;
  }

  // Botón de Hub: Añadir / Quitar (no se puede quitar el único hub)
  const btnHub = document.getElementById('apt-btn-hub');
  if (isHub && hubAirports.length <= 1) {
    btnHub.textContent = '★ Hub Principal (único)';
    btnHub.disabled    = true;
  } else if (isHub) {
    btnHub.textContent = '✕ Quitar como Hub';
    btnHub.disabled    = false;
  } else if (hasGate) {
    const cost = _hubCost(airport);
    btnHub.textContent = `⭐ Añadir como Hub — $${cost.toLocaleString()}`;
    btnHub.disabled    = false;
  } else {
    btnHub.textContent = '⭐ Añadir Hub (requiere gate)';
    btnHub.disabled    = true;
  }

  const btnRoute = document.getElementById('apt-btn-route');
  if (isHub) {
    btnRoute.textContent   = '✈ Nueva Ruta desde aquí →';
    btnRoute.disabled      = false;
    btnRoute.style.opacity = '1';
  } else {
    const hubList = hubAirports.length ? hubAirports.join('/') : 'HUB';
    btnRoute.textContent   = `Rutas solo desde hubs (${hubList})`;
    btnRoute.disabled      = true;
    btnRoute.style.opacity = '0.45';
  }

  document.getElementById('panel-airport').classList.add('open');
}

function closeAirportPanel() {
  document.getElementById('panel-airport').classList.remove('open');
  _selectedAirport = null;
}

// ─────────────────────────────────────────────────────────────
//  BOTONES DEL PANEL
// ─────────────────────────────────────────────────────────────
document.getElementById('apt-btn-gate').addEventListener('click', () => {
  if (!_selectedAirport) return;
  const ok = SkyLine.economy.rentGate(_selectedAirport.iataCode, _selectedAirport.classNumber);
  if (ok) {
    showToast(`Gate rentado en ${_selectedAirport.iataCode}.`, 'success');
    openAirportPanel(_selectedAirport);
    updateHUDCash();
  }
});

document.getElementById('apt-btn-hub').addEventListener('click', () => {
  if (!_selectedAirport) return;
  const g    = SkyLine.game;
  const iata = _selectedAirport.iataCode;
  const isHub = g.airline.hubAirports?.includes(iata);

  if (isHub) {
    // Quitar hub (solo si no es el único)
    const ok = g.removeHub(iata);
    if (!ok) { showToast('No puedes eliminar el único hub.', 'warning'); return; }
    updateMarkerStyle(iata, SkyLine.economy?.hasGateAt(iata) ? 'route' : '');
    showToast(`${iata} eliminado como hub.`, 'info');
  } else {
    // Añadir como hub (requiere gate)
    if (!SkyLine.economy?.hasGateAt(iata)) {
      showToast(`Necesitas un gate en ${iata} antes de hacerlo hub.`, 'warning'); return;
    }
    const cost = _hubCost(_selectedAirport);
    const paid = SkyLine.economy.deductExpense(cost, `Apertura hub ${iata}`);
    if (!paid) {
      showToast(`Fondos insuficientes. Abrir hub en ${iata} cuesta $${cost.toLocaleString()}.`, 'danger'); return;
    }
    g.addHub(iata);
    updateMarkerStyle(iata, 'hub');
    updateHUDCash();
    showToast(`⭐ ${iata} añadido como hub. −$${cost.toLocaleString()}`, 'success');
  }

  updateHubTag(g.airline.hubAirports);
  openAirportPanel(_selectedAirport);
});

document.getElementById('apt-btn-route').addEventListener('click', () => {
  if (!_selectedAirport) return;
  const hubs = SkyLine.game?.airline?.hubAirports ?? [];
  if (!hubs.includes(_selectedAirport.iataCode)) {
    showToast(`Las rutas solo pueden originarse desde un hub (${hubs.join(', ')}).`, 'warning');
    return;
  }
  // Abrir modal con este hub como origen
  openNewRouteModal(null, _selectedAirport.iataCode);
});
