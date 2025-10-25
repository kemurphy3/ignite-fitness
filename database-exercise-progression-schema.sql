-- Exercise Progression Schema
-- Tracks exercise progression, preferences, and adaptations

-- Add progression columns to exercises table
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS
    progression_notes TEXT,
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    weight_floor DECIMAL(5,2) DEFAULT 0,
    weight_ceiling DECIMAL(5,2) DEFAULT 1000,
    rep_scheme JSONB DEFAULT '{"min": 1, "max": 20, "progression": [8, 10, 12]}'::jsonb;

-- Create exercise preferences table
CREATE TABLE IF NOT EXISTS exercise_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    exercise_name VARCHAR(255) NOT NULL,
    preference VARCHAR(20) CHECK (preference IN ('avoid', 'prefer', 'neutral')),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, exercise_name)
);

-- Create exercise progression history table
CREATE TABLE IF NOT EXISTS exercise_progression (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    exercise_name VARCHAR(255) NOT NULL,
    session_date DATE NOT NULL,
    weight DECIMAL(5,2),
    reps INTEGER,
    sets INTEGER,
    rpe INTEGER CHECK (rpe >= 1 AND rpe <= 10),
    progression_type VARCHAR(20) CHECK (progression_type IN ('weight_increase', 'weight_decrease', 'rep_increase', 'rep_decrease', 'maintenance')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create exercise feedback table
CREATE TABLE IF NOT EXISTS exercise_feedback (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    exercise_name VARCHAR(255) NOT NULL,
    session_date DATE NOT NULL,
    feedback_type VARCHAR(20) CHECK (feedback_type IN ('pain', 'easy', 'hard', 'boring', 'hate', 'love')),
    feedback_text TEXT,
    suggested_alternative VARCHAR(255),
    action_taken VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workout adaptations table
CREATE TABLE IF NOT EXISTS workout_adaptations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    original_workout_id INTEGER,
    adaptation_type VARCHAR(20) CHECK (adaptation_type IN ('time_optimization', 'exercise_substitution', 'intensity_adjustment', 'equipment_change')),
    original_exercise VARCHAR(255),
    adapted_exercise VARCHAR(255),
    reason TEXT,
    time_saved INTEGER, -- minutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_exercise_preferences_user ON exercise_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_preferences_exercise ON exercise_preferences(exercise_name);
CREATE INDEX IF NOT EXISTS idx_exercise_progression_user_date ON exercise_progression(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_exercise_progression_exercise ON exercise_progression(exercise_name);
CREATE INDEX IF NOT EXISTS idx_exercise_feedback_user_date ON exercise_feedback(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_exercise_feedback_type ON exercise_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_workout_adaptations_user ON workout_adaptations(user_id);

-- Create function to get exercise progression trend
CREATE OR REPLACE FUNCTION get_exercise_progression_trend(
    p_user_id INTEGER,
    p_exercise_name VARCHAR(255),
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    session_date DATE,
    weight DECIMAL(5,2),
    reps INTEGER,
    rpe INTEGER,
    progression_type VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ep.session_date,
        ep.weight,
        ep.reps,
        ep.rpe,
        ep.progression_type
    FROM exercise_progression ep
    WHERE ep.user_id = p_user_id
        AND ep.exercise_name = p_exercise_name
        AND ep.session_date >= CURRENT_DATE - INTERVAL '1 day' * p_days
    ORDER BY ep.session_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user exercise preferences
CREATE OR REPLACE FUNCTION get_user_exercise_preferences(
    p_user_id INTEGER
)
RETURNS TABLE (
    exercise_name VARCHAR(255),
    preference VARCHAR(20),
    reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ep.exercise_name,
        ep.preference,
        ep.reason
    FROM exercise_preferences ep
    WHERE ep.user_id = p_user_id
    ORDER BY ep.updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate exercise progression rate
CREATE OR REPLACE FUNCTION calculate_exercise_progression_rate(
    p_user_id INTEGER,
    p_exercise_name VARCHAR(255),
    p_days INTEGER DEFAULT 30
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    progression_rate DECIMAL(5,2);
    start_weight DECIMAL(5,2);
    end_weight DECIMAL(5,2);
BEGIN
    -- Get starting weight
    SELECT weight INTO start_weight
    FROM exercise_progression
    WHERE user_id = p_user_id
        AND exercise_name = p_exercise_name
        AND session_date >= CURRENT_DATE - INTERVAL '1 day' * p_days
    ORDER BY session_date ASC
    LIMIT 1;
    
    -- Get ending weight
    SELECT weight INTO end_weight
    FROM exercise_progression
    WHERE user_id = p_user_id
        AND exercise_name = p_exercise_name
        AND session_date >= CURRENT_DATE - INTERVAL '1 day' * p_days
    ORDER BY session_date DESC
    LIMIT 1;
    
    -- Calculate progression rate
    IF start_weight IS NOT NULL AND end_weight IS NOT NULL AND start_weight > 0 THEN
        progression_rate := ((end_weight - start_weight) / start_weight) * 100;
    ELSE
        progression_rate := 0;
    END IF;
    
    RETURN COALESCE(progression_rate, 0);
END;
$$ LANGUAGE plpgsql;

-- Create function to suggest exercise alternatives
CREATE OR REPLACE FUNCTION suggest_exercise_alternatives(
    p_user_id INTEGER,
    p_exercise_name VARCHAR(255),
    p_feedback_type VARCHAR(20)
)
RETURNS TABLE (
    alternative_name VARCHAR(255),
    difficulty_adjustment VARCHAR(20),
    equipment_required VARCHAR(50),
    reason TEXT
) AS $$
BEGIN
    -- This would typically query a more sophisticated exercise database
    -- For now, return basic alternatives based on feedback type
    RETURN QUERY
    SELECT 
        CASE 
            WHEN p_feedback_type = 'pain' OR p_feedback_type = 'hard' THEN 'Safer Alternative'
            WHEN p_feedback_type = 'easy' THEN 'Harder Variation'
            WHEN p_feedback_type = 'boring' OR p_feedback_type = 'hate' THEN 'Different Exercise'
            ELSE 'Similar Exercise'
        END as alternative_name,
        CASE 
            WHEN p_feedback_type = 'pain' OR p_feedback_type = 'hard' THEN 'easier'
            WHEN p_feedback_type = 'easy' THEN 'harder'
            ELSE 'similar'
        END as difficulty_adjustment,
        'Same Equipment' as equipment_required,
        'Suggested based on your feedback' as reason;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON exercise_preferences TO ignite_fitness_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON exercise_progression TO ignite_fitness_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON exercise_feedback TO ignite_fitness_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON workout_adaptations TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION get_exercise_progression_trend(INTEGER, VARCHAR(255), INTEGER) TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION get_user_exercise_preferences(INTEGER) TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION calculate_exercise_progression_rate(INTEGER, VARCHAR(255), INTEGER) TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION suggest_exercise_alternatives(INTEGER, VARCHAR(255), VARCHAR(20)) TO ignite_fitness_app;
