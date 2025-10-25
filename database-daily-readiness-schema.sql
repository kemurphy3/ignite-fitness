-- Daily Readiness Schema
-- Tracks daily check-in data with readiness score calculation

CREATE TABLE IF NOT EXISTS daily_readiness (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    sleep_hours DECIMAL(3,1),
    sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 10),
    stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10),
    energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 10),
    soreness_level INTEGER CHECK (soreness_level >= 1 AND soreness_level <= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Add computed readiness score column
ALTER TABLE daily_readiness
ADD COLUMN IF NOT EXISTS readiness_score INT
GENERATED ALWAYS AS (
    LEAST(10, GREATEST(1,
        CEIL( (COALESCE(energy_level,5) + 11 - COALESCE(stress_level,5)
              + COALESCE(sleep_quality,5) + 11 - COALESCE(soreness_level,5)) / 4 )
    ))
) STORED;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_daily_readiness_user_date ON daily_readiness(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_readiness_date ON daily_readiness(date);
CREATE INDEX IF NOT EXISTS idx_daily_readiness_readiness_score ON daily_readiness(readiness_score);

-- Create function to get readiness trend
CREATE OR REPLACE FUNCTION get_readiness_trend(
    p_user_id INTEGER,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    date DATE,
    readiness_score INTEGER,
    sleep_hours DECIMAL(3,1),
    energy_level INTEGER,
    stress_level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dr.date,
        dr.readiness_score,
        dr.sleep_hours,
        dr.energy_level,
        dr.stress_level
    FROM daily_readiness dr
    WHERE dr.user_id = p_user_id
        AND dr.date >= CURRENT_DATE - INTERVAL '1 day' * p_days
    ORDER BY dr.date DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get average readiness score
CREATE OR REPLACE FUNCTION get_average_readiness(
    p_user_id INTEGER,
    p_days INTEGER DEFAULT 7
)
RETURNS DECIMAL(3,2) AS $$
DECLARE
    avg_score DECIMAL(3,2);
BEGIN
    SELECT AVG(readiness_score)::DECIMAL(3,2)
    INTO avg_score
    FROM daily_readiness
    WHERE user_id = p_user_id
        AND date >= CURRENT_DATE - INTERVAL '1 day' * p_days;
    
    RETURN COALESCE(avg_score, 5.0);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_readiness TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION get_readiness_trend(INTEGER, INTEGER) TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION get_average_readiness(INTEGER, INTEGER) TO ignite_fitness_app;
