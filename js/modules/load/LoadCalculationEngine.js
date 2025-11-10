/**
 * Pure Load Calculation Engine
 * Supports RPE*min, TRIMP (with HR), and MET-min calculations
 * Deterministic behavior for consistent substitution mathematics
 */

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

        if (!hr_data.avg_hr || !duration_minutes) {
            return { valid: false };
        }

        // Get user HR parameters or use defaults
        const max_hr = user_profile?.max_hr || this.estimateMaxHR(user_profile?.age, user_profile?.gender);
        const rest_hr = user_profile?.rest_hr || 60;
        const gender_factor = user_profile?.gender === 'female' ? 1.67 : 1.92;

        // Calculate Heart Rate Reserve (HRR)
        const hr_reserve = max_hr - rest_hr;
        const avg_hrr = (hr_data.avg_hr - rest_hr) / hr_reserve;

        // Clamp HRR to reasonable bounds
        const clamped_hrr = Math.max(0, Math.min(1.2, avg_hrr));

        // Banister TRIMP formula
        const trimp_score = duration_minutes * 0.64 * Math.exp(gender_factor * clamped_hrr);

        return {
            valid: true,
            trimp_score: Math.round(trimp_score * 10) / 10,
            breakdown: {
                duration_minutes,
                avg_hr: hr_data.avg_hr,
                hrr_fraction: Math.round(clamped_hrr * 1000) / 1000,
                gender_factor
            },
            details: {
                max_hr,
                rest_hr,
                hr_reserve,
                exponential_factor: Math.round(Math.exp(gender_factor * clamped_hrr) * 100) / 100
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

        // Zone intensity multipliers (relative effort)
        const zone_multipliers = {
            Z1: 1.0, // Recovery/easy
            Z2: 2.0, // Aerobic base
            Z3: 4.0, // Tempo/threshold
            Z4: 7.0, // VO2 max
            Z5: 10.0 // Neuromuscular power
        };

        let total_load = 0;
        const breakdown = {};

        // Calculate load for each zone
        Object.entries(zone_distribution).forEach(([zone, minutes]) => {
            if (minutes > 0 && zone_multipliers[zone]) {
                const zone_load = minutes * zone_multipliers[zone];
                total_load += zone_load;
                breakdown[zone] = {
                    minutes: Math.round(minutes * 10) / 10,
                    multiplier: zone_multipliers[zone],
                    load_contribution: Math.round(zone_load * 10) / 10
                };
            }
        });

        return {
            valid: true,
            load_score: Math.round(total_load * 10) / 10,
            breakdown,
            details: {
                total_minutes: duration_minutes,
                zones_used: Object.keys(breakdown),
                avg_intensity: total_load / duration_minutes
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

        if (!rpe || !duration_minutes) {
            return { valid: false };
        }

        // Clamp RPE to valid range
        const clamped_rpe = Math.max(1, Math.min(10, rpe));
        const load_score = clamped_rpe * duration_minutes;

        return {
            valid: true,
            load_score: Math.round(load_score * 10) / 10,
            breakdown: {
                rpe: clamped_rpe,
                duration_minutes,
                calculation: `${clamped_rpe} × ${duration_minutes}`
            },
            details: {
                rpe_scale: '1-10 (Borg CR10)',
                intensity_category: this.getRPECategory(clamped_rpe)
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

        const met_minutes = met_value * duration_minutes;
        // Convert MET-minutes to comparable load scale (rough approximation)
        const load_score = met_minutes * 0.8;

        return {
            valid: true,
            load_score: Math.round(load_score * 10) / 10,
            breakdown: {
                modality,
                intensity,
                duration_minutes,
                met_value,
                met_minutes
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

