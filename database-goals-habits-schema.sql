-- Goals and Habits Schema
-- Tracks user goals, milestones, and habit formation

-- User goals table
CREATE TABLE IF NOT EXISTS user_goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(50) NOT NULL, -- 'strength', 'endurance', 'body_composition'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    current_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    target_value DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    deadline DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    milestones JSONB DEFAULT '[]'::jsonb
);

-- Habit tracking table
CREATE TABLE IF NOT EXISTS habit_tracking (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    workout_completed BOOLEAN DEFAULT false,
    workout_count INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_workouts INTEGER DEFAULT 0,
    weekly_count INTEGER DEFAULT 0,
    week_start DATE,
    achievements_earned TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- User events table for audit trail
CREATE TABLE IF NOT EXISTS user_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    kind TEXT NOT NULL, -- 'workout_completed', 'goal_created', 'milestone_achieved', etc.
    payload JSONB DEFAULT '{}'::jsonb
);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    achievement_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    reward TEXT,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- Goal milestones table
CREATE TABLE IF NOT EXISTS goal_milestones (
    id SERIAL PRIMARY KEY,
    goal_id INTEGER REFERENCES user_goals(id) ON DELETE CASCADE,
    value DECIMAL(10,2) NOT NULL,
    percentage INTEGER NOT NULL,
    reward TEXT,
    achieved BOOLEAN DEFAULT false,
    achieved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_goals_user ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_active ON user_goals(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_goals_type ON user_goals(type);
CREATE INDEX IF NOT EXISTS idx_habit_tracking_user_date ON habit_tracking(user_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_tracking_streak ON habit_tracking(user_id, current_streak);
CREATE INDEX IF NOT EXISTS idx_user_events_user ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_kind ON user_events(kind);
CREATE INDEX IF NOT EXISTS idx_user_events_occurred_at ON user_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal ON goal_milestones(goal_id);

-- Create function to get user streak data
CREATE OR REPLACE FUNCTION get_user_streak_data(p_user_id INTEGER)
RETURNS TABLE (
    current_streak INTEGER,
    longest_streak INTEGER,
    total_workouts INTEGER,
    this_week_workouts INTEGER,
    last_workout_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ht.current_streak,
        ht.longest_streak,
        ht.total_workouts,
        ht.weekly_count,
        ht.date
    FROM habit_tracking ht
    WHERE ht.user_id = p_user_id
        AND ht.date = (
            SELECT MAX(date) 
            FROM habit_tracking 
            WHERE user_id = p_user_id
        );
END;
$$ LANGUAGE plpgsql;

-- Create function to get user goal progress
CREATE OR REPLACE FUNCTION get_user_goal_progress(p_user_id INTEGER)
RETURNS TABLE (
    goal_id INTEGER,
    title VARCHAR(255),
    current_value DECIMAL(10,2),
    target_value DECIMAL(10,2),
    progress_percentage DECIMAL(5,2),
    days_remaining INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ug.id,
        ug.title,
        ug.current_value,
        ug.target_value,
        ug.progress_percentage,
        CASE 
            WHEN ug.deadline IS NOT NULL THEN 
                EXTRACT(DAYS FROM ug.deadline - CURRENT_DATE)::INTEGER
            ELSE NULL
        END as days_remaining
    FROM user_goals ug
    WHERE ug.user_id = p_user_id
        AND ug.is_active = true
    ORDER BY ug.progress_percentage DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user achievements
CREATE OR REPLACE FUNCTION get_user_achievements(p_user_id INTEGER)
RETURNS TABLE (
    achievement_id VARCHAR(50),
    name VARCHAR(255),
    description TEXT,
    reward TEXT,
    unlocked_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.achievement_id,
        a.name,
        a.description,
        a.reward,
        a.unlocked_at
    FROM achievements a
    WHERE a.user_id = p_user_id
    ORDER BY a.unlocked_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if user has workout streak
CREATE OR REPLACE FUNCTION has_workout_streak(p_user_id INTEGER, p_days INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    streak_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO streak_count
    FROM habit_tracking
    WHERE user_id = p_user_id
        AND date >= CURRENT_DATE - INTERVAL '1 day' * p_days
        AND workout_completed = true;
    
    RETURN streak_count >= p_days;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user habit strength
CREATE OR REPLACE FUNCTION get_habit_strength(p_user_id INTEGER)
RETURNS TEXT AS $$
DECLARE
    current_streak INTEGER;
BEGIN
    SELECT current_streak INTO current_streak
    FROM habit_tracking
    WHERE user_id = p_user_id
        AND date = (
            SELECT MAX(date) 
            FROM habit_tracking 
            WHERE user_id = p_user_id
        );
    
    IF current_streak IS NULL THEN
        RETURN 'Starting';
    ELSIF current_streak >= 100 THEN
        RETURN 'Unstoppable';
    ELSIF current_streak >= 30 THEN
        RETURN 'Strong';
    ELSIF current_streak >= 7 THEN
        RETURN 'Forming';
    ELSIF current_streak >= 3 THEN
        RETURN 'Building';
    ELSE
        RETURN 'Starting';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to get weekly progress
CREATE OR REPLACE FUNCTION get_weekly_progress(p_user_id INTEGER)
RETURNS TABLE (
    week_start DATE,
    workouts_completed INTEGER,
    weekly_goal INTEGER,
    progress_percentage DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ht.week_start,
        ht.weekly_count,
        3 as weekly_goal, -- Default weekly goal
        ROUND((ht.weekly_count::DECIMAL / 3) * 100, 2) as progress_percentage
    FROM habit_tracking ht
    WHERE ht.user_id = p_user_id
        AND ht.week_start = (
            SELECT MAX(week_start) 
            FROM habit_tracking 
            WHERE user_id = p_user_id
        );
END;
$$ LANGUAGE plpgsql;

-- Create function to get goal completion rate
CREATE OR REPLACE FUNCTION get_goal_completion_rate(p_user_id INTEGER)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    total_goals INTEGER;
    completed_goals INTEGER;
    completion_rate DECIMAL(5,2);
BEGIN
    SELECT COUNT(*) INTO total_goals
    FROM user_goals
    WHERE user_id = p_user_id;
    
    SELECT COUNT(*) INTO completed_goals
    FROM user_goals
    WHERE user_id = p_user_id
        AND completed_at IS NOT NULL;
    
    IF total_goals = 0 THEN
        completion_rate := 0;
    ELSE
        completion_rate := ROUND((completed_goals::DECIMAL / total_goals) * 100, 2);
    END IF;
    
    RETURN completion_rate;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user motivation score
CREATE OR REPLACE FUNCTION get_motivation_score(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    streak_score INTEGER;
    goal_score INTEGER;
    achievement_score INTEGER;
    total_score INTEGER;
BEGIN
    -- Streak score (0-40 points)
    SELECT LEAST(40, current_streak * 2) INTO streak_score
    FROM habit_tracking
    WHERE user_id = p_user_id
        AND date = (
            SELECT MAX(date) 
            FROM habit_tracking 
            WHERE user_id = p_user_id
        );
    
    -- Goal score (0-30 points)
    SELECT LEAST(30, COUNT(*) * 5) INTO goal_score
    FROM user_goals
    WHERE user_id = p_user_id
        AND is_active = true;
    
    -- Achievement score (0-30 points)
    SELECT LEAST(30, COUNT(*) * 3) INTO achievement_score
    FROM achievements
    WHERE user_id = p_user_id;
    
    -- Calculate total score
    total_score := COALESCE(streak_score, 0) + COALESCE(goal_score, 0) + COALESCE(achievement_score, 0);
    
    RETURN LEAST(100, total_score);
END;
$$ LANGUAGE plpgsql;

-- External Activities Table
CREATE TABLE IF NOT EXISTS external_activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    source VARCHAR(50) NOT NULL, -- 'strava', 'apple_health', 'garmin'
    external_id VARCHAR(255) NOT NULL,
    activity_type VARCHAR(50),
    start_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    distance_meters DECIMAL(10,2),
    calories INTEGER,
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    training_stress_score DECIMAL(10,2),
    recovery_debt_hours DECIMAL(5,2),
    perceived_exertion INTEGER,
    source_load NUMERIC, -- rTSS/hrTSS or heuristic
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source, external_id)
);

-- Training Load Table
CREATE TABLE IF NOT EXISTS training_load (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    internal_load DECIMAL(10,2) DEFAULT 0,
    external_load DECIMAL(10,2) DEFAULT 0,
    total_load DECIMAL(10,2) DEFAULT 0,
    recovery_debt DECIMAL(5,2) DEFAULT 0,
    readiness_score DECIMAL(3,2) DEFAULT 1.0,
    risk_level VARCHAR(20) DEFAULT 'low',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Create indexes for external activities
CREATE INDEX IF NOT EXISTS idx_external_activities_user ON external_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_external_activities_source ON external_activities(source);
CREATE INDEX IF NOT EXISTS idx_external_activities_start_time ON external_activities(start_time);
CREATE INDEX IF NOT EXISTS idx_external_activities_type ON external_activities(activity_type);

-- Create indexes for training load
CREATE INDEX IF NOT EXISTS idx_training_load_user ON training_load(user_id);
CREATE INDEX IF NOT EXISTS idx_training_load_date ON training_load(date);

-- Create function to get user's external activities
CREATE OR REPLACE FUNCTION get_user_external_activities(p_user_id INTEGER, p_days INTEGER DEFAULT 7)
RETURNS TABLE (
    activity_id INTEGER,
    source VARCHAR(50),
    activity_type VARCHAR(50),
    start_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    distance_meters DECIMAL(10,2),
    training_stress_score DECIMAL(10,2),
    recovery_debt_hours DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ea.id,
        ea.source,
        ea.activity_type,
        ea.start_time,
        ea.duration_seconds,
        ea.distance_meters,
        ea.training_stress_score,
        ea.recovery_debt_hours
    FROM external_activities ea
    WHERE ea.user_id = p_user_id
        AND ea.start_time >= CURRENT_DATE - INTERVAL '1 day' * p_days
    ORDER BY ea.start_time DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's training load summary
CREATE OR REPLACE FUNCTION get_user_load_summary(p_user_id INTEGER, p_days INTEGER DEFAULT 7)
RETURNS TABLE (
    total_internal_load DECIMAL(10,2),
    total_external_load DECIMAL(10,2),
    total_load DECIMAL(10,2),
    avg_daily_load DECIMAL(10,2),
    peak_daily_load DECIMAL(10,2),
    total_recovery_debt DECIMAL(5,2),
    avg_readiness DECIMAL(3,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(tl.internal_load), 0) as total_internal_load,
        COALESCE(SUM(tl.external_load), 0) as total_external_load,
        COALESCE(SUM(tl.total_load), 0) as total_load,
        COALESCE(AVG(tl.total_load), 0) as avg_daily_load,
        COALESCE(MAX(tl.total_load), 0) as peak_daily_load,
        COALESCE(SUM(tl.recovery_debt), 0) as total_recovery_debt,
        COALESCE(AVG(tl.readiness_score), 1.0) as avg_readiness
    FROM training_load tl
    WHERE tl.user_id = p_user_id
        AND tl.date >= CURRENT_DATE - INTERVAL '1 day' * p_days;
END;
$$ LANGUAGE plpgsql;

-- Create function to check for overtraining risk
CREATE OR REPLACE FUNCTION check_overtraining_risk(p_user_id INTEGER)
RETURNS TABLE (
    risk_level VARCHAR(20),
    risk_score INTEGER,
    factors TEXT[],
    recommendation TEXT
) AS $$
DECLARE
    recent_load DECIMAL(10,2);
    recent_recovery DECIMAL(5,2);
    risk_score INTEGER := 0;
    risk_factors TEXT[] := '{}';
BEGIN
    -- Get recent load and recovery data
    SELECT 
        COALESCE(SUM(tl.total_load), 0),
        COALESCE(SUM(tl.recovery_debt), 0)
    INTO recent_load, recent_recovery
    FROM training_load tl
    WHERE tl.user_id = p_user_id
        AND tl.date >= CURRENT_DATE - INTERVAL '7 days';
    
    -- Calculate risk factors
    IF recent_load > 400 THEN
        risk_score := risk_score + 3;
        risk_factors := array_append(risk_factors, 'High training load');
    ELSIF recent_load > 300 THEN
        risk_score := risk_score + 2;
        risk_factors := array_append(risk_factors, 'Moderate-high training load');
    END IF;
    
    IF recent_recovery > 48 THEN
        risk_score := risk_score + 3;
        risk_factors := array_append(risk_factors, 'High recovery debt');
    ELSIF recent_recovery > 24 THEN
        risk_score := risk_score + 2;
        risk_factors := array_append(risk_factors, 'Moderate recovery debt');
    END IF;
    
    -- Determine risk level
    RETURN QUERY
    SELECT 
        CASE 
            WHEN risk_score >= 5 THEN 'high'
            WHEN risk_score >= 3 THEN 'medium'
            ELSE 'low'
        END as risk_level,
        risk_score,
        risk_factors,
        CASE 
            WHEN risk_score >= 5 THEN 'High overtraining risk - reduce training load immediately'
            WHEN risk_score >= 3 THEN 'Medium overtraining risk - monitor recovery and adjust if needed'
            ELSE 'Low overtraining risk - maintain current training'
        END as recommendation;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_goals TO ignite_fitness_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON habit_tracking TO ignite_fitness_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_events TO ignite_fitness_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON achievements TO ignite_fitness_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON goal_milestones TO ignite_fitness_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON external_activities TO ignite_fitness_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON training_load TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION get_user_streak_data(INTEGER) TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION get_user_goal_progress(INTEGER) TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION get_user_achievements(INTEGER) TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION has_workout_streak(INTEGER, INTEGER) TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION get_habit_strength(INTEGER) TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION get_weekly_progress(INTEGER) TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION get_goal_completion_rate(INTEGER) TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION get_motivation_score(INTEGER) TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION get_user_external_activities(INTEGER, INTEGER) TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION get_user_load_summary(INTEGER, INTEGER) TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION check_overtraining_risk(INTEGER) TO ignite_fitness_app;
