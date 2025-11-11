export function createAdminMetrics(overrides = {}) {
    return {
        total_users: overrides.total_users ?? 250,
        new_users_7d: overrides.new_users_7d ?? 18,
        total_sessions: overrides.total_sessions ?? 1125,
        sessions_7d: overrides.sessions_7d ?? 210,
        active_users_30d: overrides.active_users_30d ?? 160,
        avg_sessions_per_user: overrides.avg_sessions_per_user ?? 4.5,
        ...overrides
    };
}

