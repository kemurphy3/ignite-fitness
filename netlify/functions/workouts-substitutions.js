const { getDB, authenticate, errorResponse, successResponse, preflightResponse } = require('./_base');
const { checkRateLimit } = require('./_base');

/**
 * Calculate soccer-shape specific load for a workout
 * @param {Object} workout - Workout template object
 * @returns {number} Calculated load score
 */
function calculateSoccerShapeLoad(workout) {
    const baseLoad = workout.time_required * 0.8; // Base RPE of 8 for soccer-shape
    
    // Get intensity multiplier from structure if available
    let intensityMultiplier = 1.0;
    if (workout.structure && Array.isArray(workout.structure)) {
        const mainBlock = workout.structure.find(b => b.block_type === 'main');
        if (mainBlock && mainBlock.intensity) {
            const zone = mainBlock.intensity.includes('Z') 
                ? mainBlock.intensity.split('-')[0] 
                : 'Z3';
            const zoneMultipliers = {
                'Z1': 1.0,
                'Z2': 2.0,
                'Z3': 4.0,
                'Z4': 7.0,
                'Z5': 10.0
            };
            intensityMultiplier = zoneMultipliers[zone] || 4.0;
        }
    }
    
    // Complexity factor (default 5, scaled to 0-1)
    const complexityFactor = 0.5; // Mid-range complexity
    
    // Calculate final load
    return Math.round(baseLoad * intensityMultiplier * (1 + complexityFactor));
}

/**
 * Find soccer-shape workout substitutions
 * @param {Object} sql - Database client
 * @param {Object} originalWorkout - Original workout template
 * @param {Object} constraints - User constraints
 * @returns {Array} Substitution workouts
 */
async function findSoccerShapeSubstitutions(sql, originalWorkout, constraints) {
    const { equipment, time_limit, injury_considerations } = constraints || {};

    let whereConditions = [
        `template_id != $1`,
        `is_active = true`,
        `(category = 'soccer_shape' OR modality IN ('running', 'cycling', 'swimming'))`,
        `tags && $2::jsonb` // Must share at least one tag
    ];
    let params = [originalWorkout.template_id, JSON.stringify(originalWorkout.tags || [])];

    if (equipment && equipment.length > 0) {
        whereConditions.push(`equipment_required && $${params.length + 1}::jsonb`);
        params.push(JSON.stringify(equipment));
    }

    if (time_limit) {
        whereConditions.push(`time_required <= $${params.length + 1}`);
        params.push(parseInt(time_limit));
    }

    // Build query for substitutions
    const query = `
        SELECT
            id,
            template_id,
            name,
            modality,
            category,
            adaptation,
            estimated_load,
            time_required,
            difficulty_level,
            equipment_required,
            description,
            structure,
            tags,
            created_at
        FROM workout_templates
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY
            -- Prioritize same category
            CASE WHEN category = $${params.length + 1} THEN 1 ELSE 2 END,
            -- Then by tag overlap (more overlap = better match)
            (
                SELECT COUNT(*) 
                FROM jsonb_array_elements_text(tags) AS tag
                WHERE tag = ANY(SELECT jsonb_array_elements_text($2::jsonb))
            ) DESC,
            -- Then by similar duration
            ABS(time_required - $${params.length + 2})
        LIMIT 10
    `;

    params.push(originalWorkout.category || 'soccer_shape', originalWorkout.time_required || 45);

    const results = await sql(query, params);
    return results;
}

/**
 * Calculate load equivalency between workouts
 * @param {Object} original - Original workout
 * @param {Object} substitution - Substitution workout
 * @returns {number} Load equivalency percentage
 */
function calculateLoadEquivalency(original, substitution) {
    const originalLoad = calculateSoccerShapeLoad(original);
    const substitutionLoad = calculateSoccerShapeLoad(substitution);

    if (originalLoad === 0) return 100;
    
    return Math.round((substitutionLoad / originalLoad) * 100); // Percentage match
}

/**
 * Calculate adaptation match between tags
 * @param {Array} originalTags - Original workout tags
 * @param {Array} substitutionTags - Substitution workout tags
 * @returns {number} Adaptation match percentage
 */
function calculateAdaptationMatch(originalTags, substitutionTags) {
    if (!originalTags || originalTags.length === 0) return 0;
    if (!substitutionTags || substitutionTags.length === 0) return 0;

    const overlap = originalTags.filter(tag => substitutionTags.includes(tag));
    return Math.round((overlap.length / originalTags.length) * 100);
}

/**
 * Generate substitution reasoning for a workout
 * @param {Object} original - Original workout
 * @param {Object} substitution - Substitution workout
 * @param {number} rank - Ranking (1-3)
 * @returns {string} Reasoning text
 */
function generateIndividualReasoning(original, substitution, rank) {
    const loadDiff = calculateLoadEquivalency(original, substitution) - 100;
    const adaptationMatch = calculateAdaptationMatch(original.tags || [], substitution.tags || []);

    let reasoning = `Option ${rank}: `;

    if (substitution.modality !== original.modality) {
        reasoning += `Cross-modal alternative (${substitution.modality}). `;
    }

    if (substitution.category !== original.category) {
        reasoning += `Different category (${substitution.category}). `;
    }

    if (Math.abs(loadDiff) <= 10) {
        reasoning += `Equivalent training load (±${Math.abs(loadDiff)}%). `;
    } else if (loadDiff > 10) {
        reasoning += `Higher intensity (+${loadDiff}%). `;
    } else {
        reasoning += `Lower intensity (${loadDiff}%). `;
    }

    if (adaptationMatch >= 80) {
        reasoning += `Excellent adaptation match (${adaptationMatch}%).`;
    } else if (adaptationMatch >= 60) {
        reasoning += `Good adaptation match (${adaptationMatch}%).`;
    } else {
        reasoning += `Moderate adaptation match (${adaptationMatch}%).`;
    }

    return reasoning;
}

exports.handler = async (event) => {
    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return preflightResponse();
    }

    if (event.httpMethod !== 'POST') {
        return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    }

    try {
        // Authenticate user
        const userId = await authenticate(event.headers);
        if (!userId) {
            return errorResponse(401, 'AUTH_ERROR', 'Authentication required');
        }

        // Check rate limit
        const withinRateLimit = await checkRateLimit(userId);
        if (!withinRateLimit) {
            return errorResponse(429, 'RATE_LIMIT', 'Too many requests', { retry_after: 60 });
        }

        const sql = getDB();
        const body = JSON.parse(event.body || '{}');
        const { workout_id, template_id, constraints = {} } = body;

        // Support both workout_id and template_id
        const identifier = workout_id || template_id;

        if (!identifier) {
            return errorResponse(400, 'MISSING_WORKOUT_ID', 'Workout ID or template_id required');
        }

        // Get original workout - try by template_id first, then by id
        let originalQuery;
        let originalParams;

        if (identifier.includes('soccer_') || identifier.length > 10) {
            // Likely a template_id
            originalQuery = `
                SELECT * FROM workout_templates 
                WHERE template_id = $1 AND category = 'soccer_shape'
            `;
            originalParams = [identifier];
        } else {
            // Likely a numeric id
            originalQuery = `
                SELECT * FROM workout_templates 
                WHERE id = $1 AND category = 'soccer_shape'
            `;
            originalParams = [parseInt(identifier)];
        }

        const originalResults = await sql(originalQuery, originalParams);
        
        if (!originalResults || originalResults.length === 0) {
            return errorResponse(404, 'WORKOUT_NOT_FOUND', 'Soccer-shape workout not found');
        }

        const originalWorkout = originalResults[0];

        // Find substitutions based on tags and constraints
        const substitutions = await findSoccerShapeSubstitutions(
            sql,
            originalWorkout,
            constraints
        );

        // Calculate load equivalency for each substitution
        const substitutionsWithLoad = substitutions.map(sub => ({
            id: sub.id,
            template_id: sub.template_id,
            name: sub.name,
            modality: sub.modality,
            category: sub.category,
            adaptation: sub.adaptation,
            time_required: sub.time_required,
            difficulty_level: sub.difficulty_level,
            equipment: sub.equipment_required || [],
            tags: sub.tags || [],
            structure: sub.structure,
            calculated_load: calculateSoccerShapeLoad(sub),
            load_equivalency: calculateLoadEquivalency(originalWorkout, sub),
            adaptation_match: calculateAdaptationMatch(originalWorkout.tags || [], sub.tags || [])
        }));

        // Sort by adaptation match and load equivalency, then take top 3
        const sortedSubstitutions = substitutionsWithLoad
            .sort((a, b) => {
                // Primary sort: adaptation match
                if (b.adaptation_match !== a.adaptation_match) {
                    return b.adaptation_match - a.adaptation_match;
                }
                // Secondary sort: load equivalency closeness to 100%
                const aLoadDiff = Math.abs(a.load_equivalency - 100);
                const bLoadDiff = Math.abs(b.load_equivalency - 100);
                return aLoadDiff - bLoadDiff;
            })
            .slice(0, 3);

        // Generate reasoning for each substitution
        const substitutionReasoning = sortedSubstitutions.map((sub, index) => ({
            workout_id: sub.id,
            template_id: sub.template_id,
            reasoning: generateIndividualReasoning(originalWorkout, sub, index + 1)
        }));

        return successResponse({
            original_workout: {
                id: originalWorkout.id,
                template_id: originalWorkout.template_id,
                name: originalWorkout.name,
                calculated_load: calculateSoccerShapeLoad(originalWorkout)
            },
            substitutions: sortedSubstitutions,
            substitution_reasoning: substitutionReasoning
        });

    } catch (error) {
        console.error('Substitution generation failed:', error);
        return errorResponse(500, 'SUBSTITUTION_ERROR', 'Failed to generate substitutions', {
            error: error.message
        });
    }
};

