// GET /users/profile - Retrieve User Profile
const { getServerlessDB } = require('./utils/database');
const { verifyJWT } = require('./utils/auth');
const { sanitizeForLog } = require('./utils/security');
const convertUnits = require('./utils/units');

// Helper function to format time
function formatTime(seconds) {
  if (!seconds) {
    return null;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

exports.handler = async event => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed', code: 'METHOD_001' }),
    };
  }

  const sql = getServerlessDB();

  try {
    // Authenticate user
    const userId = await verifyJWT(event.headers);
    if (!userId) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized', code: 'AUTH_001' }),
      };
    }

    // Fetch profile with goal details
    const result = await sql`
            SELECT 
                p.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', g.id,
                            'display_name', g.display_name,
                            'category', g.category,
                            'conflicting_goals', g.conflicting_goals
                        )
                    ) FILTER (WHERE g.id IS NOT NULL),
                    '[]'::json
                ) as goal_details,
                CASE 
                    WHEN p.bmi < 18.5 THEN 'underweight'
                    WHEN p.bmi < 25 THEN 'normal'
                    WHEN p.bmi < 30 THEN 'overweight'
                    ELSE 'obese'
                END as bmi_category
            FROM user_profiles p
            LEFT JOIN valid_goals g ON g.id = ANY(
                SELECT jsonb_array_elements_text(p.goals)
            )
            WHERE p.user_id = ${userId}
            GROUP BY p.id
        `;

    if (!result.length) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Profile not found',
          code: 'PROF_404',
        }),
      };
    }

    const profile = result[0];

    // Check for goal conflicts
    const conflicts = profile.goal_details
      .filter(g => g.conflicting_goals)
      .flatMap(g => g.conflicting_goals)
      .filter(conflictId => profile.goals.includes(conflictId));

    // Format response based on preferred units
    const useImperial = profile.preferred_units === 'imperial';

    const response = {
      age: profile.age,
      height: useImperial ? convertUnits.toFeetInches(profile.height_cm) : profile.height_cm,
      weight: useImperial ? convertUnits.toLbs(profile.weight_kg) : profile.weight_kg,
      sex: profile.sex,
      preferred_units: profile.preferred_units,
      goals: profile.goals,
      goal_priorities: profile.goal_priorities,
      goal_details: profile.goal_details,
      goal_conflicts: conflicts.length > 0 ? conflicts : null,
      baseline_lifts: {
        bench_press_max: useImperial
          ? convertUnits.toLbs(profile.bench_press_max)
          : profile.bench_press_max,
        squat_max: useImperial ? convertUnits.toLbs(profile.squat_max) : profile.squat_max,
        deadlift_max: useImperial ? convertUnits.toLbs(profile.deadlift_max) : profile.deadlift_max,
        overhead_press_max: useImperial
          ? convertUnits.toLbs(profile.overhead_press_max)
          : profile.overhead_press_max,
        total: useImperial ? convertUnits.toLbs(profile.total_lifts) : profile.total_lifts,
      },
      baseline_bodyweight: {
        pull_ups_max: profile.pull_ups_max,
        push_ups_max: profile.push_ups_max,
      },
      baseline_cardio: {
        mile_time_seconds: profile.mile_time_seconds,
        mile_time_formatted: profile.mile_time_seconds
          ? formatTime(profile.mile_time_seconds)
          : null,
      },
      calculated_metrics: {
        bmi: profile.bmi,
        bmi_category: profile.bmi_category,
        completeness_score: profile.completeness_score,
      },
      metadata: {
        version: profile.version,
        last_updated: profile.updated_at,
        profile_age_days: Math.floor(
          (Date.now() - new Date(profile.created_at)) / (1000 * 60 * 60 * 24)
        ),
      },
    };

    // Log sanitized action (no PII)
    console.log('Profile retrieved:', {
      userId: sanitizeForLog(userId),
      completeness: profile.completeness_score,
      version: profile.version,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60',
        ETag: `"${profile.version}"`,
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Profile fetch error:', sanitizeForLog(error.message));

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        code: 'SYS_001',
      }),
    };
  }
};
