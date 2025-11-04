-- Beta Soccer-Shape Workouts Schema
-- Adds soccer-shape workout templates to workout_templates table

-- Note: This migration assumes workout_templates table already exists from database-beta-workout-templates.sql
-- If not, run database-beta-workout-templates.sql first

-- Insert soccer-shape workout templates
INSERT INTO workout_templates (
    template_id, name, modality, category, adaptation,
    estimated_load, time_required, difficulty_level,
    equipment_required, description, structure, tags, is_active
) VALUES
-- Track Sessions
(
    'soccer_track_12x200m',
    'Track 12x200m Speed Endurance',
    'running',
    'soccer_shape',
    'speed_endurance, lactate_tolerance, neuromuscular_power',
    85,
    45,
    'intermediate',
    '["track", "stopwatch"]'::jsonb,
    '12x200m intervals at 85-90% effort with 90s recovery. Develops speed endurance and lactate tolerance for repeated high-intensity efforts.',
    '[
        {"block_type": "warmup", "duration": 15, "intensity": "Z1", "description": "15min easy jog + dynamic drills"},
        {"block_type": "main", "sets": 12, "work_duration": 60, "rest_duration": 90, "intensity": "Z4", "distance": 200, "description": "12 x 200m at 85-90% effort, 90s recovery"},
        {"block_type": "cooldown", "duration": 10, "intensity": "Z1", "description": "10min easy jog + stretching"}
    ]'::jsonb,
    '["track", "speed_endurance", "lactate_tolerance", "anaerobic_capacity", "soccer_shape"]'::jsonb,
    true
),
(
    'soccer_track_6x300m',
    'Track 6x300m Speed Endurance',
    'running',
    'soccer_shape',
    'speed_endurance, lactate_tolerance, anaerobic_capacity',
    88,
    50,
    'intermediate',
    '["track", "stopwatch"]'::jsonb,
    '6x300m intervals at 90-95% effort with 2:30 recovery. Develops speed endurance and anaerobic capacity.',
    '[
        {"block_type": "warmup", "duration": 15, "intensity": "Z1", "description": "15min easy jog + dynamic drills"},
        {"block_type": "main", "sets": 6, "work_duration": 75, "rest_duration": 150, "intensity": "Z4", "distance": 300, "description": "6 x 300m at 90-95% effort, 2:30 recovery"},
        {"block_type": "cooldown", "duration": 10, "intensity": "Z1", "description": "10min easy jog + stretching"}
    ]'::jsonb,
    '["track", "speed_endurance", "lactate_tolerance", "anaerobic_capacity", "soccer_shape"]'::jsonb,
    true
),
(
    'soccer_track_100m_floats',
    'Track 10-20x100m Float-Sprint',
    'running',
    'soccer_shape',
    'speed, neuromuscular_power, acceleration',
    75,
    40,
    'intermediate',
    '["track", "stopwatch"]'::jsonb,
    '10-20x100m float-sprint alternations. Sprint 100m at 95% effort, float 100m at 70% effort, continuous. Develops speed and neuromuscular power.',
    '[
        {"block_type": "warmup", "duration": 15, "intensity": "Z1", "description": "15min easy jog + dynamic drills"},
        {"block_type": "main", "sets": 15, "work_duration": 18, "rest_duration": 18, "intensity": "Z5-Z3", "distance": 100, "description": "15 x 100m sprint (95% effort) / 100m float (70% effort), continuous"},
        {"block_type": "cooldown", "duration": 10, "intensity": "Z1", "description": "10min easy jog + stretching"}
    ]'::jsonb,
    '["track", "speed", "neuromuscular_power", "acceleration", "float_sprint", "soccer_shape"]'::jsonb,
    true
),
-- Field Shuttles
(
    'soccer_field_5_10_5_shuttle',
    'Field 5-10-5 Agility Shuttle',
    'running',
    'soccer_shape',
    'agility, change_of_direction, acceleration, deceleration',
    70,
    40,
    'beginner',
    '["field", "cones"]'::jsonb,
    '5-10-5 shuttle pattern: 5m sprint, 10m sprint, 5m sprint back. Develops agility and change of direction.',
    '[
        {"block_type": "warmup", "duration": 10, "intensity": "Z1", "description": "10min easy jog + dynamic drills"},
        {"block_type": "main", "sets": 8, "work_duration": 15, "rest_duration": 60, "intensity": "Z4", "description": "8 x 5-10-5 shuttle (5m sprint, 10m sprint, 5m sprint back), 60s recovery"},
        {"block_type": "cooldown", "duration": 10, "intensity": "Z1", "description": "10min easy jog + stretching"}
    ]'::jsonb,
    '["field", "agility", "change_of_direction", "acceleration", "deceleration", "soccer_shape"]'::jsonb,
    true
),
(
    'soccer_field_box_pattern',
    'Field Box Pattern Agility',
    'running',
    'soccer_shape',
    'agility, change_of_direction, neuromotor_coordination',
    72,
    45,
    'intermediate',
    '["field", "cones"]'::jsonb,
    'Box pattern agility: 4 cones in 10m square, run around perimeter with direction changes. Develops agility and neuromotor coordination.',
    '[
        {"block_type": "warmup", "duration": 10, "intensity": "Z1", "description": "10min easy jog + dynamic drills"},
        {"block_type": "main", "sets": 6, "work_duration": 20, "rest_duration": 90, "intensity": "Z4", "description": "6 x box pattern (10m square, run around perimeter with direction changes), 90s recovery"},
        {"block_type": "cooldown", "duration": 10, "intensity": "Z1", "description": "10min easy jog + stretching"}
    ]'::jsonb,
    '["field", "agility", "change_of_direction", "neuromotor_coordination", "soccer_shape"]'::jsonb,
    true
),
(
    'soccer_field_zigzag',
    'Field Zigzag Agility',
    'running',
    'soccer_shape',
    'agility, change_of_direction, lateral_movement',
    68,
    35,
    'beginner',
    '["field", "cones"]'::jsonb,
    'Zigzag pattern: 5 cones in 5m intervals, run zigzag pattern with sharp direction changes. Develops agility and lateral movement.',
    '[
        {"block_type": "warmup", "duration": 10, "intensity": "Z1", "description": "10min easy jog + dynamic drills"},
        {"block_type": "main", "sets": 8, "work_duration": 12, "rest_duration": 60, "intensity": "Z4", "description": "8 x zigzag pattern (5 cones, 5m intervals, sharp direction changes), 60s recovery"},
        {"block_type": "cooldown", "duration": 10, "intensity": "Z1", "description": "10min easy jog + stretching"}
    ]'::jsonb,
    '["field", "agility", "change_of_direction", "lateral_movement", "soccer_shape"]'::jsonb,
    true
),
(
    'soccer_field_shuttle_pyramid',
    'Field Shuttle Pyramid (10-20-30-20-10)',
    'running',
    'soccer_shape',
    'agility, change_of_direction, acceleration, deceleration',
    70,
    40,
    'beginner',
    '["field", "cones"]'::jsonb,
    'Shuttle pyramid: 10m sprint, 20m sprint, 30m sprint, 20m sprint, 10m sprint. Develops agility and change of direction.',
    '[
        {"block_type": "warmup", "duration": 10, "intensity": "Z1", "description": "10min easy jog + dynamic drills"},
        {"block_type": "main", "sets": 6, "work_duration": 30, "rest_duration": 60, "intensity": "Z4", "description": "6 x shuttle pyramid (10m-20m-30m-20m-10m), 60s recovery"},
        {"block_type": "cooldown", "duration": 10, "intensity": "Z1", "description": "10min easy jog + stretching"}
    ]'::jsonb,
    '["field", "agility", "change_of_direction", "acceleration", "deceleration", "soccer_shape"]'::jsonb,
    true
),
-- Hill Sprints
(
    'soccer_hill_20s_sprints',
    'Hill 8-16x20s Sprints',
    'running',
    'soccer_shape',
    'power, acceleration, neuromuscular_power, eccentric_strength',
    82,
    50,
    'intermediate',
    '["hill", "cones"]'::jsonb,
    '8-16x20s hill sprints at 6-8% grade with walk-back recovery. Develops power, acceleration, and eccentric strength.',
    '[
        {"block_type": "warmup", "duration": 15, "intensity": "Z1", "description": "15min easy jog + dynamic drills"},
        {"block_type": "main", "sets": 12, "work_duration": 20, "rest_duration": 120, "intensity": "Z5", "description": "12 x 20s hill sprint (6-8% grade, maximum effort), walk-back recovery (approx 2min)"},
        {"block_type": "cooldown", "duration": 10, "intensity": "Z1", "description": "10min easy jog + stretching"}
    ]'::jsonb,
    '["hill", "power", "acceleration", "neuromuscular_power", "eccentric_strength", "soccer_shape"]'::jsonb,
    true
),
(
    'soccer_hill_30s_sprints',
    'Hill 8-12x30s Sprints',
    'running',
    'soccer_shape',
    'power, anaerobic_capacity, eccentric_strength',
    85,
    55,
    'advanced',
    '["hill", "cones"]'::jsonb,
    '8-12x30s hill sprints at 6-8% grade with walk-back recovery. Develops power, anaerobic capacity, and eccentric strength.',
    '[
        {"block_type": "warmup", "duration": 15, "intensity": "Z1", "description": "15min easy jog + dynamic drills"},
        {"block_type": "main", "sets": 10, "work_duration": 30, "rest_duration": 150, "intensity": "Z5", "description": "10 x 30s hill sprint (6-8% grade, maximum effort), walk-back recovery (approx 2.5min)"},
        {"block_type": "cooldown", "duration": 10, "intensity": "Z1", "description": "10min easy jog + stretching"}
    ]'::jsonb,
    '["hill", "power", "anaerobic_capacity", "eccentric_strength", "soccer_shape"]'::jsonb,
    true
),
-- Speed Development
(
    'soccer_speed_100m_on_60s',
    'Speed 10-20x100m on 60s',
    'running',
    'soccer_shape',
    'speed, neuromuscular_power, acceleration, repeated_sprint_ability',
    80,
    35,
    'intermediate',
    '["track", "stopwatch"]'::jsonb,
    '10-20x100m sprints on 60s cycle (sprint 100m, rest until 60s total). Develops speed, neuromuscular power, and repeated sprint ability.',
    '[
        {"block_type": "warmup", "duration": 15, "intensity": "Z1", "description": "15min easy jog + dynamic drills"},
        {"block_type": "main", "sets": 15, "work_duration": 15, "rest_duration": 45, "intensity": "Z5", "distance": 100, "description": "15 x 100m sprint (95-100% effort) on 60s cycle (sprint 15s, rest 45s)"},
        {"block_type": "cooldown", "duration": 10, "intensity": "Z1", "description": "10min easy jog + stretching"}
    ]'::jsonb,
    '["track", "speed", "neuromuscular_power", "acceleration", "repeated_sprint_ability", "soccer_shape"]'::jsonb,
    true
),
(
    'soccer_speed_broken_400s',
    'Speed Broken 400s',
    'running',
    'soccer_shape',
    'speed_endurance, lactate_tolerance, neuromuscular_power',
    88,
    45,
    'advanced',
    '["track", "stopwatch"]'::jsonb,
    'Broken 400s: Run 400m as 100m sprint + 100m float + 100m sprint + 100m float. Develops speed endurance and lactate tolerance.',
    '[
        {"block_type": "warmup", "duration": 15, "intensity": "Z1", "description": "15min easy jog + dynamic drills"},
        {"block_type": "main", "sets": 4, "work_duration": 120, "rest_duration": 180, "intensity": "Z5-Z3", "distance": 400, "description": "4 x broken 400m (100m sprint + 100m float + 100m sprint + 100m float), 3min recovery"},
        {"block_type": "cooldown", "duration": 10, "intensity": "Z1", "description": "10min easy jog + stretching"}
    ]'::jsonb,
    '["track", "speed_endurance", "lactate_tolerance", "neuromuscular_power", "soccer_shape"]'::jsonb,
    true
),
(
    'soccer_speed_float_sprint_alternations',
    'Speed Float-Sprint Alternations',
    'running',
    'soccer_shape',
    'speed, aerobic_power, repeated_sprint_ability',
    78,
    40,
    'intermediate',
    '["track", "stopwatch"]'::jsonb,
    'Float-sprint alternations: 200m float (70% effort) + 100m sprint (95% effort), repeated. Develops speed and aerobic power.',
    '[
        {"block_type": "warmup", "duration": 15, "intensity": "Z1", "description": "15min easy jog + dynamic drills"},
        {"block_type": "main", "sets": 8, "work_duration": 90, "rest_duration": 0, "intensity": "Z3-Z5", "distance": 300, "description": "8 x (200m float at 70% + 100m sprint at 95%), continuous"},
        {"block_type": "cooldown", "duration": 10, "intensity": "Z1", "description": "10min easy jog + stretching"}
    ]'::jsonb,
    '["track", "speed", "aerobic_power", "repeated_sprint_ability", "soccer_shape"]'::jsonb,
    true
)
ON CONFLICT (template_id) DO UPDATE SET
    name = EXCLUDED.name,
    adaptation = EXCLUDED.adaptation,
    estimated_load = EXCLUDED.estimated_load,
    structure = EXCLUDED.structure,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP;

-- Insert workout blocks for soccer-shape workouts
-- Note: This is a simplified version. Full block insertion should be done via seed-database.js script
-- which properly handles all block details for each workout template

-- Create index for soccer-shape workouts
CREATE INDEX IF NOT EXISTS idx_workout_templates_soccer_shape 
ON workout_templates(category) 
WHERE category = 'soccer_shape';

-- Migration version tracking
INSERT INTO migration_history (version, description)
VALUES ('beta-soccer-shape-1.0', 'Soccer-shape workout templates')
ON CONFLICT (version) DO NOTHING;

