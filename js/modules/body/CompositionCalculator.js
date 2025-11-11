const LOG10 = Math.log10 || ((value) => Math.log(value) / Math.log(10));

const DEXA_CORRECTION = {
    default: { slope: 0.97, intercept: 1.2 },
    asian: { slope: 0.95, intercept: 0.5 },
    black: { slope: 0.99, intercept: 0.2 },
    hispanic: { slope: 0.96, intercept: 0.8 }
};

const MUSCLE_MASS_COEFFICIENTS = {
    male: { slope: 1.12, intercept: 1.05 },
    female: { slope: 0.98, intercept: 0.85 },
    nonbinary: { slope: 1.05, intercept: 0.95 }
};

class CompositionCalculator {
    constructor(options = {}) {
        const defaultLogger = (typeof window !== 'undefined' && window.SafeLogger) ? window.SafeLogger : console;
        this.logger = options.logger || defaultLogger;
    }

    estimateBodyFat(input) {
        const normalized = this.#normalizeInput(input);
        const navyEstimate = this.#navyBodyFat(normalized);
        const dexaAligned = this.#applyDexaAdjustment(navyEstimate, normalized);
        return { method: 'navy_adjusted', value: this.#clamp(dexaAligned, 2, 75) };
    }

    estimateLeanMass(input) {
        const normalized = this.#normalizeInput(input);
        const bodyFat = this.estimateBodyFat(normalized).value;
        const weightKg = this.#poundsToKg(normalized.weight);
        const leanMassKg = weightKg * (1 - bodyFat / 100);
        return { method: 'lean_mass', valueKg: this.#round(leanMassKg, 2) };
    }

    estimateMuscleMass(input) {
        const normalized = this.#normalizeInput(input);
        const leanMass = this.estimateLeanMass(normalized).valueKg;
        const coeffs = MUSCLE_MASS_COEFFICIENTS[normalized.gender] || MUSCLE_MASS_COEFFICIENTS.male;
        const muscleMassKg = (leanMass * coeffs.slope) - coeffs.intercept;
        return { method: 'martin-spenst', valueKg: this.#round(Math.max(muscleMassKg, 0), 2) };
    }

    estimateBoneDensity(input) {
        const normalized = this.#normalizeInput(input);
        const heightM = normalized.height / 100;
        const weightKg = this.#poundsToKg(normalized.weight);
        const bmi = weightKg / (heightM * heightM);
        const boneMassKg = Math.max((weightKg * 0.046) + (bmi * 0.02) - (normalized.age * 0.01), 1.5);
        const density = boneMassKg / (heightM ** 2);
        return { method: 'anthropometric', density: this.#round(density, 3), massKg: this.#round(boneMassKg, 2) };
    }

    #normalizeInput(input) {
        if (!input) {throw new Error('Body composition input is required');}
        const normalized = { ...input };
        normalized.gender = (normalized.gender || 'male').toLowerCase();
        normalized.age = Number(normalized.age);
        normalized.height = Number(normalized.height);
        normalized.weight = Number(normalized.weight);
        ['neck', 'waist', 'hip', 'abdomen'].forEach(key => {
            if (normalized[key] !== undefined) {
                normalized[key] = Number(normalized[key]);
            }
        });
        normalized.ethnicity = (normalized.ethnicity || 'default').toLowerCase();

        if (!Number.isFinite(normalized.age) || normalized.age <= 0 || normalized.age > 100) {
            throw new Error('Age must be a realistic number of years');
        }
        if (!Number.isFinite(normalized.height) || normalized.height < 120 || normalized.height > 220) {
            throw new Error('Height must be in centimeters');
        }
        if (!Number.isFinite(normalized.weight) || normalized.weight < 70 || normalized.weight > 500) {
            throw new Error('Weight must be in pounds');
        }

        return normalized;
    }

    #navyBodyFat(input) {
        const heightLog = LOG10(input.height);
        if (input.gender === 'female') {
            if (!this.#validFemaleMeasurements(input)) {
                throw new Error('Female body fat calculation requires neck, waist, and hip measurements');
            }
            const waistHip = input.waist + input.hip;
            return (163.205 * LOG10(waistHip - input.neck)) - (97.684 * heightLog) - 78.387;
        }

        if (!this.#validMaleMeasurements(input)) {
            throw new Error('Male body fat calculation requires neck and abdomen measurements');
        }
        return (86.010 * LOG10(input.abdomen - input.neck)) - (70.041 * heightLog) + 36.76;
    }

    #applyDexaAdjustment(bodyFat, input) {
        const correction = DEXA_CORRECTION[input.ethnicity] || DEXA_CORRECTION.default;
        const ageModifier = this.#ageModifier(input.age);
        return (bodyFat * correction.slope * ageModifier) + correction.intercept;
    }

    #ageModifier(age) {
        if (age < 30) {return 0.98;}
        if (age < 50) {return 1.0;}
        if (age < 65) {return 1.02;}
        return 1.05;
    }

    #validFemaleMeasurements(input) {
        return [input.neck, input.waist, input.hip].every(value => Number.isFinite(value) && value > 0);
    }

    #validMaleMeasurements(input) {
        return [input.neck, input.abdomen].every(value => Number.isFinite(value) && value > 0);
    }

    #poundsToKg(pounds) {
        return pounds * 0.45359237;
    }

    #round(value, decimals) {
        const factor = 10 ** decimals;
        return Math.round(value * factor) / factor;
    }

    #clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
}

if (typeof window !== 'undefined') {
    window.CompositionCalculator = CompositionCalculator;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CompositionCalculator;
    module.exports.default = CompositionCalculator;
}
