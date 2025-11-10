/**
 * Pure Load Calculation Engine
 * Supports RPE*min, TRIMP (with HR), and MET-min calculations
 * Deterministic behavior for consistent substitution mathematics
 */

const RPE_ZONE_MULTIPLIERS = {
    Z1: 0.5,
    Z2: 1.0,
    Z3: 1.5,
    Z4: 2.0,
    Z5: 2.5
};

class LoadCalculationEngine {
    /**
     * Compute training load for a session using multiple methods
     * @param {Object} session - Session object with duration, intensity, HR data
     * @returns {Object} Load calculation results with method breakdown
     */
    static compute_load(session) {
        if (!session || typeof session !== 'object') {
            throw new Error('Session object is required');
        }

        if (typeof session.duration_minutes !== 'undefined') {
            const durationValue = Number(session.duration_minutes);
            if (!Number.isFinite(durationValue) || durationValue <= 0) {
                throw new Error('Session duration must be positive');
            }
        }

        const result = {
            total_load: 0,
            method_used: 'unknown',
            breakdown: {},
            confidence: 0,
            details: {}
        };

        // Method 1: TRIMP (highest priority if HR data available)
        if (session.hr_data && session.hr_data.avg_hr && session.duration_minutes) {
            const trimpResult = this.calculateTRIMP(session);
            if (trimpResult.valid) {
                result.total_load = trimpResult.trimp_score;
                result.method_used = 'TRIMP';
                result.breakdown = trimpResult.breakdown;
                result.confidence = 0.95;
                result.details = trimpResult.details;
                return result;
            }
        }

        // Method 2: Zone-based RPE*min (second priority)
        if (session.zone_distribution && session.duration_minutes) {
            const zoneResult = this.calculateZoneBasedLoad(session);
            if (zoneResult.valid) {
                result.total_load = zoneResult.load_score;
                result.method_used = 'Zone_RPE';
                result.breakdown = zoneResult.breakdown;
                result.confidence = 0.85;
                result.details = zoneResult.details;
                return result;
            }
        }

        // Method 3: Simple RPE*min (third priority)
        if (session.rpe && session.duration_minutes) {
            const rpeResult = this.calculateRPELoad(session);
            result.total_load = rpeResult.load_score;
            result.method_used = 'RPE_Duration';
            result.breakdown = rpeResult.breakdown;
            result.confidence = 0.75;
            result.details = rpeResult.details;
            return result;
        }

        // Method 4: MET-based (fallback)
        if (session.modality && session.duration_minutes && session.intensity) {
            const metResult = this.calculateMETLoad(session);
            result.total_load = metResult.load_score;
            result.method_used = 'MET_Minutes';
            result.breakdown = metResult.breakdown;
            result.confidence = 0.65;
            result.details = metResult.details;
            return result;
        }

        throw new Error('Insufficient data for load calculation');
    }

    /**
     * Calculate TRIMP load using Banister formula
     * TRIMP = duration × 0.64 × e^(1.92 × HRR)
     * @param {Object} session - Session with HR data
     * @returns {Object} TRIMP calculation result
     */
    static calculateTRIMP(session) {
        const { hr_data, duration_minutes, user_profile } = session;

        const duration = Number(duration_minutes);
        const averageHr = Number(hr_data?.avg_hr);

        if (!Number.isFinite(duration) || duration <= 0) {
            return { valid: false };
        }
        if (!Number.isFinite(averageHr) || averageHr <= 0) {
            return { valid: false };
        }

        const max_hr = user_profile?.max_hr || this.estimateMaxHR(user_profile?.age, user_profile?.gender);
        const rest_hr = user_profile?.rest_hr || 60;
        const hr_reserve = max_hr - rest_hr;
        if (!Number.isFinite(hr_reserve) || hr_reserve <= 0) {
            return { valid: false };
        }

        const deltaHr = averageHr - rest_hr;
        const ratio = deltaHr / hr_reserve;
        const clampedRatio = Math.max(0, Math.min(1, ratio));

        const genderFactor = user_profile?.gender === 'female' ? 1.67 : 1.92;
        const exponentialComponent = Math.pow(genderFactor, clampedRatio);
        const trimpScore = duration * clampedRatio * exponentialComponent;

        return {
            valid: true,
            trimp_score: Number(trimpScore.toFixed(2)),
            breakdown: {
                duration_minutes: duration,
                avg_hr: averageHr,
                hrr_fraction: Number(clampedRatio.toFixed(3)),
                gender_factor: genderFactor
            },
            details: {
                max_hr,
                rest_hr,
                hr_reserve,
                delta_hr: Number(clampedRatio.toFixed(3)),
                exponential_factor: Number(exponentialComponent.toFixed(3))
            }
        };
    }

    /**
     * Calculate load based on zone distribution
     * Uses zone multipliers for more accurate load estimation
     * @param {Object} session - Session with zone distribution
     * @returns {Object} Zone-based load result
     */
    static calculateZoneBasedLoad(session) {
        const { zone_distribution, duration_minutes } = session;

        if (!zone_distribution || !duration_minutes) {
            return { valid: false };
        }
        const duration = Number(duration_minutes);
        if (!Number.isFinite(duration) || duration <= 0) {
            return { valid: false };
        }

        const zoneLoadMultipliers = {
            Z1: 1.0,
            Z2: 2.0,
            Z3: 4.0,
            Z4: 7.0,
            Z5: 10.0
        };

        let total_load = 0;
        const breakdown = {};

        Object.entries(zone_distribution).forEach(([zoneKey, minutes]) => {
            const minutesValue = Number(minutes);
            if (!Number.isFinite(minutesValue) || minutesValue <= 0) {
                return;
            }

            const zone = this.normalizeZone(zoneKey);
            if (!zone) {
                return;
            }

            const multiplier = zoneLoadMultipliers[zone];
            if (!multiplier) {
                return;
            }

            const zoneLoad = minutesValue * multiplier;
            total_load += zoneLoad;
            breakdown[zone] = {
                minutes: Number(minutesValue.toFixed(2)),
                multiplier,
                load_contribution: Number(zoneLoad.toFixed(2))
            };
        });

        if (total_load === 0) {
            return { valid: false };
        }

        return {
            valid: true,
            load_score: Number(total_load.toFixed(2)),
            breakdown,
            details: {
                total_minutes: duration,
                zones_used: Object.keys(breakdown),
                avg_intensity: Number((total_load / duration).toFixed(3))
            }
        };
    }

    /**
     * Calculate simple RPE * duration load
     * @param {Object} session - Session with RPE and duration
     * @returns {Object} RPE load result
     */
    static calculateRPELoad(session) {
        const { rpe, duration_minutes } = session;

        const duration = Number(duration_minutes);
        const perceivedExertion = Number(rpe);

        if (!Number.isFinite(duration) || duration <= 0) {
            return { valid: false };
        }
        if (!Number.isFinite(perceivedExertion)) {
            return { valid: false };
        }

        const baseRpe = perceivedExertion <= 0 ? 1 : perceivedExertion;
        const clamped_rpe = Math.min(10, Math.max(1, baseRpe));
        const zone = this.normalizeZone(session.intensity);
        const zoneMultiplier = zone ? (RPE_ZONE_MULTIPLIERS[zone] || 1) : 1;
        const load_score = clamped_rpe * duration * zoneMultiplier;

        const calculationString = zoneMultiplier === 1
            ? `${clamped_rpe} × ${duration}`
            : `${clamped_rpe} × ${duration} × ${zoneMultiplier}`;

        return {
            valid: true,
            load_score: Number(load_score.toFixed(2)),
            breakdown: {
                rpe: clamped_rpe,
                duration_minutes: duration,
                zone: zone || 'N/A',
                zone_multiplier: zoneMultiplier,
                calculation: calculationString
            },
            details: {
                rpe_scale: '1-10 (Borg CR10)',
                intensity_category: this.getRPECategory(clamped_rpe),
                effective_load: Number(load_score.toFixed(2))
            }
        };
    }

    /**
     * Calculate MET-based load using activity and intensity
     * @param {Object} session - Session with modality and intensity
     * @returns {Object} MET load result
     */
    static calculateMETLoad(session) {
        const { modality, intensity, duration_minutes } = session;

        if (!modality || !intensity || !duration_minutes) {
            return { valid: false };
        }

        // MET values by modality and intensity
        const met_values = {
            running: { Z1: 8, Z2: 10, Z3: 12, Z4: 15, Z5: 18 },
            cycling: { Z1: 6, Z2: 8, Z3: 10, Z4: 13, Z5: 16 },
            swimming: { Z1: 10, Z2: 12, Z3: 14, Z4: 17, Z5: 20 }
        };

        const modality_mets = met_values[modality];
        if (!modality_mets) {
            return { valid: false };
        }

        const met_value = modality_mets[intensity];
        if (!met_value) {
            return { valid: false };
        }

        const durationValue = Number(duration_minutes);
        if (!Number.isFinite(durationValue) || durationValue <= 0) {
            return { valid: false };
        }

        const met_minutes = met_value * durationValue;
        // Convert MET-minutes to comparable load scale (rough approximation)
        const load_score = met_minutes * 0.8;

        return {
            valid: true,
            load_score: Number(load_score.toFixed(2)),
            breakdown: {
                modality,
                intensity,
                duration_minutes: durationValue,
                met_value,
                met_minutes: Number(met_minutes.toFixed(2))
            },
            details: {
                conversion_factor: 0.8,
                met_category: this.getMETCategory(met_value)
            }
        };
    }

    /**
     * Estimate maximum heart rate based on age and gender
     * @param {number} age - User age
     * @param {string} gender - User gender
     * @returns {number} Estimated max HR
     */
    static estimateMaxHR(age = 35, gender = 'male') {
        if (gender === 'female') {
            return Math.round(206 - (0.88 * age));
        } else {
            return Math.round(220 - age);
        }
    }

    /**
     * Get RPE intensity category
     * @param {number} rpe - RPE value
     * @returns {string} Intensity category
     */
    static getRPECategory(rpe) {
        if (rpe <= 2) {return 'Very Easy';}
        if (rpe <= 4) {return 'Easy';}
        if (rpe <= 6) {return 'Moderate';}
        if (rpe <= 8) {return 'Hard';}
        return 'Very Hard';
    }

    /**
     * Get MET intensity category
     * @param {number} met_value - MET value
     * @returns {string} Intensity category
     */
    static getMETCategory(met_value) {
        if (met_value < 6) {return 'Light Intensity';}
        if (met_value < 12) {return 'Moderate Intensity';}
        return 'Vigorous Intensity';
    }

    /**
     * Normalize a zone identifier to canonical Z1-Z5 format
     * @param {string} zone - Zone identifier
     * @returns {string|null} Normalized zone or null if not recognized
     */
    static normalizeZone(zone) {
        if (!zone) {return null;}
        const match = String(zone).toUpperCase().match(/Z[1-5]/);
        return match ? match[0] : null;
    }

    /**
     * Validate session object structure
     * @param {Object} session - Session to validate
     * @returns {Object} Validation result
     */
    static validateSession(session) {
        const errors = [];
        const warnings = [];

        if (!session) {
            errors.push('Session object is required');
            return { valid: false, errors, warnings };
        }

        // Check for basic required fields
        if (!session.duration_minutes || session.duration_minutes <= 0) {
            errors.push('Valid duration_minutes is required');
        }

        // Validate HR data if present
        if (session.hr_data) {
            if (session.hr_data.avg_hr && (session.hr_data.avg_hr < 30 || session.hr_data.avg_hr > 220)) {
                warnings.push('Average HR seems unrealistic');
            }
        }

        // Validate RPE if present
        if (session.rpe && (session.rpe < 1 || session.rpe > 10)) {
            warnings.push('RPE should be between 1-10');
        }

        // Validate zone distribution if present
        if (session.zone_distribution) {
            const total_zone_minutes = Object.values(session.zone_distribution).reduce((sum, min) => sum + min, 0);
            if (Math.abs(total_zone_minutes - session.duration_minutes) > 5) {
                warnings.push('Zone distribution minutes don\'t match total duration');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
}

export default LoadCalculationEngine;

