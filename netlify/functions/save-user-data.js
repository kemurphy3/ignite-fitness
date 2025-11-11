const { neon } = require('@neondatabase/serverless');

const { getNeonClient } = require('./utils/connection-pool');
const sql = getNeonClient();

const okJson = data => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  },
  body: JSON.stringify(data),
});

const badReq = message => ({
  statusCode: 400,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify({ error: message }),
});

const methodNotAllowed = () => ({
  statusCode: 405,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify({ error: 'Method not allowed' }),
});

const okPreflight = () => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  },
  body: '',
});

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') {
    return okPreflight();
  }
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed();
  }

  try {
    const { userId, dataType, data } = JSON.parse(event.body || '{}');

    if (!userId) {
      return badReq('Missing required field: userId');
    }

    // Upsert user row by external_id
    const user = await sql`
            INSERT INTO users (external_id, username, email) 
            VALUES (${userId}, ${data.username || userId}, ${data.email || null})
            ON CONFLICT (external_id) DO UPDATE SET 
                username = EXCLUDED.username,
                email = EXCLUDED.email,
                updated_at = NOW()
            RETURNING id
        `;
    const user_id = user[0].id;

    const savedData = {};

    // Handle different data types
    if (dataType === 'all' || dataType === 'preferences') {
      if (data.preferences) {
        // Convert goals object to array format for database
        let goalsArray = null;
        if (data.preferences.goals) {
          if (typeof data.preferences.goals === 'object') {
            goalsArray = [data.preferences.goals.primary, data.preferences.goals.secondary].filter(
              Boolean
            );
          } else if (Array.isArray(data.preferences.goals)) {
            goalsArray = data.preferences.goals;
          }
        }

        const preferences = await sql`
                    INSERT INTO user_preferences (user_id, age, weight, height, sex, goals, baseline_lifts, workout_schedule)
                    VALUES (${user_id}, ${data.preferences.age || null}, ${data.preferences.weight || null}, 
                           ${data.preferences.height || null}, ${data.preferences.sex || null}, 
                           ${goalsArray}, ${data.preferences.baselineLifts ? JSON.stringify(data.preferences.baselineLifts) : null},
                           ${data.preferences.workoutSchedule ? JSON.stringify(data.preferences.workoutSchedule) : null})
                    ON CONFLICT (user_id) DO UPDATE SET
                        age = EXCLUDED.age,
                        weight = EXCLUDED.weight,
                        height = EXCLUDED.height,
                        sex = EXCLUDED.sex,
                        goals = EXCLUDED.goals,
                        baseline_lifts = EXCLUDED.baseline_lifts,
                        workout_schedule = EXCLUDED.workout_schedule,
                        updated_at = NOW()
                    RETURNING *
                `;
        savedData.preferences = preferences[0];
      }
    }

    if (dataType === 'all' || dataType === 'sessions') {
      if (data.sessions && Array.isArray(data.sessions)) {
        const savedSessions = [];
        for (const session of data.sessions) {
          const sessionResult = await sql`
                        INSERT INTO sessions (user_id, type, source, source_id, start_at, end_at, timezone, payload)
                        VALUES (${user_id}, ${session.type}, ${session.source || 'manual'}, 
                               ${session.sourceId || null}, ${session.startAt}, ${session.endAt}, 
                               ${session.timezone || 'America/Denver'}, 
                               ${session.payload ? JSON.stringify(session.payload) : null})
                        ON CONFLICT (user_id, source, source_id) DO UPDATE SET
                            type = EXCLUDED.type,
                            start_at = EXCLUDED.start_at,
                            end_at = EXCLUDED.end_at,
                            timezone = EXCLUDED.timezone,
                            payload = EXCLUDED.payload,
                            updated_at = NOW()
                        RETURNING *
                    `;
          savedSessions.push(sessionResult[0]);
        }
        savedData.sessions = savedSessions;
      }
    }

    if (dataType === 'all' || dataType === 'sleep') {
      if (data.sleepSessions && Array.isArray(data.sleepSessions)) {
        const savedSleep = [];
        for (const sleep of data.sleepSessions) {
          const sleepResult = await sql`
                        INSERT INTO sleep_sessions (user_id, source, source_id, start_at, end_at, 
                                                  deep_sleep_minutes, rem_sleep_minutes, light_sleep_minutes, 
                                                  sleep_score, notes)
                        VALUES (${user_id}, ${sleep.source || 'manual'}, ${sleep.sourceId || null},
                               ${sleep.startAt}, ${sleep.endAt}, ${sleep.deepSleepMinutes || null},
                               ${sleep.remSleepMinutes || null}, ${sleep.lightSleepMinutes || null},
                               ${sleep.sleepScore || null}, ${sleep.notes || null})
                        ON CONFLICT (user_id, source, source_id) DO UPDATE SET
                            start_at = EXCLUDED.start_at,
                            end_at = EXCLUDED.end_at,
                            deep_sleep_minutes = EXCLUDED.deep_sleep_minutes,
                            rem_sleep_minutes = EXCLUDED.rem_sleep_minutes,
                            light_sleep_minutes = EXCLUDED.light_sleep_minutes,
                            sleep_score = EXCLUDED.sleep_score,
                            notes = EXCLUDED.notes,
                            updated_at = NOW()
                        RETURNING *
                    `;
          savedSleep.push(sleepResult[0]);
        }
        savedData.sleepSessions = savedSleep;
      }
    }

    if (dataType === 'all' || dataType === 'strava') {
      if (data.stravaActivities && Array.isArray(data.stravaActivities)) {
        const savedStrava = [];
        for (const activity of data.stravaActivities) {
          const stravaResult = await sql`
                        INSERT INTO strava_activities (user_id, strava_id, name, type, distance, moving_time, 
                                                     elapsed_time, total_elevation_gain, start_date, timezone,
                                                     average_speed, max_speed, average_heartrate, max_heartrate,
                                                     calories, payload)
                        VALUES (${user_id}, ${activity.stravaId}, ${activity.name || null}, ${activity.type || null},
                               ${activity.distance || null}, ${activity.movingTime || null}, ${activity.elapsedTime || null},
                               ${activity.totalElevationGain || null}, ${activity.startDate}, ${activity.timezone || null},
                               ${activity.averageSpeed || null}, ${activity.maxSpeed || null}, ${activity.averageHeartrate || null},
                               ${activity.maxHeartrate || null}, ${activity.calories || null}, 
                               ${activity.payload ? JSON.stringify(activity.payload) : null})
                        ON CONFLICT (strava_id) DO UPDATE SET
                            name = EXCLUDED.name,
                            type = EXCLUDED.type,
                            distance = EXCLUDED.distance,
                            moving_time = EXCLUDED.moving_time,
                            elapsed_time = EXCLUDED.elapsed_time,
                            total_elevation_gain = EXCLUDED.total_elevation_gain,
                            start_date = EXCLUDED.start_date,
                            timezone = EXCLUDED.timezone,
                            average_speed = EXCLUDED.average_speed,
                            max_speed = EXCLUDED.max_speed,
                            average_heartrate = EXCLUDED.average_heartrate,
                            max_heartrate = EXCLUDED.max_heartrate,
                            calories = EXCLUDED.calories,
                            payload = EXCLUDED.payload,
                            updated_at = NOW()
                        RETURNING *
                    `;
          savedStrava.push(stravaResult[0]);
        }
        savedData.stravaActivities = savedStrava;
      }
    }

    return okJson({
      success: true,
      message: 'User data saved successfully',
      savedData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error saving user data:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
