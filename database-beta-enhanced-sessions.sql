-- Beta Enhanced Sessions Schema
-- Extends existing session tracking with multi-sport and substitution support

-- Enhanced Session Logs (extends existing session_logs)
CREATE TABLE IF NOT EXISTS session_enhancements (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL, -- Links to existing session_logs
    user_id VARCHAR(255) NOT NULL,

    -- Workout source tracking
    workout_template_id VARCHAR(100), -- Original template if used
    was_substituted BOOLEAN DEFAULT false,
    original_template_id VARCHAR(100), -- If substituted, original template
    substitution_reason TEXT,

    -- Enhanced metrics
    modality VARCHAR(50) NOT NULL,
    primary_adaptation VARCHAR(100),
    session_category VARCHAR(50), -- track, tempo, hills, endurance, vo2, etc

    -- Zone time tracking (minutes with decimals for accuracy)
    planned_z1_minutes DECIMAL(5,2) DEFAULT 0,
    planned_z2_minutes DECIMAL(5,2) DEFAULT 0,
    planned_z3_minutes DECIMAL(5,2) DEFAULT 0,
    planned_z4_minutes DECIMAL(5,2) DEFAULT 0,
    planned_z5_minutes DECIMAL(5,2) DEFAULT 0,

    actual_z1_minutes DECIMAL(5,2) DEFAULT 0,
    actual_z2_minutes DECIMAL(5,2) DEFAULT 0,
    actual_z3_minutes DECIMAL(5,2) DEFAULT 0,
    actual_z4_minutes DECIMAL(5,2) DEFAULT 0,
    actual_z5_minutes DECIMAL(5,2) DEFAULT 0,

    -- Load calculations
    planned_load INTEGER,
    actual_load INTEGER,
    load_variance DECIMAL(4,3), -- (actual - planned) / planned

    -- Execution quality
    completion_percentage DECIMAL(5,2) DEFAULT 100.0, -- % of planned workout completed
    early_termination_reason TEXT,
    perceived_difficulty INTEGER, -- 1-10 scale vs planned

    -- Equipment and constraints used
    equipment_used JSONB DEFAULT '[]'::JSONB,
    time_constraints_applied BOOLEAN DEFAULT false,
    weather_conditions JSONB,

    -- Safety and readiness context
    pre_session_readiness INTEGER, -- 1-10 scale
    post_session_fatigue INTEGER, -- 1-10 scale
    safety_overrides_triggered JSONB DEFAULT '[]'::JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Zone Target Definitions (universal zone system)
CREATE TABLE IF NOT EXISTS zone_definitions (
    id SERIAL PRIMARY KEY,
    zone_name VARCHAR(10) NOT NULL, -- Z1, Z2, Z3, Z4, Z5
    zone_number INTEGER NOT NULL,

    -- Physiological descriptions
    description TEXT NOT NULL,
    physiological_marker TEXT,
    perceived_exertion_range VARCHAR(10), -- e.g., "6-7 RPE"

    -- Heart rate percentages (if available)
    hr_percent_min INTEGER, -- % of max HR
    hr_percent_max INTEGER,

    -- Power/pace percentages (sport-specific)
    power_percent_min INTEGER, -- % of FTP/threshold
    power_percent_max INTEGER,

    -- Lactate ranges (if available)
    lactate_min DECIMAL(3,1), -- mmol/L
    lactate_max DECIMAL(3,1),

    -- Training applications
    primary_adaptations JSONB, -- Array of adaptations
    typical_durations JSONB, -- Typical duration ranges by modality

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Completed Session Summary View (for dashboard)
CREATE OR REPLACE VIEW completed_sessions_summary AS
SELECT
    sl.id,
    sl.user_id,
    sl.session_id,
    sl.date,
    sl.workout_name,
    sl.duration,
    sl.average_rpe,

    -- Enhanced data
    se.modality,
    se.primary_adaptation,
    se.session_category,
    se.was_substituted,
    se.planned_load,
    se.actual_load,
    se.load_variance,
    se.completion_percentage,

    -- Zone distribution
    se.actual_z1_minutes + se.actual_z2_minutes + se.actual_z3_minutes +
    se.actual_z4_minutes + se.actual_z5_minutes AS total_zone_minutes,
    se.actual_z4_minutes + se.actual_z5_minutes AS hard_minutes,

    -- Load tracking linkage
    lt.session_load AS calculated_load

FROM session_logs sl
LEFT JOIN session_enhancements se ON sl.session_id = se.session_id
LEFT JOIN load_tracking lt ON sl.session_id = lt.session_id
WHERE sl.date >= CURRENT_DATE - INTERVAL '90 days'; -- Last 90 days for performance

-- Indexes for enhanced session tracking
CREATE INDEX IF NOT EXISTS idx_session_enhancements_session ON session_enhancements(session_id);
CREATE INDEX IF NOT EXISTS idx_session_enhancements_user_date ON session_enhancements(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_enhancements_modality ON session_enhancements(modality);
CREATE INDEX IF NOT EXISTS idx_session_enhancements_category ON session_enhancements(session_category);
CREATE INDEX IF NOT EXISTS idx_session_enhancements_substituted ON session_enhancements(was_substituted)
WHERE was_substituted = true;
CREATE INDEX IF NOT EXISTS idx_session_enhancements_template ON session_enhancements(workout_template_id);
CREATE INDEX IF NOT EXISTS idx_session_enhancements_load_variance ON session_enhancements(load_variance);

CREATE INDEX IF NOT EXISTS idx_zone_definitions_zone ON zone_definitions(zone_name);
CREATE INDEX IF NOT EXISTS idx_zone_definitions_number ON zone_definitions(zone_number);

-- Foreign key constraints
ALTER TABLE session_enhancements
ADD CONSTRAINT fk_session_enhancements_user
FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;

-- Add reference to workout templates if exists
ALTER TABLE session_enhancements
ADD CONSTRAINT fk_session_enhancements_template
FOREIGN KEY (workout_template_id) REFERENCES workout_templates(template_id) ON DELETE SET NULL;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_session_enhancements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_session_enhancements_updated_at
    BEFORE UPDATE ON session_enhancements
    FOR EACH ROW EXECUTE FUNCTION update_session_enhancements_updated_at();

-- Migration version tracking
INSERT INTO migration_history (version, description)
VALUES ('beta-1.3', 'Enhanced session tracking with multi-sport support')
ON CONFLICT (version) DO NOTHING;

