const {
  getDB,
  authenticate,
  errorResponse,
  successResponse,
  preflightResponse,
} = require('./_base');
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
      const zone = mainBlock.intensity.includes('Z') ? mainBlock.intensity.split('-')[0] : 'Z3';
      const zoneMultipliers = {
        Z1: 1.0,
        Z2: 2.0,
        Z3: 4.0,
        Z4: 7.0,
        Z5: 10.0,
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
 * Get substitution count estimate for tags
 * @param {Array} tags - Workout tags
 * @returns {number} Estimated substitution count
 */
function getSubstitutionCount(tags) {
  const substitutionMap = {
    acceleration: 4,
    COD: 5,
    VO2: 3,
    anaerobic_capacity: 4,
    neuromotor: 3,
  };

  if (!tags || tags.length === 0) {
    return 3;
  }

  const maxSubstitutions = Math.max(...tags.map(tag => substitutionMap[tag] || 3));
  return Math.min(maxSubstitutions, 5); // Cap at 5 alternatives
}

exports.handler = async event => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return preflightResponse();
  }

  if (event.httpMethod !== 'GET') {
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
    const requestParams = event.queryStringParameters || {};
    const { experience_level, equipment, tags, intensity_zone } = requestParams;

    // Build dynamic query for soccer-shape workouts
    const whereConditions = ["category = 'soccer_shape'", 'is_active = true'];
    const params = [];

    if (experience_level) {
      const validLevels = ['beginner', 'intermediate', 'advanced', 'elite'];
      if (validLevels.includes(experience_level)) {
        whereConditions.push(`difficulty_level = $${params.length + 1}`);
        params.push(experience_level);
      }
    }

    if (equipment) {
      const equipmentList = equipment
        .split(',')
        .map(e => e.trim())
        .filter(e => e);
      if (equipmentList.length > 0) {
        whereConditions.push(`equipment_required && $${params.length + 1}::jsonb`);
        params.push(JSON.stringify(equipmentList));
      }
    }

    if (tags) {
      const tagList = tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t);
      if (tagList.length > 0) {
        whereConditions.push(`tags && $${params.length + 1}::jsonb`);
        params.push(JSON.stringify(tagList));
      }
    }

    if (intensity_zone) {
      const validZones = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];
      if (validZones.includes(intensity_zone)) {
        // Check if structure contains this intensity zone
        whereConditions.push(`structure::text LIKE $${params.length + 1}`);
        params.push(`%"intensity": "${intensity_zone}"%`);
      }
    }

    const whereClause = whereConditions.join(' AND ');

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
            WHERE ${whereClause}
            ORDER BY
                CASE difficulty_level
                    WHEN 'beginner' THEN 1
                    WHEN 'intermediate' THEN 2
                    WHEN 'advanced' THEN 3
                    WHEN 'elite' THEN 4
                END,
                time_required ASC
        `;

    const workouts = await sql(query, params);

    // Calculate load for each workout and add metadata
    const workoutsWithLoad = workouts.map(workout => ({
      id: workout.id,
      template_id: workout.template_id,
      name: workout.name,
      modality: workout.modality,
      category: workout.category,
      subcategory: workout.category, // For backward compatibility
      adaptation: workout.adaptation,
      estimated_load: workout.estimated_load,
      calculated_load: calculateSoccerShapeLoad(workout),
      time_required: workout.time_required,
      difficulty_level: workout.difficulty_level,
      experience_level: workout.difficulty_level, // Alias
      equipment: workout.equipment_required || [],
      equipment_required: workout.equipment_required || [],
      description: workout.description,
      structure: workout.structure,
      tags: workout.tags || [],
      substitution_count: getSubstitutionCount(workout.tags || []),
      created_at: workout.created_at,
    }));

    return successResponse({
      workouts: workoutsWithLoad,
      total_count: workoutsWithLoad.length,
      filters_applied: {
        experience_level: experience_level || null,
        equipment: equipment ? equipment.split(',').map(e => e.trim()) : null,
        tags: tags ? tags.split(',').map(t => t.trim()) : null,
        intensity_zone: intensity_zone || null,
      },
    });
  } catch (error) {
    console.error('Soccer-shape workout retrieval failed:', error);
    return errorResponse(500, 'QUERY_ERROR', 'Failed to retrieve workouts', {
      error: error.message,
    });
  }
};
