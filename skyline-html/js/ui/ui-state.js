// ═══════════════════════════════════════════════════════════════
//  SkyLine — ui-state.js
//  Variables de estado global de la interfaz
//  Declaradas aquí para que todos los módulos UI las compartan
// ═══════════════════════════════════════════════════════════════

let _map             = null;   // Instancia de Leaflet
let _clusterGroup    = null;   // Leaflet.markercluster group
let _airportMarkers  = {};     // iata → { marker, airport, el }
let _routeLines      = {};     // routeId → Leaflet polyline
let _selectedAirport = null;   // AirportData actualmente seleccionado
let _gameMode        = 'Tycoon';   // 'Tycoon' | 'Realista'
let _airports        = [];     // Array completo de AirportData cargados
let _eventTimerInterval = null;
