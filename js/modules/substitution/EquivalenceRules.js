/**
 * Equivalence Rules Configuration
 * Isolated configuration for cross-modality substitution mathematics
 * Easy to tune and update without touching core logic
 */

export const EquivalenceRules = {
    // Base time conversion factors between modalities
    TIME_FACTORS: {
        'running_to_cycling': 1.30,    // 1 min run = 1.3 min bike
        'running_to_swimming': 0.80,   // 1 min run = 0.8 min swim
        'cycling_to_running': 0.77,    // 1 min bike = 0.77 min run
        'cycling_to_swimming': 0.62,   // 1 min bike = 0.62 min swim
        'swimming_to_running': 1.25,   // 1 min swim = 1.25 min run
        'swimming_to_cycling': 1.61    // 1 min swim = 1.61 min bike
    },

    // Zone-specific adjustments to base factors
    ZONE_ADJUSTMENTS: {
        'running_to_cycling': {
            Z1: 0.05,   // Easy sessions: 30% + 5% = 35% longer
            Z2: 0.03,   // Aerobic: 30% + 3% = 33% longer
            Z3: 0.00,   // Tempo: exactly 30% longer
            Z4: -0.05,  // VO2: 30% - 5% = 25% longer
            Z5: -0.10   // Power: 30% - 10% = 20% longer
        },
        'running_to_swimming': {
            Z1: -0.05,  // Easy: 20% - 5% = 15% shorter
            Z2: 0.00,   // Aerobic: exactly 20% shorter
            Z3: 0.00,   // Tempo: exactly 20% shorter
            Z4: 0.05,   // VO2: 20% - 5% = 15% shorter
            Z5: 0.10    // Power: 20% - 10% = 10% shorter
        },
        'cycling_to_running': {
            Z1: -0.05,  // Reverse of running_to_cycling
            Z2: -0.03,
            Z3: 0.00,
            Z4: 0.05,
            Z5: 0.10
        },
        'cycling_to_swimming': {
            Z1: -0.10,
            Z2: -0.05,
            Z3: 0.00,
            Z4: 0.05,
            Z5: 0.15
        },
        'swimming_to_running': {
            Z1: 0.05,   // Reverse of running_to_swimming
            Z2: 0.00,
            Z3: 0.00,
            Z4: -0.05,
            Z5: -0.10
        },
        'swimming_to_cycling': {
            Z1: 0.10,   // Reverse of cycling_to_swimming
            Z2: 0.05,
            Z3: 0.00,
            Z4: -0.05,
            Z5: -0.15
        }
    },

    // Load equivalence factors (for double-checking)
    LOAD_FACTORS: {
        'running_to_cycling': 0.85,    // Cycling load 85% of running
        'running_to_swimming': 1.20,   // Swimming load 120% of running
        'cycling_to_running': 1.18,    // Running load 118% of cycling
        'cycling_to_swimming': 1.41,   // Swimming load 141% of cycling
        'swimming_to_running': 0.83,   // Running load 83% of swimming
        'swimming_to_cycling': 0.71    // Cycling load 71% of swimming
    },

    // Adaptation compatibility matrix
    ADAPTATION_COMPATIBILITY: {
        'aerobic_base': ['aerobic_base', 'endurance', 'recovery'],
        'endurance': ['aerobic_base', 'endurance', 'aerobic_capacity'],
        'lactate_threshold': ['lactate_threshold', 'tempo', 'threshold'],
        'tempo': ['lactate_threshold', 'tempo', 'threshold'],
        'threshold': ['lactate_threshold', 'tempo', 'threshold'],
        'vo2_max': ['vo2_max', 'vo2', 'aerobic_power', 'speed_endurance'],
        'vo2': ['vo2_max', 'vo2', 'aerobic_power'],
        'aerobic_power': ['vo2_max', 'vo2', 'aerobic_power'],
        'speed_endurance': ['vo2_max', 'speed_endurance', 'lactate_tolerance'],
        'neuromuscular_power': ['neuromuscular_power', 'power', 'speed'],
        'power': ['neuromuscular_power', 'power', 'anaerobic_capacity'],
        'speed': ['neuromuscular_power', 'speed', 'power'],
        'agility': ['agility', 'neuromuscular_power', 'coordination'],
        'strength_endurance': ['strength_endurance', 'muscular_endurance'],
        'recovery': ['recovery', 'aerobic_base', 'active_recovery']
    },

    // Minimum and maximum duration limits by zone
    DURATION_LIMITS: {
        Z1: { min: 15, max: 300 },  // 15min to 5 hours
        Z2: { min: 15, max: 180 },  // 15min to 3 hours
        Z3: { min: 8, max: 90 },    // 8min to 1.5 hours
        Z4: { min: 3, max: 60 },    // 3min to 1 hour
        Z5: { min: 0.5, max: 20 }   // 30sec to 20min
    },

    // Confidence scoring factors
    CONFIDENCE_FACTORS: {
        base_confidence: 0.85,
        same_adaptation: 0.10,      // +10% if adaptations match exactly
        compatible_adaptation: 0.05, // +5% if adaptations are compatible
        common_conversion: 0.05,     // +5% for run<->bike conversions
        zone_penalty: {             // Confidence reduction by zone
            Z1: 0.00,
            Z2: 0.00,
            Z3: 0.00,
            Z4: -0.05,  // -5% for VO2 intervals
            Z5: -0.10   // -10% for power intervals
        },
        duration_penalty: {
            very_short: -0.10,  // <10min sessions
            very_long: -0.05    // >120min sessions
        }
    },

    // Load tolerance for substitutions
    LOAD_TOLERANCE: {
        target: 0.10,        // ±10% is ideal
        acceptable: 0.15,    // ±15% is acceptable
        maximum: 0.25        // ±25% is maximum allowed
    },

    /**
     * Get time conversion factor for modality pair and zone
     * @param {string} fromModality - Source modality
     * @param {string} toModality - Target modality
     * @param {string} zone - Training zone (Z1-Z5)
     * @returns {number} Time conversion factor
     */
    getTimeFactor(fromModality, toModality, zone) {
        if (fromModality === toModality) return 1.0;

        const conversionKey = `${fromModality}_to_${toModality}`;
        const baseFactor = this.TIME_FACTORS[conversionKey];

        if (!baseFactor) {
            throw new Error(`No conversion factor for ${conversionKey}`);
        }

        const zoneAdjustment = this.ZONE_ADJUSTMENTS[conversionKey]?.[zone] || 0;
        return baseFactor + zoneAdjustment;
    },

    /**
     * Get load conversion factor for modality pair
     * @param {string} fromModality - Source modality
     * @param {string} toModality - Target modality
     * @returns {number} Load conversion factor
     */
    getLoadFactor(fromModality, toModality) {
        if (fromModality === toModality) return 1.0;

        const conversionKey = `${fromModality}_to_${toModality}`;
        return this.LOAD_FACTORS[conversionKey] || 1.0;
    },

    /**
     * Check if adaptations are compatible
     * @param {string} sourceAdaptation - Source adaptation
     * @param {string} targetAdaptation - Target adaptation
     * @returns {Object} Compatibility result
     */
    checkAdaptationCompatibility(sourceAdaptation, targetAdaptation) {
        const normalizedSource = sourceAdaptation.toLowerCase().replace(/[^a-z_]/g, '');
        const normalizedTarget = targetAdaptation.toLowerCase().replace(/[^a-z_]/g, '');

        if (normalizedSource === normalizedTarget) {
            return { compatible: true, match: 'exact', confidence_bonus: 0.10 };
        }

        const compatibleAdaptations = this.ADAPTATION_COMPATIBILITY[normalizedSource] || [];
        const isCompatible = compatibleAdaptations.some(adaptation =>
            normalizedTarget.includes(adaptation) || adaptation.includes(normalizedTarget)
        );

        return {
            compatible: isCompatible,
            match: isCompatible ? 'compatible' : 'incompatible',
            confidence_bonus: isCompatible ? 0.05 : -0.15
        };
    },

    /**
     * Validate duration limits for zone
     * @param {string} zone - Training zone
     * @param {number} duration - Duration in minutes
     * @returns {Object} Validation result
     */
    validateDurationLimits(zone, duration) {
        const limits = this.DURATION_LIMITS[zone];
        if (!limits) {
            return { valid: true, warning: 'Unknown zone' };
        }

        if (duration < limits.min) {
            return {
                valid: false,
                reason: `Duration ${duration}min below minimum ${limits.min}min for ${zone}`
            };
        }

        if (duration > limits.max) {
            return {
                valid: false,
                reason: `Duration ${duration}min exceeds maximum ${limits.max}min for ${zone}`
            };
        }

        return { valid: true };
    },

    /**
     * Calculate confidence score for substitution
     * @param {Object} params - Substitution parameters
     * @returns {number} Confidence score (0-1)
     */
    calculateConfidence(params) {
        const {
            sourceAdaptation,
            targetAdaptation,
            sourceModality,
            targetModality,
            zone,
            duration,
            loadVariance
        } = params;

        let confidence = this.CONFIDENCE_FACTORS.base_confidence;

        // Adaptation compatibility
        const adaptationCheck = this.checkAdaptationCompatibility(sourceAdaptation, targetAdaptation);
        confidence += adaptationCheck.confidence_bonus;

        // Common conversion bonus
        if ((sourceModality === 'running' && targetModality === 'cycling') ||
            (sourceModality === 'cycling' && targetModality === 'running')) {
            confidence += this.CONFIDENCE_FACTORS.common_conversion;
        }

        // Zone penalty
        const zonePenalty = this.CONFIDENCE_FACTORS.zone_penalty[zone] || 0;
        confidence += zonePenalty;

        // Duration penalties
        if (duration < 10) {
            confidence += this.CONFIDENCE_FACTORS.duration_penalty.very_short;
        } else if (duration > 120) {
            confidence += this.CONFIDENCE_FACTORS.duration_penalty.very_long;
        }

        // Load variance penalty
        if (loadVariance > this.LOAD_TOLERANCE.acceptable) {
            confidence -= 0.10;
        }

        return Math.max(0, Math.min(1, confidence));
    }
};

export default EquivalenceRules;

