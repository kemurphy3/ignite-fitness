-- User Preferences Schema Update
-- Adds onboarding and role-based preferences to user_preferences table

-- Add new columns to user_preferences table
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS data_preference VARCHAR(20) DEFAULT 'some_metrics',
ADD COLUMN IF NOT EXISTS primary_goal VARCHAR(50),
ADD COLUMN IF NOT EXISTS training_background VARCHAR(50),
ADD COLUMN IF NOT EXISTS primary_sport VARCHAR(50),
ADD COLUMN IF NOT EXISTS time_commitment VARCHAR(20),
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'athlete',
ADD COLUMN IF NOT EXISTS onboarding_version INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS onboarding_skipped BOOLEAN DEFAULT FALSE;

-- Create index for efficient querying by role
CREATE INDEX IF NOT EXISTS idx_user_preferences_role ON user_preferences(role);

-- Create index for onboarding status
CREATE INDEX IF NOT EXISTS idx_user_preferences_onboarding ON user_preferences(onboarding_version, onboarding_completed_at);

-- Update existing users to have default preferences
UPDATE user_preferences 
SET 
    data_preference = 'some_metrics',
    role = 'athlete',
    onboarding_version = 1
WHERE 
    data_preference IS NULL 
    OR role IS NULL 
    OR onboarding_version IS NULL;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON user_preferences TO ignite_fitness_app;