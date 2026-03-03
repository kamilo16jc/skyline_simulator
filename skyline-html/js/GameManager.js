// ═══════════════════════════════════════════════════════════════
//  SkyLine — GameManager.js
//  Portado desde GameManager.cs (Unity C#)
//  Controlador principal del juego
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  ENUMS
// ─────────────────────────────────────────────────────────────

const GameState = Object.freeze({
    MainMenu:      'MainMenu',
    Loading:       'Loading',
    Playing:       'Playing',
    Paused:        'Paused',
    MonthlyReport: 'MonthlyReport',
    GameOver:      'GameOver',
    Victory:       'Victory',
    Bankruptcy:    'Bankruptcy'
});

const GameSpeed = Object.freeze({
    Paused: 0,
    Normal: 1,
    Fast:   3,
    Ultra:  6
});

const DifficultyLevel = Object.freeze({
    Easy:      'Easy',       // $10M inicial, eventos reducidos
    Normal:    'Normal',     // $5M inicial, eventos normales
    Hard:      'Hard',       // $2M inicial, eventos frecuentes
    Realistic: 'Realistic'   // $1M inicial, sin ayudas
});

// Duración de un día de juego en milisegundos según el modo
// Tycoon:   3.2 h reales = 5× acelerado  (16 h de vuelo / 5 = 3.2 h)
// Realista: 16 h reales  = tiempo 1:1    (un vuelo de 7 h tarda 7 h reales)
const DAY_DURATIONS = Object.freeze({
    Tycoon:   11_520_000,   //  3.2 h × 3600 × 1000
    Realista: 57_600_000    // 16.0 h × 3600 × 1000
});

// ─────────────────────────────────────────────────────────────
//  CLASES DE DATOS
// ─────────────────────────────────────────────────────────────

class GameDate {
    constructor(day, month, year) {
        this.day   = day;
        this.month = month;
        this.year  = year;
    }

    toShortString() {
        return `${String(this.day).padStart(2,'0')}/${String(this.month).padStart(2,'0')}/${this.year}`;
    }

    toLongString() {
        const months = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        return `${this.day} de ${months[this.month]} de ${this.year}`;
    }

    advanceDay() {
        this.day++;
        const daysInMonth = new Date(this.year, this.month, 0).getDate();
        if (this.day > daysInMonth) { this.day = 1; this.month++; }
        if (this.month > 12)        { this.month = 1; this.year++; }
    }

    isNewMonth(previousDay)   { return this.day === 1 && previousDay > 1; }
    isNewYear(previousMonth)  { return this.month === 1 && previousMonth === 12; }
    isQuarter()               { return (this.month === 3 || this.month === 6 ||
                                        this.month === 9 || this.month === 12) && this.day === 1; }

    clone() { return new GameDate(this.day, this.month, this.year); }
}

class AirlineProfile {
    constructor() {
        this.airlineName          = '';
        this.iataCode             = '';          // 2 letras, ej: "SK"
        this.icaoCode             = '';          // 3 letras, ej: "SKL"
        this.hubAirports          = [];   // array de IATA — permite múltiples hubs
        this.logoColor            = '#1a6fc4';
        this.difficulty           = DifficultyLevel.Normal;
        this.foundedDate          = new GameDate(1,1,2024);
        this.reputation           = 50;          // 0-100
        this.safetyRating         = 3.5;         // 0-5
        this.totalFlightsOperated = 0;
        this.totalPassengersCarried = 0;
        this.totalKmFlown         = 0;
    }
}

class FleetEntry {
    constructor() {
        this.aircraftId        = '';
        this.aircraftDataId    = '';
        this.tailNumber        = '';
        this.assignedRouteId   = null;
        this.currentAirport    = '';
        this.isOperational     = true;
        this.ageYears          = 0;
        this.conditionPercent  = 100;
        this.isLeased          = false;
        this.monthlyLeaseCost  = 0;
        // Configuración personalizada de asientos (null = usar defaults del catálogo)
        this.seatsEconomy      = null;
        this.seatsBusiness     = null;
        this.seatsPremium      = null;
    }
}

class Route {
    constructor() {
        this.routeId            = '';
        this.originIATA         = '';
        this.destinationIATA    = '';
        this.assignedAircraftId = null;
        this.distanceKm         = 0;
        this.flightsPerWeek     = 0;
        this.schedule           = [1,1,1,1,1,1,1];  // vuelos por día (Lun→Dom)
        this.currentOccupancy   = 0.65;   // 65% inicial
        this.demandMultiplier   = 1.0;
        this.isActive           = true;
        this.isPaused           = false;
        this.pauseReason        = null;   // 'manual' | 'seasonal' | 'low_demand'
        this.isInternational    = false;
        this.baseFareEconomy    = 0;
        this.baseFareBusiness   = 0;
        this.baseFarePremium    = 0;
        this.weeklyRevenue      = 0;
        this.weeklyProfit       = 0;
        this.dayPlan            = null;  // null = sin plan manual; [[depHour,...] × 7 días]
    }
}

class GameSettings {
    constructor() {
        this.autoPause           = true;
        this.showTutorial        = true;
        this.language            = 'ES';
        this.musicVolume         = 0.7;
        this.sfxVolume           = 0.8;
        this.notificationsOn     = true;
        this.autoSave            = true;
        this.autoSaveIntervalMin = 5;
    }
}

// ─────────────────────────────────────────────────────────────
//  GAME MANAGER — CLASE PRINCIPAL (Singleton)
// ─────────────────────────────────────────────────────────────

class GameManager {
    constructor() {
        if (GameManager._instance) return GameManager._instance;
        GameManager._instance = this;

        // Estado del juego
        this._gameState   = GameState.MainMenu;
        this._gameSpeed   = GameSpeed.Normal;
        this._currentDate = new GameDate(1,1,2024);
        this._dayDuration = 30000;  // ms por día (30 segundos)
        this._dayTimer      = 0;
        this._previousDay   = 1;
        this._previousMonth = 1;
        this._previousHour  = -1;
        this._lastTick      = null;

        // Aerolínea
        this._airline = new AirlineProfile();
        this._fleet   = [];
        this._routes  = [];

        // Configuración
        this._settings   = new GameSettings();
        this._difficulty = DifficultyLevel.Normal;

        // Coordenadas de aeropuertos
        this._airportCoords = new Map();  // iata -> { lat, lon, country }

        // Acumuladores mensuales
        this._monthlyFlightRevenue   = 0;
        this._monthlyCargoRevenue    = 0;
        this._monthlyFuelCost        = 0;
        this._monthlyCrewCost        = 0;
        this._monthlyMaintenanceCost = 0;
        this._monthlyAirportFees     = 0;
        this._monthlyLeaseCost       = 0;

        // Referencias a otros motores
        this._economy = null;  // Se asigna externamente: GameManager.instance.economy = EconomyEngine.instance

        // Event listeners
        this._listeners = {
            onGameStateChanged:  [],
            onDayAdvanced:       [],
            onHourChanged:       [],
            onMonthChanged:      [],
            onYearChanged:       [],
            onGameSpeedChanged:  [],
            onReputationChanged: [],
            onFleetUpdated:      [],
            onRoutesUpdated:     []
        };

        this._tickInterval = null;
    }

    static get instance() {
        if (!GameManager._instance) new GameManager();
        return GameManager._instance;
    }

    // ── Propiedades públicas ──
    get state()     { return this._gameState; }
    get speed()     { return this._gameSpeed; }
    get date()      { return this._currentDate; }
    get airline()   { return this._airline; }
    get fleet()     { return this._fleet; }
    get routes()    { return this._routes; }
    get settings()  { return this._settings; }
    get isPlaying()    { return this._gameState === GameState.Playing; }
    get economy()      { return this._economy; }
    set economy(e)     { this._economy = e; }
    /** Hora del día en juego (0–23), derivada del progreso del tick actual */
    get currentHour()  { return Math.floor((this._dayTimer / Math.max(1, this._dayDuration)) * 24); }

    /** Snapshot del mes en curso para el panel de economía */
    get currentMonthSnapshot() {
        const daysInMonth = this._currentDate.daysInMonth?.() ?? 30;
        const dayOfMonth  = this._currentDate.day ?? 1;
        return {
            revenue:     this._monthlyFlightRevenue,
            fuelCost:    this._monthlyFuelCost,
            airportFees: this._monthlyAirportFees,
            leaseCost:   this._monthlyLeaseCost,
            dayOfMonth,
            daysInMonth,
            progress: dayOfMonth / daysInMonth,
        };
    }

    // ─────────────────────────────────────────────────────────
    //  EVENTOS (Observer pattern, reemplaza C# events)
    // ─────────────────────────────────────────────────────────

    on(event, callback) {
        if (this._listeners[event]) this._listeners[event].push(callback);
    }

    off(event, callback) {
        if (this._listeners[event])
            this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    }

    _emit(event, data) {
        if (this._listeners[event])
            this._listeners[event].forEach(cb => cb(data));
    }

    // ─────────────────────────────────────────────────────────
    //  CARGAR AEROPUERTOS
    // ─────────────────────────────────────────────────────────

    loadAirports(airportsArray) {
        this._airportCoords.clear();
        airportsArray.forEach(a => {
            if (a && a.iataCode)
                this._airportCoords.set(a.iataCode, {
                    lat: a.latitude, lon: a.longitude, country: a.country
                });
        });
        console.log(`[GameManager] ${this._airportCoords.size} aeropuertos cargados.`);
    }

    // ─────────────────────────────────────────────────────────
    //  NUEVA PARTIDA
    // ─────────────────────────────────────────────────────────

    startNewGame(airlineName, iataCode, hubIATA, gameMode) {
        this._gameMode    = gameMode ?? 'Tycoon';
        this._dayDuration = DAY_DURATIONS[this._gameMode] ?? DAY_DURATIONS.Tycoon;

        this._airline = new AirlineProfile();
        this._airline.airlineName    = airlineName;
        this._airline.iataCode       = iataCode.toUpperCase();
        this._airline.icaoCode       = iataCode.toUpperCase() + 'L';
        this._airline.hubAirports    = [hubIATA];  // primer hub
        // Usar la fecha real del sistema como punto de partida
        const _now = new Date();
        const _startDate = new GameDate(_now.getDate(), _now.getMonth() + 1, _now.getFullYear());

        this._airline.foundedDate    = _startDate.clone();
        this._airline.reputation     = 50;
        this._airline.safetyRating   = 3.5;

        this._currentDate   = _startDate;
        this._previousDay   = 1;
        this._previousMonth = 1;
        this._fleet         = [];
        this._routes        = [];

        // Todos los modos empiezan con $5,000,000
        const startingCash = 5_000_000;

        if (this._economy) {
            this._economy.addRevenue(startingCash, 'Capital inicial');
            const hubClass = this._getAirportClass(hubIATA);
            this._economy.rentGate(hubIATA, hubClass);
        }

        this.setGameState(GameState.Playing);
        this._startTick();
        console.log(`[GameManager] Nueva partida: ${airlineName} (${iataCode}) Hub: ${hubIATA} | Modo: ${this._gameMode} | _dayDuration: ${this._dayDuration}ms | $${startingCash.toLocaleString()} inicial`);
    }

    // ─────────────────────────────────────────────────────────
    //  LOOP PRINCIPAL — TIEMPO DE JUEGO
    // ─────────────────────────────────────────────────────────

    _startTick() {
        if (this._tickInterval) clearInterval(this._tickInterval);
        this._lastTick = Date.now();
        this._tickInterval = setInterval(() => this._tick(), 100);  // cada 100ms
    }

    _stopTick() {
        if (this._tickInterval) { clearInterval(this._tickInterval); this._tickInterval = null; }
    }

    _tick() {
        if (this._gameState !== GameState.Playing) return;
        if (this._gameSpeed === GameSpeed.Paused) return;

        const now     = Date.now();
        const delta   = now - (this._lastTick || now);
        this._lastTick = now;

        this._dayTimer += delta * this._gameSpeed;

        // Emitir cambio de hora (0–23) cuando avanza la hora en el día actual
        const hour = this.currentHour;
        if (hour !== this._previousHour) {
            this._previousHour = hour;
            this._emit('onHourChanged', hour);
        }

        if (this._dayTimer >= this._dayDuration) {
            this._dayTimer -= this._dayDuration;
            this._previousHour = -1;   // resetear al comenzar el nuevo día
            this._advanceDay();
        }
    }

    _advanceDay() {
        this._previousDay   = this._currentDate.day;
        this._previousMonth = this._currentDate.month;

        this._currentDate.advanceDay();
        this._emit('onDayAdvanced', this._currentDate);

        if (this._currentDate.isNewMonth(this._previousDay)) {
            this._handleNewMonth();
            this._emit('onMonthChanged', this._currentDate);
        }

        if (this._currentDate.isNewYear(this._previousMonth)) {
            this._handleNewYear();
            this._emit('onYearChanged', this._currentDate);
        }

        if (this._currentDate.isQuarter() && this._economy?.stock?.isPubliclyTraded) {
            this._economy.payQuarterlyDividends();
        }

        this._accumulateDailyOperations();

        // Auto-save
        if (this._settings.autoSave && this._currentDate.day % this._settings.autoSaveIntervalMin === 0)
            this.saveGame();
    }

    // ─────────────────────────────────────────────────────────
    //  OPERACIONES DIARIAS
    // ─────────────────────────────────────────────────────────

    _accumulateDailyOperations() {
        this._routes.forEach(route => {
            if (!route.isActive) return;

            const flightsToday = route.flightsPerWeek / 7;
            const fleetEntry   = this._getFleetEntry(route.assignedAircraftId);
            if (!fleetEntry || !fleetEntry.isOperational) return;

            const aircraftData = this._getAircraftData(fleetEntry.aircraftDataId);
            if (!aircraftData) return;

            // Si el avión tiene asientos personalizados, crear objeto efectivo con esos valores
            const acEff = (fleetEntry.seatsEconomy !== null)
                ? Object.assign(Object.create(Object.getPrototypeOf(aircraftData)), aircraftData, {
                      seatsEconomy:  fleetEntry.seatsEconomy,
                      seatsBusiness: fleetEntry.seatsBusiness,
                      seatsPremium:  fleetEntry.seatsPremium
                  })
                : aircraftData;

            const dailyRevenue = this._calculateDailyRouteRevenue(route, acEff, flightsToday);
            const dailyFuel    = this._calculateDailyFuelCost(route, acEff, flightsToday);
            const dailyAirport = this._calculateDailyAirportFees(route, acEff, flightsToday);

            this._monthlyFlightRevenue += dailyRevenue;
            this._monthlyFuelCost      += dailyFuel;
            this._monthlyAirportFees   += dailyAirport;

            route.weeklyRevenue = dailyRevenue * 7;
        });

        // Desgaste de flota
        this._fleet.forEach(plane => {
            if (!plane.isOperational) return;
            plane.conditionPercent -= 0.02;
            if (plane.conditionPercent < 20) {
                plane.isOperational = false;
                console.warn(`[Fleet] ${plane.tailNumber} requiere mantenimiento urgente.`);
            }
        });
    }

    _calculateDailyRouteRevenue(route, aircraft, flights) {
        if (!this._economy) return 0;
        // × 2: cada vuelo genera ingresos en AMBOS sentidos (BOG→MIA + MIA→BOG)
        return this._economy.calculateFlightRevenue(
            aircraft.seatsEconomy, aircraft.seatsBusiness, aircraft.seatsPremium,
            route.currentOccupancy, route.demandMultiplier,
            route.baseFareEconomy, route.baseFareBusiness,
            route.baseFarePremium, route.distanceKm) * flights * 2;
    }

    _calculateDailyFuelCost(route, aircraft, flights) {
        if (!this._economy) return 0;
        // × 2: combustible para ida y vuelta
        return this._economy.calculateFuelCost(
            aircraft.fuelBurnPerHour, route.distanceKm,
            aircraft.cruiseSpeedKmh) * flights * 2;
    }

    _calculateDailyAirportFees(route, aircraft, flights) {
        if (!this._economy) return 0;
        const seats     = aircraft.seatsEconomy + aircraft.seatsBusiness;
        const destClass = this._getAirportClass(route.destinationIATA);
        const origClass = this._getAirportClass(route.originIATA);
        // Ida: tasas en destino — Vuelta: tasas en origen (que es el destino del regreso)
        return (this._economy.calculateAirportFees(destClass, seats) +
                this._economy.calculateAirportFees(origClass, seats)) * flights;
    }

    // ─────────────────────────────────────────────────────────
    //  CIERRE MENSUAL
    // ─────────────────────────────────────────────────────────

    _handleNewMonth() {
        const totalPilots    = this._fleet.length * 2;
        const totalCabinCrew = this._fleet.length * 5;
        this._monthlyCrewCost = this._economy
            ? this._economy.calculateCrewCost(totalPilots, totalCabinCrew) : 0;

        this._monthlyMaintenanceCost = 0;
        this._fleet.forEach(plane => {
            const data = this._getAircraftData(plane.aircraftDataId);
            if (data && this._economy)
                this._monthlyMaintenanceCost += this._economy.calculateMaintenanceCost(data.family, plane.ageYears);
        });

        // Costo mensual de arriendos (leases)
        this._monthlyLeaseCost = this._fleet
            .filter(p => p.isLeased)
            .reduce((sum, p) => sum + (p.monthlyLeaseCost ?? 0), 0);

        const closingMonth = this._currentDate.month === 1 ? 12 : this._currentDate.month - 1;
        const closingYear  = this._currentDate.month === 1 ? this._currentDate.year - 1 : this._currentDate.year;

        if (this._economy) {
            this._economy.closeMonth(
                closingYear, closingMonth,
                this._monthlyFlightRevenue,
                this._monthlyCargoRevenue,
                this._monthlyFuelCost,
                this._monthlyCrewCost,
                this._monthlyMaintenanceCost,
                this._monthlyAirportFees,
                this._monthlyLeaseCost
            );
        }

        this._updateReputation();

        if (this._economy?.stock?.isPubliclyTraded) {
            const lastBalance = this._economy.getLastBalance();
            this._economy.updateStockPrice(this._airline.reputation, lastBalance?.netProfit ?? 0);
        }

        this._resetMonthlyAccumulators();

        // ── Chequeo de bancarrota ──
        if (this._economy && this._economy.cash <= 0) {
            console.warn('[GameManager] 💸 BANCARROTA — La aerolínea se quedó sin fondos.');
            this.setGameState(GameState.Bankruptcy);
            return;
        }

        if (this._economy?.isInFinancialDistress()) {
            console.warn('[GameManager] ⚠️ ALERTA FINANCIERA — Reservas de efectivo críticas.');
        }

        this.setGameState(GameState.MonthlyReport);
        console.log(`[GameManager] Cierre de mes: ${closingMonth}/${closingYear}`);
    }

    /** Estadísticas para la pantalla de bancarrota */
    getBankruptcyStats() {
        const history = this._economy?._balanceHistory ?? [];
        const peakProfit = history.length
            ? Math.max(...history.map(b => b.netProfit)) : 0;
        return {
            airlineName:    this._airline?.name ?? 'Tu aerolínea',
            hubCode:        this._airline?.hubAirports?.[0] ?? '—',
            monthsOperated: history.length,
            totalRoutes:    this._routes.length,
            fleetSize:      this._fleet.length,
            peakProfit,
            reputation:     Math.round(this._airline?.reputation ?? 0),
        };
    }

    _handleNewYear() {
        this._fleet.forEach(plane => {
            plane.ageYears++;
            if (plane.isLeased)
                plane.conditionPercent = Math.min(100, plane.conditionPercent + 15);
        });
        console.log(`[GameManager] ¡Nuevo año ${this._currentDate.year}! Flota: ${this._fleet.length} | Rutas: ${this._routes.length}`);
    }

    _resetMonthlyAccumulators() {
        this._monthlyFlightRevenue   = 0;
        this._monthlyCargoRevenue    = 0;
        this._monthlyFuelCost        = 0;
        this._monthlyCrewCost        = 0;
        this._monthlyMaintenanceCost = 0;
        this._monthlyAirportFees     = 0;
        this._monthlyLeaseCost       = 0;
    }

    // ─────────────────────────────────────────────────────────
    //  REPUTACIÓN
    // ─────────────────────────────────────────────────────────

    modifyReputation(delta, reason = '') {
        this._airline.reputation = Math.max(0, Math.min(100, this._airline.reputation + delta));
        if (reason) console.log(`[Reputation] ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} — ${reason}. Total: ${this._airline.reputation.toFixed(1)}`);
        this._emit('onReputationChanged', this._airline.reputation);
        this._updateRouteDemand();
    }

    _updateReputation() {
        if (this._airline.reputation > 60)
            this.modifyReputation(-0.5, 'Decaimiento natural');

        const activeRoutes = this._routes.filter(r => r.isActive).length;
        if (activeRoutes > 5)
            this.modifyReputation(0.3 * activeRoutes * 0.1, 'Operaciones exitosas');
    }

    _updateRouteDemand() {
        const reputationFactor = this._airline.reputation / 100;
        this._routes.forEach(route => {
            const baseDemand = 0.5 + (reputationFactor * 0.5);
            route.demandMultiplier = Math.max(0.3, Math.min(2.0, baseDemand));
        });
    }

    // ─────────────────────────────────────────────────────────
    //  GESTIÓN DE FLOTA
    // ─────────────────────────────────────────────────────────

    addAircraftToFleet(aircraftDataId, currentAirport, isLeased = false, leaseCost = 0, customSeats = null) {
        const entry = new FleetEntry();
        entry.aircraftId        = 'AC_' + Math.random().toString(36).substr(2, 8);
        entry.aircraftDataId    = aircraftDataId;
        entry.tailNumber        = `${this._airline.iataCode}-${String(this._fleet.length + 1).padStart(3,'0')}`;
        entry.currentAirport    = currentAirport;
        entry.isOperational     = true;
        entry.isLeased          = isLeased;
        entry.monthlyLeaseCost  = leaseCost;

        // Aplicar configuración personalizada de asientos
        if (customSeats) {
            entry.seatsEconomy  = customSeats.eco  ?? null;
            entry.seatsBusiness = customSeats.biz  ?? null;
            entry.seatsPremium  = customSeats.prem ?? null;
        }

        this._fleet.push(entry);
        this._emit('onFleetUpdated', this._fleet);
        console.log(`[Fleet] ${entry.tailNumber} agregado a la flota (${isLeased ? `Arrendado $${leaseCost.toLocaleString()}/mes` : 'Propio'})`);
        return entry;
    }

    removeAircraftFromFleet(aircraftId) {
        const entry = this._getFleetEntry(aircraftId);
        if (!entry) return false;

        if (entry.assignedRouteId) {
            const route = this._getRoute(entry.assignedRouteId);
            if (route) route.isActive = false;
        }

        this._fleet = this._fleet.filter(f => f.aircraftId !== aircraftId);
        this._emit('onFleetUpdated', this._fleet);
        console.log(`[Fleet] ${entry.tailNumber} retirado de la flota`);
        return true;
    }

    sendToMaintenance(aircraftId, daysRequired) {
        const entry = this._getFleetEntry(aircraftId);
        if (!entry) return;

        entry.isOperational = false;

        if (entry.assignedRouteId) {
            const route = this._getRoute(entry.assignedRouteId);
            if (route) route.isActive = false;
        }

        const waitMs = daysRequired * (this._dayDuration / Math.max(1, this._gameSpeed));
        setTimeout(() => {
            const e = this._getFleetEntry(aircraftId);
            if (e) {
                e.isOperational    = true;
                e.conditionPercent = 100;
                console.log(`[Fleet] ${e.tailNumber} regresó del mantenimiento. ✓`);
                if (e.assignedRouteId) {
                    const r = this._getRoute(e.assignedRouteId);
                    if (r) r.isActive = true;
                }
            }
        }, waitMs);

        console.log(`[Fleet] ${entry.tailNumber} en mantenimiento por ${daysRequired} días`);
    }

    // ─────────────────────────────────────────────────────────
    //  GESTIÓN DE RUTAS
    // ─────────────────────────────────────────────────────────

    openRoute(originIATA, destinationIATA, aircraftId, flightsPerWeek,
              fareEconomy, fareBusiness = 0, farePremium = 0) {
        if (this._economy && !this._economy.hasGateAt(originIATA)) {
            console.warn(`[Routes] No tienes gate en ${originIATA}. Compra o renta uno primero.`);
            return null;
        }

        const plane = this._getFleetEntry(aircraftId);
        if (!plane || !plane.isOperational) {
            console.warn(`[Routes] Avión ${aircraftId} no disponible`);
            return null;
        }

        const distance = this._calculateRouteDistance(originIATA, destinationIATA);
        const isIntl   = this._isInternationalRoute(originIATA, destinationIATA);

        const route = new Route();
        route.routeId            = `RT_${originIATA}_${destinationIATA}`;
        route.originIATA         = originIATA;
        route.destinationIATA    = destinationIATA;
        route.assignedAircraftId = aircraftId;
        route.distanceKm         = distance;
        route.flightsPerWeek     = flightsPerWeek;
        // Distribuir flightsPerWeek en el horario semanal (Lun→Dom)
        const _base  = Math.floor(flightsPerWeek / 7);
        const _extra = flightsPerWeek % 7;
        route.schedule = Array.from({length:7}, (_, i) => _base + (i < _extra ? 1 : 0));
        route.currentOccupancy   = 0.65;
        route.demandMultiplier   = 1.0;
        route.isActive           = true;
        route.isInternational    = isIntl;
        route.baseFareEconomy    = fareEconomy;
        route.baseFareBusiness   = fareBusiness > 0 ? fareBusiness : fareEconomy * 3.5;
        route.baseFarePremium    = farePremium  > 0 ? farePremium  : fareEconomy * 6.0;

        plane.assignedRouteId = route.routeId;
        this._routes.push(route);
        this._emit('onRoutesUpdated', this._routes);

        console.log(`[Routes] Ruta abierta: ${originIATA}→${destinationIATA} | ${flightsPerWeek}x semana | $${fareEconomy.toLocaleString()} economy`);
        return route;
    }

    closeRoute(routeId) {
        const route = this._getRoute(routeId);
        if (!route) return false;

        // Liberar avión asignado
        const plane = this._getFleetEntry(route.assignedAircraftId);
        if (plane) plane.assignedRouteId = null;

        // Eliminar permanentemente del array
        this._routes = this._routes.filter(r => r.routeId !== routeId);
        this._emit('onRoutesUpdated', this._routes);
        console.log(`[Routes] Ruta cancelada: ${route.originIATA}→${route.destinationIATA}`);
        return true;
    }

    pauseRoute(routeId, reason = 'manual') {
        const route = this._getRoute(routeId);
        if (!route || route.isPaused) return false;

        route.isActive    = false;
        route.isPaused    = true;
        route.pauseReason = reason;

        // Liberar avión para que pueda usarse en otras rutas
        const plane = this._getFleetEntry(route.assignedAircraftId);
        if (plane) plane.assignedRouteId = null;
        route.assignedAircraftId = null;

        this._emit('onRoutesUpdated', this._routes);
        console.log(`[Routes] Ruta ${route.originIATA}→${route.destinationIATA} pausada (${reason})`);
        return true;
    }

    resumeRoute(routeId, newAircraftId) {
        const route = this._getRoute(routeId);
        if (!route || !route.isPaused) return false;

        const plane = this._getFleetEntry(newAircraftId);
        if (!plane || !plane.isOperational) {
            console.warn(`[Routes] Avión ${newAircraftId} no disponible para reanudar`);
            return false;
        }

        route.isActive           = true;
        route.isPaused           = false;
        route.pauseReason        = null;
        route.assignedAircraftId = newAircraftId;
        plane.assignedRouteId    = routeId;

        this._emit('onRoutesUpdated', this._routes);
        console.log(`[Routes] Ruta ${route.originIATA}→${route.destinationIATA} reanudada (${plane.tailNumber})`);
        return true;
    }

    updateRouteSchedule(routeId, schedule) {
        const route = this._getRoute(routeId);
        if (!route) return false;

        route.schedule       = [...schedule];
        route.flightsPerWeek = schedule.reduce((a, b) => a + b, 0);
        this._emit('onRoutesUpdated', this._routes);
        return true;
    }

    // ─────────────────────────────────────────────────────────
    //  CONTROL DE ESTADO
    // ─────────────────────────────────────────────────────────

    setGameState(newState) {
        if (this._gameState === newState) return;
        this._gameState = newState;
        this._emit('onGameStateChanged', newState);
        console.log(`[GameManager] Estado: ${newState}`);

        if (newState !== GameState.Playing) this._stopTick();
        else this._startTick();
    }

    setGameSpeed(speed) {
        this._gameSpeed = speed;
        this._emit('onGameSpeedChanged', speed);
    }

    pauseGame()   { this.setGameState(GameState.Paused); }
    resumeGame()  { this.setGameState(GameState.Playing); }
    togglePause() {
        if (this._gameState === GameState.Playing) this.pauseGame();
        else if (this._gameState === GameState.Paused) this.resumeGame();
    }

    // ─────────────────────────────────────────────────────────
    //  GUARDADO Y CARGA
    // ─────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────
    //  GESTIÓN DE HUBS
    // ─────────────────────────────────────────────────────────

    isHubAirport(iata) {
        return this._airline?.hubAirports?.includes(iata) ?? false;
    }

    addHub(iata) {
        if (!this._airline) return false;
        if (!Array.isArray(this._airline.hubAirports)) this._airline.hubAirports = [];
        if (this._airline.hubAirports.includes(iata)) return false;
        this._airline.hubAirports.push(iata);
        console.log(`[GameManager] Hub añadido: ${iata} | Hubs: ${this._airline.hubAirports.join(', ')}`);
        return true;
    }

    removeHub(iata) {
        if (!this._airline?.hubAirports) return false;
        if (this._airline.hubAirports.length <= 1) return false; // no se puede quitar el único hub
        const idx = this._airline.hubAirports.indexOf(iata);
        if (idx === -1) return false;
        this._airline.hubAirports.splice(idx, 1);
        console.log(`[GameManager] Hub eliminado: ${iata} | Hubs restantes: ${this._airline.hubAirports.join(', ')}`);
        return true;
    }

    saveGame() {
        const SaveSystem = window.SaveSystem;
        if (!SaveSystem) return;

        const econState = this._economy?.getSaveState();
        const data = {
            airline:     this._airline,
            currentDate: this._currentDate,
            lastState:   this._gameState,
            fleet:       this._fleet,
            routes:      this._routes,
            settings:    this._settings,
            gameMode:    this._gameMode    ?? 'Tycoon',
            cash:        econState?.cash        ?? 0,
            creditScore: econState?.creditScore ?? 700,
            loans:       econState?.loans       ?? [],
            gates:       econState?.gates       ?? []
        };

        SaveSystem.save(data);
        console.log(`[Save] Partida guardada — ${this._currentDate?.toShortString()}`);
    }

    loadGame() {
        const SaveSystem = window.SaveSystem;
        if (!SaveSystem) return false;

        const data = SaveSystem.load();
        if (!data) return false;

        this._airline     = data.airline     ?? new AirlineProfile();

        // ── Migración: saves antiguos usaban hubAirportIATA (string) ──
        if (!Array.isArray(this._airline.hubAirports) || this._airline.hubAirports.length === 0) {
            const legacy = this._airline.hubAirportIATA ?? this._airline.hubAirports;
            this._airline.hubAirports = (legacy && typeof legacy === 'string') ? [legacy] : [];
        }

        if (data.currentDate) {
            this._currentDate = new GameDate(data.currentDate.day, data.currentDate.month, data.currentDate.year);
        } else {
            // Sin fecha guardada → arrancar desde hoy
            const _n = new Date();
            this._currentDate = new GameDate(_n.getDate(), _n.getMonth() + 1, _n.getFullYear());
        }
        this._fleet    = data.fleet    ?? [];
        this._routes   = data.routes   ?? [];
        this._settings = data.settings ?? new GameSettings();

        // Restaurar modo de juego y velocidad del tiempo
        this._gameMode    = data.gameMode ?? 'Tycoon';
        this._dayDuration = DAY_DURATIONS[this._gameMode] ?? DAY_DURATIONS.Tycoon;

        this._economy?.loadFromSave(data.cash, data.creditScore, data.loans, data.gates);

        this.setGameState(GameState.Playing);
        console.log(`[Load] Partida cargada: ${this._airline.airlineName} — ${this._currentDate.toShortString()} | Modo: ${this._gameMode}`);
        return true;
    }

    deleteSave()  { window.SaveSystem?.deleteSave(); }
    getSaveInfo() { return window.SaveSystem?.getSaveInfo() ?? 'Sin partida guardada'; }
    get hasSave() { return window.SaveSystem?.hasSave() ?? false; }

    // ─────────────────────────────────────────────────────────
    //  MANEJADORES DE EVENTOS DEL ECONOMY
    // ─────────────────────────────────────────────────────────

    handleMonthClosed(balance) {
        if (balance.netProfit > 0)
            this.modifyReputation(1.5, 'Mes rentable');
        else
            this.modifyReputation(-2, 'Mes con pérdidas');

        if (this._airline)
            this._airline.totalFlightsOperated += this._routes.length * 4;
    }

    handleLoanDefault(loan) {
        this.modifyReputation(-10, 'Default en préstamo bancario');
        console.error('[GameManager] DEFAULT en préstamo. Reputación afectada.');
    }

    handleIPO() {
        this.modifyReputation(15, 'IPO exitoso en bolsa');
        console.log('[GameManager] ¡Aerolínea cotiza en bolsa! +15 reputación');
    }

    // ─────────────────────────────────────────────────────────
    //  UTILIDADES PRIVADAS
    // ─────────────────────────────────────────────────────────

    _getFleetEntry(aircraftId) { return this._fleet.find(f => f.aircraftId === aircraftId) ?? null; }
    _getRoute(routeId)         { return this._routes.find(r => r.routeId === routeId) ?? null; }

    _getAircraftData(dataId) {
        // En HTML: busca en el catálogo global de aviones
        return window.AIRCRAFT_CATALOG?.find(a => a.aircraftId === dataId) ?? null;
    }

    _getAirportClass(iata) {
        const classF = ['ORD','ATL','DFW','DEN','LAX','JFK','LHR','CDG','FRA','AMS','DXB','HND','PEK','PVG'];
        const classE = ['MIA','IAH','SFO','SEA','BOS','EWR','MUC','MAD','BCN','FCO','GRU','BOG','MEX','SCL'];
        const classD = ['MCO','LAS','PHX','CLT','DTW','MSP','MDE','LIM','GIG','EZE','UIO','CCS','PTY'];
        if (classF.includes(iata)) return 1;
        if (classE.includes(iata)) return 2;
        if (classD.includes(iata)) return 3;
        return 4;
    }

    _calculateRouteDistance(originIATA, destIATA) {
        const a = this._airportCoords.get(originIATA);
        const b = this._airportCoords.get(destIATA);
        if (a && b) return this._haversineKm(a.lat, a.lon, b.lat, b.lon);
        // Fallback
        let hash = 0;
        for (const c of (originIATA + destIATA)) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
        return 500 + (hash % 14500);
    }

    _haversineKm(lat1, lon1, lat2, lon2) {
        const R    = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a    = Math.sin(dLat/2)**2 +
                     Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
                     Math.sin(dLon/2)**2;
        const c    = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return Math.round(R * c);
    }

    _isInternationalRoute(originIATA, destIATA) {
        const a = this._airportCoords.get(originIATA);
        const b = this._airportCoords.get(destIATA);
        if (a && b) return a.country.toLowerCase() !== b.country.toLowerCase();
        return false;
    }

    destroy() { this._stopTick(); }
}

GameManager._instance = null;

// Exportar para uso en módulos o como global
if (typeof module !== 'undefined') module.exports = { GameManager, GameState, GameSpeed, DifficultyLevel, GameDate, AirlineProfile, FleetEntry, Route, GameSettings };
else window.GameManager = GameManager, window.GameState = GameState, window.GameSpeed = GameSpeed, window.DifficultyLevel = DifficultyLevel, window.GameDate = GameDate;
