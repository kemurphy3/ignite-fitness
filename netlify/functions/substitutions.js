/**
 * Substitution API Endpoint
 * POST /substitutions - Generate workout substitutions
 */

const { neon } = require('@neondatabase/serverless');

// Mock helpers if not available
const handleCORS = () => {
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: ''
    };
};

const createResponse = (statusCode, data) => {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(data)
    };
};

const withErrorHandling = (handler) => {
    return async (event, context) => {
        try {
            return await handler(event, context);
        } catch (error) {
            console.error('Unhandled error:', error);
            return createResponse(500, {
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Request failed'
            });
        }
    };
};

/**
 * Mock Workout Catalog for API
 * In production, this would connect to the actual database
 */
class MockWorkoutCatalog {
    async getWorkoutsByModality(modality) {
        const mockWorkouts = {
            cycling: [
                {
                    template_id: 'cycle_endurance_60min_z2',
                    name: '60min Z2 Endurance',
                    modality: 'cycling',
                    category: 'endurance',
                    adaptation: 'aerobic_base',
                    estimated_load: 60,
                    time_required: 60,
                    difficulty_level: 'beginner',
                    equipment_required: ['bike'],
                    structure: [
                        { block_type: 'warmup', duration: 10, intensity: 'Z1' },
                        { block_type: 'main', duration: 40, intensity: 'Z2' },
                        { block_type: 'cooldown', duration: 10, intensity: 'Z1' }
                    ]
                },
                {
                    template_id: 'cycle_tempo_3x8min',
                    name: '3x8min Tempo Intervals',
                    modality: 'cycling',
                    category: 'tempo',
                    adaptation: 'lactate_threshold',
                    estimated_load: 75,
                    time_required: 60,
                    difficulty_level: 'intermediate',
                    equipment_required: ['bike'],
                    structure: [
                        { block_type: 'warmup', duration: 15, intensity: 'Z1' },
                        { block_type: 'main', sets: 3, work_duration: 480, rest_duration: 180, intensity: 'Z3' },
                        { block_type: 'cooldown', duration: 15, intensity: 'Z1' }
                    ]
                }
            ],
            swimming: [
                {
                    template_id: 'swim_aerobic_3000m',
                    name: '3000m Aerobic Swim',
                    modality: 'swimming',
                    category: 'aerobic',
                    adaptation: 'aerobic_base',
                    estimated_load: 65,
                    time_required: 75,
                    difficulty_level: 'intermediate',
                    equipment_required: ['pool'],
                    structure: [
                        { block_type: 'warmup', duration: 15, intensity: 'Z1' },
                        { block_type: 'main', duration: 45, intensity: 'Z2' },
                        { block_type: 'cooldown', duration: 15, intensity: 'Z1' }
                    ]
                }
            ],
            running: [
                {
                    template_id: 'run_tempo_20min',
                    name: '20min Tempo Run',
                    modality: 'running',
                    category: 'tempo',
                    adaptation: 'lactate_threshold',
                    estimated_load: 75,
                    time_required: 45,
                    difficulty_level: 'intermediate',
                    equipment_required: ['road'],
                    structure: [
                        { block_type: 'warmup', duration: 15, intensity: 'Z1' },
                        { block_type: 'main', duration: 20, intensity: 'Z3' },
                        { block_type: 'cooldown', duration: 10, intensity: 'Z1' }
                    ]
                }
            ]
        };

        return mockWorkouts[modality] || [];
    }
}

// Load calculation engine (simplified for serverless)
const LoadCalculationEngine = {
    compute_load(session) {
        if (!session || !session.duration_minutes) {
            throw new Error('Invalid session data');
        }

        // Simple RPE-based calculation as fallback
        if (session.rpe && session.duration_minutes) {
            const clamped_rpe = Math.max(1, Math.min(10, session.rpe));
            return {
                total_load: clamped_rpe * session.duration_minutes,
                method_used: 'RPE_Duration',
                confidence: 0.75
            };
        }

        // Zone-based calculation
        if (session.zone_distribution && session.duration_minutes) {
            const zone_multipliers = { Z1: 1.0, Z2: 2.0, Z3: 4.0, Z4: 7.0, Z5: 10.0 };
            let total_load = 0;

            Object.entries(session.zone_distribution).forEach(([zone, minutes]) => {
                if (minutes > 0 && zone_multipliers[zone]) {
                    total_load += minutes * zone_multipliers[zone];
                }
            });

            return {
                total_load: Math.round(total_load * 10) / 10,
                method_used: 'Zone_RPE',
                confidence: 0.85
            };
        }

        // MET-based fallback
        if (session.modality && session.intensity && session.duration_minutes) {
            const met_values = {
                running: { Z1: 8, Z2: 10, Z3: 12, Z4: 15, Z5: 18 },
                cycling: { Z1: 6, Z2: 8, Z3: 10, Z4: 13, Z5: 16 },
                swimming: { Z1: 10, Z2: 12, Z3: 14, Z4: 17, Z5: 20 }
            };

            const met_value = met_values[session.modality]?.[session.intensity] || 10;
            const load_score = met_value * session.duration_minutes * 0.8;

            return {
                total_load: Math.round(load_score * 10) / 10,
                method_used: 'MET_Minutes',
                confidence: 0.65
            };
        }

        throw new Error('Insufficient data for load calculation');
    }
};

// Equivalence rules (simplified for serverless)
const EquivalenceRules = {
    getTimeFactor(fromModality, toModality, zone) {
        if (fromModality === toModality) return 1.0;

        const baseFactors = {
            'running_to_cycling': 1.30,
            'running_to_swimming': 0.80,
            'cycling_to_running': 0.77,
            'cycling_to_swimming': 0.62,
            'swimming_to_running': 1.25,
            'swimming_to_cycling': 1.61
        };

        const zoneAdjustments = {
            'running_to_cycling': { Z1: 0.05, Z2: 0.03, Z3: 0.00, Z4: -0.05, Z5: -0.10 },
            'running_to_swimming': { Z1: -0.05, Z2: 0.00, Z3: 0.00, Z4: 0.05, Z5: 0.10 },
            'cycling_to_running': { Z1: -0.05, Z2: -0.03, Z3: 0.00, Z4: 0.05, Z5: 0.10 },
            'cycling_to_swimming': { Z1: -0.10, Z2: -0.05, Z3: 0.00, Z4: 0.05, Z5: 0.15 },
            'swimming_to_running': { Z1: 0.05, Z2: 0.00, Z3: 0.00, Z4: -0.05, Z5: -0.10 },
            'swimming_to_cycling': { Z1: 0.10, Z2: 0.05, Z3: 0.00, Z4: -0.05, Z5: -0.15 }
        };

        const conversionKey = `${fromModality}_to_${toModality}`;
        const baseFactor = baseFactors[conversionKey];
        if (!baseFactor) return 1.0;

        const adjustment = zoneAdjustments[conversionKey]?.[zone] || 0;
        return baseFactor + adjustment;
    },

    checkAdaptationCompatibility(sourceAdaptation, targetAdaptation) {
        const normalizedSource = sourceAdaptation.toLowerCase().replace(/[^a-z_]/g, '');
        const normalizedTarget = targetAdaptation.toLowerCase().replace(/[^a-z_]/g, '');

        if (normalizedSource === normalizedTarget) {
            return { compatible: true, match: 'exact', confidence_bonus: 0.10 };
        }

        const compatibility = {
            'aerobic_base': ['aerobic_base', 'endurance', 'recovery'],
            'endurance': ['aerobic_base', 'endurance', 'aerobic_capacity'],
            'lactate_threshold': ['lactate_threshold', 'tempo', 'threshold'],
            'tempo': ['lactate_threshold', 'tempo', 'threshold'],
            'vo2_max': ['vo2_max', 'vo2', 'aerobic_power', 'speed_endurance'],
            'vo2': ['vo2_max', 'vo2', 'aerobic_power']
        };

        const compatible = compatibility[normalizedSource] || [];
        const isCompatible = compatible.some(adaptation =>
            normalizedTarget.includes(adaptation) || adaptation.includes(normalizedTarget)
        );

        return {
            compatible: isCompatible,
            match: isCompatible ? 'compatible' : 'incompatible',
            confidence_bonus: isCompatible ? 0.05 : -0.15
        };
    },

    calculateConfidence(params) {
        const { sourceAdaptation, targetAdaptation, zone, duration, loadVariance } = params;
        let confidence = 0.85;

        const adaptationCheck = this.checkAdaptationCompatibility(sourceAdaptation, targetAdaptation);
        confidence += adaptationCheck.confidence_bonus;

        const zonePenalty = { Z1: 0, Z2: 0, Z3: 0, Z4: -0.05, Z5: -0.10 };
        confidence += zonePenalty[zone] || 0;

        if (duration < 10) confidence -= 0.10;
        if (duration > 120) confidence -= 0.05;
        if (loadVariance > 0.15) confidence -= 0.10;

        return Math.max(0, Math.min(1, confidence));
    }
};

// Simplified SubstitutionEngine for serverless
class SubstitutionEngine {
    constructor(workoutCatalog, guardrailManager) {
        this.workoutCatalog = workoutCatalog;
        this.guardrailManager = guardrailManager;
    }

    async suggest_substitutions(planned_session, target_modality, user_context) {
        const sessionAnalysis = this.parsePlannedSession(planned_session);
        const targetLoad = LoadCalculationEngine.compute_load(sessionAnalysis);

        const candidates = await this.findCandidateTemplates(target_modality, sessionAnalysis.adaptation, user_context);
        if (candidates.length === 0) {
            throw new Error(`No suitable ${target_modality} workouts found`);
        }

        const scaledCandidates = candidates.map(candidate =>
            this.scaleWorkoutForEquivalence(candidate, sessionAnalysis, targetLoad.total_load, planned_session.modality, target_modality)
        );

        const validCandidates = scaledCandidates.filter(c => {
            const durationCheck = EquivalenceRules.validateDurationLimits(sessionAnalysis.primary_zone, c.scaled_duration);
            return durationCheck.valid;
        });

        if (validCandidates.length === 0) {
            throw new Error('No substitutions pass validation');
        }

        const rankedOptions = this.rankSubstitutionOptions(validCandidates, targetLoad.total_load);
        return rankedOptions.slice(0, 3).map(option => ({
            ...option,
            reasoning: this.generateReasoning(planned_session, option, targetLoad.total_load)
        }));
    }

    parsePlannedSession(planned_session) {
        const analysis = {
            modality: planned_session.modality,
            duration_minutes: planned_session.duration_minutes || 0,
            adaptation: planned_session.adaptation || 'general',
            zone_distribution: {},
            primary_zone: 'Z2'
        };

        if (planned_session.structure) {
            const zoneMinutes = {};
            planned_session.structure.forEach(block => {
                if (block.block_type === 'main' && block.intensity) {
                    const blockMinutes = block.sets ? (block.work_duration * block.sets) / 60 : block.duration || 0;
                    zoneMinutes[block.intensity] = (zoneMinutes[block.intensity] || 0) + blockMinutes;
                }
            });
            analysis.zone_distribution = zoneMinutes;
            if (Object.keys(zoneMinutes).length > 0) {
                analysis.primary_zone = Object.entries(zoneMinutes).reduce((a, b) => zoneMinutes[a[0]] > zoneMinutes[b[0]] ? a : b)[0];
            }
        } else if (planned_session.intensity) {
            analysis.primary_zone = planned_session.intensity;
            analysis.zone_distribution[planned_session.intensity] = analysis.duration_minutes;
        }

        return analysis;
    }

    async findCandidateTemplates(target_modality, adaptation, user_context) {
        const modalityWorkouts = await this.workoutCatalog.getWorkoutsByModality(target_modality);
        if (!modalityWorkouts || modalityWorkouts.length === 0) return [];

        const candidates = [];
        for (const workout of modalityWorkouts) {
            const adaptationCheck = EquivalenceRules.checkAdaptationCompatibility(adaptation, workout.adaptation);
            if (adaptationCheck.compatible) {
                const userEquipment = user_context.equipment || [];
                const maxTime = user_context.available_time || 180;

                if ((!workout.equipment_required || workout.equipment_required.every(eq => userEquipment.includes(eq))) &&
                    workout.time_required <= maxTime) {
                    candidates.push({ ...workout, adaptation_match: adaptationCheck.match });
                }
            }
        }

        return candidates;
    }

    scaleWorkoutForEquivalence(candidate, sessionAnalysis, targetLoad, sourceModality, targetModality) {
        const primaryZone = sessionAnalysis.primary_zone;
        const timeFactor = EquivalenceRules.getTimeFactor(sourceModality, targetModality, primaryZone);
        const scaledDuration = Math.round(candidate.time_required * timeFactor);

        const scaledStructure = candidate.structure.map(block => {
            if (block.block_type === 'main') {
                if (block.sets) {
                    return { ...block, work_duration: Math.round(block.work_duration * timeFactor) };
                } else {
                    return { ...block, duration: Math.round(block.duration * timeFactor) };
                }
            }
            return block;
        });

        const scaledSession = {
            modality: targetModality,
            duration_minutes: scaledDuration,
            structure: scaledStructure,
            adaptation: candidate.adaptation
        };

        const scaledLoad = LoadCalculationEngine.compute_load(scaledSession);
        const loadVariance = Math.abs(scaledLoad.total_load - targetLoad) / targetLoad;

        const confidence = EquivalenceRules.calculateConfidence({
            sourceAdaptation: sessionAnalysis.adaptation,
            targetAdaptation: candidate.adaptation,
            sourceModality,
            targetModality,
            zone: primaryZone,
            duration: scaledDuration,
            loadVariance
        });

        return {
            ...candidate,
            scaled_duration: scaledDuration,
            scaled_structure: scaledStructure,
            scaling_factor: timeFactor,
            calculated_load: scaledLoad.total_load,
            load_variance: loadVariance,
            load_variance_percentage: Math.round(loadVariance * 1000) / 10,
            confidence_score: Math.round(confidence * 100) / 100
        };
    }

    rankSubstitutionOptions(candidates, targetLoad) {
        return candidates
            .map(candidate => ({
                ...candidate,
                quality_score: this.calculateQualityScore(candidate, targetLoad)
            }))
            .sort((a, b) => b.quality_score - a.quality_score);
    }

    calculateQualityScore(candidate, targetLoad) {
        let score = 50;
        const loadAccuracy = 1 - Math.min(candidate.load_variance, 0.25);
        score += loadAccuracy * 40;
        score += candidate.confidence_score * 30;
        if (candidate.adaptation_match === 'exact') score += 20;
        else if (candidate.adaptation_match === 'compatible') score += 10;
        if (!candidate.equipment_required || candidate.equipment_required.length === 0) score += 5;
        if (candidate.scaled_duration >= 15 && candidate.scaled_duration <= 120) score += 5;
        return Math.round(score * 10) / 10;
    }

    generateReasoning(originalSession, substitution, targetLoad) {
        const reasons = [];
        const durationChange = substitution.scaled_duration - originalSession.duration_minutes;
        const durationPercent = Math.round((durationChange / originalSession.duration_minutes) * 100);

        if (Math.abs(durationPercent) >= 10) {
            const direction = durationPercent > 0 ? 'longer' : 'shorter';
            reasons.push(`${Math.abs(durationPercent)}% ${direction} duration for equivalent training stress`);
        } else {
            reasons.push('Similar duration to original workout');
        }

        const loadDiff = Math.abs(substitution.load_variance_percentage);
        if (loadDiff <= 5) {
            reasons.push(`Equivalent training load (${loadDiff}% difference)`);
        } else if (loadDiff <= 10) {
            reasons.push(`Very similar training load (${loadDiff}% difference)`);
        } else {
            reasons.push(`Comparable training load (${loadDiff}% difference)`);
        }

        if (substitution.adaptation_match === 'exact') {
            reasons.push('Same training adaptation');
        } else {
            reasons.push(`Compatible training focus (${substitution.adaptation})`);
        }

        if (substitution.equipment_required && substitution.equipment_required.length > 0) {
            reasons.push(`Requires: ${substitution.equipment_required.join(', ')}`);
        } else {
            reasons.push('Minimal equipment required');
        }

        if (substitution.confidence_score >= 0.9) {
            reasons.push('High confidence substitution');
        } else if (substitution.confidence_score >= 0.75) {
            reasons.push('Good substitution match');
        } else {
            reasons.push('Reasonable alternative option');
        }

        return reasons.join('. ') + '.';
    }
}

EquivalenceRules.validateDurationLimits = (zone, duration) => {
    const limits = {
        Z1: { min: 15, max: 300 },
        Z2: { min: 15, max: 180 },
        Z3: { min: 8, max: 90 },
        Z4: { min: 3, max: 60 },
        Z5: { min: 0.5, max: 20 }
    };

    const limit = limits[zone];
    if (!limit) return { valid: true };

    if (duration < limit.min) {
        return { valid: false, reason: `Duration ${duration}min below minimum ${limit.min}min for ${zone}` };
    }
    if (duration > limit.max) {
        return { valid: false, reason: `Duration ${duration}min exceeds maximum ${limit.max}min for ${zone}` };
    }

    return { valid: true };
};

exports.handler = withErrorHandling(async (event, context) => {
    if (event.httpMethod === 'OPTIONS') {
        return handleCORS();
    }

    if (event.httpMethod !== 'POST') {
        return createResponse(405, { error: 'Method not allowed' });
    }

    try {
        const requestBody = JSON.parse(event.body || '{}');
        const { planned_session, target_modality, user_context } = requestBody;

        if (!planned_session) {
            return createResponse(400, {
                error: 'planned_session is required',
                example: {
                    planned_session: {
                        modality: 'running',
                        duration_minutes: 50,
                        intensity: 'Z2',
                        adaptation: 'aerobic_base'
                    },
                    target_modality: 'cycling',
                    user_context: {
                        equipment: ['bike', 'indoor_trainer'],
                        available_time: 90
                    }
                }
            });
        }

        if (!target_modality) {
            return createResponse(400, {
                error: 'target_modality is required (running, cycling, or swimming)'
            });
        }

        const validModalities = ['running', 'cycling', 'swimming'];
        if (!validModalities.includes(target_modality)) {
            return createResponse(400, {
                error: `Invalid target_modality. Must be one of: ${validModalities.join(', ')}`
            });
        }

        const defaultUserContext = {
            equipment: [],
            available_time: 120,
            user_profile: {
                training_level: 'intermediate',
                age: 35,
                gender: 'male'
            },
            recent_sessions: [],
            readiness_data: {},
            ...user_context
        };

        const mockWorkoutCatalog = new MockWorkoutCatalog();
        const substitutionEngine = new SubstitutionEngine(mockWorkoutCatalog, null);

        const startTime = Date.now();
        const substitutions = await substitutionEngine.suggest_substitutions(
            planned_session,
            target_modality,
            defaultUserContext
        );
        const processingTime = Date.now() - startTime;

        let originalLoad = null;
        try {
            originalLoad = LoadCalculationEngine.compute_load(planned_session);
        } catch (error) {
            console.warn('Could not calculate original load:', error.message);
        }

        const response = {
            success: true,
            substitutions: substitutions.map(sub => ({
                id: sub.template_id,
                name: sub.name,
                modality: target_modality,
                category: sub.category,
                adaptation: sub.adaptation,
                duration_minutes: sub.scaled_duration,
                estimated_load: sub.calculated_load,
                load_variance_percent: sub.load_variance_percentage,
                confidence_score: sub.confidence_score,
                quality_score: sub.quality_score,
                equipment_required: sub.equipment_required || [],
                reasoning: sub.reasoning,
                structure: sub.scaled_structure,
                warnings: sub.warnings || []
            })),
            metadata: {
                original_session: {
                    modality: planned_session.modality,
                    duration_minutes: planned_session.duration_minutes,
                    adaptation: planned_session.adaptation,
                    estimated_load: originalLoad?.total_load
                },
                target_modality,
                processing_time_ms: processingTime,
                stats: {
                    count: substitutions.length,
                    avg_load_variance: substitutions.length > 0 ? Math.round((substitutions.reduce((sum, s) => sum + s.load_variance_percentage, 0) / substitutions.length) * 10) / 10 : 0,
                    avg_confidence: substitutions.length > 0 ? Math.round((substitutions.reduce((sum, s) => sum + s.confidence_score, 0) / substitutions.length) * 100) / 100 : 0
                }
            }
        };

        return createResponse(200, response);

    } catch (error) {
        console.error('Substitution API error:', error);

        if (error.message.includes('No suitable')) {
            return createResponse(404, {
                error: 'No suitable substitutions found',
                details: error.message
            });
        }

        if (error.message.includes('safety guardrails') || error.message.includes('pass validation')) {
            return createResponse(422, {
                error: 'No substitutions pass safety requirements',
                details: error.message
            });
        }

        return createResponse(500, {
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Substitution generation failed'
        });
    }
});

