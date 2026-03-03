// ═══════════════════════════════════════════════════════════════
//  SkyLine — index.js
//  Punto de entrada — inicializa y conecta todos los motores
//  Orden de carga en HTML:
//    1. data/models.js
//    2. SaveSystem.js
//    3. EconomyEngine.js
//    4. RouteEngine.js
//    5. EventEngine.js
//    6. GameManager.js
//    7. index.js  ← este archivo
// ═══════════════════════════════════════════════════════════════

/**
 * SkyLine — Inicializador del juego
 *
 * Uso:
 *   SkyLine.init(airportsData);       // Pasa el array de aeropuertos
 *   SkyLine.newGame('Mi Aerolínea', 'MY', 'ORD', 'Normal');
 *   SkyLine.load();                   // Cargar partida guardada
 *
 * Acceso a motores:
 *   SkyLine.game     → GameManager.instance
 *   SkyLine.economy  → EconomyEngine.instance
 *   SkyLine.routes   → RouteEngine.instance
 *   SkyLine.events   → EventEngine.instance
 */

const SkyLine = {
    game:    null,
    economy: null,
    routes:  null,
    events:  null,

    /**
     * Inicializa todos los motores del juego.
     * @param {Array} airportsData  - Array de objetos AirportData (1103 aeropuertos)
     * @param {Array} eventsData    - Array de objetos EventData (eventos aleatorios)
     */
    init(airportsData = [], eventsData = []) {
        console.log('[SkyLine] Inicializando motores...');

        // Crear instancias singleton
        this.economy = EconomyEngine.instance;
        this.routes  = RouteEngine.instance;
        this.events  = EventEngine.instance;
        this.game    = GameManager.instance;

        // Conectar economía con el game manager
        this.game.economy = this.economy;

        // Cargar aeropuertos en todos los motores que los necesitan
        this.game.loadAirports(airportsData);
        this.routes.init(this.game, this.economy, airportsData);
        this.events.init(this.game, this.economy, eventsData);

        // Conectar eventos del EconomyEngine al GameManager
        this.economy.on('onMonthClosed',   (b) => this.game.handleMonthClosed(b));
        this.economy.on('onLoanDefaulted', (l) => this.game.handleLoanDefault(l));
        this.economy.on('onIPOCompleted',  ()  => this.game.handleIPO());

        // Registrar SaveSystem como global para uso del GameManager
        window.SaveSystem = SaveSystem;

        // Registrar catálogo de aviones
        if (typeof DEFAULT_AIRCRAFT_CATALOG !== 'undefined')
            window.AIRCRAFT_CATALOG = DEFAULT_AIRCRAFT_CATALOG;

        console.log('[SkyLine] ✓ Todos los motores iniciados correctamente.');
        console.log(`[SkyLine] Aeropuertos: ${airportsData.length} | Eventos: ${eventsData.length} | Aviones: ${window.AIRCRAFT_CATALOG?.length ?? 0}`);

        return this;
    },

    /**
     * Inicia una nueva partida.
     */
    newGame(airlineName, iataCode, hubIATA, gameMode = 'Tycoon') {
        this.game.startNewGame(airlineName, iataCode, hubIATA, gameMode);
    },

    /**
     * Carga una partida guardada.
     */
    load() {
        return this.game.loadGame();
    },

    /**
     * Guarda la partida actual.
     */
    save() {
        this.game.saveGame();
    },

    /**
     * Info sobre la partida guardada (para menú principal).
     */
    getSaveInfo() {
        return SaveSystem.getSaveInfo();
    },

    hasSave() {
        return SaveSystem.hasSave();
    }
};

// Hacer global para acceso desde el HTML
if (typeof window !== 'undefined') {
    window.SkyLine = SkyLine;
}

// ─────────────────────────────────────────────────────────────
//  EJEMPLO DE USO (descomenta para probar en consola del navegador)
// ─────────────────────────────────────────────────────────────
/*
// 1. Inicializar con aeropuertos cargados desde JSON
fetch('data/airports.json')
    .then(r => r.json())
    .then(airports => {
        const airportObjects = airports.map(a => new AirportData(a));
        SkyLine.init(airportObjects, []);

        // 2. Nueva partida
        SkyLine.newGame('SkyLine Air', 'SL', 'ORD', 'Normal');

        // 3. Escuchar eventos
        SkyLine.game.on('onDayAdvanced', (date) => {
            document.getElementById('hud-date').textContent = date.toShortString();
        });

        SkyLine.economy.on('onCashChanged', (cash) => {
            document.getElementById('hud-cash').textContent = '$' + cash.toLocaleString();
        });
    });
*/
