export function createStravaTokenRecord(overrides = {}) {
    const now = Date.now();
    const defaultExpiry = new Date(now + 30 * 60 * 1000);

    return {
        user_id: overrides.user_id || 'user-test-1',
        encrypted_access_token: overrides.encrypted_access_token || 'enc_access_token',
        encrypted_refresh_token: overrides.encrypted_refresh_token || 'enc_refresh_token',
        expires_at: overrides.expires_at instanceof Date
            ? overrides.expires_at.toISOString()
            : overrides.expires_at || defaultExpiry.toISOString(),
        encryption_key_version: overrides.encryption_key_version ?? 1,
        refresh_count: overrides.refresh_count ?? 0,
        scope: overrides.scope || 'read,activity:read_all',
        created_at: overrides.created_at || new Date(now - 60 * 60 * 1000).toISOString(),
        updated_at: overrides.updated_at || new Date(now - 30 * 60 * 1000).toISOString()
    };
}

export function createStravaActivity(overrides = {}) {
    const base = {
        id: overrides.id ?? 1234567890,
        name: overrides.name || 'Morning Run',
        sport_type: overrides.sport_type || 'Run',
        moving_time: overrides.moving_time ?? 1800,
        elapsed_time: overrides.elapsed_time ?? 1900,
        distance: overrides.distance ?? 10000,
        total_elevation_gain: overrides.total_elevation_gain ?? 120,
        average_speed: overrides.average_speed ?? 2.78,
        average_heartrate: overrides.average_heartrate ?? 152,
        max_heartrate: overrides.max_heartrate ?? 182,
        has_heartrate: overrides.has_heartrate ?? true,
        average_watts: overrides.average_watts ?? 210,
        weighted_average_watts: overrides.weighted_average_watts ?? 240,
        max_watts: overrides.max_watts ?? 375,
        device_watts: overrides.device_watts ?? true,
        timezone: overrides.timezone || '(GMT-05:00) America/New_York',
        start_date: overrides.start_date || new Date().toISOString(),
        start_date_local: overrides.start_date_local || new Date().toISOString(),
        description: overrides.description || 'Tempo run with strides.',
        manual: overrides.manual ?? false,
        private: overrides.private ?? false,
        trainer: overrides.trainer ?? false,
        workout_type: overrides.workout_type ?? 3,
        device_name: overrides.device_name || 'Garmin Forerunner',
        gear_id: overrides.gear_id || 'gear123',
        achievement_count: overrides.achievement_count ?? 3,
        kudos_count: overrides.kudos_count ?? 8,
        comment_count: overrides.comment_count ?? 1,
        suffer_score: overrides.suffer_score ?? 185,
        photo_count: overrides.photo_count ?? 0,
        map: overrides.map || { summary_polyline: 'abcdef' }
    };

    return {
        ...base,
        ...overrides
    };
}

