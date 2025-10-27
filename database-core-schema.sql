-- IgniteFitness Core Database Schema
-- PostgreSQL/Neon database initialization
-- Supports offline-first architecture with eventual sync

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id VARCHAR(255) PRIMARY KEY,
    profile_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Common profile fields indexed
    sport VARCHAR(50),
    position VARCHAR(50),
    aesthetic_goals VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_updated 
ON user_profiles(updated_at);

-- Readiness Logs Table
CREATE TABLE IF NOT EXISTS readiness_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    sleep_quality INTEGER,
    stress_level INTEGER,
    soreness_level INTEGER,
    energy_level INTEGER,
    readiness_score INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_readiness_logs_user_date 
ON readiness_logs(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_readiness_logs_date 
ON readiness_logs(date DESC);

-- Session Logs Table
CREATE TABLE IF NOT EXISTS session_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    
    workout_name VARCHAR(255),
    exercises JSONB,
    rpe_data JSONB,
    duration INTEGER,
    total_volume INTEGER,
    average_rpe DECIMAL(3,1),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_session_logs_user_date 
ON session_logs(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_session_logs_session_id 
ON session_logs(session_id);

-- Progression Events Table
CREATE TABLE IF NOT EXISTS progression_events (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    
    exercise VARCHAR(255),
    exercise_type VARCHAR(50),
    previous_weight DECIMAL(10,2),
    new_weight DECIMAL(10,2),
    previous_reps INTEGER,
    new_reps INTEGER,
    rpe DECIMAL(3,1),
    
    progression_type VARCHAR(50),
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_progression_events_user_date 
ON progression_events(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_progression_events_exercise 
ON progression_events(exercise);

-- Injury Flags Table
CREATE TABLE IF NOT EXISTS injury_flags (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    
    body_location VARCHAR(255),
    pain_level INTEGER,
    pain_type VARCHAR(50),
    exercise_name VARCHAR(255),
    modifications JSONB,
    suggestions TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_injury_flags_user_date 
ON injury_flags(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_injury_flags_location 
ON injury_flags(body_location);

-- Preferences Table
CREATE TABLE IF NOT EXISTS preferences (
    user_id VARCHAR(255) PRIMARY KEY,
    
    aesthetic_goals JSONB,
    equipment_prefs JSONB,
    notification_settings JSONB,
    display_prefs JSONB,
    integration_settings JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_preferences_updated 
ON preferences(updated_at);

-- Sync Queue Table (for offline-first architecture)
CREATE TABLE IF NOT EXISTS sync_queue (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_key VARCHAR(255) NOT NULL,
    operation VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    data JSONB NOT NULL,
    attempts INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending', -- pending, syncing, synced, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_user_status 
ON sync_queue(user_id, status);

CREATE INDEX IF NOT EXISTS idx_sync_queue_created 
ON sync_queue(created_at);

-- Sync Status Table
CREATE TABLE IF NOT EXISTS sync_status (
    user_id VARCHAR(255) PRIMARY KEY,
    is_online BOOLEAN DEFAULT false,
    last_sync_at TIMESTAMP,
    queue_length INTEGER DEFAULT 0,
    sync_in_progress BOOLEAN DEFAULT false,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration History Table
CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert current schema version
INSERT INTO migration_history (version, description) 
VALUES ('1.0.0', 'Initial IgniteFitness schema')
ON CONFLICT (version) DO NOTHING;

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at auto-update
CREATE TRIGGER update_user_profiles_updated_at 
BEFORE UPDATE ON user_profiles 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_readiness_logs_updated_at 
BEFORE UPDATE ON readiness_logs 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_logs_updated_at 
BEFORE UPDATE ON session_logs 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_progression_events_updated_at 
BEFORE UPDATE ON progression_events 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_injury_flags_updated_at 
BEFORE UPDATE ON injury_flags 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preferences_updated_at 
BEFORE UPDATE ON preferences 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
