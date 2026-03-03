// ═══════════════════════════════════════════════════════════════
//  SkyLine — EconomyEngine.js
//  Portado desde EconomyEngine.cs (Unity C#)
//  Motor económico principal del juego
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  ENUMS
// ─────────────────────────────────────────────────────────────

const LoanType = Object.freeze({
    ShortTerm:      'ShortTerm',
    FleetFinancing: 'FleetFinancing',
    CreditLine:     'CreditLine'
});

const LoanStatus = Object.freeze({
    Active:   'Active',
    Paid:     'Paid',
    Defaulted:'Defaulted'
});

const GateOwnership = Object.freeze({
    Rented: 'Rented',
    Owned:  'Owned'
});

const SubsidiaryType = Object.freeze({
    CargoAirline:      'CargoAirline',
    RegionalLowCost:   'RegionalLowCost',
    GroundHandling:    'GroundHandling',
    MRO:               'MRO',
    PilotSchool:       'PilotSchool'
});

const SubsidiaryStatus = Object.freeze({
    Operating:  'Operating',
    Suspended:  'Suspended',
    ForSale:    'ForSale'
});

// ─────────────────────────────────────────────────────────────
//  CLASES DE DATOS
// ─────────────────────────────────────────────────────────────

class BankLoan {
    constructor() {
        this.loanId           = '';
        this.type             = LoanType.ShortTerm;
        this.status           = LoanStatus.Active;
        this.principal        = 0;
        this.remainingBalance = 0;
        this.interestRate     = 0;
        this.termMonths       = 0;
        this.monthsRemaining  = 0;
        this.monthlyPayment   = 0;
        this.purpose          = '';
        this.startDate        = new Date();
    }

    calculateMonthlyPayment() {
        if (this.interestRate <= 0) return this.principal / this.termMonths;
        const monthlyRate = this.interestRate / 12;
        return this.principal *
            (monthlyRate * Math.pow(1 + monthlyRate, this.termMonths)) /
            (Math.pow(1 + monthlyRate, this.termMonths) - 1);
    }
}

class Gate {
    constructor() {
        this.gateId             = '';
        this.airportIATA        = '';
        this.gateNumber         = '';
        this.ownership          = GateOwnership.Rented;
        this.monthlyRent        = 0;
        this.purchasePrice      = 0;
        this.isOccupied         = false;
        this.assignedAircraftId = null;
        this.airportClass       = 4;   // 1=F, 2=E, 3=D, 4=C
    }
}

class Subsidiary {
    constructor() {
        this.subsidiaryId          = '';
        this.name                  = '';
        this.type                  = SubsidiaryType.GroundHandling;
        this.status                = SubsidiaryStatus.Operating;
        this.acquisitionCost       = 0;
        this.currentValue          = 0;
        this.monthlyRevenue        = 0;
        this.monthlyExpenses       = 0;
        this.ownershipPercentage   = 1.0;
        this.employeeCount         = 0;
        this.foundedDate           = new Date();
    }

    get monthlyProfit() {
        return (this.monthlyRevenue - this.monthlyExpenses) * this.ownershipPercentage;
    }
}

class StockMarket {
    constructor() {
        this.isPubliclyTraded    = false;
        this.ipoPrice            = 0;
        this.currentStockPrice   = 0;
        this.totalShares         = 0;
        this.publicShares        = 0;
        this.publicOwnership     = 0;
        this.marketCap           = 0;
        this.quarterlyDividend   = 0;
        this.stockVolatility     = 0.15;
        this.priceHistory        = [];
    }

    updateMarketCap() {
        this.marketCap = this.currentStockPrice * this.totalShares;
    }
}

class MonthlyBalance {
    constructor() {
        this.year  = 0;
        this.month = 0;

        // Ingresos
        this.revenuePassengers   = 0;
        this.revenueCargo        = 0;
        this.revenueSubsidiaries = 0;
        this.revenueOther        = 0;

        // Costos
        this.costFuel          = 0;
        this.costCrew          = 0;
        this.costMaintenance   = 0;
        this.costAirportFees   = 0;
        this.costGates         = 0;
        this.costLoanPayments  = 0;
        this.costTaxes         = 0;
        this.costOther         = 0;
    }

    get totalRevenue() {
        return this.revenuePassengers + this.revenueCargo +
               this.revenueSubsidiaries + this.revenueOther;
    }

    get totalCosts() {
        return this.costFuel + this.costCrew + this.costMaintenance +
               this.costAirportFees + this.costGates +
               this.costLoanPayments + this.costTaxes + this.costOther;
    }

    get netProfit()    { return this.totalRevenue - this.totalCosts; }
    get profitMargin() { return this.totalRevenue > 0 ? this.netProfit / this.totalRevenue : 0; }
}

class CompanyValuation {
    constructor() {
        this.fleetValue        = 0;
        this.gatesValue        = 0;
        this.cashOnHand        = 0;
        this.subsidiariesValue = 0;
        this.totalDebt         = 0;
        this.enterpriseValue   = 0;
    }

    recalculate() {
        this.enterpriseValue = this.fleetValue + this.gatesValue +
                               this.cashOnHand + this.subsidiariesValue -
                               this.totalDebt;
    }

    get canAccessLargeLoan()  { return this.enterpriseValue >= 10_000_000; }
    get canCreateSubsidiary() { return this.enterpriseValue >= 50_000_000; }
    get canAcquireAirline()   { return this.enterpriseValue >= 150_000_000; }
    get canIPO()              { return this.enterpriseValue >= 500_000_000; }
}

// ─────────────────────────────────────────────────────────────
//  ECONOMY ENGINE — CLASE PRINCIPAL (Singleton)
// ─────────────────────────────────────────────────────────────

class EconomyEngine {
    constructor() {
        if (EconomyEngine._instance) return EconomyEngine._instance;
        EconomyEngine._instance = this;

        this._cash        = 5_000_000;
        this._creditScore = 700;
        this._taxRate     = 0.25;

        this._loans        = [];
        this._gates        = [];
        this._subsidiaries = [];
        this._stock        = new StockMarket();
        this._balanceHistory = [];
        this._valuation    = new CompanyValuation();

        // Precios de gates por clase (rent, purchase)
        this._gatePrices = {
            1: { rent: 850_000,  purchase: 25_000_000  },  // Clase F
            2: { rent: 280_000,  purchase:  8_000_000  },  // Clase E
            3: { rent:  95_000,  purchase:  2_500_000  },  // Clase D
            4: { rent:  22_000,  purchase:    500_000  },  // Clase C
        };

        // Tasas de interés por tipo
        this._loanRates = {
            [LoanType.ShortTerm]:      0.12,
            [LoanType.FleetFinancing]: 0.07,
            [LoanType.CreditLine]:     0.15,
        };

        // Listeners
        this._listeners = {
            onCashChanged:        [],
            onMonthClosed:        [],
            onLoanApproved:       [],
            onLoanDefaulted:      [],
            onIPOCompleted:       [],
            onSubsidiaryCreated:  []
        };

        this._recalculateValuation();
        console.log(`[EconomyEngine] Iniciado. Efectivo: $${this._cash.toLocaleString()}`);
    }

    static get instance() {
        if (!EconomyEngine._instance) new EconomyEngine();
        return EconomyEngine._instance;
    }

    // ── Propiedades ──
    get cash()        { return this._cash; }
    get creditScore() { return this._creditScore; }
    get valuation()   { return this._valuation; }
    get stock()       { return this._stock; }
    get loans()       { return this._loans; }
    get gates()       { return this._gates; }
    get subsidiaries(){ return this._subsidiaries; }
    get history()     { return this._balanceHistory; }

    on(event, callback) {
        if (this._listeners[event]) this._listeners[event].push(callback);
    }

    _emit(event, data) {
        if (this._listeners[event]) this._listeners[event].forEach(cb => cb(data));
    }

    // ─────────────────────────────────────────────────────────
    //  GESTIÓN DE EFECTIVO
    // ─────────────────────────────────────────────────────────

    addRevenue(amount, concept = '') {
        if (amount <= 0) return false;
        this._cash += amount;
        this._emit('onCashChanged', this._cash);
        console.log(`[Economy] +$${amount.toLocaleString()} — ${concept}. Caja: $${this._cash.toLocaleString()}`);
        return true;
    }

    deductExpense(amount, concept = '') {
        if (amount <= 0) return false;
        if (this._cash < amount) {
            console.warn(`[Economy] Fondos insuficientes para: ${concept} ($${amount.toLocaleString()})`);
            return false;
        }
        this._cash -= amount;
        this._emit('onCashChanged', this._cash);
        console.log(`[Economy] -$${amount.toLocaleString()} — ${concept}. Caja: $${this._cash.toLocaleString()}`);
        return true;
    }

    // ─────────────────────────────────────────────────────────
    //  CÁLCULO DE INGRESOS POR RUTA
    // ─────────────────────────────────────────────────────────

    calculateFlightRevenue(seatsEconomy, seatsBusiness, seatsPremium,
                            occupancyRate, demandMultiplier,
                            baseFareEconomy, baseFareBusiness, baseFarePremium,
                            distanceKm) {
        const distanceFactor = distanceKm > 5000 ? 1.3 :
                               distanceKm > 2000 ? 1.15 : 1.0;

        const revenueEconomy  = seatsEconomy  * occupancyRate * baseFareEconomy  * distanceFactor * demandMultiplier;
        const revenueBusiness = seatsBusiness * occupancyRate * baseFareBusiness * distanceFactor * demandMultiplier;
        const revenuePremium  = seatsPremium  * occupancyRate * baseFarePremium  * distanceFactor * demandMultiplier;

        return revenueEconomy + revenueBusiness + revenuePremium;
    }

    // ─────────────────────────────────────────────────────────
    //  CÁLCULO DE COSTOS OPERACIONALES
    // ─────────────────────────────────────────────────────────

    calculateFuelCost(fuelBurnPerHour, distanceKm, cruiseSpeedKmh, fuelPricePerLiter = 0.85) {
        const flightHours = distanceKm / cruiseSpeedKmh;
        const fuelLiters  = fuelBurnPerHour * flightHours;
        return fuelLiters * fuelPricePerLiter;
    }

    calculateAirportFees(airportClass, seatsTotal) {
        const baseFee = {1: 18000, 2: 9500, 3: 4200, 4: 1800}[airportClass] ?? 2500;
        const sizeFactor = seatsTotal > 300 ? 1.4 : seatsTotal > 180 ? 1.15 : 1.0;
        return baseFee * sizeFactor;
    }

    calculateCrewCost(pilotCount, cabinCrewCount) {
        const PILOT_MONTHLY = 12500;
        const CABIN_MONTHLY = 3800;
        return (pilotCount * PILOT_MONTHLY) + (cabinCrewCount * CABIN_MONTHLY);
    }

    calculateMaintenanceCost(aircraftFamily, aircraftAgeYears) {
        const familyMap = {
            'A380': 280000, '747': 280000,
            '777': 165000, '787': 165000, 'A350': 165000, 'A330': 165000,
            '737': 85000,  'A320': 85000, 'A321': 85000,
            'ATR': 42000,  'CRJ': 42000,  'E': 42000
        };
        const baseCost = familyMap[aircraftFamily] ?? 75000;
        const ageFactor = 1 + (aircraftAgeYears * 0.03);
        return baseCost * ageFactor;
    }

    // ─────────────────────────────────────────────────────────
    //  SISTEMA DE GATES
    // ─────────────────────────────────────────────────────────

    rentGate(airportIATA, airportClass) {
        const prices = this._gatePrices[airportClass];
        if (!prices) { console.error(`[Gates] Clase de aeropuerto inválida: ${airportClass}`); return false; }
        if (this._cash < prices.rent) {
            console.warn(`[Gates] Fondos insuficientes para rentar gate en ${airportIATA}`);
            return false;
        }

        const gate = new Gate();
        gate.gateId      = `GATE_${airportIATA}_${Math.random().toString(36).substr(2,6)}`;
        gate.airportIATA = airportIATA;
        gate.ownership   = GateOwnership.Rented;
        gate.monthlyRent = prices.rent;
        gate.airportClass = airportClass;

        this.deductExpense(prices.rent, `Primer mes renta gate ${airportIATA}`);
        this._gates.push(gate);
        this._recalculateValuation();
        console.log(`[Gates] Gate rentado en ${airportIATA} — $${prices.rent.toLocaleString()}/mes`);
        return true;
    }

    purchaseGate(airportIATA, airportClass) {
        const prices = this._gatePrices[airportClass];
        if (!prices) return false;
        if (this._cash < prices.purchase) {
            console.warn(`[Gates] Fondos insuficientes para comprar gate en ${airportIATA}`);
            return false;
        }

        const gate = new Gate();
        gate.gateId        = `GATE_${airportIATA}_${Math.random().toString(36).substr(2,6)}`;
        gate.airportIATA   = airportIATA;
        gate.ownership     = GateOwnership.Owned;
        gate.purchasePrice = prices.purchase;
        gate.airportClass  = airportClass;

        this.deductExpense(prices.purchase, `Compra gate ${airportIATA}`);
        this._gates.push(gate);
        this._recalculateValuation();
        console.log(`[Gates] Gate comprado en ${airportIATA} — $${prices.purchase.toLocaleString()}`);
        return true;
    }

    getMonthlyGateCost() {
        return this._gates
            .filter(g => g.ownership === GateOwnership.Rented)
            .reduce((sum, g) => sum + g.monthlyRent, 0);
    }

    hasGateAt(airportIATA) {
        return this._gates.some(g => g.airportIATA === airportIATA);
    }

    // ─────────────────────────────────────────────────────────
    //  SISTEMA BANCARIO
    // ─────────────────────────────────────────────────────────

    requestLoan(type, amount, termMonths, purpose = '') {
        if (!this._validateLoanRequest(type, amount)) return null;

        let rate = this._loanRates[type];
        if (this._creditScore < 600) rate += 0.03;
        else if (this._creditScore > 750) rate -= 0.01;

        const loan = new BankLoan();
        loan.loanId           = 'LOAN_' + Math.random().toString(36).substr(2,8);
        loan.type             = type;
        loan.status           = LoanStatus.Active;
        loan.principal        = amount;
        loan.remainingBalance = amount;
        loan.interestRate     = rate;
        loan.termMonths       = termMonths;
        loan.monthsRemaining  = termMonths;
        loan.purpose          = purpose;
        loan.startDate        = new Date();
        loan.monthlyPayment   = loan.calculateMonthlyPayment();

        this.addRevenue(amount, `Préstamo aprobado: ${purpose}`);
        this._loans.push(loan);
        this._recalculateValuation();
        this._emit('onLoanApproved', loan);

        console.log(`[Bank] Préstamo aprobado: $${amount.toLocaleString()} a ${(rate*100).toFixed(1)}% — Cuota: $${loan.monthlyPayment.toLocaleString()}/mes`);
        return loan;
    }

    _validateLoanRequest(type, amount) {
        if (amount <= 0) { console.warn('[Bank] Monto inválido'); return false; }

        const maxAmount = {
            [LoanType.ShortTerm]:      5_000_000,
            [LoanType.FleetFinancing]: 500_000_000,
            [LoanType.CreditLine]:     10_000_000
        }[type] ?? 0;

        if (amount > maxAmount) {
            console.warn(`[Bank] Monto excede el límite para ${type}: $${maxAmount.toLocaleString()}`);
            return false;
        }

        if (amount > 10_000_000 && !this._valuation.canAccessLargeLoan) {
            console.warn('[Bank] Necesitas $10M de valor empresa para préstamos grandes');
            return false;
        }

        if (this._creditScore < 500) {
            console.warn('[Bank] Credit score demasiado bajo para préstamos');
            return false;
        }

        return true;
    }

    processLoanPayments() {
        let totalPaid = 0;
        const toRemove = [];

        this._loans.forEach(loan => {
            if (loan.status !== LoanStatus.Active) return;

            if (this._cash >= loan.monthlyPayment) {
                this.deductExpense(loan.monthlyPayment, `Cuota préstamo ${loan.loanId.substr(0,8)}`);
                loan.remainingBalance -= (loan.monthlyPayment - (loan.remainingBalance * loan.interestRate / 12));
                loan.monthsRemaining--;
                totalPaid += loan.monthlyPayment;

                if (loan.monthsRemaining <= 0 || loan.remainingBalance <= 0) {
                    loan.status = LoanStatus.Paid;
                    toRemove.push(loan);
                    this._creditScore = Math.min(850, this._creditScore + 15);
                    console.log(`[Bank] Préstamo ${loan.loanId.substr(0,8)} pagado completamente. ✓`);
                }
            } else {
                loan.status = LoanStatus.Defaulted;
                this._creditScore = Math.max(300, this._creditScore - 80);
                this._emit('onLoanDefaulted', loan);
                console.warn(`[Bank] DEFAULT en préstamo ${loan.loanId.substr(0,8)}. Credit score: ${this._creditScore}`);
            }
        });

        toRemove.forEach(loan => this._loans.splice(this._loans.indexOf(loan), 1));
        return totalPaid;
    }

    // ─────────────────────────────────────────────────────────
    //  SUBSIDIARIAS
    // ─────────────────────────────────────────────────────────

    createSubsidiary(name, type, investmentAmount) {
        if (!this._valuation.canCreateSubsidiary) {
            console.warn('[Subsidiary] Necesitas $50M de valor empresa');
            return null;
        }
        if (!this.deductExpense(investmentAmount, `Inversión inicial: ${name}`)) return null;

        const profiles = {
            [SubsidiaryType.CargoAirline]:    { revenue: 2_800_000, expenses: 2_100_000, employees: 85  },
            [SubsidiaryType.RegionalLowCost]: { revenue: 3_200_000, expenses: 2_600_000, employees: 120 },
            [SubsidiaryType.GroundHandling]:  { revenue: 1_200_000, expenses:   850_000, employees: 200 },
            [SubsidiaryType.MRO]:             { revenue: 2_100_000, expenses: 1_500_000, employees: 150 },
            [SubsidiaryType.PilotSchool]:     { revenue:   450_000, expenses:   280_000, employees: 35  },
        };
        const profile = profiles[type] ?? { revenue: 1_000_000, expenses: 800_000, employees: 50 };

        const sub = new Subsidiary();
        sub.subsidiaryId        = 'SUB_' + Math.random().toString(36).substr(2,8);
        sub.name                = name;
        sub.type                = type;
        sub.acquisitionCost     = investmentAmount;
        sub.currentValue        = investmentAmount;
        sub.monthlyRevenue      = profile.revenue;
        sub.monthlyExpenses     = profile.expenses;
        sub.ownershipPercentage = 1.0;
        sub.employeeCount       = profile.employees;

        this._subsidiaries.push(sub);
        this._recalculateValuation();
        this._emit('onSubsidiaryCreated', sub);
        console.log(`[Subsidiary] ${name} creada. Profit mensual estimado: $${sub.monthlyProfit.toLocaleString()}`);
        return sub;
    }

    getSubsidiaryMonthlyIncome() {
        return this._subsidiaries
            .filter(s => s.status === SubsidiaryStatus.Operating)
            .reduce((sum, s) => sum + s.monthlyProfit, 0);
    }

    // ─────────────────────────────────────────────────────────
    //  BOLSA DE VALORES
    // ─────────────────────────────────────────────────────────

    executeIPO(sharePrice, sharesToIssue) {
        if (!this._valuation.canIPO) {
            console.warn('[IPO] Necesitas $500M de valor empresa para cotizar en bolsa');
            return false;
        }
        if (this._stock.isPubliclyTraded) {
            console.warn('[IPO] La empresa ya cotiza en bolsa');
            return false;
        }

        const ipoProceeds = sharePrice * sharesToIssue;

        this._stock.isPubliclyTraded  = true;
        this._stock.ipoPrice          = sharePrice;
        this._stock.currentStockPrice = sharePrice;
        this._stock.totalShares       = sharesToIssue * 2;
        this._stock.publicShares      = sharesToIssue;
        this._stock.publicOwnership   = 0.5;
        this._stock.stockVolatility   = 0.15;
        this._stock.quarterlyDividend = sharePrice * 0.02;
        this._stock.priceHistory.push(sharePrice);
        this._stock.updateMarketCap();

        this.addRevenue(ipoProceeds, 'Ingresos IPO');
        this._emit('onIPOCompleted', this._stock);

        console.log(`[IPO] ¡Empresa en bolsa! Precio: $${sharePrice.toFixed(2)} | Recaudado: $${ipoProceeds.toLocaleString()} | Market Cap: $${this._stock.marketCap.toLocaleString()}`);
        return true;
    }

    updateStockPrice(reputationScore, monthlyProfit) {
        if (!this._stock.isPubliclyTraded) return;

        const reputationFactor = (reputationScore - 50) / 100;
        const profitFactor     = monthlyProfit > 0 ? 0.02 : -0.03;
        const randomFactor     = (Math.random() * 2 - 1) * this._stock.stockVolatility * 0.1;

        const totalChange = reputationFactor * 0.01 + profitFactor + randomFactor;
        this._stock.currentStockPrice *= (1 + totalChange);
        this._stock.currentStockPrice = Math.max(this._stock.currentStockPrice, 0.01);
        this._stock.priceHistory.push(this._stock.currentStockPrice);
        this._stock.updateMarketCap();
    }

    payQuarterlyDividends() {
        if (!this._stock.isPubliclyTraded) return false;

        const totalDividend = this._stock.quarterlyDividend * this._stock.publicShares;
        if (!this.deductExpense(totalDividend, 'Dividendos trimestrales accionistas')) {
            this._stock.currentStockPrice *= 0.92;
            console.warn('[Stock] Dividendos no pagados — precio de acción bajó 8%');
            return false;
        }
        console.log(`[Stock] Dividendos pagados: $${totalDividend.toLocaleString()}`);
        return true;
    }

    // ─────────────────────────────────────────────────────────
    //  CIERRE MENSUAL
    // ─────────────────────────────────────────────────────────

    closeMonth(year, month, flightRevenue, cargoRevenue,
               fuelCost, crewCost, maintenanceCost, airportFees) {
        const balance = new MonthlyBalance();
        balance.year   = year;
        balance.month  = month;

        balance.revenuePassengers   = flightRevenue;
        balance.revenueCargo        = cargoRevenue;
        balance.revenueSubsidiaries = this.getSubsidiaryMonthlyIncome();

        balance.costFuel         = fuelCost;
        balance.costCrew         = crewCost;
        balance.costMaintenance  = maintenanceCost;
        balance.costAirportFees  = airportFees;
        balance.costGates        = this.getMonthlyGateCost();
        balance.costLoanPayments = this.processLoanPayments();

        if (balance.netProfit > 0)
            balance.costTaxes = balance.netProfit * this._taxRate;

        const netAfterTax = balance.netProfit - balance.costTaxes;
        if (netAfterTax > 0)
            this.addRevenue(netAfterTax, `Ganancia neta ${month}/${year}`);
        else
            this.deductExpense(Math.abs(netAfterTax), `Pérdida neta ${month}/${year}`);

        this._subsidiaries.forEach(sub => { sub.currentValue *= 1.005; });

        this._balanceHistory.push(balance);
        this._recalculateValuation();
        this._emit('onMonthClosed', balance);

        console.log(`[Economy] Cierre ${month}/${year} — Ingresos: $${balance.totalRevenue.toLocaleString()} | Costos: $${balance.totalCosts.toLocaleString()} | Neto: $${balance.netProfit.toLocaleString()} | Margen: ${(balance.profitMargin*100).toFixed(1)}%`);
        return balance;
    }

    // ─────────────────────────────────────────────────────────
    //  VALORACIÓN DE EMPRESA
    // ─────────────────────────────────────────────────────────

    _recalculateValuation(fleetValue = 0) {
        if (fleetValue > 0) this._valuation.fleetValue = fleetValue;

        this._valuation.gatesValue = this._gates
            .filter(g => g.ownership === GateOwnership.Owned)
            .reduce((sum, g) => sum + g.purchasePrice * 0.85, 0);

        this._valuation.subsidiariesValue = this._subsidiaries
            .reduce((sum, s) => sum + s.currentValue * s.ownershipPercentage, 0);

        this._valuation.totalDebt = this._loans
            .filter(l => l.status === LoanStatus.Active)
            .reduce((sum, l) => sum + l.remainingBalance, 0);

        this._valuation.cashOnHand = this._cash;
        this._valuation.recalculate();
    }

    // ─────────────────────────────────────────────────────────
    //  UTILIDADES
    // ─────────────────────────────────────────────────────────

    isInFinancialDistress() {
        const monthlyObligations = this.getMonthlyGateCost() +
            this._loans.filter(l => l.status === LoanStatus.Active)
                        .reduce((sum, l) => sum + l.monthlyPayment, 0);
        return this._cash < monthlyObligations * 2;
    }

    getLastBalance() {
        if (this._balanceHistory.length === 0) return null;
        return this._balanceHistory[this._balanceHistory.length - 1];
    }

    calculateCASK(totalCosts, totalSeatsAvailable, totalKmFlown) {
        if (totalSeatsAvailable <= 0 || totalKmFlown <= 0) return 0;
        return totalCosts / (totalSeatsAvailable * totalKmFlown);
    }

    calculateRASK(totalRevenue, totalSeatsAvailable, totalKmFlown) {
        if (totalSeatsAvailable <= 0 || totalKmFlown <= 0) return 0;
        return totalRevenue / (totalSeatsAvailable * totalKmFlown);
    }

    // ─────────────────────────────────────────────────────────
    //  SAVE / LOAD
    // ─────────────────────────────────────────────────────────

    loadFromSave(cash, creditScore, loans, gates) {
        this._cash        = cash;
        this._creditScore = creditScore;
        this._loans       = loans  ?? [];
        this._gates       = gates  ?? [];
        this._recalculateValuation();
        this._emit('onCashChanged', this._cash);
        console.log(`[EconomyEngine] Estado financiero restaurado. Caja: $${this._cash.toLocaleString()}`);
    }

    getSaveState() {
        return {
            cash:        this._cash,
            creditScore: this._creditScore,
            loans:       this._loans,
            gates:       this._gates
        };
    }
}

EconomyEngine._instance = null;

// Exportar
if (typeof module !== 'undefined')
    module.exports = { EconomyEngine, BankLoan, Gate, Subsidiary, StockMarket, MonthlyBalance, CompanyValuation, LoanType, LoanStatus, GateOwnership, SubsidiaryType, SubsidiaryStatus };
else
    window.EconomyEngine = EconomyEngine, window.LoanType = LoanType, window.LoanStatus = LoanStatus, window.GateOwnership = GateOwnership, window.SubsidiaryType = SubsidiaryType;
