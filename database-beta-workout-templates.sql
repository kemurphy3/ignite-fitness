-- Beta Workout Templates Schema
-- Supports multi-sport workout catalog with zone-based training

-- Workout Templates Table
CREATE TABLE IF NOT EXISTS workout_templates (
    id SERIAL PRIMARY KEY,
    template_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    modality VARCHAR(50) NOT NULL, -- running, cycling, swimming
    category VARCHAR(50) NOT NULL, -- track, tempo, hills, endurance, vo2, etc
    adaptation VARCHAR(255) NOT NULL, -- Primary training adaptation
    estimated_load INTEGER NOT NULL, -- Estimated training load score
    time_required INTEGER NOT NULL, -- Minutes
    difficulty_level VARCHAR(20) DEFAULT 'intermediate', -- beginner, intermediate, advanced, elite
    equipment_required JSONB DEFAULT '[]'::JSONB, -- Required equipment array
    description TEXT,
    structure JSONB NOT NULL, -- Workout block structure
    tags JSONB DEFAULT '[]'::JSONB, -- Searchable tags

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Workout Blocks Table (for structured workout components)
CREATE TABLE IF NOT EXISTS workout_blocks (
    id SERIAL PRIMARY KEY,
    template_id VARCHAR(100) NOT NULL,
    block_order INTEGER NOT NULL,
    block_type VARCHAR(50) NOT NULL, -- warmup, main, cooldown, rest
    duration INTEGER, -- Minutes for continuous blocks
    sets INTEGER, -- Number of sets for interval blocks
    work_duration INTEGER, -- Work interval duration (seconds)
    rest_duration INTEGER, -- Rest interval duration (seconds)
    intensity VARCHAR(10) NOT NULL, -- Z1, Z2, Z3, Z4, Z5
    distance INTEGER, -- Distance in meters (optional)
    description TEXT,

    FOREIGN KEY (template_id) REFERENCES workout_templates(template_id) ON DELETE CASCADE
);

-- Training Adaptations Reference Table
CREATE TABLE IF NOT EXISTS training_adaptations (
    id SERIAL PRIMARY KEY,
    adaptation_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    primary_zones JSONB, -- Primary intensity zones for this adaptation
    modalities JSONB, -- Applicable modalities

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_workout_templates_modality ON workout_templates(modality);
CREATE INDEX IF NOT EXISTS idx_workout_templates_category ON workout_templates(modality, category);
CREATE INDEX IF NOT EXISTS idx_workout_templates_difficulty ON workout_templates(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_workout_templates_load ON workout_templates(estimated_load);
CREATE INDEX IF NOT EXISTS idx_workout_templates_time ON workout_templates(time_required);
CREATE INDEX IF NOT EXISTS idx_workout_templates_active ON workout_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workout_templates_equipment ON workout_templates USING GIN(equipment_required);
CREATE INDEX IF NOT EXISTS idx_workout_templates_tags ON workout_templates USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_workout_blocks_template ON workout_blocks(template_id);
CREATE INDEX IF NOT EXISTS idx_workout_blocks_order ON workout_blocks(template_id, block_order);
CREATE INDEX IF NOT EXISTS idx_workout_blocks_intensity ON workout_blocks(intensity);
CREATE INDEX IF NOT EXISTS idx_workout_blocks_type ON workout_blocks(block_type);

-- Insert standard training adaptations
INSERT INTO training_adaptations (adaptation_name, description, primary_zones, modalities) VALUES
('Aerobic Base', 'Low-intensity aerobic capacity building', '["Z1", "Z2"]', '["running", "cycling", "swimming"]'),
('Lactate Threshold', 'Tempo and threshold power/pace development', '["Z3"]', '["running", "cycling", "swimming"]'),
('VO2 Max', 'Maximal oxygen uptake development', '["Z4", "Z5"]', '["running", "cycling", "swimming"]'),
('Neuromuscular Power', 'Short, high-intensity power development', '["Z5"]', '["running", "cycling", "swimming"]'),
('Speed Endurance', 'Sustained high-intensity efforts', '["Z4"]', '["running", "cycling"]'),
('Agility', 'Change of direction and coordination', '["Z3", "Z4"]', '["running"]'),
('Strength Endurance', 'Muscular endurance under load', '["Z2", "Z3"]', '["cycling", "swimming"]'),
('Recovery', 'Active recovery and regeneration', '["Z1"]', '["running", "cycling", "swimming"]')
ON CONFLICT (adaptation_name) DO NOTHING;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_workout_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workout_templates_updated_at
    BEFORE UPDATE ON workout_templates
    FOR EACH ROW EXECUTE FUNCTION update_workout_templates_updated_at();

-- Migration version tracking
INSERT INTO migration_history (version, description)
VALUES ('beta-1.0', 'Workout templates and blocks schema')
ON CONFLICT (version) DO NOTHING;

