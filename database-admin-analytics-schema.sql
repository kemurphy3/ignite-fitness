-- Admin Analytics Database Schema v1.0
-- Run this script to create the comprehensive admin analytics system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Add role column to existing users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Composite indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE role = 'admin';
CREATE INDEX IF NOT EXISTS idx_sessions_date_user ON sessions(created_at, user_id) 
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON sessions(user_id, created_at) 
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_type_date ON sessions(session_type, created_at)
  WHERE deleted_at IS NULL;

-- Admin audit log with request tracking
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  query_params JSONB,
  response_status INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_request ON admin_audit_log(request_id);

-- Daily session aggregates with privacy thresholds
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_sessions_daily AS
SELECT 
  DATE(created_at AT TIME ZONE 'UTC') as date_utc,
  COUNT(*) as session_count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(CASE WHEN completed THEN 1 END) as completed_count,
  AVG(duration_minutes) as avg_duration,
  -- Privacy flag
  COUNT(DISTINCT user_id) >= 5 as meets_privacy_threshold
FROM sessions
WHERE deleted_at IS NULL
GROUP BY DATE(created_at AT TIME ZONE 'UTC');

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_sessions_daily_date ON mv_sessions_daily(date_utc);

-- Refresh tracking
CREATE TABLE IF NOT EXISTS mv_refresh_log (
  view_name TEXT PRIMARY KEY,
  last_refresh TIMESTAMPTZ,
  row_version INTEGER DEFAULT 0,
  refresh_duration_ms INTEGER
);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_admin_views()
RETURNS void AS $$
DECLARE
  start_time BIGINT;
BEGIN
  start_time := extract(epoch from now()) * 1000;
  
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sessions_daily;
  
  INSERT INTO mv_refresh_log (view_name, last_refresh, refresh_duration_ms)
  VALUES ('mv_sessions_daily', NOW(), extract(epoch from now()) * 1000 - start_time)
  ON CONFLICT (view_name) 
  DO UPDATE SET 
    last_refresh = NOW(),
    row_version = mv_refresh_log.row_version + 1,
    refresh_duration_ms = EXCLUDED.refresh_duration_ms;
END;
$$ LANGUAGE plpgsql;

-- Rate limiting for admin endpoints
CREATE TABLE IF NOT EXISTS admin_rate_limits (
  admin_id UUID REFERENCES users(id),
  window_start TIMESTAMPTZ,
  attempts INTEGER DEFAULT 1,
  PRIMARY KEY (admin_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON admin_rate_limits(window_start);

-- Schema migrations tracking (if not exists)
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial migration if not exists
INSERT INTO schema_migrations (version) 
VALUES ('admin_analytics_v1') 
ON CONFLICT (version) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE admin_audit_log IS 'Audit log for all admin API requests';
COMMENT ON TABLE mv_refresh_log IS 'Tracking for materialized view refresh operations';
COMMENT ON TABLE admin_rate_limits IS 'Rate limiting for admin endpoints';
COMMENT ON MATERIALIZED VIEW mv_sessions_daily IS 'Daily session aggregates with privacy thresholds';
COMMENT ON FUNCTION refresh_admin_views() IS 'Refreshes all admin materialized views';

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON admin_audit_log TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON mv_refresh_log TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON admin_rate_limits TO your_app_user;
-- GRANT SELECT ON mv_sessions_daily TO your_app_user;
