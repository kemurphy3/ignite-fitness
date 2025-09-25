-- Exercises API Database Schema v1.0
-- Run this script to create the comprehensive session exercises management system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum for validated muscle groups
CREATE TYPE IF NOT EXISTS muscle_group AS ENUM (
    'chest', 'back', 'shoulders', 'biceps', 'triceps',
    'quadriceps', 'hamstrings', 'glutes', 'calves', 
    'abs', 'obliques', 'forearms', 'lats', 'traps'
);

-- Main exercises table
CREATE TABLE IF NOT EXISTS session_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Core exercise data
    name VARCHAR(100) NOT NULL,
    sets INTEGER NOT NULL CHECK (sets >= 1 AND sets <= 20),
    reps INTEGER NOT NULL CHECK (reps >= 1 AND reps <= 100),
    weight_kg DECIMAL(6,2) CHECK (weight_kg >= 0 AND weight_kg <= 500),
    rpe INTEGER CHECK (rpe >= 1 AND rpe <= 10),
    
    -- Optional advanced fields
    tempo VARCHAR(10), -- e.g., "3-1-2-0" (eccentric-pause-concentric-pause)
    rest_seconds INTEGER CHECK (rest_seconds >= 0 AND rest_seconds <= 600),
    notes TEXT,
    superset_group VARCHAR(10), -- e.g., "A", "B" for supersetting
    order_index INTEGER NOT NULL DEFAULT 0,
    
    -- Tracking fields
    equipment_type VARCHAR(50), -- barbell, dumbbell, machine, bodyweight, cable, etc.
    muscle_groups muscle_group[], -- validated enum array
    exercise_type VARCHAR(20) CHECK (exercise_type IN ('strength', 'cardio', 'flexibility', 'plyometric', 'isometric')),
    
    -- Idempotency
    request_hash VARCHAR(64), -- SHA-256 of request for deduplication
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_tempo CHECK (tempo ~ '^[0-9]-[0-9]-[0-9]-[0-9]$' OR tempo IS NULL),
    CONSTRAINT valid_name_length CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100),
    CONSTRAINT valid_notes_length CHECK (char_length(notes) <= 500 OR notes IS NULL),
    CONSTRAINT valid_superset_group CHECK (char_length(superset_group) <= 10 OR superset_group IS NULL),
    CONSTRAINT unique_request_hash UNIQUE(user_id, request_hash)
);

-- Optimized indexes for performance
CREATE INDEX IF NOT EXISTS idx_exercises_session_order ON session_exercises(session_id, order_index, created_at, id);
CREATE INDEX IF NOT EXISTS idx_exercises_user_id ON session_exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_exercises_request_hash ON session_exercises(user_id, request_hash) WHERE request_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exercises_superset ON session_exercises(session_id, superset_group) WHERE superset_group IS NOT NULL;

-- Exercise history for tracking changes
CREATE TABLE IF NOT EXISTS session_exercise_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id UUID NOT NULL,
    session_id UUID NOT NULL,
    user_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'bulk_create')),
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_by UUID
);

-- Composite index for history queries
CREATE INDEX IF NOT EXISTS idx_exercise_history_composite ON session_exercise_history(session_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_history_user ON session_exercise_history(user_id, changed_at DESC);

-- Sliding window rate limiting
CREATE TABLE IF NOT EXISTS exercise_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for sliding window queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_sliding ON exercise_rate_limits(user_id, endpoint, created_at DESC);

-- Cleanup old rate limit entries periodically
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON exercise_rate_limits(created_at) 
WHERE created_at < NOW() - INTERVAL '2 minutes';

-- Function to reindex exercises (fix gaps in order_index)
CREATE OR REPLACE FUNCTION reindex_session_exercises(p_session_id UUID)
RETURNS void AS $$
BEGIN
    WITH numbered AS (
        SELECT id, 
               ROW_NUMBER() OVER (ORDER BY order_index, created_at, id) - 1 as new_index
        FROM session_exercises
        WHERE session_id = p_session_id
    )
    UPDATE session_exercises e
    SET order_index = n.new_index
    FROM numbered n
    WHERE e.id = n.id;
END;
$$ LANGUAGE plpgsql;

-- Function for sliding window rate limiting
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id UUID,
    p_endpoint VARCHAR,
    p_limit INTEGER DEFAULT 60,
    p_window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, retry_after INTEGER) AS $$
DECLARE
    v_count INTEGER;
    v_oldest_timestamp TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Count requests in sliding window
    SELECT COUNT(*), MIN(created_at) 
    INTO v_count, v_oldest_timestamp
    FROM exercise_rate_limits
    WHERE user_id = p_user_id
      AND endpoint = p_endpoint
      AND created_at > NOW() - make_interval(secs => p_window_seconds);
    
    IF v_count >= p_limit THEN
        -- Calculate retry_after based on oldest request
        RETURN QUERY SELECT 
            false, 
            v_count,
            EXTRACT(EPOCH FROM (v_oldest_timestamp + make_interval(secs => p_window_seconds) - NOW()))::INTEGER;
    ELSE
        RETURN QUERY SELECT true, v_count, 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to generate request hash for idempotency
CREATE OR REPLACE FUNCTION generate_request_hash(
    p_user_id UUID,
    p_session_id UUID, 
    p_exercises JSONB
)
RETURNS VARCHAR AS $$
DECLARE
    v_data TEXT;
BEGIN
    -- Include date for daily deduplication
    v_data := p_user_id::TEXT || p_session_id::TEXT || 
              p_exercises::TEXT || CURRENT_DATE::TEXT;
    RETURN encode(digest(v_data, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain updated_at
CREATE OR REPLACE FUNCTION update_exercise_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_session_exercise_timestamp
BEFORE UPDATE ON session_exercises
FOR EACH ROW EXECUTE FUNCTION update_exercise_timestamp();

-- Helper function for cursor pagination (JSON-based)
CREATE OR REPLACE FUNCTION encode_cursor(p_order_index INTEGER, p_created_at TIMESTAMP WITH TIME ZONE, p_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_cursor JSONB;
BEGIN
    v_cursor := jsonb_build_object(
        'o', p_order_index,
        'c', p_created_at,
        'i', p_id,
        'v', 1  -- version for future changes
    );
    RETURN encode(v_cursor::text::bytea, 'base64');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decode_cursor(p_cursor TEXT)
RETURNS TABLE(order_index INTEGER, created_at TIMESTAMP WITH TIME ZONE, id UUID) AS $$
DECLARE
    v_json JSONB;
BEGIN
    v_json := convert_from(decode(p_cursor, 'base64'), 'UTF8')::JSONB;
    RETURN QUERY SELECT 
        (v_json->>'o')::INTEGER,
        (v_json->>'c')::TIMESTAMP WITH TIME ZONE,
        (v_json->>'i')::UUID;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE session_exercises IS 'Individual exercises within training sessions with comprehensive tracking';
COMMENT ON TABLE session_exercise_history IS 'Change tracking for all exercise modifications';
COMMENT ON TABLE exercise_rate_limits IS 'Sliding window rate limiting for exercise operations';
COMMENT ON TYPE muscle_group IS 'Validated muscle group categories for exercise classification';

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON session_exercises TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON session_exercise_history TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON exercise_rate_limits TO your_app_user;
