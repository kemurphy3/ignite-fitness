-- Beta Safety Guardrails Schema
-- Supports load management, ramp rates, and safety overrides

-- Guardrails Configuration Table
CREATE TABLE IF NOT EXISTS guardrails_config (
    id SERIAL PRIMARY KEY,
    config_name VARCHAR(100) UNIQUE NOT NULL,
    training_level VARCHAR(20) NOT NULL, -- beginner, intermediate, advanced, elite

    -- Weekly load limits
    weekly_load_cap INTEGER NOT NULL,
    weekly_hard_minutes_cap INTEGER NOT NULL, -- Z4/Z5 minutes per week
    daily_load_cap INTEGER NOT NULL,

    -- Ramp rate limits (as decimal percentages)
    max_weekly_load_increase DECIMAL(3,2) NOT NULL, -- e.g., 0.10 for 10%
    max_weekly_volume_increase DECIMAL(3,2) NOT NULL,
    max_weekly_intensity_increase DECIMAL(3,2) NOT NULL,

    -- Recovery requirements
    min_hours_between_hard INTEGER NOT NULL, -- Hours between Z4/Z5 sessions
    max_consecutive_hard_days INTEGER NOT NULL,
    required_easy_days_per_week INTEGER NOT NULL,
    deload_frequency_weeks INTEGER NOT NULL,

    -- Injury prevention
    max_pain_threshold INTEGER NOT NULL, -- 1-10 scale, workout blocked above this
    high_soreness_threshold INTEGER NOT NULL, -- 1-10 scale, load reduction above this
    soreness_load_reduction DECIMAL(3,2) NOT NULL, -- Load reduction factor
    missed_days_auto_deload INTEGER NOT NULL, -- Auto-deload after X missed days

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Load Tracking Table (enhanced session tracking)
CREATE TABLE IF NOT EXISTS load_tracking (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),
    date DATE NOT NULL,

    -- Load calculations
    session_load INTEGER NOT NULL, -- Total session load score
    volume_load INTEGER, -- Volume-based load component
    intensity_load INTEGER, -- Intensity-based load component

    -- Time in zones (minutes with decimals for accuracy)
    z1_minutes DECIMAL(5,2) DEFAULT 0,
    z2_minutes DECIMAL(5,2) DEFAULT 0,
    z3_minutes DECIMAL(5,2) DEFAULT 0,
    z4_minutes DECIMAL(5,2) DEFAULT 0,
    z5_minutes DECIMAL(5,2) DEFAULT 0,

    -- Derived metrics
    hard_minutes DECIMAL(5,2) GENERATED ALWAYS AS (z4_minutes + z5_minutes) STORED,
    session_rpe DECIMAL(3,1), -- Overall session RPE (1-10)
    session_duration INTEGER, -- Total session minutes

    -- Modality and type
    modality VARCHAR(50) NOT NULL,
    session_type VARCHAR(50), -- planned, substituted, manual
    workout_template_id VARCHAR(100),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Safety Overrides Table
CREATE TABLE IF NOT EXISTS safety_overrides (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    override_date DATE NOT NULL,

    -- Override trigger
    trigger_type VARCHAR(50) NOT NULL, -- weekly_cap, ramp_rate, pain, soreness, recovery
    trigger_value DECIMAL(10,2), -- The value that triggered the override
    threshold_value DECIMAL(10,2), -- The threshold that was exceeded

    -- Override action
    action_taken VARCHAR(50) NOT NULL, -- block_workout, reduce_load, force_rest, deload_week
    load_reduction_factor DECIMAL(3,2), -- If load was reduced, by what factor

    -- User response
    user_acknowledged BOOLEAN DEFAULT false,
    user_override_accepted BOOLEAN, -- User accepted or rejected the override
    user_feedback TEXT,

    -- Workout context
    original_workout_id VARCHAR(100),
    modified_workout_id VARCHAR(100),
    planned_load INTEGER,
    actual_load INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Weekly Load Aggregates (materialized for performance)
CREATE TABLE IF NOT EXISTS weekly_load_aggregates (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    week_start_date DATE NOT NULL,

    -- Aggregate metrics
    total_load INTEGER NOT NULL DEFAULT 0,
    total_hard_minutes DECIMAL(6,2) NOT NULL DEFAULT 0,
    total_sessions INTEGER NOT NULL DEFAULT 0,
    avg_session_rpe DECIMAL(3,1),

    -- By modality
    running_load INTEGER DEFAULT 0,
    cycling_load INTEGER DEFAULT 0,
    swimming_load INTEGER DEFAULT 0,
    other_load INTEGER DEFAULT 0,

    -- Trend indicators
    vs_previous_week_load DECIMAL(4,1), -- Percentage change
    vs_previous_week_hard DECIMAL(4,1), -- Percentage change
    ramp_rate_warning BOOLEAN DEFAULT false,

    -- Readiness indicators
    avg_readiness_score DECIMAL(3,1),
    avg_soreness_level DECIMAL(3,1),
    missed_sessions INTEGER DEFAULT 0,

    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, week_start_date)
);

-- Indexes for fast guardrail checks
CREATE INDEX IF NOT EXISTS idx_guardrails_config_level ON guardrails_config(training_level);
CREATE INDEX IF NOT EXISTS idx_guardrails_config_active ON guardrails_config(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_load_tracking_user_date ON load_tracking(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_load_tracking_user_week ON load_tracking(user_id, date)
WHERE date >= CURRENT_DATE - INTERVAL '7 days';
CREATE INDEX IF NOT EXISTS idx_load_tracking_hard_sessions ON load_tracking(user_id, date DESC)
WHERE hard_minutes > 0;
CREATE INDEX IF NOT EXISTS idx_load_tracking_modality ON load_tracking(modality);
CREATE INDEX IF NOT EXISTS idx_load_tracking_session_type ON load_tracking(session_type);

CREATE INDEX IF NOT EXISTS idx_safety_overrides_user ON safety_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_overrides_date ON safety_overrides(override_date DESC);
CREATE INDEX IF NOT EXISTS idx_safety_overrides_trigger ON safety_overrides(trigger_type);
CREATE INDEX IF NOT EXISTS idx_safety_overrides_unresolved ON safety_overrides(resolved_at)
WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_weekly_aggregates_user_date ON weekly_load_aggregates(user_id, week_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_aggregates_warnings ON weekly_load_aggregates(ramp_rate_warning)
WHERE ramp_rate_warning = true;

-- Foreign key constraints
ALTER TABLE load_tracking
ADD CONSTRAINT fk_load_tracking_user
FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;

ALTER TABLE safety_overrides
ADD CONSTRAINT fk_safety_overrides_user
FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;

ALTER TABLE weekly_load_aggregates
ADD CONSTRAINT fk_weekly_aggregates_user
FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_guardrails_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_guardrails_config_updated_at
    BEFORE UPDATE ON guardrails_config
    FOR EACH ROW EXECUTE FUNCTION update_guardrails_config_updated_at();

-- Migration version tracking
INSERT INTO migration_history (version, description)
VALUES ('beta-1.2', 'Safety guardrails and load management schema')
ON CONFLICT (version) DO NOTHING;

