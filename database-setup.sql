-- IgniteFitness Database Schema for Neon Postgres
-- Run this in your Neon SQL editor

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sessions table (for workouts, soccer, climbing, etc.)
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL, -- 'workout', 'soccer', 'climbing', 'recovery', etc.
    source VARCHAR(50) DEFAULT 'manual', -- 'manual', 'strava', 'apple_health', 'whoop'
    source_id VARCHAR(255), -- External ID from the source
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE,
    timezone VARCHAR(50) DEFAULT 'America/Denver',
    payload JSONB, -- Flexible data storage for different session types
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create exercises table
CREATE TABLE IF NOT EXISTS exercises (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    weight DECIMAL(10,2),
    reps INTEGER,
    sets INTEGER,
    rpe INTEGER, -- Rate of Perceived Exertion
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sleep_sessions table
CREATE TABLE IF NOT EXISTS sleep_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(50) DEFAULT 'manual', -- 'manual', 'apple_health', 'garmin', 'whoop'
    source_id VARCHAR(255),
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deep_sleep_minutes INTEGER,
    rem_sleep_minutes INTEGER,
    light_sleep_minutes INTEGER,
    sleep_score INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create strava_activities table
CREATE TABLE IF NOT EXISTS strava_activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    strava_id BIGINT UNIQUE NOT NULL,
    name VARCHAR(255),
    type VARCHAR(100),
    distance DECIMAL(10,2),
    moving_time INTEGER, -- seconds
    elapsed_time INTEGER, -- seconds
    total_elevation_gain DECIMAL(10,2),
    start_date TIMESTAMP WITH TIME ZONE,
    timezone VARCHAR(50),
    average_speed DECIMAL(10,2),
    max_speed DECIMAL(10,2),
    average_heartrate DECIMAL(10,2),
    max_heartrate DECIMAL(10,2),
    calories INTEGER,
    payload JSONB, -- Full Strava activity data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    age INTEGER,
    weight DECIMAL(10,2),
    height DECIMAL(10,2),
    sex VARCHAR(10),
    goals TEXT[], -- Array of goal strings
    baseline_lifts JSONB, -- Baseline lift numbers
    workout_schedule JSONB, -- Weekly workout schedule
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_external_id ON users(external_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
CREATE INDEX IF NOT EXISTS idx_sessions_start_at ON sessions(start_at);
CREATE INDEX IF NOT EXISTS idx_exercises_user_id ON exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_exercises_session_id ON exercises(session_id);
CREATE INDEX IF NOT EXISTS idx_sleep_sessions_user_id ON sleep_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sleep_sessions_start_at ON sleep_sessions(start_at);
CREATE INDEX IF NOT EXISTS idx_strava_activities_user_id ON strava_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_strava_activities_strava_id ON strava_activities(strava_id);
CREATE INDEX IF NOT EXISTS idx_strava_activities_start_date ON strava_activities(start_date);

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_unique_source ON sessions(user_id, source, source_id) WHERE source_id IS NOT NULL;

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sleep_sessions_updated_at BEFORE UPDATE ON sleep_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_strava_activities_updated_at BEFORE UPDATE ON strava_activities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
