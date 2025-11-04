-- Beta Substitution Engine Schema
-- Supports AI-powered cross-modality workout substitutions

-- Substitution Rules Table
CREATE TABLE IF NOT EXISTS substitution_rules (
    id SERIAL PRIMARY KEY,
    rule_id VARCHAR(100) UNIQUE NOT NULL,
    from_modality VARCHAR(50) NOT NULL,
    to_modality VARCHAR(50) NOT NULL,
    from_zone VARCHAR(10) NOT NULL, -- Z1, Z2, Z3, Z4, Z5
    to_zone VARCHAR(10) NOT NULL,
    time_factor DECIMAL(4,2) NOT NULL, -- Duration conversion factor
    load_factor DECIMAL(4,2) NOT NULL, -- Load conversion factor
    confidence_score DECIMAL(3,2) DEFAULT 0.85, -- Rule confidence (0-1)

    -- Conditional factors
    min_duration INTEGER, -- Minimum duration for rule to apply (minutes)
    max_duration INTEGER, -- Maximum duration for rule to apply (minutes)
    equipment_required JSONB DEFAULT '[]'::JSONB,
    user_level VARCHAR(20), -- beginner, intermediate, advanced, elite

    -- Metadata
    description TEXT,
    research_citation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Modality Conversion Factors Table
CREATE TABLE IF NOT EXISTS modality_factors (
    id SERIAL PRIMARY KEY,
    from_modality VARCHAR(50) NOT NULL,
    to_modality VARCHAR(50) NOT NULL,
    base_time_factor DECIMAL(4,2) NOT NULL, -- Base conversion without zone adjustment
    met_ratio DECIMAL(4,2) NOT NULL, -- MET value ratio between modalities
    biomechanical_factor DECIMAL(4,2) DEFAULT 1.0, -- Biomechanical efficiency adjustment

    -- Zone-specific adjustments
    z1_adjustment DECIMAL(3,2) DEFAULT 0.0,
    z2_adjustment DECIMAL(3,2) DEFAULT 0.0,
    z3_adjustment DECIMAL(3,2) DEFAULT 0.0,
    z4_adjustment DECIMAL(3,2) DEFAULT 0.0,
    z5_adjustment DECIMAL(3,2) DEFAULT 0.0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(from_modality, to_modality)
);

-- Substitution History Table
CREATE TABLE IF NOT EXISTS substitution_history (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    original_workout_id VARCHAR(100),
    substituted_workout_id VARCHAR(100),
    substitution_rule_id VARCHAR(100),

    -- Original workout details
    original_modality VARCHAR(50) NOT NULL,
    original_duration INTEGER NOT NULL,
    original_load INTEGER NOT NULL,

    -- Substituted workout details
    substituted_modality VARCHAR(50) NOT NULL,
    substituted_duration INTEGER NOT NULL,
    substituted_load INTEGER NOT NULL,

    -- Accuracy tracking
    load_variance DECIMAL(4,3), -- Actual vs predicted load variance
    user_rating INTEGER, -- User satisfaction rating (1-5)
    completion_status VARCHAR(20), -- completed, partial, skipped

    -- Context
    substitution_reason TEXT,
    equipment_constraint BOOLEAN DEFAULT false,
    time_constraint BOOLEAN DEFAULT false,
    readiness_constraint BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast substitution lookups
CREATE INDEX IF NOT EXISTS idx_substitution_rules_modalities ON substitution_rules(from_modality, to_modality);
CREATE INDEX IF NOT EXISTS idx_substitution_rules_zones ON substitution_rules(from_zone, to_zone);
CREATE INDEX IF NOT EXISTS idx_substitution_rules_active ON substitution_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_substitution_rules_duration ON substitution_rules(min_duration, max_duration);
CREATE INDEX IF NOT EXISTS idx_substitution_rules_level ON substitution_rules(user_level);

CREATE INDEX IF NOT EXISTS idx_modality_factors_conversion ON modality_factors(from_modality, to_modality);

CREATE INDEX IF NOT EXISTS idx_substitution_history_user ON substitution_history(user_id);
CREATE INDEX IF NOT EXISTS idx_substitution_history_date ON substitution_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_substitution_history_modalities ON substitution_history(original_modality, substituted_modality);
CREATE INDEX IF NOT EXISTS idx_substitution_history_completion ON substitution_history(completion_status);

-- Foreign key constraints
ALTER TABLE substitution_history
ADD CONSTRAINT fk_substitution_history_user
FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_substitution_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_substitution_rules_updated_at
    BEFORE UPDATE ON substitution_rules
    FOR EACH ROW EXECUTE FUNCTION update_substitution_rules_updated_at();

-- Migration version tracking
INSERT INTO migration_history (version, description)
VALUES ('beta-1.1', 'Substitution engine and modality conversion schema')
ON CONFLICT (version) DO NOTHING;

