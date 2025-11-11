const DEFAULT_METHOD = 'karvonen';
const GENDER_FACTORS = {
    male: { reserveMultiplier: 1.0, maxHRAdjustment: 0 },
    female: { reserveMultiplier: 0.98, maxHRAdjustment: -3 },
    nonbinary: { reserveMultiplier: 0.99, maxHRAdjustment: -1 }
};

const AGE_FACTORS = [
    { maxAge: 29, adjustment: 0 },
    { maxAge: 39, adjustment: -1 },
    { maxAge: 49, adjustment: -2 },
    { maxAge: 59, adjustment: -4 },
    { maxAge: Infinity, adjustment: -6 }
];

class HRZoneEngine {
    constructor(options = {}) {
        const defaultLogger = (typeof window !== 'undefined' && window.SafeLogger) ? window.SafeLogger : console;
        this.logger = options.logger || defaultLogger;
    }

    estimateMaxHeartRate(age, gender = 'male') {
        if (!Number.isFinite(age) || age <= 0 || age > 110) {
            throw new Error('Invalid age supplied for max heart rate estimation');
        }
        const base = 208 - (0.7 * age); // Tanaka et al. 2001
        const genderFactor = GENDER_FACTORS[gender]?.maxHRAdjustment || 0;
        const ageFactor = AGE_FACTORS.find(entry => age <= entry.maxAge)?.adjustment || 0;
        return Math.round(base + genderFactor + ageFactor);
    }

    calculateZones(maxHR, restingHR, method = DEFAULT_METHOD, context = {}) {
        this.#validateInputs(maxHR, restingHR);
        const normalizedMethod = method.toLowerCase();
        if (normalizedMethod !== 'karvonen') {
            throw new Error(`Unsupported HR zone method: ${method}`);
        }

        const gender = context.gender || 'male';
        const reserveMultiplier = GENDER_FACTORS[gender]?.reserveMultiplier || 1.0;
        const adjustedMax = Math.max(maxHR, restingHR + 10); // ensure positive reserve
        const hrReserve = (adjustedMax - restingHR) * reserveMultiplier;

        const zones = {
            Z1: { min: this.#zoneValue(restingHR, hrReserve, 0.50), max: this.#zoneValue(restingHR, hrReserve, 0.60) },
            Z2: { min: this.#zoneValue(restingHR, hrReserve, 0.60), max: this.#zoneValue(restingHR, hrReserve, 0.70) },
            Z3: { min: this.#zoneValue(restingHR, hrReserve, 0.70), max: this.#zoneValue(restingHR, hrReserve, 0.80) },
            Z4: { min: this.#zoneValue(restingHR, hrReserve, 0.80), max: this.#zoneValue(restingHR, hrReserve, 0.90) },
            Z5: { min: this.#zoneValue(restingHR, hrReserve, 0.90), max: Math.round(adjustedMax) }
        };

        if (context.adaptations && typeof context.adaptations === 'object') {
            this.#applyAdaptations(zones, context.adaptations);
        }
        return zones;
    }

    classifyHeartRate(heartRate, zones) {
        if (!Number.isFinite(heartRate) || heartRate <= 0) {return null;}
        for (const [zone, range] of Object.entries(zones)) {
            if (heartRate >= range.min && heartRate <= range.max) {
                return zone;
            }
        }
        if (heartRate > zones.Z5.max) {return 'maximal';}
        if (heartRate < zones.Z1.min) {return 'below';}
        return null;
    }

    #zoneValue(resting, reserve, fraction) {
        return Math.round(resting + (reserve * fraction));
    }

    #applyAdaptations(zones, adaptations) {
        const { altitude, fitnessLevel } = adaptations;
        if (Number.isFinite(altitude) && altitude > 1500) {
            const reduction = altitude >= 3500 ? 5 : 3;
            Object.values(zones).forEach(range => {
                range.min = Math.max(range.min - reduction, 40);
                range.max = Math.max(range.max - reduction, range.min + 1);
            });
        }
        if (fitnessLevel) {
            const adjustment = fitnessLevel === 'elite' ? 2 : fitnessLevel === 'detrained' ? -2 : 0;
            if (adjustment !== 0) {
                Object.values(zones).forEach(range => {
                    range.min += adjustment;
                    range.max += adjustment;
                });
            }
        }
    }

    #validateInputs(maxHR, restingHR) {
        if (!Number.isFinite(maxHR) || !Number.isFinite(restingHR)) {
            throw new Error('Heart rate inputs must be numeric');
        }
        if (maxHR <= restingHR) {
            throw new Error('Max heart rate must exceed resting heart rate');
        }
        if (maxHR < 80 || maxHR > 230) {
            throw new Error('Max heart rate value out of physiological range');
        }
        if (restingHR < 30 || restingHR > 120) {
            throw new Error('Resting heart rate value out of physiological range');
        }
    }
}

if (typeof window !== 'undefined') {
    window.HRZoneEngine = HRZoneEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HRZoneEngine;
    module.exports.default = HRZoneEngine;
}
