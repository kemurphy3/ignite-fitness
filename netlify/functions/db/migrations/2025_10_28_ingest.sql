-- Migration: 2025_10_28_ingest.sql
-- Add normalized activity/biometric stores, dedup hash, richness score, and helper utilities
-- 
-- This migration creates the foundation for:
-- - External source management (Strava, Garmin, etc.)
-- - Normalized activity storage with deduplication
-- - Activity stream data (HR, GPS, power)
-- - Biometric tracking
-- - Daily aggregates for training load metrics
-- - Ingest logging for audit trails

-- External sources table for managing integrations
CREATE TABLE IF NOT EXISTS external_sources (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  provider VARCHAR(40) NOT NULL,                    -- 'strava' | 'garmin' | 'polar' | 'fitbit'
  access_token_meta JSONB,                          -- Encrypted token data, refresh info
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT fk_external_sources_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_user_provider UNIQUE (user_id, provider)
);

-- Main activities table with normalized structure
CREATE TABLE IF NOT EXISTS activities (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  canonical_source VARCHAR(32) NOT NULL,           -- 'manual' | 'strava' | 'garmin' | 'polar'
  canonical_external_id VARCHAR(255),               -- External provider's ID (null for manual)
  type VARCHAR(40) NOT NULL,                        -- 'Run' | 'Ride' | 'Strength' | 'Soccer' | 'Swim'
  name VARCHAR(255),                                -- Activity name/title
  start_ts TIMESTAMPTZ NOT NULL,                   -- Activity start time
  end_ts TIMESTAMPTZ,                              -- Activity end time
  duration_s INTEGER,                              -- Duration in seconds
  device JSONB,                                    -- Device info: {"name": "Garmin Forerunner 945", "type": "watch"}
  has_hr BOOLEAN DEFAULT false,                    -- Has heart rate data
  has_gps BOOLEAN DEFAULT false,                   -- Has GPS data
  has_power BOOLEAN DEFAULT false,                  -- Has power data
  distance_m NUMERIC,                              -- Distance in meters
  avg_hr NUMERIC,                                  -- Average heart rate (BPM)
  max_hr NUMERIC,                                  -- Maximum heart rate (BPM)
  calories_kcal NUMERIC,                           -- Calories burned
  source_set JSONB,                                -- Multi-source tracking: {"manual":{"id":"m_1","richness":0.3},"strava":{"id":"123","richness":0.82}}
  merged_from JSONB,                               -- Audit trail for merged activities
  is_excluded BOOLEAN DEFAULT false,               -- Exclude from analysis
  dedup_hash TEXT UNIQUE,                          -- SHA256 hash for deduplication
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT fk_activities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT valid_canonical_source CHECK (canonical_source IN ('manual', 'strava', 'garmin', 'polar', 'fitbit', 'apple_health')),
  CONSTRAINT valid_activity_type CHECK (type IN ('Run', 'Ride', 'Strength', 'Soccer', 'Swim', 'Walk', 'Hike', 'Yoga', 'Other')),
  CONSTRAINT valid_duration CHECK (duration_s > 0),
  CONSTRAINT valid_distance CHECK (distance_m >= 0),
  CONSTRAINT valid_hr CHECK (avg_hr > 0 AND avg_hr < 300),
  CONSTRAINT valid_calories CHECK (calories_kcal >= 0)
);

-- Activity streams for detailed time-series data
CREATE TABLE IF NOT EXISTS activity_streams (
  id BIGSERIAL PRIMARY KEY,
  activity_id BIGINT NOT NULL,
  stream_type VARCHAR(16) NOT NULL,                -- 'hr' | 'gps' | 'alt' | 'power' | 'pace' | 'cadence'
  samples JSONB NOT NULL,                          -- Time-series data: [{"t":0, "v":120}, {"t":1, "v":125}]
  sample_rate_hz NUMERIC,                          -- Sampling frequency
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT fk_activity_streams_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  CONSTRAINT valid_stream_type CHECK (stream_type IN ('hr', 'gps', 'alt', 'power', 'pace', 'cadence', 'temp')),
  CONSTRAINT valid_sample_rate CHECK (sample_rate_hz > 0 AND sample_rate_hz <= 10)
);

-- Biometric measurements over time
CREATE TABLE IF NOT EXISTS biometrics (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  metric VARCHAR(32) NOT NULL,                    -- 'rest_hr' | 'hrv' | 'sleep_score' | 'weight' | 'bodyfat' | 'vo2max'
  value_num NUMERIC,                               -- Numeric value
  value_text TEXT,                                 -- Text value (for non-numeric metrics)
  source VARCHAR(40),                             -- Source device/app
  external_id VARCHAR(255),                       -- External provider ID
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT fk_biometrics_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT valid_metric CHECK (metric IN ('rest_hr', 'hrv', 'sleep_score', 'weight', 'bodyfat', 'vo2max', 'stress', 'recovery')),
  CONSTRAINT valid_value CHECK (value_num IS NOT NULL OR value_text IS NOT NULL)
);

-- Daily aggregates for training load calculations
CREATE TABLE IF NOT EXISTS daily_aggregates (
  user_id INTEGER NOT NULL,
  date DATE NOT NULL,
  trimp NUMERIC,                                   -- Training Impulse
  tss NUMERIC,                                     -- Training Stress Score
  load_score NUMERIC,                             -- Custom load score
  z1_min NUMERIC,                                 -- Zone 1 minutes
  z2_min NUMERIC,                                 -- Zone 2 minutes  
  z3_min NUMERIC,                                 -- Zone 3 minutes
  z4_min NUMERIC,                                 -- Zone 4 minutes
  z5_min NUMERIC,                                 -- Zone 5 minutes
  distance_m NUMERIC,                             -- Total distance
  duration_s INTEGER,                             -- Total duration
  run_count INTEGER,                              -- Number of runs
  ride_count INTEGER,                              -- Number of rides
  strength_count INTEGER,                         -- Number of strength sessions
  atl7 NUMERIC,                                   -- Acute Training Load (7-day)
  ctl28 NUMERIC,                                  -- Chronic Training Load (28-day)
  monotony NUMERIC,                                -- Training monotony
  strain NUMERIC,                                  -- Training strain
  last_recalc_ts TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT fk_daily_aggregates_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT valid_zones CHECK (z1_min >= 0 AND z2_min >= 0 AND z3_min >= 0 AND z4_min >= 0 AND z5_min >= 0),
  CONSTRAINT valid_counts CHECK (run_count >= 0 AND ride_count >= 0 AND strength_count >= 0),
  CONSTRAINT valid_load_metrics CHECK (atl7 >= 0 AND ctl28 >= 0 AND monotony >= 0 AND strain >= 0),
  PRIMARY KEY(user_id, date)
);

-- Ingest logging for audit trails
CREATE TABLE IF NOT EXISTS ingest_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  provider VARCHAR(40) NOT NULL,
  external_id VARCHAR(255),
  raw_sha256 TEXT,                                 -- SHA256 of raw data for deduplication
  status VARCHAR(20) NOT NULL,                    -- 'imported' | 'updated' | 'skipped_dup' | 'error' | 'merged'
  error_message TEXT,                              -- Error details if status = 'error'
  metadata JSONB,                                  -- Additional processing metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT fk_ingest_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT valid_status CHECK (status IN ('imported', 'updated', 'skipped_dup', 'error', 'merged', 'processing'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activities_user_start ON activities(user_id, start_ts);
CREATE INDEX IF NOT EXISTS idx_activities_canonical ON activities(user_id, canonical_source, canonical_external_id);
CREATE INDEX IF NOT EXISTS idx_activities_dedup_hash ON activities(dedup_hash);
CREATE INDEX IF NOT EXISTS idx_activities_type_date ON activities(user_id, type, start_ts);
CREATE INDEX IF NOT EXISTS idx_activities_excluded ON activities(user_id, is_excluded, start_ts);

CREATE INDEX IF NOT EXISTS idx_activity_streams_activity ON activity_streams(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_streams_type ON activity_streams(activity_id, stream_type);

CREATE INDEX IF NOT EXISTS idx_biometrics_user_metric ON biometrics(user_id, metric, ts);
CREATE INDEX IF NOT EXISTS idx_biometrics_user_date ON biometrics(user_id, ts);

CREATE INDEX IF NOT EXISTS idx_daily_aggregates_user_date ON daily_aggregates(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_recalc ON daily_aggregates(user_id, last_recalc_ts);

CREATE INDEX IF NOT EXISTS idx_ingest_log_user_provider ON ingest_log(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_ingest_log_status ON ingest_log(status, created_at);
CREATE INDEX IF NOT EXISTS idx_ingest_log_sha256 ON ingest_log(raw_sha256);

-- Comments for documentation
COMMENT ON TABLE external_sources IS 'Manages external data source integrations (Strava, Garmin, etc.)';
COMMENT ON TABLE activities IS 'Normalized activity storage with deduplication and multi-source tracking';
COMMENT ON TABLE activity_streams IS 'Time-series data streams for activities (HR, GPS, power, etc.)';
COMMENT ON TABLE biometrics IS 'Biometric measurements over time (HRV, sleep, weight, etc.)';
COMMENT ON TABLE daily_aggregates IS 'Daily training load aggregates and rolling metrics';
COMMENT ON TABLE ingest_log IS 'Audit trail for data ingestion and processing';

COMMENT ON COLUMN activities.source_set IS 'Multi-source tracking: {"manual":{"id":"m_1","richness":0.3},"strava":{"id":"123","richness":0.82}}';
COMMENT ON COLUMN activities.merged_from IS 'Audit trail for activities merged from multiple sources';
COMMENT ON COLUMN activities.dedup_hash IS 'SHA256 hash for deduplication: hash(user_id, start_ts, duration_s, type)';
COMMENT ON COLUMN activity_streams.samples IS 'Time-series data: [{"t":0, "v":120}, {"t":1, "v":125}] where t=seconds, v=value';
COMMENT ON COLUMN daily_aggregates.atl7 IS 'Acute Training Load - 7-day rolling average';
COMMENT ON COLUMN daily_aggregates.ctl28 IS 'Chronic Training Load - 28-day rolling average';
COMMENT ON COLUMN ingest_log.raw_sha256 IS 'SHA256 hash of raw data for deduplication';
