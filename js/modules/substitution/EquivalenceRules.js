/**
 * Equivalence Rules Configuration
 * Isolated configuration for cross-modality substitution mathematics
 * Easy to tune and update without touching core logic
 */

export const EquivalenceRules = {
    timeMultiplier(fromModality, toModality, zone) {
        if (fromModality === 'running' && toModality === 'cycling') {
            const zoneScale = {
                Z1: 1.35,
                Z2: 1.33,
                Z3: 1.30,
                Z4: 1.25,
                Z5: 1.20
            };
            return zoneScale[zone] || 1.30;
        }
        if (fromModality === 'running' && toModality === 'swimming') {
            return 0.75;
        }
        if (fromModality === 'cycling' && toModality === 'running') {
            const inverse = {
                Z1: 1 / 1.35,
                Z2: 1 / 1.33,
                Z3: 1 / 1.30,
                Z4: 1 / 1.25,
                Z5: 1 / 1.20
            };
            return inverse[zone] || (1 / 1.30);
        }
        if (fromModality === 'swimming' && toModality === 'running') {
            return 1 / 0.75;
        }
        if (fromModality === 'cycling' && toModality === 'swimming') {
            return 0.75 * this.timeMultiplier(fromModality, 'running', zone);
        }
        if (fromModality === 'swimming' && toModality === 'cycling') {
            return this.timeMultiplier('running', 'cycling', zone) * (1 / 0.75);
        }
        return 1.0;
    },

    loadEquivalenceFactor(fromModality, toModality) {
        const key = `${fromModality}_to_${toModality}`;
        const factors = {
            'running_to_cycling': 0.85,
            'cycling_to_running': 1 / 0.85,
            'running_to_swimming': 1.10,
            'swimming_to_running': 1 / 1.10,
            'cycling_to_swimming': 0.85 * 1.10,
            'swimming_to_cycling': 1 / (0.85 * 1.10)
        };
        return factors[key] || 1.0;
    },

    // Load equivalence factors (for reference)
    LOAD_FACTORS: {
        'running_to_cycling': 0.85,
        'cycling_to_running': 1 / 0.85,
        'running_to_swimming': 1.10,
        'swimming_to_running': 1 / 1.10,
        'cycling_to_swimming': 0.85 * 1.10,
        'swimming_to_cycling': 1 / (0.85 * 1.10)
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
        Z1: { min: 15, max: 300 }, // 15min to 5 hours
        Z2: { min: 15, max: 180 }, // 15min to 3 hours
        Z3: { min: 8, max: 90 }, // 8min to 1.5 hours
        Z4: { min: 3, max: 60 }, // 3min to 1 hour
        Z5: { min: 0.5, max: 20 } // 30sec to 20min
    },

    // Confidence scoring factors
    CONFIDENCE_FACTORS: {
        base_confidence: 0.85,
        same_adaptation: 0.10, // +10% if adaptations match exactly
        compatible_adaptation: 0.05, // +5% if adaptations are compatible
        common_conversion: 0.05, // +5% for run<->bike conversions
        zone_penalty: { // Confidence reduction by zone
            Z1: 0.00,
            Z2: 0.00,
            Z3: 0.00,
            Z4: -0.05, // -5% for VO2 intervals
            Z5: -0.10 // -10% for power intervals
        },
        duration_penalty: {
            very_short: -0.10, // <10min sessions
            very_long: -0.05 // >120min sessions
        }
    },

    // Load tolerance for substitutions
    LOAD_TOLERANCE: {
        target: 0.10, // ±10% is ideal
        acceptable: 0.15, // ±15% is acceptable
        maximum: 0.25 // ±25% is maximum allowed
    },

    /**
     * Get time conversion factor for modality pair and zone
     * @param {string} fromModality - Source modality
     * @param {string} toModality - Target modality
     * @param {string} zone - Training zone (Z1-Z5)
     * @returns {number} Time conversion factor
     */
    getTimeFactor(fromModality, toModality, zone) {
        return this.timeMultiplier(fromModality, toModality, zone);
    },

    /**
     * Get load conversion factor for modality pair
     * @param {string} fromModality - Source modality
     * @param {string} toModality - Target modality
     * @returns {number} Load conversion factor
     */
    getLoadFactor(fromModality, toModality) {
        return this.loadEquivalenceFactor(fromModality, toModality);
    },

    /**
     * Check if adaptations are compatible
     * @param {string} sourceAdaptation - Source adaptation
     * @param {string} targetAdaptation - Target adaptation
     * @returns {Object} Compatibility result
     */
    checkAdaptationCompatibility(sourceAdaptation, targetAdaptation) {
        const normalizedSource = (sourceAdaptation || 'general').toLowerCase().replace(/[^a-z_]/g, '');
        const normalizedTarget = (targetAdaptation || 'general').toLowerCase().replace(/[^a-z_]/g, '');

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
            loadVariance,
            userProfile = {}
        } = params;

        const adaptationCheck = this.checkAdaptationCompatibility(
            sourceAdaptation || 'general',
            targetAdaptation || 'general'
        );
        const adaptationFactor = adaptationCheck.match === 'exact'
            ? 1.0
            : adaptationCheck.match === 'compatible'
                ? 0.85
                : 0.65;

        const loadAccuracy = Math.max(0.4, 1 - Math.min(loadVariance, 0.6));

        const experienceLevel = (userProfile.training_level || '').toLowerCase();
        const experienceFactor = {
            beginner: 0.80,
            novice: 0.80,
            intermediate: 0.90,
            advanced: 1.0,
            elite: 1.05
        }[experienceLevel] || 0.90;

        let confidence = adaptationFactor * loadAccuracy * experienceFactor;

        if ((sourceModality === 'running' && targetModality === 'cycling') ||
            (sourceModality === 'cycling' && targetModality === 'running')) {
            confidence *= 1.05;
        }

        const zonePenalty = this.CONFIDENCE_FACTORS.zone_penalty[zone] || 0;
        confidence *= (1 + zonePenalty);

        if (duration < 10) {
            confidence *= (1 + this.CONFIDENCE_FACTORS.duration_penalty.very_short);
        } else if (duration > 120) {
            confidence *= (1 + this.CONFIDENCE_FACTORS.duration_penalty.very_long);
        }

        if (loadVariance > this.LOAD_TOLERANCE.acceptable) {
            confidence *= 0.9;
        }

        return Math.max(0, Math.min(1, Number(confidence.toFixed(3))));
    }
};

export default EquivalenceRules;

