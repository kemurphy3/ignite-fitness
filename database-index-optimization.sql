-- Database Index Optimization Migration
-- This migration adds critical indexes identified in performance audits
-- to improve query performance across all Netlify Functions

-- =====================================================
-- CRITICAL PERFORMANCE INDEXES
-- =====================================================

-- 1. Sessions table - Most critical for user queries
-- Composite index for user sessions ordered by start time (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_sessions_user_start_desc 
ON sessions(user_id, start_at DESC);

-- Index for sessions by type and user (admin analytics)
CREATE INDEX IF NOT EXISTS idx_sessions_user_type 
ON sessions(user_id, type);

-- Index for sessions by source (deduplication queries)
CREATE INDEX IF NOT EXISTS idx_sessions_user_source 
ON sessions(user_id, source, source_id) 
WHERE source_id IS NOT NULL;

-- Index for sessions by date range (admin analytics)
CREATE INDEX IF NOT EXISTS idx_sessions_start_at_type 
ON sessions(start_at, type);

-- 2. Exercises table - Critical for session exercise queries
-- Composite index for exercises by session (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_exercises_session_id 
ON exercises(session_id, id);

-- Index for exercises by user and session
CREATE INDEX IF NOT EXISTS idx_exercises_user_session 
ON exercises(user_id, session_id);

-- Index for exercises by name (for exercise analytics)
CREATE INDEX IF NOT EXISTS idx_exercises_name 
ON exercises(name);

-- 3. Users table - Critical for authentication
-- Index for external_id lookups (already exists but ensuring it's optimal)
CREATE INDEX IF NOT EXISTS idx_users_external_id 
ON users(external_id);

-- Index for username lookups
CREATE INDEX IF NOT EXISTS idx_users_username 
ON users(username);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

-- 4. Sleep sessions - Performance optimization
-- Composite index for user sleep sessions ordered by start time
CREATE INDEX IF NOT EXISTS idx_sleep_sessions_user_start_desc 
ON sleep_sessions(user_id, start_at DESC);

-- Index for sleep sessions by date range
CREATE INDEX IF NOT EXISTS idx_sleep_sessions_start_at 
ON sleep_sessions(start_at);

-- 5. Strava activities - Performance optimization
-- Composite index for user Strava activities ordered by start date
CREATE INDEX IF NOT EXISTS idx_strava_activities_user_start_desc 
ON strava_activities(user_id, start_date DESC);

-- Index for Strava activities by type
CREATE INDEX IF NOT EXISTS idx_strava_activities_type 
ON strava_activities(type);

-- Index for Strava activities by date range
CREATE INDEX IF NOT EXISTS idx_strava_activities_start_date 
ON strava_activities(start_date);

-- 6. User preferences - Performance optimization
-- Index for user preferences lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id 
ON user_preferences(user_id);

-- =====================================================
-- ADMIN ANALYTICS INDEXES
-- =====================================================

-- Index for admin user analytics (user creation trends)
CREATE INDEX IF NOT EXISTS idx_users_created_at 
ON users(created_at);

-- Index for admin session analytics (session creation trends)
CREATE INDEX IF NOT EXISTS idx_sessions_created_at 
ON sessions(created_at);

-- Index for admin exercise analytics (exercise creation trends)
CREATE INDEX IF NOT EXISTS idx_exercises_created_at 
ON exercises(created_at);

-- =====================================================
-- API PERFORMANCE INDEXES
-- =====================================================

-- Index for API key lookups (if api_keys table exists)
-- CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
-- CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- Index for rate limiting (if rate_limits table exists)
-- CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint ON rate_limits(user_id, endpoint);
-- CREATE INDEX IF NOT EXISTS idx_rate_limits_created_at ON rate_limits(created_at);

-- =====================================================
-- PARTIAL INDEXES FOR SPECIFIC USE CASES
-- =====================================================

-- Index for active sessions only (not deleted)
CREATE INDEX IF NOT EXISTS idx_sessions_active_user_start 
ON sessions(user_id, start_at DESC) 
WHERE deleted_at IS NULL;

-- Index for active exercises only
CREATE INDEX IF NOT EXISTS idx_exercises_active_session 
ON exercises(session_id, id) 
WHERE deleted_at IS NULL;

-- Index for recent sessions (last 30 days)
CREATE INDEX IF NOT EXISTS idx_sessions_recent_user_start 
ON sessions(user_id, start_at DESC) 
WHERE start_at >= NOW() - INTERVAL '30 days';

-- =====================================================
-- COVERING INDEXES FOR COMMON QUERIES
-- =====================================================

-- Covering index for session list queries (includes commonly selected columns)
CREATE INDEX IF NOT EXISTS idx_sessions_covering_user_start 
ON sessions(user_id, start_at DESC) 
INCLUDE (id, type, source, end_at, timezone);

-- Covering index for exercise list queries
CREATE INDEX IF NOT EXISTS idx_exercises_covering_session 
ON exercises(session_id, id) 
INCLUDE (name, weight, reps, sets, rpe, notes);

-- =====================================================
-- STATISTICS UPDATE
-- =====================================================

-- Update table statistics for better query planning
ANALYZE users;
ANALYZE sessions;
ANALYZE exercises;
ANALYZE sleep_sessions;
ANALYZE strava_activities;
ANALYZE user_preferences;

-- =====================================================
-- INDEX USAGE MONITORING
-- =====================================================

-- Create a view to monitor index usage
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW_USAGE'
        WHEN idx_scan < 1000 THEN 'MEDIUM_USAGE'
        ELSE 'HIGH_USAGE'
    END as usage_level
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- =====================================================
-- QUERY PERFORMANCE VALIDATION
-- =====================================================

-- Create a function to validate index performance
CREATE OR REPLACE FUNCTION validate_index_performance()
RETURNS TABLE(
    query_name TEXT,
    execution_time_ms NUMERIC,
    index_used BOOLEAN,
    rows_examined BIGINT
) AS $$
BEGIN
    -- Test 1: User sessions query
    RETURN QUERY
    SELECT 
        'user_sessions'::TEXT,
        EXTRACT(EPOCH FROM (clock_timestamp() - statement_timestamp())) * 1000,
        (SELECT COUNT(*) > 0 FROM pg_stat_user_indexes WHERE indexname = 'idx_sessions_user_start_desc'),
        (SELECT COUNT(*) FROM sessions WHERE user_id = 1)
    FROM sessions 
    WHERE user_id = 1 
    ORDER BY start_at DESC 
    LIMIT 10;
    
    -- Test 2: Session exercises query
    RETURN QUERY
    SELECT 
        'session_exercises'::TEXT,
        EXTRACT(EPOCH FROM (clock_timestamp() - statement_timestamp())) * 1000,
        (SELECT COUNT(*) > 0 FROM pg_stat_user_indexes WHERE indexname = 'idx_exercises_session_id'),
        (SELECT COUNT(*) FROM exercises WHERE session_id = 1)
    FROM exercises 
    WHERE session_id = 1 
    ORDER BY id 
    LIMIT 10;
    
    -- Test 3: User lookup by external_id
    RETURN QUERY
    SELECT 
        'user_lookup'::TEXT,
        EXTRACT(EPOCH FROM (clock_timestamp() - statement_timestamp())) * 1000,
        (SELECT COUNT(*) > 0 FROM pg_stat_user_indexes WHERE indexname = 'idx_users_external_id'),
        (SELECT COUNT(*) FROM users WHERE external_id = 'test-user')
    FROM users 
    WHERE external_id = 'test-user';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MIGRATION COMPLETION
-- =====================================================

-- Log the migration completion
INSERT INTO pg_stat_statements_info (dealloc) VALUES (0);

-- Display index creation summary
SELECT 
    'Index Optimization Migration Complete' as status,
    COUNT(*) as total_indexes_created
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';

-- Display performance recommendations
SELECT 
    'Performance Recommendations:' as recommendation,
    '1. Monitor index usage with: SELECT * FROM index_usage_stats;' as step1,
    '2. Validate performance with: SELECT * FROM validate_index_performance();' as step2,
    '3. Consider VACUUM ANALYZE for large tables' as step3;