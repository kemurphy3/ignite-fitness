-- User Profiles Database Schema v1.0
-- Run this script to create the comprehensive user profile management system

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User profiles table with comprehensive validation
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    program_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Demographics (validated)
    age INTEGER CHECK (age >= 13 AND age <= 120),
    height_cm DECIMAL(5,2) CHECK (height_cm >= 50 AND height_cm <= 300),
    weight_kg DECIMAL(5,2) CHECK (weight_kg >= 20 AND weight_kg <= 500),
    sex VARCHAR(20) CHECK (sex IN ('male', 'female', 'other', 'prefer_not_to_say')),
    
    -- Unit preferences
    preferred_units VARCHAR(20) DEFAULT 'metric' CHECK (preferred_units IN ('metric', 'imperial')),
    
    -- Goals (multi-select stored as JSONB with size limits)
    goals JSONB DEFAULT '[]'::JSONB,
    goal_priorities JSONB DEFAULT '{}'::JSONB,
    
    -- Baseline lifts (all in kg)
    bench_press_max DECIMAL(5,2) CHECK (bench_press_max >= 0 AND bench_press_max <= 500),
    squat_max DECIMAL(5,2) CHECK (squat_max >= 0 AND squat_max <= 500),
    deadlift_max DECIMAL(5,2) CHECK (deadlift_max >= 0 AND deadlift_max <= 500),
    overhead_press_max DECIMAL(5,2) CHECK (overhead_press_max >= 0 AND overhead_press_max <= 300),
    
    -- Additional baseline metrics
    pull_ups_max INTEGER CHECK (pull_ups_max >= 0 AND pull_ups_max <= 100),
    push_ups_max INTEGER CHECK (push_ups_max >= 0 AND push_ups_max <= 500),
    mile_time_seconds INTEGER CHECK (mile_time_seconds >= 240 AND mile_time_seconds <= 1800),
    
    -- Calculated fields (cached)
    bmi DECIMAL(4,2) GENERATED ALWAYS AS (
        CASE 
            WHEN height_cm IS NOT NULL AND weight_kg IS NOT NULL 
            THEN weight_kg / POWER(height_cm / 100, 2)
            ELSE NULL 
        END
    ) STORED,
    
    total_lifts DECIMAL(6,2) GENERATED ALWAYS AS (
        COALESCE(bench_press_max, 0) + 
        COALESCE(squat_max, 0) + 
        COALESCE(deadlift_max, 0)
    ) STORED,
    
    -- Profile completeness
    completeness_score INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN age IS NOT NULL THEN 10 ELSE 0 END +
            CASE WHEN height_cm IS NOT NULL THEN 10 ELSE 0 END +
            CASE WHEN weight_kg IS NOT NULL THEN 10 ELSE 0 END +
            CASE WHEN sex IS NOT NULL THEN 10 ELSE 0 END +
            CASE WHEN jsonb_array_length(goals) > 0 THEN 20 ELSE 0 END +
            CASE WHEN bench_press_max IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN squat_max IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN deadlift_max IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN overhead_press_max IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN pull_ups_max IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN push_ups_max IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN mile_time_seconds IS NOT NULL THEN 10 ELSE 0 END
    ) STORED,
    
    -- Metadata
    version INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_modified_by UUID,
    
    -- Constraints
    CONSTRAINT unique_user_profile UNIQUE(user_id),
    CONSTRAINT valid_goals CHECK (jsonb_typeof(goals) = 'array'),
    CONSTRAINT valid_goal_priorities CHECK (jsonb_typeof(goal_priorities) = 'object'),
    CONSTRAINT goals_size_limit CHECK (pg_column_size(goals) <= 4096),
    CONSTRAINT priorities_size_limit CHECK (pg_column_size(goal_priorities) <= 2048),
    CONSTRAINT valid_lift_relationships CHECK (
        (deadlift_max IS NULL OR squat_max IS NULL) OR 
        deadlift_max >= squat_max * 0.7 -- Deadlift typically higher than squat
    )
);

-- Profile history with field-level tracking
CREATE TABLE IF NOT EXISTS user_profile_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_data JSONB NOT NULL,
    version INTEGER NOT NULL,
    changed_fields JSONB NOT NULL, -- Store old and new values
    change_reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    request_id UUID -- Link to request tracking
);

-- Request tracking for deduplication and rate limiting
CREATE TABLE IF NOT EXISTS profile_update_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_hash VARCHAR(64) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    endpoint VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_request UNIQUE(user_id, request_hash)
);

-- Rate limiting tracking
CREATE TABLE IF NOT EXISTS profile_rate_limits (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hour_bucket TIMESTAMP WITH TIME ZONE NOT NULL,
    update_count INTEGER DEFAULT 1,
    PRIMARY KEY (user_id, hour_bucket)
);

-- Valid goals enum table
CREATE TABLE IF NOT EXISTS valid_goals (
    id VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    conflicting_goals TEXT[], -- Array of goal IDs that conflict
    is_active BOOLEAN DEFAULT true
);

-- Insert standard fitness goals with conflict mappings
INSERT INTO valid_goals (id, display_name, category, description, conflicting_goals) VALUES
('lose_weight', 'Lose Weight', 'body_composition', 'Reduce body weight through fat loss', ARRAY['bulk_muscle']),
('gain_muscle', 'Gain Muscle', 'body_composition', 'Increase lean muscle mass', ARRAY['lose_weight_fast']),
('bulk_muscle', 'Bulk Muscle', 'body_composition', 'Maximum muscle gain with some fat', ARRAY['lose_weight', 'improve_endurance']),
('lose_weight_fast', 'Rapid Weight Loss', 'body_composition', 'Aggressive caloric deficit', ARRAY['gain_muscle', 'increase_strength']),
('improve_endurance', 'Improve Endurance', 'performance', 'Enhance cardiovascular endurance', ARRAY['bulk_muscle']),
('increase_strength', 'Increase Strength', 'performance', 'Build maximum strength', ARRAY['lose_weight_fast']),
('improve_flexibility', 'Improve Flexibility', 'wellness', 'Enhance range of motion', NULL),
('reduce_stress', 'Reduce Stress', 'wellness', 'Manage stress through exercise', NULL),
('train_for_event', 'Train for Event', 'performance', 'Prepare for specific competition', NULL),
('general_fitness', 'General Fitness', 'wellness', 'Maintain overall health', NULL),
('rehabilitation', 'Rehabilitation', 'wellness', 'Recover from injury', ARRAY['train_for_event']),
('sports_performance', 'Sports Performance', 'performance', 'Enhance athletic performance', NULL)
ON CONFLICT (id) DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_history_composite ON user_profile_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_history_version ON user_profile_history(user_id, version);
CREATE INDEX IF NOT EXISTS idx_update_requests_user_time ON profile_update_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_bucket ON profile_rate_limits(hour_bucket);

-- Row-level security policies using JWT auth
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS profile_owner_policy ON user_profiles
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

ALTER TABLE user_profile_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS history_owner_policy ON user_profile_history
    FOR SELECT
    USING (user_id = auth.uid());

-- Trigger for updating timestamp and history with field tracking
CREATE OR REPLACE FUNCTION update_profile_timestamp()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields JSONB;
    old_json JSONB;
    new_json JSONB;
BEGIN
    -- Only increment version on actual changes
    IF OLD IS DISTINCT FROM NEW THEN
        NEW.updated_at = NOW();
        NEW.version = OLD.version + 1;
        
        -- Calculate changed fields with old and new values
        old_json := to_jsonb(OLD);
        new_json := to_jsonb(NEW);
        
        SELECT jsonb_object_agg(key, jsonb_build_object(
            'old', old_json->key,
            'new', new_json->key
        ))
        INTO changed_fields
        FROM jsonb_object_keys(new_json) AS key
        WHERE old_json->key IS DISTINCT FROM new_json->key
        AND key NOT IN ('updated_at', 'version');
        
        -- Record history if there are actual field changes
        IF changed_fields IS NOT NULL AND changed_fields != '{}'::jsonb THEN
            INSERT INTO user_profile_history (
                user_id,
                profile_data,
                version,
                changed_fields,
                created_by,
                request_id
            ) VALUES (
                NEW.user_id,
                old_json,
                OLD.version,
                changed_fields,
                NEW.last_modified_by,
                current_setting('app.request_id', true)::UUID
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_user_profile_timestamp
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_profile_timestamp();

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_profile_rate_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_hour TIMESTAMP WITH TIME ZONE;
    update_count INTEGER;
BEGIN
    current_hour := date_trunc('hour', NOW());
    
    SELECT COUNT(*) INTO update_count
    FROM profile_update_requests
    WHERE user_id = p_user_id
    AND created_at >= current_hour;
    
    RETURN update_count < 10; -- Allow 10 updates per hour
END;
$$ LANGUAGE plpgsql;

-- Function to validate goal conflicts
CREATE OR REPLACE FUNCTION validate_goal_conflicts(p_goals JSONB)
RETURNS TABLE(conflict_pair TEXT[]) AS $$
BEGIN
    RETURN QUERY
    SELECT ARRAY[g1.id, g2.id]
    FROM jsonb_array_elements_text(p_goals) AS goal1(id)
    JOIN valid_goals g1 ON g1.id = goal1.id
    JOIN jsonb_array_elements_text(p_goals) AS goal2(id) ON goal1.id < goal2.id
    JOIN valid_goals g2 ON g2.id = goal2.id
    WHERE g1.id = ANY(g2.conflicting_goals) OR g2.id = ANY(g1.conflicting_goals);
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE user_profiles IS 'User fitness profiles with comprehensive validation and calculated metrics';
COMMENT ON TABLE user_profile_history IS 'Field-level change tracking for profile updates';
COMMENT ON TABLE profile_update_requests IS 'Request deduplication and rate limiting tracking';
COMMENT ON TABLE profile_rate_limits IS 'Hourly rate limiting for profile updates';
COMMENT ON TABLE valid_goals IS 'Valid fitness goals with conflict detection';

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_profile_history TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON profile_update_requests TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON profile_rate_limits TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON valid_goals TO your_app_user;
