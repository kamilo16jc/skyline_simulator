// ═══════════════════════════════════════════════════════════════
//  SkyLine — EventEngine.js
//  Portado desde EventEngine.cs (Unity C#)
//  Motor de eventos aleatorios
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  ENUMS
// ─────────────────────────────────────────────────────────────

const EventResolutionChoice = Object.freeze({
    Accept:    'Accept',     // Acepta el costo predefinido
    Negotiate: 'Negotiate',  // Intenta negociar (40-60% éxito)
    Ignore:    'Ignore',     // Ignora el evento (peor resultado)
    Insurance: 'Insurance'   // Usa seguro (50-80% reducción)
});

const EventQueuePriority = Object.freeze({
    Critical:    0,   // Se muestra primero, timer 60s
    Important:   1,   // Timer 5 min
    Informative: 2    // Sin timer
});

// ─────────────────────────────────────────────────────────────
//  CLASES DE DATOS
// ─────────────────────────────────────────────────────────────

class ActiveEvent {
    constructor() {
        this.instanceId             = '';
        this.data                   = null;   // EventData object
        this.timeRemainingSeconds   = 0;
        this.isExpired              = false;
        this.isResolved             = false;
        this.resolution             = null;
        this.finalCashImpact        = 0;
        this.finalReputationImpact  = 0;
        this.triggeredDate          = null;
        this.triggeredAtAirport     = null;
    }

    get priority() {
        if (!this.data) return EventQueuePriority.Informative;
        const map = {
            'Critical':    EventQueuePriority.Critical,
            'Important':   EventQueuePriority.Important,
            'Informative': EventQueuePriority.Informative
        };
        return map[this.data.urgency] ?? EventQueuePriority.Informative;
    }
}

class EventCooldownEntry {
    constructor(eventId, weeks) {
        this.eventId       = eventId;
        this.weeksRemaining = weeks;
    }
}

class EventResolutionResult {
    constructor() {
        this.success              = false;
        this.cashImpact           = 0;
        this.reputationImpact     = 0;
        this.messageEN            = '';
        this.messageES            = '';
        this.triggeredChainEvent  = false;
        this.chainEventId         = null;
    }
}

// ─────────────────────────────────────────────────────────────
//  EVENT ENGINE — CLASE PRINCIPAL (Singleton)
// ─────────────────────────────────────────────────────────────

class EventEngine {
    constructor() {
        if (EventEngine._instance) return EventEngine._instance;
        EventEngine._instance = this;

        // Referencias
        this._game    = null;
        this._economy = null;

        // Base de datos de eventos (array de objetos EventData)
        this._allEvents = [];

        // Cola de eventos activos
        this._eventQueue    = [];
        this._currentEvent  = null;

        // Cooldowns
        this._cooldowns     = [];

        // Historial
        this._eventHistory  = [];

        // Configuración
        this._checkIntervalDays  = 3;
        this._maxQueueSize       = 5;
        this._eventsEnabled      = true;
        this._daysSinceLastCheck = 0;
        this._weekCounter        = 0;
        this._difficultyMultiplier = 1.0;

        // Timer de countdown (reemplaza Update() de Unity)
        this._countdownInterval = null;

        // Listeners
        this._listeners = {
            onEventTriggered:      [],
            onEventExpired:        [],
            onEventResolved:       [],
            onChainEventTriggered: []
        };

        console.log('[EventEngine] Iniciado.');
    }

    static get instance() {
        if (!EventEngine._instance) new EventEngine();
        return EventEngine._instance;
    }

    // ── Propiedades ──
    get eventQueue()       { return this._eventQueue; }
    get currentEvent()     { return this._currentEvent; }
    get history()          { return this._eventHistory; }
    get hasPendingEvents() { return this._eventQueue.length > 0; }

    on(event, callback) {
        if (this._listeners[event]) this._listeners[event].push(callback);
    }

    _emit(event, data) {
        if (this._listeners[event]) this._listeners[event].forEach(cb => cb(data));
    }

    // ─────────────────────────────────────────────────────────
    //  INICIALIZACIÓN
    // ─────────────────────────────────────────────────────────

    init(gameManager, economyEngine, eventsArray) {
        this._game    = gameManager;
        this._economy = economyEngine;

        if (eventsArray) {
            this._allEvents = eventsArray;
            console.log(`[EventEngine] ${this._allEvents.length} eventos cargados.`);
        }

        this._setDifficultyMultiplier();

        if (this._game) {
            this._game.on('onDayAdvanced',  () => this._handleDayAdvanced());
            this._game.on('onMonthChanged', () => this._handleMonthChanged());
        }

        this._startCountdown();
        console.log(`[EventEngine] Iniciado con ${this._allEvents.length} eventos cargados.`);
    }

    loadEvents(eventsArray) {
        this._allEvents = eventsArray ?? [];
        console.log(`[EventEngine] ${this._allEvents.length} eventos cargados.`);
    }

    _setDifficultyMultiplier() {
        if (!this._game?.airline) return;
        const map = {
            'Easy':      0.6,
            'Normal':    1.0,
            'Hard':      1.4,
            'Realistic': 1.8
        };
        this._difficultyMultiplier = map[this._game.airline.difficulty] ?? 1.0;
    }

    // ─────────────────────────────────────────────────────────
    //  COUNTDOWN — REEMPLAZA Update() DE UNITY
    // ─────────────────────────────────────────────────────────

    _startCountdown() {
        if (this._countdownInterval) clearInterval(this._countdownInterval);
        this._countdownInterval = setInterval(() => this._tick(), 100);
    }

    _tick() {
        if (!this._eventsEnabled) return;
        if (!this._game?.isPlaying) return;

        if (this._currentEvent && !this._currentEvent.isResolved) {
            if (this._currentEvent.data?.urgency !== 'Informative') {
                this._currentEvent.timeRemainingSeconds -= 0.1;
                if (this._currentEvent.timeRemainingSeconds <= 0) {
                    this._handleEventExpired(this._currentEvent);
                }
            }
        } else if (!this._currentEvent || this._currentEvent.isResolved) {
            this._dequeueNextEvent();
        }
    }

    // ─────────────────────────────────────────────────────────
    //  EVALUACIÓN DE EVENTOS
    // ─────────────────────────────────────────────────────────

    _handleDayAdvanced() {
        this._daysSinceLastCheck++;
        if (this._daysSinceLastCheck >= this._checkIntervalDays) {
            this._daysSinceLastCheck = 0;
            this._evaluateEvents();
        }
    }

    _handleMonthChanged() {
        this._weekCounter += 4;
        this._advanceCooldowns();
    }

    _evaluateEvents() {
        if (this._eventQueue.length >= this._maxQueueSize) return;
        if (this._allEvents.length === 0) return;

        for (const eventData of this._allEvents) {
            if (!this._canTrigger(eventData)) continue;

            const probability = this._getEventProbability(eventData);
            const roll        = Math.random();

            if (roll <= probability) {
                this.triggerEvent(eventData);
                if (eventData.urgency !== 'Critical') break;
            }
        }
    }

    _canTrigger(e) {
        if (!e || !this._game?.airline) return false;

        const cooldown = this._cooldowns.find(c => c.eventId === e.eventId);
        if (cooldown && cooldown.weeksRemaining > 0) return false;

        const companyAgeMonths = this._calculateCompanyAgeMonths();
        if (companyAgeMonths < e.minCompanyAgeMonths) return false;

        if (this._game.fleet.length < e.minFleetSize) return false;

        if (e.requiresInternationalRoutes) {
            const hasIntl = this._game.routes.some(r => r.isInternational && r.isActive);
            if (!hasIntl) return false;
        }

        if (e.requiresLargeAirport) {
            const hasLarge = this._economy?.gates?.some(g => g.airportClass <= 2) ?? false;
            if (!hasLarge) return false;
        }

        return true;
    }

    _getEventProbability(e) {
        let baseProbability = e.baseProbabilityPerWeek * this._difficultyMultiplier;

        let reputationMod = 1.0;
        if (this._game?.airline) {
            const rep = this._game.airline.reputation;
            if (rep < 30)       reputationMod = 1.5;
            else if (rep > 70)  reputationMod = 0.75;
        }

        const categoryMod = e.category === 'Opportunities'
            ? (reputationMod > 1 ? 0.5 : 1.2)
            : reputationMod;

        return Math.max(0, Math.min(0.95, baseProbability * categoryMod));
    }

    // ─────────────────────────────────────────────────────────
    //  DISPARO DE EVENTOS
    // ─────────────────────────────────────────────────────────

    triggerEvent(eventData, isChainEvent = false) {
        if (!eventData) return null;

        const timerMap = { Critical: 60, Important: 300, Informative: Number.MAX_VALUE };
        const timer    = timerMap[eventData.urgency] ?? 300;

        const active = new ActiveEvent();
        active.instanceId           = 'EVT_' + Math.random().toString(36).substr(2,8);
        active.data                 = eventData;
        active.timeRemainingSeconds = timer;
        active.triggeredDate        = this._game?.date ? { ...this._game.date } : null;

        this._insertByPriority(active);
        this._registerCooldown(eventData.eventId, eventData.cooldownWeeks ?? 0);

        if (eventData.urgency === 'Critical' && this._game?.settings?.autoPause)
            this._game.pauseGame();

        this._emit('onEventTriggered', active);

        const prefix = isChainEvent ? '[CHAIN] ' : '';
        console.log(`[EventEngine] ${prefix}Evento disparado: ${eventData.eventId} — ${eventData.titleES} (${eventData.urgency})`);
        return active;
    }

    triggerEventById(eventId) {
        const eventData = this._allEvents.find(e => e.eventId === eventId);
        if (!eventData) { console.warn(`[EventEngine] Evento no encontrado: ${eventId}`); return null; }
        return this.triggerEvent(eventData);
    }

    _insertByPriority(newEvent) {
        let insertIndex = this._eventQueue.length;
        for (let i = 0; i < this._eventQueue.length; i++) {
            if (newEvent.priority < this._eventQueue[i].priority) {
                insertIndex = i;
                break;
            }
        }
        this._eventQueue.splice(insertIndex, 0, newEvent);
    }

    // ─────────────────────────────────────────────────────────
    //  RESOLUCIÓN DE EVENTOS
    // ─────────────────────────────────────────────────────────

    resolveCurrentEvent(choice, optionIndex = 0) {
        if (!this._currentEvent || this._currentEvent.isResolved) {
            console.warn('[EventEngine] No hay evento activo para resolver.');
            return null;
        }

        const result = this._calculateResolution(this._currentEvent, choice, optionIndex);
        this._applyResolution(this._currentEvent, result);

        this._currentEvent.isResolved              = true;
        this._currentEvent.resolution              = choice;
        this._currentEvent.finalCashImpact         = result.cashImpact;
        this._currentEvent.finalReputationImpact   = result.reputationImpact;

        this._eventHistory.push(this._currentEvent);

        if (result.triggeredChainEvent && result.chainEventId) {
            setTimeout(() => this._triggerChainEvent(result.chainEventId), 2000);
        }

        this._emit('onEventResolved', result);
        console.log(`[EventEngine] Evento resuelto: ${this._currentEvent.data.eventId} — $${result.cashImpact.toLocaleString()} | Rep: ${result.reputationImpact >= 0 ? '+' : ''}${result.reputationImpact.toFixed(1)}`);

        this._currentEvent = null;
        this._dequeueNextEvent();
        return result;
    }

    _calculateResolution(active, choice, optionIndex) {
        const data   = active.data;
        const result = new EventResolutionResult();

        const baseCash = data.cashImpact ?? 0;
        const baseRep  = data.reputationImpact ?? 0;

        switch (choice) {
            case EventResolutionChoice.Accept: {
                const optionCost = (data.optionCosts && optionIndex < data.optionCosts.length)
                    ? data.optionCosts[optionIndex] : baseCash;
                const optionRep = (data.optionReputationChange && optionIndex < data.optionReputationChange.length)
                    ? data.optionReputationChange[optionIndex] : baseRep;
                result.cashImpact       = optionCost;
                result.reputationImpact = optionRep;
                result.success          = true;
                result.messageES        = 'Situación resuelta según protocolo.';
                result.messageEN        = 'Situation resolved per protocol.';
                break;
            }

            case EventResolutionChoice.Negotiate: {
                const chance  = 0.4 + Math.random() * 0.2;
                const success = Math.random() <= chance;
                if (success) {
                    const reduction = 0.3 + Math.random() * 0.2;
                    result.cashImpact       = baseCash * (1 - reduction);
                    result.reputationImpact = baseRep * 0.5;
                    result.success          = true;
                    result.messageES        = `Negociación exitosa. Costo reducido ${(reduction*100).toFixed(0)}%.`;
                    result.messageEN        = `Negotiation successful. Cost reduced ${(reduction*100).toFixed(0)}%.`;
                } else {
                    result.cashImpact       = baseCash;
                    result.reputationImpact = baseRep * 1.3;
                    result.success          = false;
                    result.messageES        = 'Negociación fallida. Sin reducción de costos.';
                    result.messageEN        = 'Negotiation failed. No cost reduction.';
                }
                break;
            }

            case EventResolutionChoice.Ignore:
                result.cashImpact       = baseCash * 1.5;
                result.reputationImpact = baseRep * 2.0 - 5;
                result.success          = false;
                result.messageES        = 'Ignorar el evento tuvo consecuencias graves.';
                result.messageEN        = 'Ignoring the event had severe consequences.';
                break;

            case EventResolutionChoice.Insurance:
                if (data.hasRewardedAdOption) {
                    const reduction = 0.5 + Math.random() * 0.3;
                    result.cashImpact       = baseCash * (1 - reduction);
                    result.reputationImpact = baseRep * 0.3;
                    result.success          = true;
                    result.messageES        = `Seguro cubrió ${(reduction*100).toFixed(0)}% del costo.`;
                    result.messageEN        = `Insurance covered ${(reduction*100).toFixed(0)}% of cost.`;
                } else {
                    result.cashImpact       = baseCash;
                    result.reputationImpact = baseRep;
                    result.success          = false;
                    result.messageES        = 'No tienes seguro disponible para este evento.';
                    result.messageEN        = 'No insurance available for this event.';
                }
                break;
        }

        // Cadena de eventos
        if (data.triggersEventIds?.length > 0 && Math.random() <= (data.chainProbability ?? 0)) {
            const chainIndex = Math.floor(Math.random() * data.triggersEventIds.length);
            result.triggeredChainEvent = true;
            result.chainEventId        = data.triggersEventIds[chainIndex];
        }

        return result;
    }

    _applyResolution(active, result) {
        if (this._economy) {
            if (result.cashImpact < 0)
                this._economy.deductExpense(Math.abs(result.cashImpact), `Evento: ${active.data.titleES}`);
            else if (result.cashImpact > 0)
                this._economy.addRevenue(result.cashImpact, `Evento: ${active.data.titleES}`);
        }

        if (this._game && result.reputationImpact !== 0)
            this._game.modifyReputation(result.reputationImpact, `Evento: ${active.data.titleES}`);

        if (active.data.demandImpact && active.data.demandImpact !== 0 && this._game) {
            this._game.routes.forEach(route => {
                route.demandMultiplier *= (1 + active.data.demandImpact * 0.01);
            });
        }
    }

    // ─────────────────────────────────────────────────────────
    //  EXPIRACIÓN DE EVENTOS
    // ─────────────────────────────────────────────────────────

    _handleEventExpired(active) {
        active.isExpired = true;

        const result = this._calculateResolution(active, EventResolutionChoice.Ignore, 0);
        result.messageES = 'El tiempo de respuesta expiró. Consecuencias máximas aplicadas.';
        result.messageEN = 'Response time expired. Maximum consequences applied.';

        this._applyResolution(active, result);
        active.isResolved = true;
        this._eventHistory.push(active);

        this._emit('onEventExpired', active);
        console.warn(`[EventEngine] Evento expirado: ${active.data.eventId} — Consecuencias máximas aplicadas.`);

        this._currentEvent = null;
        if (this._game?.settings?.autoPause) this._game.resumeGame();
    }

    // ─────────────────────────────────────────────────────────
    //  GESTIÓN DE COLA
    // ─────────────────────────────────────────────────────────

    _dequeueNextEvent() {
        if (this._eventQueue.length === 0) { this._currentEvent = null; return; }
        this._currentEvent = this._eventQueue.shift();
        console.log(`[EventEngine] Mostrando evento: ${this._currentEvent.data.eventId}`);
    }

    // ─────────────────────────────────────────────────────────
    //  COOLDOWNS
    // ─────────────────────────────────────────────────────────

    _registerCooldown(eventId, weeks) {
        if (weeks <= 0) return;
        const existing = this._cooldowns.find(c => c.eventId === eventId);
        if (existing) existing.weeksRemaining = weeks;
        else this._cooldowns.push(new EventCooldownEntry(eventId, weeks));
    }

    _advanceCooldowns() {
        this._weekCounter++;
        this._cooldowns = this._cooldowns.filter(cd => {
            cd.weeksRemaining--;
            return cd.weeksRemaining > 0;
        });
    }

    // ─────────────────────────────────────────────────────────
    //  CADENAS DE EVENTOS
    // ─────────────────────────────────────────────────────────

    _triggerChainEvent(chainEventId) {
        const chainData = this._allEvents.find(e => e.eventId === chainEventId);
        if (chainData) {
            const chainEvent = this.triggerEvent(chainData, true);
            this._emit('onChainEventTriggered', chainEvent);
            console.log(`[EventEngine] Evento en cadena disparado: ${chainEventId}`);
        } else {
            console.warn(`[EventEngine] Evento en cadena no encontrado: ${chainEventId}`);
        }
    }

    // ─────────────────────────────────────────────────────────
    //  UTILIDADES
    // ─────────────────────────────────────────────────────────

    _calculateCompanyAgeMonths() {
        if (!this._game?.airline?.foundedDate || !this._game?.date) return 0;
        const founded = this._game.airline.foundedDate;
        const current = this._game.date;
        return ((current.year - founded.year) * 12) + (current.month - founded.month);
    }

    setEventsEnabled(enabled) {
        this._eventsEnabled = enabled;
        console.log(`[EventEngine] Eventos ${enabled ? 'activados' : 'desactivados'}`);
    }

    clearQueue() {
        this._eventQueue = [];
        this._currentEvent = null;
        console.log('[EventEngine] Cola de eventos limpiada.');
    }

    forceEvent(eventId) {
        const eventData = this._allEvents.find(e => e.eventId === eventId);
        if (eventData) this.triggerEvent(eventData);
        else console.warn(`[EventEngine] Evento no encontrado: ${eventId}`);
    }

    getStats() {
        return `Eventos cargados: ${this._allEvents.length} | En cola: ${this._eventQueue.length} | Historial: ${this._eventHistory.length} | Cooldowns activos: ${this._cooldowns.length}`;
    }

    destroy() {
        if (this._countdownInterval) clearInterval(this._countdownInterval);
    }
}

EventEngine._instance = null;

// Exportar
if (typeof module !== 'undefined')
    module.exports = { EventEngine, ActiveEvent, EventResolutionResult, EventCooldownEntry, EventResolutionChoice, EventQueuePriority };
else
    window.EventEngine = EventEngine, window.EventResolutionChoice = EventResolutionChoice, window.EventQueuePriority = EventQueuePriority;
