-- Strava Activity Import Database Schema v1.0
-- Run this script to create the comprehensive Strava activity import system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Integration sync state table with resume support
CREATE TABLE IF NOT EXISTS integrations_strava (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Sync state
    last_import_after TEXT, -- String to avoid JS precision loss
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_status VARCHAR(20) CHECK (last_status IN ('success', 'partial', 'failed', 'in_progress')),
    last_error TEXT,
    last_error_code VARCHAR(50),
    
    -- Resume support
    import_in_progress BOOLEAN DEFAULT false,
    import_continue_token TEXT, -- Base64 encoded resume state
    import_started_at TIMESTAMP WITH TIME ZONE,
    
    -- Statistics
    total_imported INTEGER DEFAULT 0,
    total_duplicates INTEGER DEFAULT 0,
    total_updated INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_user_strava UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_integrations_strava_user ON integrations_strava(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_strava_status ON integrations_strava(last_status);

-- Track all Strava activities for orphan detection
CREATE TABLE IF NOT EXISTS strava_activity_cache (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id BIGINT NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activity_version TEXT, -- Track Strava's version for update detection
    PRIMARY KEY (user_id, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_cache_last_seen ON strava_activity_cache(user_id, last_seen);

-- Extend sessions table for Strava data with timezone support
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS source_id VARCHAR(100);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS external_url TEXT;

-- Timezone-aware date fields
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS utc_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS timezone_offset INTEGER; -- Minutes from UTC

-- Duration fields
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS elapsed_duration INTEGER; -- Total time including stops

-- Rich payload storage
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS payload JSONB;

-- Add constraints for deduplication
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS unique_external_activity;
ALTER TABLE sessions ADD CONSTRAINT unique_external_activity 
    UNIQUE(user_id, source, source_id);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_sessions_source ON sessions(user_id, source, source_id) 
    WHERE source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_source_date ON sessions(user_id, source, utc_date DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_payload_version ON sessions((payload->>'version')) 
    WHERE source = 'strava';

-- Activity import log for debugging/audit
CREATE TABLE IF NOT EXISTS strava_import_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    run_id UUID NOT NULL,
    
    -- Request details
    requested_after TEXT,
    requested_per_page INTEGER,
    continue_token TEXT,
    
    -- Response details
    page_number INTEGER,
    activities_fetched INTEGER,
    activities_imported INTEGER,
    activities_duplicate INTEGER,
    activities_updated INTEGER,
    activities_failed INTEGER,
    
    -- Errors
    errors JSONB,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    timed_out BOOLEAN DEFAULT false,
    
    CONSTRAINT check_counts CHECK (
        activities_fetched >= activities_imported + activities_duplicate + activities_updated + activities_failed
    )
);

CREATE INDEX IF NOT EXISTS idx_import_log_user_run ON strava_import_log(user_id, run_id);
CREATE INDEX IF NOT EXISTS idx_import_log_created ON strava_import_log(started_at DESC);

-- Comprehensive sport type mapping
CREATE OR REPLACE FUNCTION map_strava_sport_type(sport_type TEXT)
RETURNS VARCHAR AS $$
BEGIN
    RETURN CASE sport_type
        -- Running
        WHEN 'Run' THEN 'run'
        WHEN 'TrailRun' THEN 'run'
        WHEN 'VirtualRun' THEN 'run'
        
        -- Cycling  
        WHEN 'Ride' THEN 'cardio'
        WHEN 'VirtualRide' THEN 'cardio'
        WHEN 'EBikeRide' THEN 'cardio'
        WHEN 'MountainBikeRide' THEN 'cardio'
        WHEN 'GravelRide' THEN 'cardio'
        
        -- Water
        WHEN 'Swim' THEN 'cardio'
        WHEN 'Kayaking' THEN 'cardio'
        WHEN 'Canoeing' THEN 'cardio'
        WHEN 'Surfing' THEN 'cardio'
        WHEN 'StandUpPaddling' THEN 'cardio'
        WHEN 'Rowing' THEN 'cardio'
        
        -- Gym
        WHEN 'Workout' THEN 'workout'
        WHEN 'WeightTraining' THEN 'workout'
        WHEN 'Crossfit' THEN 'workout'
        
        -- Flexibility
        WHEN 'Yoga' THEN 'flexibility'
        WHEN 'Pilates' THEN 'flexibility'
        
        -- Walking/Hiking
        WHEN 'Walk' THEN 'cardio'
        WHEN 'Hike' THEN 'cardio'
        
        -- Winter sports
        WHEN 'AlpineSki' THEN 'cardio'
        WHEN 'BackcountrySki' THEN 'cardio'
        WHEN 'NordicSki' THEN 'cardio'
        WHEN 'Snowboard' THEN 'cardio'
        WHEN 'Snowshoe' THEN 'cardio'
        WHEN 'IceSkate' THEN 'cardio'
        
        -- Team sports
        WHEN 'Soccer' THEN 'cardio'
        WHEN 'Basketball' THEN 'cardio'
        WHEN 'Tennis' THEN 'cardio'
        WHEN 'Squash' THEN 'cardio'
        WHEN 'Badminton' THEN 'cardio'
        WHEN 'Golf' THEN 'cardio'
        
        -- Default
        ELSE 'cardio'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to clean up orphaned activities
CREATE OR REPLACE FUNCTION cleanup_orphaned_strava_activities(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions
    WHERE user_id = p_user_id
    AND source = 'strava'
    AND source_id NOT IN (
        SELECT activity_id::TEXT 
        FROM strava_activity_cache
        WHERE user_id = p_user_id
        AND last_seen > NOW() - INTERVAL '1 hour'
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE integrations_strava IS 'Strava integration sync state with resume support';
COMMENT ON TABLE strava_activity_cache IS 'Cache of Strava activities for orphan detection';
COMMENT ON TABLE strava_import_log IS 'Detailed log of Strava import operations';
COMMENT ON FUNCTION map_strava_sport_type(TEXT) IS 'Maps Strava sport types to internal session types';
COMMENT ON FUNCTION cleanup_orphaned_strava_activities(UUID) IS 'Removes activities no longer present on Strava';

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON integrations_strava TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON strava_activity_cache TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON strava_import_log TO your_app_user;
