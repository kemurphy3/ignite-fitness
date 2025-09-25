-- User Preferences Settings Database Schema v1.0
-- Run this script to create the comprehensive user preferences system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create user_preferences table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Core preferences
    timezone VARCHAR(100),
    units VARCHAR(10) DEFAULT 'imperial' CHECK (units IN ('metric', 'imperial')),
    sleep_goal_hours DECIMAL(3,1) CHECK (sleep_goal_hours >= 0 AND sleep_goal_hours <= 14),
    workout_goal_per_week INTEGER CHECK (workout_goal_per_week >= 0 AND workout_goal_per_week <= 14),
    notifications_enabled BOOLEAN DEFAULT true,
    theme VARCHAR(16) DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
    
    -- Schema versioning
    schema_version INTEGER DEFAULT 1,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one preferences row per user
    CONSTRAINT user_preferences_user_id_unique UNIQUE (user_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Add comments for documentation
COMMENT ON TABLE user_preferences IS 'User preferences and settings for personalization';
COMMENT ON COLUMN user_preferences.timezone IS 'IANA timezone string (e.g., America/Denver)';
COMMENT ON COLUMN user_preferences.units IS 'Measurement units: metric or imperial';
COMMENT ON COLUMN user_preferences.sleep_goal_hours IS 'Target sleep hours per night (0-14)';
COMMENT ON COLUMN user_preferences.workout_goal_per_week IS 'Target workouts per week (0-14)';
COMMENT ON COLUMN user_preferences.notifications_enabled IS 'Global notification preference';
COMMENT ON COLUMN user_preferences.theme IS 'UI theme preference: system, light, or dark';
COMMENT ON COLUMN user_preferences.schema_version IS 'Schema version for future migrations';

-- Function to get or create user preferences with defaults
CREATE OR REPLACE FUNCTION get_or_create_user_preferences(p_user_id UUID)
RETURNS TABLE (
    timezone VARCHAR(100),
    units VARCHAR(10),
    sleep_goal_hours DECIMAL(3,1),
    workout_goal_per_week INTEGER,
    notifications_enabled BOOLEAN,
    theme VARCHAR(16)
) AS $$
BEGIN
    -- Try to get existing preferences
    RETURN QUERY
    SELECT 
        up.timezone,
        up.units,
        up.sleep_goal_hours,
        up.workout_goal_per_week,
        up.notifications_enabled,
        up.theme
    FROM user_preferences up
    WHERE up.user_id = p_user_id;
    
    -- If no preferences found, create with defaults
    IF NOT FOUND THEN
        INSERT INTO user_preferences (
            user_id,
            timezone,
            units,
            sleep_goal_hours,
            workout_goal_per_week,
            notifications_enabled,
            theme
        ) VALUES (
            p_user_id,
            NULL, -- timezone - client falls back to browser detection
            'imperial', -- units
            8.0, -- sleep_goal_hours
            3, -- workout_goal_per_week
            true, -- notifications_enabled
            'system' -- theme
        );
        
        -- Return the newly created preferences
        RETURN QUERY
        SELECT 
            up.timezone,
            up.units,
            up.sleep_goal_hours,
            up.workout_goal_per_week,
            up.notifications_enabled,
            up.theme
        FROM user_preferences up
        WHERE up.user_id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update user preferences atomically
CREATE OR REPLACE FUNCTION update_user_preferences(
    p_user_id UUID,
    p_timezone VARCHAR(100) DEFAULT NULL,
    p_units VARCHAR(10) DEFAULT NULL,
    p_sleep_goal_hours DECIMAL(3,1) DEFAULT NULL,
    p_workout_goal_per_week INTEGER DEFAULT NULL,
    p_notifications_enabled BOOLEAN DEFAULT NULL,
    p_theme VARCHAR(16) DEFAULT NULL
)
RETURNS TABLE (
    timezone VARCHAR(100),
    units VARCHAR(10),
    sleep_goal_hours DECIMAL(3,1),
    workout_goal_per_week INTEGER,
    notifications_enabled BOOLEAN,
    theme VARCHAR(16)
) AS $$
BEGIN
    -- Atomic upsert with only provided fields
    RETURN QUERY
    INSERT INTO user_preferences (
        user_id,
        timezone,
        units,
        sleep_goal_hours,
        workout_goal_per_week,
        notifications_enabled,
        theme
    ) VALUES (
        p_user_id,
        p_timezone,
        p_units,
        p_sleep_goal_hours,
        p_workout_goal_per_week,
        p_notifications_enabled,
        p_theme
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        timezone = COALESCE(EXCLUDED.timezone, user_preferences.timezone),
        units = COALESCE(EXCLUDED.units, user_preferences.units),
        sleep_goal_hours = COALESCE(EXCLUDED.sleep_goal_hours, user_preferences.sleep_goal_hours),
        workout_goal_per_week = COALESCE(EXCLUDED.workout_goal_per_week, user_preferences.workout_goal_per_week),
        notifications_enabled = COALESCE(EXCLUDED.notifications_enabled, user_preferences.notifications_enabled),
        theme = COALESCE(EXCLUDED.theme, user_preferences.theme),
        updated_at = NOW()
    RETURNING 
        user_preferences.timezone,
        user_preferences.units,
        user_preferences.sleep_goal_hours,
        user_preferences.workout_goal_per_week,
        user_preferences.notifications_enabled,
        user_preferences.theme;
END;
$$ LANGUAGE plpgsql;

-- Function to validate timezone
CREATE OR REPLACE FUNCTION is_valid_timezone(p_timezone VARCHAR(100))
RETURNS BOOLEAN AS $$
BEGIN
    -- NULL is valid (client falls back to browser detection)
    IF p_timezone IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Check if it's a valid IANA timezone
    -- This is a simplified check - in production, you might want to use
    -- a more comprehensive timezone validation
    RETURN p_timezone ~ '^[A-Za-z_/]+$' AND length(p_timezone) <= 100;
END;
$$ LANGUAGE plpgsql;

-- Function to round sleep goal to 0.1 precision
CREATE OR REPLACE FUNCTION round_sleep_goal(p_hours DECIMAL)
RETURNS DECIMAL(3,1) AS $$
BEGIN
    IF p_hours IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Round to 0.1 precision
    RETURN ROUND(p_hours * 10) / 10;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_preferences TO your_app_user;
-- GRANT EXECUTE ON FUNCTION get_or_create_user_preferences(UUID) TO your_app_user;
-- GRANT EXECUTE ON FUNCTION update_user_preferences(UUID, VARCHAR, VARCHAR, DECIMAL, INTEGER, BOOLEAN, VARCHAR) TO your_app_user;
-- GRANT EXECUTE ON FUNCTION is_valid_timezone(VARCHAR) TO your_app_user;
-- GRANT EXECUTE ON FUNCTION round_sleep_goal(DECIMAL) TO your_app_user;
