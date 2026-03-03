// ═══════════════════════════════════════════════════════════════
//  SkyLine — RouteEngine.js
//  Portado desde RouteEngine.cs (Unity C#)
//  Motor de rutas y demanda dinámica
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  ENUMS
// ─────────────────────────────────────────────────────────────

const RouteStatus = Object.freeze({
    Active:    'Active',
    Suspended: 'Suspended',
    Cancelled: 'Cancelled',
    Seasonal:  'Seasonal'
});

const SeasonType = Object.freeze({
    Spring: 'Spring',   // Marzo - Mayo
    Summer: 'Summer',   // Junio - Agosto (alta temporada)
    Fall:   'Fall',     // Septiembre - Noviembre
    Winter: 'Winter'    // Diciembre - Febrero (alta temporada navideña)
});

const PricingStrategy = Object.freeze({
    Budget:   'Budget',
    Standard: 'Standard',
    Premium:  'Premium',
    Dynamic:  'Dynamic'
});

// ─────────────────────────────────────────────────────────────
//  CLASES DE DATOS
// ─────────────────────────────────────────────────────────────

class RouteCompetitor {
    constructor() {
        this.competitorName = '';
        this.iataCode       = '';
        this.marketShare    = 0;
        this.avgFareEconomy = 0;
        this.avgOccupancy   = 0;
        this.flightsPerWeek = 0;
        this.reputationScore = 0;
    }
}

class RouteAnalytics {
    constructor() {
        this.routeId               = '';
        this.totalRevenue          = 0;
        this.totalCosts            = 0;
        this.netProfit             = 0;
        this.avgOccupancy          = 0;
        this.avgFare               = 0;
        this.totalFlightsOperated  = 0;
        this.totalPassengersCarried = 0;
        this.onTimePerformance     = 0.95;
        this.profitMargin          = 0;
    }

    get isProfitable() { return this.netProfit > 0; }

    get performanceRating() {
        if (this.profitMargin > 0.20) return 'Excelente';
        if (this.profitMargin > 0.10) return 'Bueno';
        if (this.profitMargin > 0)    return 'Marginal';
        return 'Con pérdidas';
    }
}

class DemandFactor {
    constructor(name, multiplier, daysActive, isPermanent = false) {
        this.name          = name;
        this.multiplier    = multiplier;
        this.daysRemaining = daysActive;
        this.isPermanent   = isPermanent;
    }
}

class RouteData {
    constructor() {
        this.routeId            = '';
        this.originIATA         = '';
        this.destinationIATA    = '';
        this.originCity         = '';
        this.destinationCity    = '';
        this.distanceKm         = 0;
        this.isInternational    = false;
        this.airportClassOrigin = 4;
        this.airportClassDest   = 4;

        this.assignedAircraftId = null;
        this.status             = RouteStatus.Active;
        this.pricingStrategy    = PricingStrategy.Standard;

        this.flightsPerWeek    = 0;
        this.currentOccupancy  = 0.65;
        this.targetOccupancy   = 0.80;

        this.baseFareEconomy    = 0;
        this.baseFareBusiness   = 0;
        this.baseFarePremium    = 0;
        this.currentFareEconomy = 0;
        this.currentFareBusiness = 0;
        this.currentFarePremium = 0;

        this.baseDemand        = 0.5;
        this.demandMultiplier  = 1.0;
        this.demandFactors     = [];
        this.competitors       = [];
        this.analytics         = new RouteAnalytics();

        this.isSeasonal    = false;
        this.activeSeasons = [];
    }

    get effectiveFareEconomy()  { return this.currentFareEconomy  > 0 ? this.currentFareEconomy  : this.baseFareEconomy; }
    get effectiveFareBusiness() { return this.currentFareBusiness > 0 ? this.currentFareBusiness : this.baseFareBusiness; }
    get effectiveFarePremium()  { return this.currentFarePremium  > 0 ? this.currentFarePremium  : this.baseFarePremium; }
}

// ─────────────────────────────────────────────────────────────
//  ROUTE ENGINE — CLASE PRINCIPAL (Singleton)
// ─────────────────────────────────────────────────────────────

class RouteEngine {
    constructor() {
        if (RouteEngine._instance) return RouteEngine._instance;
        RouteEngine._instance = this;

        this._routes               = [];
        this._globalDemandMultiplier = 1.0;
        this._fuelPricePerLiter    = 0.85;
        this._currentSeason        = SeasonType.Summer;
        this._fuelPriceHistory     = [];
        this._airportCoords        = new Map();  // iata -> { lat, lon, country }

        // Referencias
        this._game    = null;  // window.GameManager.instance
        this._economy = null;  // window.EconomyEngine.instance

        // Competidores predefinidos
        this._competitorNames = [
            'AeroGlobal','SkyConnect','TransAir','PacificWings',
            'AtlanticJet','MegaFly','StarRoutes','SunAir',
            'NorthernAir','CoastalJet','BlueSky Airlines','RapidAir'
        ];
        this._competitorIatas = [
            'AG','SC','TA','PW','AJ','MF','SR','SA','NA','CJ','BS','RA'
        ];

        // Listeners
        this._listeners = {
            onRouteOpened:     [],
            onRouteClosed:     [],
            onRouteProfitAlert:[],
            onFuelPriceChanged:[],
            onSeasonChanged:   []
        };

        console.log(`[RouteEngine] Iniciado. Temporada: ${this._currentSeason} | Combustible: $${this._fuelPricePerLiter.toFixed(2)}/L`);
    }

    static get instance() {
        if (!RouteEngine._instance) new RouteEngine();
        return RouteEngine._instance;
    }

    // ── Propiedades ──
    get routes()          { return this._routes; }
    get globalDemand()    { return this._globalDemandMultiplier; }
    get fuelPrice()       { return this._fuelPricePerLiter; }
    get currentSeason()   { return this._currentSeason; }
    get activeRouteCount(){ return this._routes.filter(r => r.status === RouteStatus.Active).length; }

    on(event, callback) {
        if (this._listeners[event]) this._listeners[event].push(callback);
    }

    _emit(event, data) {
        if (this._listeners[event]) this._listeners[event].forEach(cb => cb(data));
    }

    // ─────────────────────────────────────────────────────────
    //  INICIALIZACIÓN
    // ─────────────────────────────────────────────────────────

    init(gameManager, economyEngine, airportsArray) {
        this._game    = gameManager;
        this._economy = economyEngine;

        // Cargar coordenadas
        if (airportsArray) {
            this._airportCoords.clear();
            airportsArray.forEach(a => {
                if (a?.iataCode)
                    this._airportCoords.set(a.iataCode, { lat: a.latitude, lon: a.longitude, country: a.country });
            });
            console.log(`[RouteEngine] ${this._airportCoords.size} aeropuertos cargados para distancias.`);
        }

        // Temporada inicial
        if (this._game?.date) {
            this._currentSeason = this._getCurrentSeason(this._game.date.month);
        }

        // Suscribirse a eventos del GameManager
        if (this._game) {
            this._game.on('onDayAdvanced',  (date) => this._handleDayAdvanced(date));
            this._game.on('onMonthChanged', (date) => this._handleMonthChanged(date));
        }
    }

    // ─────────────────────────────────────────────────────────
    //  APERTURA Y CIERRE DE RUTAS
    // ─────────────────────────────────────────────────────────

    openRoute(originIATA, destinationIATA, originCity, destinationCity,
              aircraftId, flightsPerWeek, fareEconomy,
              strategy = PricingStrategy.Standard) {

        if (this.routeExists(originIATA, destinationIATA)) {
            console.warn(`[RouteEngine] Ya existe la ruta ${originIATA}→${destinationIATA}`);
            return null;
        }

        if (this._economy && !this._economy.hasGateAt(originIATA)) {
            console.warn(`[RouteEngine] Necesitas un gate en ${originIATA}`);
            return null;
        }

        const distance = this._calculateDistance(originIATA, destinationIATA);
        const isIntl   = this._isInternational(originIATA, destinationIATA);
        const classO   = this._getAirportClass(originIATA);
        const classD   = this._getAirportClass(destinationIATA);

        const fares      = this._calculateFares(fareEconomy, strategy, distance, isIntl);
        const baseDemand = this._calculateBaseDemand(distance, classO, classD, isIntl);

        const route = new RouteData();
        route.routeId            = `RT_${originIATA}_${destinationIATA}`;
        route.originIATA         = originIATA;
        route.destinationIATA    = destinationIATA;
        route.originCity         = originCity;
        route.destinationCity    = destinationCity;
        route.distanceKm         = distance;
        route.isInternational    = isIntl;
        route.airportClassOrigin = classO;
        route.airportClassDest   = classD;
        route.assignedAircraftId = aircraftId;
        route.flightsPerWeek     = flightsPerWeek;
        route.pricingStrategy    = strategy;
        route.baseFareEconomy    = fareEconomy;
        route.baseFareBusiness   = fares.business;
        route.baseFarePremium    = fares.premium;
        route.currentFareEconomy = fareEconomy;
        route.currentFareBusiness = fares.business;
        route.currentFarePremium  = fares.premium;
        route.baseDemand         = baseDemand;
        route.demandMultiplier   = this._getSeasonMultiplier(this._currentSeason, isIntl);
        route.analytics.routeId  = route.routeId;

        this._generateCompetitors(route);
        route.currentOccupancy = this._calculateInitialOccupancy(route);

        this._routes.push(route);
        this._emit('onRouteOpened', route);

        console.log(`[RouteEngine] Ruta abierta: ${originIATA}→${destinationIATA} | ${distance}km | ${flightsPerWeek}x/sem | $${fareEconomy.toLocaleString()} eco | Demanda: ${(baseDemand*100).toFixed(0)}%`);
        return route;
    }

    closeRoute(routeId) {
        const route = this.getRoute(routeId);
        if (!route) return false;
        route.status = RouteStatus.Cancelled;
        this._emit('onRouteClosed', route);
        console.log(`[RouteEngine] Ruta cerrada: ${route.originIATA}→${route.destinationIATA}`);
        return true;
    }

    suspendRoute(routeId) {
        const route = this.getRoute(routeId);
        if (!route) return false;
        route.status = RouteStatus.Suspended;
        return true;
    }

    reactivateRoute(routeId) {
        const route = this.getRoute(routeId);
        if (!route) return false;
        route.status = RouteStatus.Active;
        return true;
    }

    // ─────────────────────────────────────────────────────────
    //  UPDATE DIARIO Y MENSUAL
    // ─────────────────────────────────────────────────────────

    _handleDayAdvanced(date) {
        this._routes.forEach(route => {
            if (route.status !== RouteStatus.Active) return;
            this._updateDemandFactors(route);
            if (route.pricingStrategy === PricingStrategy.Dynamic) this._applyDynamicPricing(route);
            this._simulateDailyOccupancy(route);
            this._recordDailyRevenue(route);
        });
        this._fluctuateFuelPrice();
    }

    _handleMonthChanged(date) {
        const newSeason = this._getCurrentSeason(date.month);
        if (newSeason !== this._currentSeason) {
            this._currentSeason = newSeason;
            this._applySeasonalDemand();
            this._emit('onSeasonChanged', this._currentSeason);
            console.log(`[RouteEngine] Nueva temporada: ${this._currentSeason}`);
        }
        this._analyzeRoutePerformance();
        this._updateCompetitors();
    }

    // ─────────────────────────────────────────────────────────
    //  SISTEMA DE DEMANDA
    // ─────────────────────────────────────────────────────────

    _calculateBaseDemand(distanceKm, classOrigin, classDest, isIntl) {
        const classSum = classOrigin + classDest;
        const classFactor = classSum <= 2 ? 1.4  :
                            classSum === 3 ? 1.25 :
                            classSum === 4 ? 1.1  :
                            classSum === 5 ? 0.95 :
                            classSum === 6 ? 0.80 : 0.65;

        const distanceFactor = distanceKm < 500  ? 0.7  :
                               distanceKm < 1500 ? 0.9  :
                               distanceKm < 4000 ? 1.0  :
                               distanceKm < 8000 ? 1.1  : 1.2;

        const intlFactor = isIntl ? 1.15 : 1.0;
        return Math.max(0.2, Math.min(1.0, 0.50 * classFactor * distanceFactor * intlFactor));
    }

    addDemandFactor(routeId, name, multiplier, daysActive, isPermanent = false) {
        const route = this.getRoute(routeId);
        if (!route) return;
        route.demandFactors.push(new DemandFactor(name, multiplier, daysActive, isPermanent));
        this._recalculateDemand(route);
        console.log(`[RouteEngine] Factor de demanda '${name}' (${multiplier > 1 ? '+' : ''}${((multiplier-1)*100).toFixed(0)}%) añadido a ${routeId}`);
    }

    addGlobalDemandFactor(multiplier, reason = '') {
        this._globalDemandMultiplier *= multiplier;
        this._globalDemandMultiplier = Math.max(0.1, Math.min(3.0, this._globalDemandMultiplier));
        this._routes.forEach(route => this._recalculateDemand(route));
        console.log(`[RouteEngine] Demanda global: ${this._globalDemandMultiplier.toFixed(2)}x — ${reason}`);
    }

    _updateDemandFactors(route) {
        let changed = false;
        route.demandFactors = route.demandFactors.filter(factor => {
            if (!factor.isPermanent) {
                factor.daysRemaining--;
                if (factor.daysRemaining <= 0) { changed = true; return false; }
            }
            return true;
        });
        if (changed) this._recalculateDemand(route);
    }

    _recalculateDemand(route) {
        const seasonMult = this._getSeasonMultiplier(this._currentSeason, route.isInternational);
        const reputMult  = this._game?.airline
            ? 0.5 + (this._game.airline.reputation / 100) : 1.0;
        const factorMult = route.demandFactors.reduce((acc, f) => acc * f.multiplier, 1.0);

        route.demandMultiplier = Math.max(0.1, Math.min(2.5,
            route.baseDemand * seasonMult * reputMult * factorMult * this._globalDemandMultiplier
        ));
    }

    _applySeasonalDemand() {
        this._routes.forEach(route => this._recalculateDemand(route));
    }

    _getSeasonMultiplier(season, isInternational) {
        if (season === SeasonType.Summer) return isInternational ? 1.35 : 1.20;
        if (season === SeasonType.Winter) return 1.25;
        if (season === SeasonType.Spring) return 1.05;
        return 0.90;  // Fall
    }

    _getCurrentSeason(month) {
        if (month >= 3 && month <= 5)  return SeasonType.Spring;
        if (month >= 6 && month <= 8)  return SeasonType.Summer;
        if (month >= 9 && month <= 11) return SeasonType.Fall;
        return SeasonType.Winter;
    }

    // ─────────────────────────────────────────────────────────
    //  SIMULACIÓN DE OCUPACIÓN
    // ─────────────────────────────────────────────────────────

    _simulateDailyOccupancy(route) {
        const competitiveFactor = this._calculateCompetitiveFactor(route);
        const targetOcc = Math.max(0.15, Math.min(0.98,
            route.demandMultiplier * competitiveFactor));

        const speed = 0.02;
        route.currentOccupancy += (targetOcc - route.currentOccupancy) * speed;
        route.currentOccupancy += (Math.random() * 0.02 - 0.01);
        route.currentOccupancy  = Math.max(0.05, Math.min(0.99, route.currentOccupancy));
    }

    _calculateInitialOccupancy(route) {
        const competitiveFactor = this._calculateCompetitiveFactor(route);
        return Math.max(0.2, Math.min(0.85, route.baseDemand * 0.65 * competitiveFactor));
    }

    _calculateCompetitiveFactor(route) {
        if (route.competitors.length === 0) return 1.2;

        const avgCompFare = route.competitors.reduce((s, c) => s + c.avgFareEconomy, 0) / route.competitors.length;
        const priceFactor = avgCompFare > 0 ? avgCompFare / route.effectiveFareEconomy : 1.0;

        const avgCompRep = route.competitors.reduce((s, c) => s + c.reputationScore, 0) / route.competitors.length;
        const repFactor  = this._game?.airline
            ? this._game.airline.reputation / Math.max(avgCompRep, 1)
            : 1.0;

        return Math.max(0.4, Math.min(1.8, priceFactor * 0.6 + repFactor * 0.4));
    }

    // ─────────────────────────────────────────────────────────
    //  SISTEMA DE PRECIOS
    // ─────────────────────────────────────────────────────────

    _calculateFares(economyFare, strategy, distanceKm, isIntl) {
        const businessMults = {
            [PricingStrategy.Budget]:   2.5,
            [PricingStrategy.Standard]: 3.5,
            [PricingStrategy.Premium]:  5.0,
            [PricingStrategy.Dynamic]:  3.5
        };
        let businessMult = businessMults[strategy] ?? 3.5;
        let premiumMult  = businessMult * 1.7;

        if (isIntl && distanceKm > 5000) {
            businessMult *= 1.2;
            premiumMult  *= 1.3;
        }

        return { business: economyFare * businessMult, premium: economyFare * premiumMult };
    }

    changePricingStrategy(routeId, strategy) {
        const route = this.getRoute(routeId);
        if (!route) return;
        route.pricingStrategy = strategy;
        const fares = this._calculateFares(route.baseFareEconomy, strategy, route.distanceKm, route.isInternational);
        route.currentFareBusiness = fares.business;
        route.currentFarePremium  = fares.premium;
        console.log(`[RouteEngine] Estrategia ${strategy} aplicada a ${routeId}`);
    }

    setEconomyFare(routeId, newFare) {
        const route = this.getRoute(routeId);
        if (!route) return;
        const minFare = route.distanceKm * 0.03;
        const maxFare = route.distanceKm * 0.25;
        route.currentFareEconomy = Math.max(minFare, Math.min(maxFare, newFare));
        console.log(`[RouteEngine] Tarifa economy ${routeId}: $${route.currentFareEconomy.toLocaleString()}`);
    }

    _applyDynamicPricing(route) {
        if (route.currentOccupancy > 0.85) {
            route.currentFareEconomy  *= 1.02;
            route.currentFareBusiness *= 1.02;
            route.currentFarePremium  *= 1.02;
        } else if (route.currentOccupancy < 0.50) {
            route.currentFareEconomy  *= 0.985;
            route.currentFareBusiness *= 0.985;
            route.currentFarePremium  *= 0.985;
        }
        const minFare = route.distanceKm * 0.03;
        const maxFare = route.distanceKm * 0.30;
        route.currentFareEconomy = Math.max(minFare, Math.min(maxFare, route.currentFareEconomy));
    }

    // ─────────────────────────────────────────────────────────
    //  COMPETIDORES
    // ─────────────────────────────────────────────────────────

    _generateCompetitors(route) {
        const classSum = route.airportClassOrigin + route.airportClassDest;
        const maxComp  = classSum <= 2 ? 7 : classSum === 3 ? 5 : classSum === 4 ? 4 : classSum === 5 ? 3 : 2;
        const minComp  = classSum <= 2 ? 3 : classSum === 3 ? 2 : classSum === 4 ? 1 : 0;
        const numComp  = minComp + Math.floor(Math.random() * (maxComp - minComp + 1));

        for (let i = 0; i < numComp; i++) {
            const idx  = Math.floor(Math.random() * this._competitorNames.length);
            const fare = route.baseFareEconomy * (0.85 + Math.random() * 0.35);

            const comp = new RouteCompetitor();
            comp.competitorName  = this._competitorNames[idx];
            comp.iataCode        = this._competitorIatas[idx];
            comp.marketShare     = 0.05 + Math.random() * 0.30;
            comp.avgFareEconomy  = fare;
            comp.avgOccupancy    = 0.60 + Math.random() * 0.25;
            comp.flightsPerWeek  = 1 + Math.floor(Math.random() * (route.flightsPerWeek + 2));
            comp.reputationScore = 40 + Math.random() * 40;
            route.competitors.push(comp);
        }
    }

    _updateCompetitors() {
        this._routes.forEach(route => {
            route.competitors.forEach(comp => {
                comp.avgFareEconomy  *= (0.97 + Math.random() * 0.06);
                comp.avgOccupancy    += (Math.random() * 0.06 - 0.03);
                comp.avgOccupancy     = Math.max(0.4, Math.min(0.95, comp.avgOccupancy));
                comp.reputationScore += (Math.random() * 2 - 1);
                comp.reputationScore  = Math.max(20, Math.min(95, comp.reputationScore));
            });
        });
    }

    // ─────────────────────────────────────────────────────────
    //  COMBUSTIBLE
    // ─────────────────────────────────────────────────────────

    _fluctuateFuelPrice() {
        const change = (Math.random() * 0.01) - 0.005;
        this._fuelPricePerLiter *= (1 + change);
        this._fuelPricePerLiter  = Math.max(0.50, Math.min(2.50, this._fuelPricePerLiter));
        this._fuelPriceHistory.push(this._fuelPricePerLiter);
        if (this._fuelPriceHistory.length > 90) this._fuelPriceHistory.shift();
        if (Math.abs(change) > 0.05) this._emit('onFuelPriceChanged', this._fuelPricePerLiter);
    }

    applyFuelPriceShock(multiplier, reason = '') {
        this._fuelPricePerLiter *= multiplier;
        this._fuelPricePerLiter  = Math.max(0.50, Math.min(2.50, this._fuelPricePerLiter));
        this._emit('onFuelPriceChanged', this._fuelPricePerLiter);
        console.log(`[RouteEngine] Shock de combustible: $${this._fuelPricePerLiter.toFixed(2)}/L — ${reason}`);
    }

    // ─────────────────────────────────────────────────────────
    //  ANALYTICS Y REVENUE
    // ─────────────────────────────────────────────────────────

    _recordDailyRevenue(route) {
        if (!this._economy) return;

        const aircraftData = this._getAircraftDataForRoute(route);
        if (!aircraftData) return;

        const flightsToday = route.flightsPerWeek / 7;

        const dailyRevenue = this._economy.calculateFlightRevenue(
            aircraftData.seatsEconomy, aircraftData.seatsBusiness, aircraftData.seatsPremium,
            route.currentOccupancy, route.demandMultiplier,
            route.effectiveFareEconomy, route.effectiveFareBusiness, route.effectiveFarePremium,
            route.distanceKm) * flightsToday;

        const dailyFuel = this._economy.calculateFuelCost(
            aircraftData.fuelBurnPerHour, route.distanceKm,
            aircraftData.cruiseSpeedKmh, this._fuelPricePerLiter) * flightsToday * 2;

        const dailyAirport = this._economy.calculateAirportFees(
            route.airportClassDest,
            aircraftData.seatsEconomy + aircraftData.seatsBusiness) * flightsToday;

        const dailyCost   = dailyFuel + dailyAirport;
        const dailyProfit = dailyRevenue - dailyCost;

        route.analytics.totalRevenue += dailyRevenue;
        route.analytics.totalCosts   += dailyCost;
        route.analytics.netProfit    += dailyProfit;
        route.analytics.totalFlightsOperated++;
        route.analytics.totalPassengersCarried +=
            Math.floor((aircraftData.seatsEconomy + aircraftData.seatsBusiness) *
                        route.currentOccupancy * flightsToday);
    }

    _analyzeRoutePerformance() {
        this._routes.forEach(route => {
            if (route.analytics.totalRevenue > 0) {
                route.analytics.profitMargin = route.analytics.netProfit / route.analytics.totalRevenue;
                route.analytics.avgOccupancy = route.currentOccupancy;
            }

            if (route.analytics.totalFlightsOperated > 30 && !route.analytics.isProfitable) {
                this._emit('onRouteProfitAlert', route);
                console.warn(`[RouteEngine] ⚠️ Ruta con pérdidas: ${route.originIATA}→${route.destinationIATA} | Margen: ${(route.analytics.profitMargin*100).toFixed(1)}%`);
            }
        });
    }

    // ─────────────────────────────────────────────────────────
    //  UTILIDADES PÚBLICAS
    // ─────────────────────────────────────────────────────────

    getRoute(routeId)           { return this._routes.find(r => r.routeId === routeId) ?? null; }
    getRouteBetween(orig, dest) { return this._routes.find(r => r.originIATA === orig && r.destinationIATA === dest) ?? null; }
    routeExists(orig, dest)     { return this.getRouteBetween(orig, dest) !== null; }

    getProfitableRoutes() { return this._routes.filter(r => r.analytics.isProfitable && r.status === RouteStatus.Active); }
    getLossRoutes()       { return this._routes.filter(r => !r.analytics.isProfitable && r.status === RouteStatus.Active && r.analytics.totalFlightsOperated > 30); }

    getTotalMonthlyRevenue() {
        return this._routes
            .filter(r => r.status === RouteStatus.Active)
            .reduce((sum, r) => sum + r.analytics.totalRevenue, 0);
    }

    getRoutesSummary() {
        const active    = this._routes.filter(r => r.status === RouteStatus.Active).length;
        const suspended = this._routes.filter(r => r.status === RouteStatus.Suspended).length;
        const profitable = this.getProfitableRoutes().length;
        return `Rutas activas: ${active} | Suspendidas: ${suspended} | Rentables: ${profitable}/${active} | Combustible: $${this._fuelPricePerLiter.toFixed(2)}/L | Temporada: ${this._currentSeason}`;
    }

    // ─────────────────────────────────────────────────────────
    //  UTILIDADES PRIVADAS
    // ─────────────────────────────────────────────────────────

    _getAirportClass(iata) {
        const classF = ['ORD','ATL','DFW','DEN','LAX','JFK','LHR','CDG','FRA','AMS','DXB','HND','PEK','PVG'];
        const classE = ['MIA','IAH','SFO','SEA','BOS','EWR','MUC','MAD','BCN','FCO','GRU','BOG','MEX','SCL'];
        const classD = ['MCO','LAS','PHX','CLT','DTW','MSP','MDE','LIM','GIG','EZE','UIO','CCS','PTY'];
        if (classF.includes(iata)) return 1;
        if (classE.includes(iata)) return 2;
        if (classD.includes(iata)) return 3;
        return 4;
    }

    _calculateDistance(origin, dest) {
        const a = this._airportCoords.get(origin);
        const b = this._airportCoords.get(dest);
        if (a && b) return this._haversineKm(a.lat, a.lon, b.lat, b.lon);
        let hash = 0;
        for (const c of (origin + dest)) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
        return 500 + (hash % 14500);
    }

    _haversineKm(lat1, lon1, lat2, lon2) {
        const R    = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a    = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
        return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    }

    _isInternational(origin, dest) {
        const a = this._airportCoords.get(origin);
        const b = this._airportCoords.get(dest);
        return a && b ? a.country.toLowerCase() !== b.country.toLowerCase() : false;
    }

    _getAircraftDataForRoute(route) {
        return window.AIRCRAFT_CATALOG?.find(a => a.aircraftId === route.assignedAircraftId) ?? null;
    }
}

RouteEngine._instance = null;

// Exportar
if (typeof module !== 'undefined')
    module.exports = { RouteEngine, RouteData, RouteAnalytics, RouteCompetitor, DemandFactor, RouteStatus, SeasonType, PricingStrategy };
else
    window.RouteEngine = RouteEngine, window.RouteStatus = RouteStatus, window.SeasonType = SeasonType, window.PricingStrategy = PricingStrategy;
