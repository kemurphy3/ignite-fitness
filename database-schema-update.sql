-- Database Schema Updates for Sessions API v1
-- Run this script to update your existing database schema

-- Add check constraints for session types and sources
ALTER TABLE sessions 
    ADD CONSTRAINT valid_session_type CHECK (
        type IN ('workout', 'soccer', 'climbing', 'recovery', 'cardio', 'strength', 'flexibility', 'sport_specific')
    ),
    ADD CONSTRAINT valid_session_source CHECK (
        source IN ('manual', 'strava', 'apple_health', 'garmin', 'whoop', 'import')
    );

-- Add deduplication support with session hash
ALTER TABLE sessions 
    ADD COLUMN session_hash VARCHAR(64) GENERATED ALWAYS AS (
        CASE 
            WHEN source_id IS NOT NULL THEN 
                encode(sha256((user_id || ':' || source || ':' || source_id)::bytea), 'hex')
            ELSE 
                encode(sha256((user_id || ':' || start_at || ':' || type)::bytea), 'hex')
        END
    ) STORED;

-- Create unique index for session hash
CREATE UNIQUE INDEX idx_sessions_hash ON sessions(session_hash);

-- Add payload size constraint
ALTER TABLE sessions 
    ADD CONSTRAINT payload_size_limit CHECK (
        octet_length(payload::text) <= 10240  -- 10KB limit
    );

-- Create API key authentication table
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
    id VARCHAR(255) PRIMARY KEY,  -- user_id:window
    count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 minute'
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON sessions(user_id, start_at DESC);
CREATE INDEX IF NOT EXISTS idx_exercises_session_name ON exercises(session_id, name);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- Update users table to match new profile structure
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS sex VARCHAR(10),
    ADD COLUMN IF NOT EXISTS goals JSONB,
    ADD COLUMN IF NOT EXISTS baseline_lifts JSONB;

-- Add constraints for user profile data
ALTER TABLE users 
    ADD CONSTRAINT valid_sex CHECK (sex IN ('male', 'female', 'other') OR sex IS NULL),
    ADD CONSTRAINT valid_age CHECK (age IS NULL OR (age >= 13 AND age <= 120)),
    ADD CONSTRAINT valid_weight CHECK (weight IS NULL OR (weight >= 20 AND weight <= 300)),
    ADD CONSTRAINT valid_height CHECK (height IS NULL OR (height >= 100 AND height <= 250));

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at 
    BEFORE UPDATE ON sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_exercises_updated_at ON exercises;
CREATE TRIGGER update_exercises_updated_at 
    BEFORE UPDATE ON exercises 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at 
    BEFORE UPDATE ON api_keys 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to clean up expired rate limits
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limits WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired rate limits (if using pg_cron)
-- SELECT cron.schedule('cleanup-rate-limits', '*/5 * * * *', 'SELECT cleanup_expired_rate_limits();');

-- Add comments for documentation
COMMENT ON TABLE api_keys IS 'API keys for authentication';
COMMENT ON TABLE rate_limits IS 'Rate limiting tracking per user per minute';
COMMENT ON COLUMN sessions.session_hash IS 'Unique hash for deduplication based on source_id or start_at+type';
COMMENT ON COLUMN sessions.payload IS 'JSON payload with additional session data (max 10KB)';
COMMENT ON COLUMN users.goals IS 'Array of user fitness goals (max 5 items)';
COMMENT ON COLUMN users.baseline_lifts IS 'JSON object with baseline strength measurements (max 1KB)';

-- Ensure program start date column exists and is populated
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS program_start_date DATE;

UPDATE user_profiles
SET program_start_date = COALESCE(program_start_date, CURRENT_DATE)
WHERE program_start_date IS NULL;

ALTER TABLE user_profiles
    ALTER COLUMN program_start_date SET NOT NULL;

ALTER TABLE user_profiles
    ALTER COLUMN program_start_date SET DEFAULT CURRENT_DATE;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limits TO your_app_user;
-- GRANT USAGE ON SEQUENCE api_keys_id_seq TO your_app_user;
