-- Strava Token Management Database Schema v1.0
-- Run this script to create the enhanced Strava token management tables

-- Strava tokens table with enhanced security
CREATE TABLE IF NOT EXISTS strava_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scope TEXT,
    athlete_id BIGINT,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    encryption_key_version INTEGER NOT NULL DEFAULT 1,
    last_validated_at TIMESTAMP WITH TIME ZONE,
    last_refresh_at TIMESTAMP WITH TIME ZONE,
    refresh_count INTEGER DEFAULT 0,
    refresh_lock_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_strava UNIQUE(user_id)
);

-- Audit logs with retention policy
CREATE TABLE IF NOT EXISTS strava_token_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for audit cleanup
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON strava_token_audit(created_at);

-- Rate limiting with sliding window
CREATE TABLE IF NOT EXISTS api_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    request_hash VARCHAR(64),
    CONSTRAINT unique_request UNIQUE(user_id, endpoint, request_hash)
);

-- Circuit breaker state
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
    service_name VARCHAR(100) PRIMARY KEY,
    state VARCHAR(20) NOT NULL DEFAULT 'CLOSED',
    failure_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    next_attempt_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Encryption key versions for rotation
CREATE TABLE IF NOT EXISTS encryption_keys (
    version INTEGER PRIMARY KEY,
    key_id VARCHAR(255) NOT NULL,
    algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    rotated_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Function for automatic audit log cleanup
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM strava_token_audit 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup job (if using pg_cron)
-- SELECT cron.schedule('cleanup-audit-logs', '0 2 * * *', 'SELECT cleanup_old_audit_logs();');

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_strava_tokens_user_id ON strava_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_strava_tokens_expires_at ON strava_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_strava_tokens_athlete_id ON strava_tokens(athlete_id);
CREATE INDEX IF NOT EXISTS idx_strava_tokens_refresh_lock ON strava_tokens(refresh_lock_until);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_user_endpoint ON api_rate_limits(user_id, endpoint);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_timestamp ON api_rate_limits(request_timestamp);

-- Add comments for documentation
COMMENT ON TABLE strava_tokens IS 'Encrypted Strava OAuth tokens with refresh management';
COMMENT ON TABLE strava_token_audit IS 'Audit trail for all token operations with 90-day retention';
COMMENT ON TABLE api_rate_limits IS 'Sliding window rate limiting with anomaly detection';
COMMENT ON TABLE circuit_breaker_state IS 'Circuit breaker state for external API calls';
COMMENT ON TABLE encryption_keys IS 'Encryption key versions for token security';

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to strava_tokens
DROP TRIGGER IF EXISTS update_strava_tokens_updated_at ON strava_tokens;
CREATE TRIGGER update_strava_tokens_updated_at 
    BEFORE UPDATE ON strava_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to circuit_breaker_state
DROP TRIGGER IF EXISTS update_circuit_breaker_updated_at ON circuit_breaker_state;
CREATE TRIGGER update_circuit_breaker_updated_at 
    BEFORE UPDATE ON circuit_breaker_state 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON strava_tokens TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON strava_token_audit TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON api_rate_limits TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON circuit_breaker_state TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON encryption_keys TO your_app_user;
