// ═══════════════════════════════════════════════════════════════
//  SkyLine — models.js
//  Portado desde AirportData.cs, AircraftData.cs, EventData.cs
//  Modelos de datos base del juego
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  AIRPORT DATA
//  (Equivale a AirportData ScriptableObject en Unity)
// ─────────────────────────────────────────────────────────────

class AirportData {
    constructor(data = {}) {
        // Identificación
        this.iataCode        = data.iataCode        ?? '';
        this.displayName     = data.displayName     ?? '';
        this.displayNameES   = data.displayNameES   ?? '';
        this.city            = data.city            ?? '';
        this.country         = data.country         ?? '';
        this.region          = data.region          ?? '';
        this.airportClass    = data.airportClass    ?? 'C';   // 'F' / 'E' / 'D' / 'C'

        // Posición geográfica
        this.latitude        = data.latitude        ?? 0;
        this.longitude       = data.longitude       ?? 0;

        // Capacidad
        this.maxDailyFlights    = data.maxDailyFlights    ?? 100;
        this.numberOfTerminals  = data.numberOfTerminals  ?? 1;
        this.runwayLengthM      = data.runwayLengthM      ?? 2000;
        this.hasJetbridge       = data.hasJetbridge       ?? false;

        // Economía
        this.landingFeePerFlight = data.landingFeePerFlight ?? 1000;
        this.demandMultiplier    = data.demandMultiplier    ?? 1.0;
        this.slotCostPerMonth    = data.slotCostPerMonth    ?? 10000;

        // Aviones permitidos
        this.minAircraftClass  = data.minAircraftClass  ?? 'C';

        // Juego
        this.isUnlockedAtStart  = data.isUnlockedAtStart ?? true;
        this.unlockCost         = data.unlockCost        ?? 0;
        this.requiredReputation = data.requiredReputation ?? 0;
    }

    // Convierte clase de aeropuerto a número (1=F, 2=E, 3=D, 4=C)
    get classNumber() {
        const map = { 'F': 1, 'E': 2, 'D': 3, 'C': 4 };
        return map[this.airportClass] ?? 4;
    }

    // Convierte coordenadas geográficas a posición de mapa (-0.5 a 0.5)
    // Compatible con WorldMap2D de Kronnect
    get mapPosition() {
        return {
            x: this.longitude / 360,
            y: this.latitude  / 180
        };
    }
}
window.AirportData = AirportData;

// ─────────────────────────────────────────────────────────────
//  AIRCRAFT CATEGORY ENUM
// ─────────────────────────────────────────────────────────────

const AircraftCategory = Object.freeze({
    Regional:   'Regional',     // CRJ, E-Jets, ATR, Q-Series
    NarrowBody: 'NarrowBody',   // 737, A320 family, 757
    WideBody:   'WideBody',     // 777, A350, 787, A330, 767
    MegaHub:    'MegaHub'       // 747, A380
});

// ─────────────────────────────────────────────────────────────
//  AIRCRAFT DATA
//  (Equivale a AircraftData ScriptableObject en Unity)
// ─────────────────────────────────────────────────────────────

class AircraftData {
    constructor(data = {}) {
        // Identificación
        this.aircraftId   = data.aircraftId   ?? '';
        this.displayName  = data.displayName  ?? '';
        this.manufacturer = data.manufacturer ?? '';    // 'Boeing' / 'Airbus' / 'ATR' / etc.
        this.family       = data.family       ?? '';    // '737' / 'A320' / '787' etc.
        this.category     = data.category     ?? AircraftCategory.NarrowBody;
        this.iconUrl      = data.iconUrl      ?? null;  // Ruta a imagen PNG (reemplaza Sprite de Unity)

        // Capacidad
        this.seatsEconomy      = data.seatsEconomy      ?? 0;
        this.seatsBusiness     = data.seatsBusiness     ?? 0;
        this.seatsPremium      = data.seatsPremium      ?? 0;
        this.cargoCapacityTons = data.cargoCapacityTons ?? 0;

        // Performance
        this.rangeKm           = data.rangeKm           ?? 0;
        this.cruiseSpeedKmh    = data.cruiseSpeedKmh    ?? 800;
        this.fuelBurnPerHour   = data.fuelBurnPerHour   ?? 0;  // Litros/hora
        this.minRunwayLengthM  = data.minRunwayLengthM  ?? 1800;
        this.needsJetbridge    = data.needsJetbridge    ?? false;

        // Economía
        this.purchasePrice          = data.purchasePrice          ?? 0;
        this.leasePricePerMonth     = data.leasePricePerMonth     ?? 0;
        this.maintenanceCostPerHour = data.maintenanceCostPerHour ?? 0;

        // Clasificación de aeropuerto
        this.minAirportClass = data.minAirportClass ?? 'C';  // 'C' / 'D' / 'E' / 'F'
        this.maxAirportClass = data.maxAirportClass ?? 'F';

        // Juego — todos disponibles desde el inicio
        this.isUnlockedAtStart  = data.isUnlockedAtStart  ?? true;
        this.reputationRequired = data.reputationRequired ?? 0;
        this.description        = data.description        ?? '';
    }

    get totalSeats() { return this.seatsEconomy + this.seatsBusiness + this.seatsPremium; }

    flightHoursFor(distanceKm) { return distanceKm / this.cruiseSpeedKmh; }

    canLandAt(airport) {
        const classOrder = ['F','E','D','C'];
        const minIdx = classOrder.indexOf(this.minAirportClass);
        const aptIdx = classOrder.indexOf(airport.airportClass);
        return aptIdx >= minIdx;
    }
}
window.AircraftData = AircraftData;

// ─────────────────────────────────────────────────────────────
//  EVENT DATA ENUMS
// ─────────────────────────────────────────────────────────────

const EventCategory = Object.freeze({
    Emergencies:       'Emergencies',
    TechnicalFailures: 'TechnicalFailures',
    WeatherNatural:    'WeatherNatural',
    Operations:        'Operations',
    Personnel:         'Personnel',
    Passengers:        'Passengers',
    Opportunities:     'Opportunities',
    RegulatoryLegal:   'RegulatoryLegal',
    CyberTechnology:   'CyberTechnology',
    SecurityThreats:   'SecurityThreats',
    UnionsLabor:       'UnionsLabor'
});

const EventSeverity    = Object.freeze({ Low: 'Low', Medium: 'Medium', High: 'High', Critical: 'Critical' });
const EventProbability = Object.freeze({ Low: 'Low', Medium: 'Medium', High: 'High' });
const EventImpactType  = Object.freeze({ Negative: 'Negative', Positive: 'Positive', Neutral: 'Neutral' });
const UrgencyLevel     = Object.freeze({ Informative: 'Informative', Important: 'Important', Critical: 'Critical' });

// ─────────────────────────────────────────────────────────────
//  EVENT DATA
//  (Equivale a EventData ScriptableObject en Unity)
// ─────────────────────────────────────────────────────────────

class EventData {
    constructor(data = {}) {
        // Identificación
        this.eventId    = data.eventId    ?? '';
        this.category   = data.category   ?? EventCategory.Operations;
        this.severity   = data.severity   ?? EventSeverity.Medium;
        this.impactType = data.impactType ?? EventImpactType.Negative;

        // Título
        this.titleEN = data.titleEN ?? '';
        this.titleES = data.titleES ?? '';

        // Descripción
        this.descriptionEN = data.descriptionEN ?? '';
        this.descriptionES = data.descriptionES ?? '';

        // Mensaje de Aria / Alex (asistente IA del juego)
        this.ariaMessageEN = data.ariaMessageEN ?? '';
        this.ariaMessageES = data.ariaMessageES ?? '';

        // Impacto económico
        this.cashImpact       = data.cashImpact       ?? 0;   // Negativo = gasto, positivo = ingreso
        this.reputationImpact = data.reputationImpact ?? 0;
        this.demandImpact     = data.demandImpact     ?? 0;   // % cambio en demanda de rutas
        this.durationDays     = data.durationDays     ?? 0;

        // Condiciones de disparo
        this.probability                = data.probability                ?? EventProbability.Low;
        this.baseProbabilityPerWeek     = data.baseProbabilityPerWeek     ?? 0.05;
        this.cooldownWeeks              = data.cooldownWeeks              ?? 4;
        this.minCompanyAgeMonths        = data.minCompanyAgeMonths        ?? 0;
        this.minFleetSize               = data.minFleetSize               ?? 0;
        this.requiresInternationalRoutes = data.requiresInternationalRoutes ?? false;
        this.requiresLargeAirport       = data.requiresLargeAirport       ?? false;

        // Opciones de resolución
        this.optionLabelsEN         = data.optionLabelsEN         ?? [];
        this.optionLabelsES         = data.optionLabelsES         ?? [];
        this.optionCosts            = data.optionCosts            ?? [];
        this.optionReputationChange = data.optionReputationChange ?? [];
        this.hasRewardedAdOption    = data.hasRewardedAdOption    ?? false;

        // Urgencia UI
        this.urgency = data.urgency ?? UrgencyLevel.Informative;

        // Cadena de eventos
        this.triggersEventIds  = data.triggersEventIds  ?? [];
        this.chainProbability  = data.chainProbability  ?? 0;
    }
}
window.EventData = EventData;

// ─────────────────────────────────────────────────────────────
//  CATÁLOGO DE AVIONES — 37 MODELOS
//  Todos disponibles desde el inicio (isUnlockedAtStart: true)
//  Organizados: Regional → NarrowBody → WideBody → MegaHub
// ─────────────────────────────────────────────────────────────

const DEFAULT_AIRCRAFT_CATALOG = [

    // ══════════════════════════════════════════
    //  REGIONAL  (11 modelos)
    // ══════════════════════════════════════════

    new AircraftData({
        aircraftId: 'ATR42-600', displayName: 'ATR 42-600', manufacturer: 'ATR',
        family: 'ATR', category: AircraftCategory.Regional,
        seatsEconomy: 50, seatsBusiness: 0, seatsPremium: 0, cargoCapacityTons: 5.4,
        rangeKm: 1326, cruiseSpeedKmh: 510, fuelBurnPerHour: 1350,
        minRunwayLengthM: 950, needsJetbridge: false,
        purchasePrice: 21_000_000, leasePricePerMonth: 72_000,
        maintenanceCostPerHour: 520, minAirportClass: 'C',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El hermano menor del ATR 72. Perfecto para aeropuertos pequeños.'
    }),
    new AircraftData({
        aircraftId: 'ATR72-600', displayName: 'ATR 72-600', manufacturer: 'ATR',
        family: 'ATR', category: AircraftCategory.Regional,
        seatsEconomy: 70, seatsBusiness: 0, seatsPremium: 0, cargoCapacityTons: 7.5,
        rangeKm: 1528, cruiseSpeedKmh: 510, fuelBurnPerHour: 1800,
        minRunwayLengthM: 1100, needsJetbridge: false,
        purchasePrice: 26_000_000, leasePricePerMonth: 90_000,
        maintenanceCostPerHour: 600, minAirportClass: 'C',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'Avión regional turbohélice ideal para rutas cortas.'
    }),
    new AircraftData({
        aircraftId: 'CRJ-200', displayName: 'Bombardier CRJ-200', manufacturer: 'Bombardier',
        family: 'CRJ', category: AircraftCategory.Regional,
        seatsEconomy: 50, seatsBusiness: 0, seatsPremium: 0, cargoCapacityTons: 4.5,
        rangeKm: 3148, cruiseSpeedKmh: 830, fuelBurnPerHour: 1800,
        minRunwayLengthM: 1250, needsJetbridge: false,
        purchasePrice: 22_000_000, leasePricePerMonth: 75_000,
        maintenanceCostPerHour: 620, minAirportClass: 'C',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El jet regional más pequeño de Bombardier. Perfecto para rutas de baja demanda con buenos márgenes.'
    }),
    new AircraftData({
        aircraftId: 'CRJ-700', displayName: 'Bombardier CRJ-700', manufacturer: 'Bombardier',
        family: 'CRJ', category: AircraftCategory.Regional,
        seatsEconomy: 70, seatsBusiness: 0, seatsPremium: 0, cargoCapacityTons: 5.0,
        rangeKm: 3700, cruiseSpeedKmh: 830, fuelBurnPerHour: 2400,
        minRunwayLengthM: 1300, needsJetbridge: false,
        purchasePrice: 38_000_000, leasePricePerMonth: 125_000,
        maintenanceCostPerHour: 780, minAirportClass: 'C',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'Jet regional de 70 asientos. Flexible para rutas domésticas cortas y medianas.'
    }),
    new AircraftData({
        aircraftId: 'CRJ-900', displayName: 'Bombardier CRJ-900', manufacturer: 'Bombardier',
        family: 'CRJ', category: AircraftCategory.Regional,
        seatsEconomy: 88, seatsBusiness: 2, seatsPremium: 0, cargoCapacityTons: 6.0,
        rangeKm: 2876, cruiseSpeedKmh: 830, fuelBurnPerHour: 2700,
        minRunwayLengthM: 1400, needsJetbridge: false,
        purchasePrice: 46_000_000, leasePricePerMonth: 148_000,
        maintenanceCostPerHour: 850, minAirportClass: 'C',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'Versión alargada del CRJ. Más capacidad para rutas regionales concurridas.'
    }),
    new AircraftData({
        aircraftId: 'ERJ-145', displayName: 'Embraer ERJ-145', manufacturer: 'Embraer',
        family: 'ERJ', category: AircraftCategory.Regional,
        seatsEconomy: 50, seatsBusiness: 0, seatsPremium: 0, cargoCapacityTons: 4.8,
        rangeKm: 2800, cruiseSpeedKmh: 833, fuelBurnPerHour: 2100,
        minRunwayLengthM: 1300, needsJetbridge: false,
        purchasePrice: 24_000_000, leasePricePerMonth: 82_000,
        maintenanceCostPerHour: 620, minAirportClass: 'C',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'Jet regional brasileño de 50 plazas. Muy popular en feeds de hub.'
    }),
    new AircraftData({
        aircraftId: 'E170', displayName: 'Embraer E170', manufacturer: 'Embraer',
        family: 'E-Jet', category: AircraftCategory.Regional,
        seatsEconomy: 76, seatsBusiness: 0, seatsPremium: 0, cargoCapacityTons: 7.0,
        rangeKm: 3735, cruiseSpeedKmh: 870, fuelBurnPerHour: 2600,
        minRunwayLengthM: 1400, needsJetbridge: false,
        purchasePrice: 43_000_000, leasePricePerMonth: 138_000,
        maintenanceCostPerHour: 750, minAirportClass: 'C',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'E-Jet de 76 asientos. Confort superior para vuelos regionales.'
    }),
    new AircraftData({
        aircraftId: 'E175', displayName: 'Embraer E175', manufacturer: 'Embraer',
        family: 'E-Jet', category: AircraftCategory.Regional,
        seatsEconomy: 80, seatsBusiness: 0, seatsPremium: 0, cargoCapacityTons: 7.5,
        rangeKm: 3735, cruiseSpeedKmh: 870, fuelBurnPerHour: 2700,
        minRunwayLengthM: 1500, needsJetbridge: false,
        purchasePrice: 48_000_000, leasePricePerMonth: 155_000,
        maintenanceCostPerHour: 790, minAirportClass: 'C',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El E-Jet más popular en EE.UU. Eficiente y cómodo para rutas cortas.'
    }),
    new AircraftData({
        aircraftId: 'E190', displayName: 'Embraer E190', manufacturer: 'Embraer',
        family: 'E-Jet', category: AircraftCategory.Regional,
        seatsEconomy: 98, seatsBusiness: 6, seatsPremium: 0, cargoCapacityTons: 10.5,
        rangeKm: 4537, cruiseSpeedKmh: 870, fuelBurnPerHour: 3100,
        minRunwayLengthM: 1600, needsJetbridge: false,
        purchasePrice: 56_000_000, leasePricePerMonth: 178_000,
        maintenanceCostPerHour: 880, minAirportClass: 'C',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El mayor E-Jet original. Transición perfecta hacia rutas de mayor capacidad.'
    }),
    new AircraftData({
        aircraftId: 'E190-E2', displayName: 'Embraer E190-E2', manufacturer: 'Embraer',
        family: 'E-Jet E2', category: AircraftCategory.Regional,
        seatsEconomy: 104, seatsBusiness: 6, seatsPremium: 0, cargoCapacityTons: 11.0,
        rangeKm: 4537, cruiseSpeedKmh: 870, fuelBurnPerHour: 2700,
        minRunwayLengthM: 1600, needsJetbridge: false,
        purchasePrice: 63_000_000, leasePricePerMonth: 196_000,
        maintenanceCostPerHour: 820, minAirportClass: 'C',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'Versión E2 con motores PW1900G. 17% menos combustible que el E190 original.'
    }),
    new AircraftData({
        aircraftId: 'E195-E2', displayName: 'Embraer E195-E2', manufacturer: 'Embraer',
        family: 'E-Jet E2', category: AircraftCategory.Regional,
        seatsEconomy: 120, seatsBusiness: 12, seatsPremium: 0, cargoCapacityTons: 12.5,
        rangeKm: 4260, cruiseSpeedKmh: 870, fuelBurnPerHour: 2900,
        minRunwayLengthM: 1700, needsJetbridge: true,
        purchasePrice: 72_000_000, leasePricePerMonth: 218_000,
        maintenanceCostPerHour: 910, minAirportClass: 'D',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El E-Jet más grande. Casi un narrow-body con costos de regional.'
    }),

    // ══════════════════════════════════════════
    //  NARROW BODY  (11 modelos)
    // ══════════════════════════════════════════

    new AircraftData({
        aircraftId: '737-700', displayName: 'Boeing 737-700', manufacturer: 'Boeing',
        family: '737', category: AircraftCategory.NarrowBody,
        seatsEconomy: 126, seatsBusiness: 12, seatsPremium: 0, cargoCapacityTons: 16,
        rangeKm: 6370, cruiseSpeedKmh: 842, fuelBurnPerHour: 4800,
        minRunwayLengthM: 1500, needsJetbridge: true,
        purchasePrice: 74_000_000, leasePricePerMonth: 310_000,
        maintenanceCostPerHour: 1550, minAirportClass: 'D',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'La versión más pequeña del 737NG. Ideal para rutas de menor densidad.'
    }),
    new AircraftData({
        aircraftId: '737-800', displayName: 'Boeing 737-800', manufacturer: 'Boeing',
        family: '737', category: AircraftCategory.NarrowBody,
        seatsEconomy: 162, seatsBusiness: 12, seatsPremium: 0, cargoCapacityTons: 20,
        rangeKm: 5765, cruiseSpeedKmh: 842, fuelBurnPerHour: 5600,
        minRunwayLengthM: 1600, needsJetbridge: true,
        purchasePrice: 89_000_000, leasePricePerMonth: 380_000,
        maintenanceCostPerHour: 1800, minAirportClass: 'D',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El caballo de batalla de las aerolíneas. Versátil y eficiente.'
    }),
    new AircraftData({
        aircraftId: '737-900ER', displayName: 'Boeing 737-900ER', manufacturer: 'Boeing',
        family: '737', category: AircraftCategory.NarrowBody,
        seatsEconomy: 174, seatsBusiness: 16, seatsPremium: 0, cargoCapacityTons: 22,
        rangeKm: 5083, cruiseSpeedKmh: 842, fuelBurnPerHour: 5900,
        minRunwayLengthM: 1700, needsJetbridge: true,
        purchasePrice: 98_000_000, leasePricePerMonth: 405_000,
        maintenanceCostPerHour: 1900, minAirportClass: 'D',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'La variante de mayor capacidad del 737NG. Domina rutas domésticas densas.'
    }),
    new AircraftData({
        aircraftId: '737MAX8', displayName: 'Boeing 737 MAX 8', manufacturer: 'Boeing',
        family: '737 MAX', category: AircraftCategory.NarrowBody,
        seatsEconomy: 162, seatsBusiness: 16, seatsPremium: 0, cargoCapacityTons: 20,
        rangeKm: 6570, cruiseSpeedKmh: 839, fuelBurnPerHour: 4800,
        minRunwayLengthM: 1600, needsJetbridge: true,
        purchasePrice: 121_000_000, leasePricePerMonth: 440_000,
        maintenanceCostPerHour: 1700, minAirportClass: 'D',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'Motor LEAP-1B — 14% más eficiente que el 737-800. El narrow-body más vendido.'
    }),
    new AircraftData({
        aircraftId: '737MAX9', displayName: 'Boeing 737 MAX 9', manufacturer: 'Boeing',
        family: '737 MAX', category: AircraftCategory.NarrowBody,
        seatsEconomy: 172, seatsBusiness: 16, seatsPremium: 0, cargoCapacityTons: 21,
        rangeKm: 6570, cruiseSpeedKmh: 839, fuelBurnPerHour: 4950,
        minRunwayLengthM: 1650, needsJetbridge: true,
        purchasePrice: 128_000_000, leasePricePerMonth: 454_000,
        maintenanceCostPerHour: 1750, minAirportClass: 'D',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'La versión intermedia del MAX. Más capacidad que el MAX 8 con el mismo alcance excepcional.'
    }),
    new AircraftData({
        aircraftId: '737MAX10', displayName: 'Boeing 737 MAX 10', manufacturer: 'Boeing',
        family: '737 MAX', category: AircraftCategory.NarrowBody,
        seatsEconomy: 180, seatsBusiness: 16, seatsPremium: 0, cargoCapacityTons: 23,
        rangeKm: 6110, cruiseSpeedKmh: 839, fuelBurnPerHour: 5100,
        minRunwayLengthM: 1700, needsJetbridge: true,
        purchasePrice: 135_000_000, leasePricePerMonth: 468_000,
        maintenanceCostPerHour: 1780, minAirportClass: 'D',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El MAX más grande. Rival del A321neo para rutas de alta densidad.'
    }),
    new AircraftData({
        aircraftId: '757-200', displayName: 'Boeing 757-200', manufacturer: 'Boeing',
        family: '757', category: AircraftCategory.NarrowBody,
        seatsEconomy: 178, seatsBusiness: 22, seatsPremium: 0, cargoCapacityTons: 24,
        rangeKm: 7250, cruiseSpeedKmh: 850, fuelBurnPerHour: 6100,
        minRunwayLengthM: 1800, needsJetbridge: true,
        purchasePrice: 85_000_000, leasePricePerMonth: 350_000,
        maintenanceCostPerHour: 1900, minAirportClass: 'D',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'Icónico por su capacidad transatlántica en narrow-body. Ideal para rutas TATL delgadas.'
    }),
    new AircraftData({
        aircraftId: 'A319neo', displayName: 'Airbus A319neo', manufacturer: 'Airbus',
        family: 'A320', category: AircraftCategory.NarrowBody,
        seatsEconomy: 120, seatsBusiness: 12, seatsPremium: 0, cargoCapacityTons: 14,
        rangeKm: 6850, cruiseSpeedKmh: 833, fuelBurnPerHour: 4200,
        minRunwayLengthM: 1440, needsJetbridge: true,
        purchasePrice: 92_000_000, leasePricePerMonth: 360_000,
        maintenanceCostPerHour: 1500, minAirportClass: 'D',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El más pequeño de la familia neo. Perfecto para aeropuertos con restricciones de capacidad.'
    }),
    new AircraftData({
        aircraftId: 'A320', displayName: 'Airbus A320', manufacturer: 'Airbus',
        family: 'A320', category: AircraftCategory.NarrowBody,
        seatsEconomy: 150, seatsBusiness: 12, seatsPremium: 0, cargoCapacityTons: 20,
        rangeKm: 5700, cruiseSpeedKmh: 833, fuelBurnPerHour: 5500,
        minRunwayLengthM: 1500, needsJetbridge: true,
        purchasePrice: 75_000_000, leasePricePerMonth: 300_000,
        maintenanceCostPerHour: 1800, minAirportClass: 'D',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El A320 clásico, caballo de batalla de la aviación comercial. Económico de operar y muy confiable.'
    }),
    new AircraftData({
        aircraftId: 'A320neo', displayName: 'Airbus A320neo', manufacturer: 'Airbus',
        family: 'A320', category: AircraftCategory.NarrowBody,
        seatsEconomy: 150, seatsBusiness: 12, seatsPremium: 0, cargoCapacityTons: 20,
        rangeKm: 6300, cruiseSpeedKmh: 833, fuelBurnPerHour: 4900,
        minRunwayLengthM: 1500, needsJetbridge: true,
        purchasePrice: 101_000_000, leasePricePerMonth: 420_000,
        maintenanceCostPerHour: 1700, minAirportClass: 'D',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'Motor LEAP ultra-eficiente. Rival directo del 737 MAX.'
    }),
    new AircraftData({
        aircraftId: 'A321neo', displayName: 'Airbus A321neo', manufacturer: 'Airbus',
        family: 'A320', category: AircraftCategory.NarrowBody,
        seatsEconomy: 180, seatsBusiness: 14, seatsPremium: 0, cargoCapacityTons: 24,
        rangeKm: 7400, cruiseSpeedKmh: 833, fuelBurnPerHour: 5700,
        minRunwayLengthM: 1600, needsJetbridge: true,
        purchasePrice: 129_000_000, leasePricePerMonth: 460_000,
        maintenanceCostPerHour: 1850, minAirportClass: 'D',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El narrow-body más vendido de la historia. Mayor capacidad y alcance de la familia neo.'
    }),
    new AircraftData({
        aircraftId: 'A321XLR', displayName: 'Airbus A321XLR', manufacturer: 'Airbus',
        family: 'A320', category: AircraftCategory.NarrowBody,
        seatsEconomy: 180, seatsBusiness: 14, seatsPremium: 0, cargoCapacityTons: 22,
        rangeKm: 8700, cruiseSpeedKmh: 833, fuelBurnPerHour: 5500,
        minRunwayLengthM: 1700, needsJetbridge: true,
        purchasePrice: 158_000_000, leasePricePerMonth: 540_000,
        maintenanceCostPerHour: 1950, minAirportClass: 'D',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'Extra Long Range — conecta Europa con EE.UU. sin escala en narrow-body. Revolucionario.'
    }),
    new AircraftData({
        aircraftId: '757-300', displayName: 'Boeing 757-300', manufacturer: 'Boeing',
        family: '757', category: AircraftCategory.NarrowBody,
        seatsEconomy: 219, seatsBusiness: 24, seatsPremium: 0, cargoCapacityTons: 28,
        rangeKm: 6295, cruiseSpeedKmh: 850, fuelBurnPerHour: 6500,
        minRunwayLengthM: 1900, needsJetbridge: true,
        purchasePrice: 92_000_000, leasePricePerMonth: 370_000,
        maintenanceCostPerHour: 2000, minAirportClass: 'D',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El 757 alargado. Alta capacidad para un narrow-body, favorito en rutas charter densas.'
    }),

    // ══════════════════════════════════════════
    //  WIDE BODY  (12 modelos)
    // ══════════════════════════════════════════

    new AircraftData({
        aircraftId: '767-300ER', displayName: 'Boeing 767-300ER', manufacturer: 'Boeing',
        family: '767', category: AircraftCategory.WideBody,
        seatsEconomy: 193, seatsBusiness: 28, seatsPremium: 0, cargoCapacityTons: 38,
        rangeKm: 11090, cruiseSpeedKmh: 851, fuelBurnPerHour: 7200,
        minRunwayLengthM: 2100, needsJetbridge: true,
        purchasePrice: 175_000_000, leasePricePerMonth: 680_000,
        maintenanceCostPerHour: 2600, minAirportClass: 'E',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El wide-body más pequeño. Puente entre el 757 y el 787, muy versátil.'
    }),
    new AircraftData({
        aircraftId: 'A330-200', displayName: 'Airbus A330-200', manufacturer: 'Airbus',
        family: 'A330', category: AircraftCategory.WideBody,
        seatsEconomy: 247, seatsBusiness: 22, seatsPremium: 0, cargoCapacityTons: 40,
        rangeKm: 13430, cruiseSpeedKmh: 871, fuelBurnPerHour: 7800,
        minRunwayLengthM: 2100, needsJetbridge: true,
        purchasePrice: 208_000_000, leasePricePerMonth: 790_000,
        maintenanceCostPerHour: 2900, minAirportClass: 'E',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'Wide-body de largo alcance muy popular. La columna vertebral de muchas aerolíneas.'
    }),
    new AircraftData({
        aircraftId: 'A330-300', displayName: 'Airbus A330-300', manufacturer: 'Airbus',
        family: 'A330', category: AircraftCategory.WideBody,
        seatsEconomy: 256, seatsBusiness: 36, seatsPremium: 0, cargoCapacityTons: 45,
        rangeKm: 11750, cruiseSpeedKmh: 871, fuelBurnPerHour: 8200,
        minRunwayLengthM: 2200, needsJetbridge: true,
        purchasePrice: 224_000_000, leasePricePerMonth: 830_000,
        maintenanceCostPerHour: 3000, minAirportClass: 'E',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'La versión alargada del A330. Mayor capacidad para rutas intercontinentales densas.'
    }),
    new AircraftData({
        aircraftId: 'A330neo', displayName: 'Airbus A330neo', manufacturer: 'Airbus',
        family: 'A330', category: AircraftCategory.WideBody,
        seatsEconomy: 250, seatsBusiness: 36, seatsPremium: 0, cargoCapacityTons: 43,
        rangeKm: 13334, cruiseSpeedKmh: 912, fuelBurnPerHour: 7000,
        minRunwayLengthM: 2200, needsJetbridge: true,
        purchasePrice: 259_000_000, leasePricePerMonth: 890_000,
        maintenanceCostPerHour: 2800, minAirportClass: 'E',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'A330 con motores Trent 7000. 14% más eficiente, compite directamente con el 787.'
    }),
    new AircraftData({
        aircraftId: '787-8', displayName: 'Boeing 787-8 Dreamliner', manufacturer: 'Boeing',
        family: '787', category: AircraftCategory.WideBody,
        seatsEconomy: 195, seatsBusiness: 28, seatsPremium: 18, cargoCapacityTons: 38,
        rangeKm: 13620, cruiseSpeedKmh: 903, fuelBurnPerHour: 7600,
        minRunwayLengthM: 2100, needsJetbridge: true,
        purchasePrice: 220_000_000, leasePricePerMonth: 840_000,
        maintenanceCostPerHour: 3000, minAirportClass: 'E',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El Dreamliner original. Fibra de carbono y cabina premium con humedad mejorada.'
    }),
    new AircraftData({
        aircraftId: '787-9', displayName: 'Boeing 787-9 Dreamliner', manufacturer: 'Boeing',
        family: '787', category: AircraftCategory.WideBody,
        seatsEconomy: 204, seatsBusiness: 48, seatsPremium: 21, cargoCapacityTons: 45,
        rangeKm: 14140, cruiseSpeedKmh: 903, fuelBurnPerHour: 8400,
        minRunwayLengthM: 2200, needsJetbridge: true,
        purchasePrice: 248_000_000, leasePricePerMonth: 950_000,
        maintenanceCostPerHour: 3200, minAirportClass: 'E',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'Fuselaje de fibra de carbono. Ideal para rutas de largo alcance.'
    }),
    new AircraftData({
        aircraftId: '787-10', displayName: 'Boeing 787-10 Dreamliner', manufacturer: 'Boeing',
        family: '787', category: AircraftCategory.WideBody,
        seatsEconomy: 287, seatsBusiness: 40, seatsPremium: 0, cargoCapacityTons: 50,
        rangeKm: 11910, cruiseSpeedKmh: 903, fuelBurnPerHour: 8900,
        minRunwayLengthM: 2300, needsJetbridge: true,
        purchasePrice: 272_000_000, leasePricePerMonth: 1_020_000,
        maintenanceCostPerHour: 3350, minAirportClass: 'E',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El más grande y eficiente de los 787. Máxima capacidad en rutas medianas.'
    }),
    new AircraftData({
        aircraftId: '777-200ER', displayName: 'Boeing 777-200ER', manufacturer: 'Boeing',
        family: '777', category: AircraftCategory.WideBody,
        seatsEconomy: 261, seatsBusiness: 37, seatsPremium: 16, cargoCapacityTons: 55,
        rangeKm: 13080, cruiseSpeedKmh: 905, fuelBurnPerHour: 9200,
        minRunwayLengthM: 2400, needsJetbridge: true,
        purchasePrice: 310_000_000, leasePricePerMonth: 1_200_000,
        maintenanceCostPerHour: 3900, minAirportClass: 'E',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El long-range clásico de Boeing. Dos motores GE90 más grandes del mundo.'
    }),
    new AircraftData({
        aircraftId: '777-300ER', displayName: 'Boeing 777-300ER', manufacturer: 'Boeing',
        family: '777', category: AircraftCategory.WideBody,
        seatsEconomy: 280, seatsBusiness: 60, seatsPremium: 8, cargoCapacityTons: 70,
        rangeKm: 13650, cruiseSpeedKmh: 905, fuelBurnPerHour: 11000,
        minRunwayLengthM: 2500, needsJetbridge: true,
        purchasePrice: 375_000_000, leasePricePerMonth: 1_500_000,
        maintenanceCostPerHour: 4500, minAirportClass: 'E',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El más vendido de gran capacidad. Pilar de las rutas intercontinentales.'
    }),
    new AircraftData({
        aircraftId: 'A350-900', displayName: 'Airbus A350-900', manufacturer: 'Airbus',
        family: 'A350', category: AircraftCategory.WideBody,
        seatsEconomy: 253, seatsBusiness: 42, seatsPremium: 33, cargoCapacityTons: 50,
        rangeKm: 15000, cruiseSpeedKmh: 903, fuelBurnPerHour: 7900,
        minRunwayLengthM: 2200, needsJetbridge: true,
        purchasePrice: 317_000_000, leasePricePerMonth: 1_200_000,
        maintenanceCostPerHour: 3500, minAirportClass: 'E',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El más eficiente de su clase. Ultra largo alcance con confort premium.'
    }),
    new AircraftData({
        aircraftId: 'A350-1000', displayName: 'Airbus A350-1000', manufacturer: 'Airbus',
        family: 'A350', category: AircraftCategory.WideBody,
        seatsEconomy: 300, seatsBusiness: 48, seatsPremium: 40, cargoCapacityTons: 60,
        rangeKm: 16100, cruiseSpeedKmh: 910, fuelBurnPerHour: 8600,
        minRunwayLengthM: 2400, needsJetbridge: true,
        purchasePrice: 366_000_000, leasePricePerMonth: 1_380_000,
        maintenanceCostPerHour: 3800, minAirportClass: 'E',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El avión de mayor alcance en servicio. Conecta cualquier par de ciudades del planeta.'
    }),

    // ══════════════════════════════════════════
    //  MEGA HUB  (3 modelos)
    // ══════════════════════════════════════════

    new AircraftData({
        aircraftId: '747-400', displayName: 'Boeing 747-400', manufacturer: 'Boeing',
        family: '747', category: AircraftCategory.MegaHub,
        seatsEconomy: 345, seatsBusiness: 52, seatsPremium: 14, cargoCapacityTons: 80,
        rangeKm: 13450, cruiseSpeedKmh: 913, fuelBurnPerHour: 12000,
        minRunwayLengthM: 3000, needsJetbridge: true,
        purchasePrice: 350_000_000, leasePricePerMonth: 1_480_000,
        maintenanceCostPerHour: 5200, minAirportClass: 'F',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'La Reina de los Cielos clásica. Icónica joroba, 4 motores, capacidad monumental.'
    }),
    new AircraftData({
        aircraftId: 'A380-800', displayName: 'Airbus A380-800', manufacturer: 'Airbus',
        family: 'A380', category: AircraftCategory.MegaHub,
        seatsEconomy: 399, seatsBusiness: 76, seatsPremium: 14, cargoCapacityTons: 84,
        rangeKm: 15200, cruiseSpeedKmh: 903, fuelBurnPerHour: 14000,
        minRunwayLengthM: 3000, needsJetbridge: true,
        purchasePrice: 432_000_000, leasePricePerMonth: 2_000_000,
        maintenanceCostPerHour: 6000, minAirportClass: 'F',
        isUnlockedAtStart: true, reputationRequired: 0,
        description: 'El gigante del aire. Solo para mega-hubs con máxima demanda.'
    })
];

// Registrar como global para acceso desde otros módulos
if (typeof window !== 'undefined') {
    window.AIRCRAFT_CATALOG = DEFAULT_AIRCRAFT_CATALOG;
}

// ─────────────────────────────────────────────────────────────
//  MAPEO aircraftId → imagen PNG  (img/aviones/<nombre>.png)
// ─────────────────────────────────────────────────────────────
const AIRCRAFT_IMAGES = {
    // Regional — turbohélices
    'ATR42-600':  'ATR42.png',
    'ATR72-600':  'ATR72.png',
    // Regional — jets Bombardier CRJ
    'CRJ-200':    'CRJ-200.png',
    'CRJ-700':    'CRJ-700.png',
    'CRJ-900':    'CRJ-900.png',
    // Regional — jets Embraer
    'ERJ-145':    'ERJ-145.png',
    'E170':       'E170.png',
    'E175':       'E175.png',
    'E190':       'E190.png',
    'E190-E2':    'E190.png',
    'E195-E2':    'E195.png',
    // Narrow-body Boeing
    '737-700':    '737-700.png',
    '737-800':    '737-800.png',
    '737-900ER':  '737-900.png',
    '737MAX8':    '737-MAX8.png',
    '737MAX9':    '737-MAX9.png',
    '737MAX10':   '737-MAX10.png',
    '757-200':    '757.png',
    '757-300':    '757.png',
    // Narrow-body Airbus
    'A319neo':    'A319.png',
    'A320':       'A320.png',
    'A320neo':    'A320NEO.png',
    'A321neo':    'A321NEO.png',
    'A321XLR':    'A321XLR.png',
    // Wide-body Boeing
    '767-300ER':  '767-300ER.png',
    '787-8':      '787-8.png',
    '787-9':      '787-9.png',
    '787-10':     '787-10.png',
    '777-200ER':  '777-200.png',
    '777-300ER':  '777-300ER.png',
    // Wide-body Airbus
    'A330-200':   'A330.png',
    'A330-300':   'A330.png',
    'A330neo':    'A330NEO.png',
    'A350-900':   'A350-900.png',
    'A350-1000':  'A350-1000.png',
    // Mega-hub
    '747-400':    '747-8.png',
    'A380-800':   'A380.png',
};
if (typeof window !== 'undefined') {
    window.AIRCRAFT_IMAGES = AIRCRAFT_IMAGES;
}

// ─────────────────────────────────────────────────────────────
//  EXPORTAR
// ─────────────────────────────────────────────────────────────

if (typeof module !== 'undefined') {
    module.exports = {
        AirportData, AircraftData, EventData,
        AircraftCategory, EventCategory, EventSeverity,
        EventProbability, EventImpactType, UrgencyLevel,
        DEFAULT_AIRCRAFT_CATALOG
    };
} else {
    window.AirportData  = AirportData;
    window.AircraftData = AircraftData;
    window.EventData    = EventData;
    window.AircraftCategory  = AircraftCategory;
    window.EventCategory     = EventCategory;
    window.EventSeverity     = EventSeverity;
    window.EventProbability  = EventProbability;
    window.EventImpactType   = EventImpactType;
    window.UrgencyLevel      = UrgencyLevel;
    window.DEFAULT_AIRCRAFT_CATALOG = DEFAULT_AIRCRAFT_CATALOG;
}
