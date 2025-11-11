// Strava Activity Import Utilities
const crypto = require('crypto');

// Standardized error response
class ImportError extends Error {
  constructor(code, message, statusCode = 500, details = null) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toResponse(headers) {
    return {
      statusCode: this.statusCode,
      headers,
      body: JSON.stringify({
        error: {
          code: this.code,
          message: this.message,
          ...(this.details && { details: this.details }),
        },
      }),
    };
  }
}

// Network fetch with timeout
async function fetchWithTimeout(url, options, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// Calculate pace
function calculatePace(seconds, meters, unit = 'km') {
  if (!seconds || !meters) {
    return null;
  }
  const divisor = unit === 'km' ? 1000 : 1609.34;
  const minutesPer = seconds / 60 / (meters / divisor);
  const mins = Math.floor(minutesPer);
  const secs = Math.round((minutesPer - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Map Strava activity to session
function mapStravaActivity(activity, userId) {
  // Parse timezone
  const tzMatch = activity.timezone?.match(/GMT([+-]\d{2}):(\d{2})/);
  const tzOffsetMinutes = tzMatch
    ? parseInt(tzMatch[1]) * 60 + parseInt(tzMatch[2]) * (tzMatch[1].startsWith('-') ? -1 : 1)
    : 0;

  return {
    user_id: userId,

    // Use local time for display, UTC for sorting
    date: activity.start_date_local
      ? new Date(activity.start_date_local)
      : new Date(activity.start_date),
    utc_date: new Date(activity.start_date),
    timezone: activity.timezone,
    timezone_offset: tzOffsetMinutes,

    // Durations
    duration: Math.ceil((activity.moving_time || 0) / 60),
    elapsed_duration: Math.ceil((activity.elapsed_time || 0) / 60),

    // Type and naming
    type: 'cardio', // Will be mapped by SQL function
    name: (activity.name || `${activity.sport_type} Activity`).substring(0, 255),
    notes: activity.description?.substring(0, 5000),

    // Source tracking
    source: 'strava',
    source_id: String(activity.id),
    external_url: `https://www.strava.com/activities/${activity.id}`,

    // Complete payload
    payload: {
      version: activity.version || '1',
      original: activity,
      summary: {
        distance_km: activity.distance ? (activity.distance / 1000).toFixed(2) : null,
        distance_mi: activity.distance ? (activity.distance / 1609.34).toFixed(2) : null,

        pace_per_km: calculatePace(activity.moving_time, activity.distance, 'km'),
        pace_per_mi: calculatePace(activity.moving_time, activity.distance, 'mi'),

        speed_kmh: activity.average_speed ? (activity.average_speed * 3.6).toFixed(1) : null,
        speed_mph: activity.average_speed ? (activity.average_speed * 2.237).toFixed(1) : null,

        elevation_gain_m: activity.total_elevation_gain,
        elevation_gain_ft: activity.total_elevation_gain
          ? Math.round(activity.total_elevation_gain * 3.281)
          : null,

        calories: activity.kilojoules ? Math.round(activity.kilojoules * 1.05) : null,

        heart_rate: {
          average: activity.average_heartrate,
          max: activity.max_heartrate,
          has_data: activity.has_heartrate,
        },

        power: {
          average: activity.average_watts,
          weighted: activity.weighted_average_watts,
          max: activity.max_watts,
          has_data: activity.device_watts,
        },
      },
      metadata: {
        is_manual: activity.manual,
        is_private: activity.private,
        is_indoor: activity.trainer,
        is_race: activity.workout_type === 1,

        device: activity.device_name,
        gear_id: activity.gear_id,

        achievements: activity.achievement_count,
        kudos: activity.kudos_count,
        comments: activity.comment_count,
        suffer_score: activity.suffer_score,

        has_photos: activity.photo_count > 0,
        has_gps: !!activity.map?.summary_polyline,
      },
    },
  };
}

// Validate after parameter
function validateAfterParam(after) {
  if (after === null || after === undefined) {
    return true;
  }

  const afterStr = String(after);
  if (!/^\d{1,10}$/.test(afterStr)) {
    return false;
  }

  const afterNum = parseInt(afterStr);
  if (afterNum > Math.floor(Date.now() / 1000)) {
    return false;
  }

  return true;
}

// Generate continue token
function generateContinueToken(state) {
  return Buffer.from(JSON.stringify(state)).toString('base64');
}

// Parse continue token
function parseContinueToken(token) {
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString());
  } catch (error) {
    throw new ImportError('INVALID_CONTINUE_TOKEN', 'Invalid continue token', 400);
  }
}

// Sanitize data for logging
function sanitizeForLog(data) {
  const sanitized = { ...data };

  // Remove sensitive data
  delete sanitized.access_token;
  delete sanitized.refresh_token;
  delete sanitized.encrypted_access_token;
  delete sanitized.encrypted_refresh_token;

  // Hash user ID
  if (sanitized.user_id) {
    sanitized.user_hash = crypto
      .createHash('sha256')
      .update(sanitized.user_id)
      .digest('hex')
      .substring(0, 8);
    delete sanitized.user_id;
  }

  // Truncate long strings
  if (sanitized.notes && sanitized.notes.length > 100) {
    sanitized.notes = `${sanitized.notes.substring(0, 100)}...`;
  }

  return sanitized;
}

// Handle Strava rate limiting
async function handleStravaRateLimit(response, retryCount = 0) {
  if (response.status !== 429) {
    return response;
  }

  const retryAfterHeader = response.headers.get('Retry-After');
  const rateLimitUsage = response.headers.get('X-RateLimit-Usage');

  const waitMs = retryAfterHeader
    ? parseInt(retryAfterHeader) * 1000
    : Math.min(1000 * Math.pow(2, retryCount), 30000);

  if (rateLimitUsage) {
    const [fifteenMin, daily] = rateLimitUsage.split(',').map(Number);
    console.log(`Rate limit: ${fifteenMin}/600 (15min), ${daily}/1000 (daily)`);
  }

  console.log(`Rate limited, waiting ${waitMs}ms before retry ${retryCount + 1}`);
  await new Promise(resolve => setTimeout(resolve, waitMs));

  return null; // Indicate retry needed
}

// Build Strava API URL with pagination
function buildStravaUrl(params) {
  const { perPage, page, lastActivityId, after } = params;
  const url = new URL('https://www.strava.com/api/v3/athlete/activities');

  url.searchParams.append('per_page', String(perPage));

  // Use cursor-based pagination if available
  if (lastActivityId) {
    url.searchParams.append('before', String(lastActivityId));
  } else {
    url.searchParams.append('page', String(page));
  }

  if (after) {
    url.searchParams.append('after', String(after));
  }

  return url.toString();
}

// Process activities in batch
async function processActivitiesBatch(sql, activities, userId, runId, page, after, perPage) {
  const pageStartTime = Date.now();
  const pageImported = [];
  const pageDuplicates = [];
  const pageUpdated = [];
  const pageFailed = [];

  for (const activity of activities) {
    try {
      // Map activity
      const sessionData = mapStravaActivity(activity, userId);

      // Get sport type from SQL function
      const sportType = await sql`
                SELECT map_strava_sport_type(${activity.sport_type}) as type
            `;
      sessionData.type = sportType[0].type;

      // UPSERT with duplicate detection
      const upsertResult = await sql`
                INSERT INTO sessions ${sql(sessionData)}
                ON CONFLICT (user_id, source, source_id)
                DO UPDATE SET
                    date = EXCLUDED.date,
                    utc_date = EXCLUDED.utc_date,
                    timezone = EXCLUDED.timezone,
                    timezone_offset = EXCLUDED.timezone_offset,
                    duration = EXCLUDED.duration,
                    elapsed_duration = EXCLUDED.elapsed_duration,
                    name = EXCLUDED.name,
                    notes = EXCLUDED.notes,
                    payload = EXCLUDED.payload,
                    updated_at = NOW()
                RETURNING 
                    id,
                    (xmax = 0) as was_inserted,
                    payload->>'version' as old_version
            `;

      // Track in activity cache
      await sql`
                INSERT INTO strava_activity_cache (user_id, activity_id, activity_version)
                VALUES (${userId}, ${activity.id}, ${activity.version || '1'})
                ON CONFLICT (user_id, activity_id)
                DO UPDATE SET 
                    last_seen = NOW(),
                    activity_version = EXCLUDED.activity_version
            `;

      // Categorize result
      if (upsertResult[0].was_inserted) {
        pageImported.push(activity.id);
      } else if (upsertResult[0].old_version !== (activity.version || '1')) {
        pageUpdated.push(activity.id);
      } else {
        pageDuplicates.push(activity.id);
      }
    } catch (error) {
      console.error(`Failed to import activity ${activity.id}:`, error.message);
      pageFailed.push({
        activity_id: activity.id,
        name: activity.name,
        error: error.message,
      });
    }
  }

  // Log import
  await sql`
        INSERT INTO strava_import_log (
            user_id, run_id, page_number,
            requested_after, requested_per_page,
            activities_fetched, activities_imported,
            activities_duplicate, activities_updated,
            activities_failed, errors,
            completed_at, duration_ms
        ) VALUES (
            ${userId}, ${runId}, ${page},
            ${after}, ${perPage},
            ${activities.length}, ${pageImported.length},
            ${pageDuplicates.length}, ${pageUpdated.length},
            ${pageFailed.length}, 
            ${pageFailed.length > 0 ? JSON.stringify(pageFailed) : null},
            NOW(), ${Date.now() - pageStartTime}
        )
    `;

  return {
    imported: pageImported.length,
    duplicates: pageDuplicates.length,
    updated: pageUpdated.length,
    failed: pageFailed.length,
    errors: pageFailed,
  };
}

module.exports = {
  ImportError,
  fetchWithTimeout,
  mapStravaActivity,
  validateAfterParam,
  generateContinueToken,
  parseContinueToken,
  sanitizeForLog,
  handleStravaRateLimit,
  buildStravaUrl,
  processActivitiesBatch,
};
