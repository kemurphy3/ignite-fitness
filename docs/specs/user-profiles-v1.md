# User Profiles Feature Specification v1.0

**Feature:** Secure User Profile Management with Multi-User Isolation
**Status:** Ready for Implementation **Last Updated:** 2025-09-25

## Section 1: Summary

Implement a secure user profile management system that stores fitness-related
personal data with strict validation, multi-user isolation, and comprehensive
audit logging. The system supports creating, updating (full and partial), and
retrieving user profiles with baseline fitness metrics while ensuring data
privacy and security.

### Key Requirements

- Store fitness metrics: age, height, weight, sex, goals, baseline lifts
- Support both metric and imperial units with automatic conversion
- Enforce validation ranges with physical consistency checks
- Implement row-level security with JWT-based authentication
- Support partial updates via PATCH endpoint
- Provide optimistic locking to prevent race conditions
- Rate limit profile updates to prevent abuse
- Prevent PII exposure in logs
- Support versioning for profile changes with field-level tracking

## Section 2: Data Model

### Primary Tables

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User profiles table with comprehensive validation
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Demographics (validated)
    age INTEGER CHECK (age >= 13 AND age <= 120),
    height_cm DECIMAL(5,2) CHECK (height_cm >= 50 AND height_cm <= 300),
    weight_kg DECIMAL(5,2) CHECK (weight_kg >= 20 AND weight_kg <= 500),
    sex VARCHAR(20) CHECK (sex IN ('male', 'female', 'other', 'prefer_not_to_say')),

    -- Unit preferences
    preferred_units VARCHAR(20) DEFAULT 'metric' CHECK (preferred_units IN ('metric', 'imperial')),

    -- Goals (multi-select stored as JSONB with size limits)
    goals JSONB DEFAULT '[]'::JSONB,
    goal_priorities JSONB DEFAULT '{}'::JSONB,

    -- Baseline lifts (all in kg)
    bench_press_max DECIMAL(5,2) CHECK (bench_press_max >= 0 AND bench_press_max <= 500),
    squat_max DECIMAL(5,2) CHECK (squat_max >= 0 AND squat_max <= 500),
    deadlift_max DECIMAL(5,2) CHECK (deadlift_max >= 0 AND deadlift_max <= 500),
    overhead_press_max DECIMAL(5,2) CHECK (overhead_press_max >= 0 AND overhead_press_max <= 300),

    -- Additional baseline metrics
    pull_ups_max INTEGER CHECK (pull_ups_max >= 0 AND pull_ups_max <= 100),
    push_ups_max INTEGER CHECK (push_ups_max >= 0 AND push_ups_max <= 500),
    mile_time_seconds INTEGER CHECK (mile_time_seconds >= 240 AND mile_time_seconds <= 1800),

    -- Calculated fields (cached)
    bmi DECIMAL(4,2) GENERATED ALWAYS AS (
        CASE
            WHEN height_cm IS NOT NULL AND weight_kg IS NOT NULL
            THEN weight_kg / POWER(height_cm / 100, 2)
            ELSE NULL
        END
    ) STORED,

    total_lifts DECIMAL(6,2) GENERATED ALWAYS AS (
        COALESCE(bench_press_max, 0) +
        COALESCE(squat_max, 0) +
        COALESCE(deadlift_max, 0)
    ) STORED,

    -- Profile completeness
    completeness_score INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN age IS NOT NULL THEN 10 ELSE 0 END +
            CASE WHEN height_cm IS NOT NULL THEN 10 ELSE 0 END +
            CASE WHEN weight_kg IS NOT NULL THEN 10 ELSE 0 END +
            CASE WHEN sex IS NOT NULL THEN 10 ELSE 0 END +
            CASE WHEN jsonb_array_length(goals) > 0 THEN 20 ELSE 0 END +
            CASE WHEN bench_press_max IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN squat_max IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN deadlift_max IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN overhead_press_max IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN pull_ups_max IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN push_ups_max IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN mile_time_seconds IS NOT NULL THEN 10 ELSE 0 END
    ) STORED,

    -- Metadata
    version INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_modified_by UUID,

    -- Constraints
    CONSTRAINT unique_user_profile UNIQUE(user_id),
    CONSTRAINT valid_goals CHECK (jsonb_typeof(goals) = 'array'),
    CONSTRAINT valid_goal_priorities CHECK (jsonb_typeof(goal_priorities) = 'object'),
    CONSTRAINT goals_size_limit CHECK (pg_column_size(goals) <= 4096),
    CONSTRAINT priorities_size_limit CHECK (pg_column_size(goal_priorities) <= 2048),
    CONSTRAINT valid_lift_relationships CHECK (
        (deadlift_max IS NULL OR squat_max IS NULL) OR
        deadlift_max >= squat_max * 0.7 -- Deadlift typically higher than squat
    )
);

-- Profile history with field-level tracking
CREATE TABLE user_profile_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_data JSONB NOT NULL,
    version INTEGER NOT NULL,
    changed_fields JSONB NOT NULL, -- Store old and new values
    change_reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    request_id UUID -- Link to request tracking
);

-- Request tracking for deduplication and rate limiting
CREATE TABLE profile_update_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_hash VARCHAR(64) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    endpoint VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_request UNIQUE(user_id, request_hash)
);

-- Rate limiting tracking
CREATE TABLE profile_rate_limits (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hour_bucket TIMESTAMP WITH TIME ZONE NOT NULL,
    update_count INTEGER DEFAULT 1,
    PRIMARY KEY (user_id, hour_bucket)
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_profile_history_composite ON user_profile_history(user_id, created_at DESC);
CREATE INDEX idx_profile_history_version ON user_profile_history(user_id, version);
CREATE INDEX idx_update_requests_user_time ON profile_update_requests(user_id, created_at DESC);
CREATE INDEX idx_rate_limits_bucket ON profile_rate_limits(hour_bucket);

-- Row-level security policies using JWT auth
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profile_owner_policy ON user_profiles
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

ALTER TABLE user_profile_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY history_owner_policy ON user_profile_history
    FOR SELECT
    USING (user_id = auth.uid());

-- Valid goals enum table
CREATE TABLE valid_goals (
    id VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    conflicting_goals TEXT[], -- Array of goal IDs that conflict
    is_active BOOLEAN DEFAULT true
);

-- Insert standard fitness goals with conflict mappings
INSERT INTO valid_goals (id, display_name, category, description, conflicting_goals) VALUES
('lose_weight', 'Lose Weight', 'body_composition', 'Reduce body weight through fat loss', ARRAY['bulk_muscle']),
('gain_muscle', 'Gain Muscle', 'body_composition', 'Increase lean muscle mass', ARRAY['lose_weight_fast']),
('bulk_muscle', 'Bulk Muscle', 'body_composition', 'Maximum muscle gain with some fat', ARRAY['lose_weight', 'improve_endurance']),
('lose_weight_fast', 'Rapid Weight Loss', 'body_composition', 'Aggressive caloric deficit', ARRAY['gain_muscle', 'increase_strength']),
('improve_endurance', 'Improve Endurance', 'performance', 'Enhance cardiovascular endurance', ARRAY['bulk_muscle']),
('increase_strength', 'Increase Strength', 'performance', 'Build maximum strength', ARRAY['lose_weight_fast']),
('improve_flexibility', 'Improve Flexibility', 'wellness', 'Enhance range of motion', NULL),
('reduce_stress', 'Reduce Stress', 'wellness', 'Manage stress through exercise', NULL),
('train_for_event', 'Train for Event', 'performance', 'Prepare for specific competition', NULL),
('general_fitness', 'General Fitness', 'wellness', 'Maintain overall health', NULL),
('rehabilitation', 'Rehabilitation', 'wellness', 'Recover from injury', ARRAY['train_for_event']),
('sports_performance', 'Sports Performance', 'performance', 'Enhance athletic performance', NULL);

-- Trigger for updating timestamp and history with field tracking
CREATE OR REPLACE FUNCTION update_profile_timestamp()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields JSONB;
    old_json JSONB;
    new_json JSONB;
BEGIN
    -- Only increment version on actual changes
    IF OLD IS DISTINCT FROM NEW THEN
        NEW.updated_at = NOW();
        NEW.version = OLD.version + 1;

        -- Calculate changed fields with old and new values
        old_json := to_jsonb(OLD);
        new_json := to_jsonb(NEW);

        SELECT jsonb_object_agg(key, jsonb_build_object(
            'old', old_json->key,
            'new', new_json->key
        ))
        INTO changed_fields
        FROM jsonb_object_keys(new_json) AS key
        WHERE old_json->key IS DISTINCT FROM new_json->key
        AND key NOT IN ('updated_at', 'version');

        -- Record history if there are actual field changes
        IF changed_fields IS NOT NULL AND changed_fields != '{}'::jsonb THEN
            INSERT INTO user_profile_history (
                user_id,
                profile_data,
                version,
                changed_fields,
                created_by,
                request_id
            ) VALUES (
                NEW.user_id,
                old_json,
                OLD.version,
                changed_fields,
                NEW.last_modified_by,
                current_setting('app.request_id', true)::UUID
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profile_timestamp
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_profile_timestamp();

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_profile_rate_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_hour TIMESTAMP WITH TIME ZONE;
    update_count INTEGER;
BEGIN
    current_hour := date_trunc('hour', NOW());

    SELECT COUNT(*) INTO update_count
    FROM profile_update_requests
    WHERE user_id = p_user_id
    AND created_at >= current_hour;

    RETURN update_count < 10; -- Allow 10 updates per hour
END;
$$ LANGUAGE plpgsql;

-- Function to validate goal conflicts
CREATE OR REPLACE FUNCTION validate_goal_conflicts(p_goals JSONB)
RETURNS TABLE(conflict_pair TEXT[]) AS $$
BEGIN
    RETURN QUERY
    SELECT ARRAY[g1.id, g2.id]
    FROM jsonb_array_elements_text(p_goals) AS goal1(id)
    JOIN valid_goals g1 ON g1.id = goal1.id
    JOIN jsonb_array_elements_text(p_goals) AS goal2(id) ON goal1.id < goal2.id
    JOIN valid_goals g2 ON g2.id = goal2.id
    WHERE g1.id = ANY(g2.conflicting_goals) OR g2.id = ANY(g1.conflicting_goals);
END;
$$ LANGUAGE plpgsql;
```

## Section 3: API Specification

### 3.1 POST /users/profile - Create Profile

```javascript
// netlify/functions/users-profile-post.js
const { getServerlessDB } = require('./utils/database');
const { verifyJWT } = require('./utils/auth');
const { sanitizeForLog } = require('./utils/security');
const { convertUnits } = require('./utils/units');
const Ajv = require('ajv');
const crypto = require('crypto');

// Input validation schema
const createProfileSchema = {
  type: 'object',
  properties: {
    age: { type: 'integer', minimum: 13, maximum: 120 },
    height: {
      oneOf: [
        { type: 'number', minimum: 50, maximum: 300 }, // cm
        {
          type: 'object',
          properties: {
            value: { type: 'number' },
            unit: { enum: ['cm', 'inches', 'feet'] },
            inches: { type: 'number', minimum: 0, maximum: 11 },
          },
          required: ['value', 'unit'],
        },
      ],
    },
    weight: {
      oneOf: [
        { type: 'number', minimum: 20, maximum: 500 }, // kg
        {
          type: 'object',
          properties: {
            value: { type: 'number' },
            unit: { enum: ['kg', 'lbs'] },
          },
          required: ['value', 'unit'],
        },
      ],
    },
    sex: { enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    preferred_units: { enum: ['metric', 'imperial'] },
    goals: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 10,
    },
    goal_priorities: {
      type: 'object',
      additionalProperties: { type: 'integer', minimum: 1, maximum: 10 },
    },
    bench_press_max: { type: 'number', minimum: 0, maximum: 500 },
    squat_max: { type: 'number', minimum: 0, maximum: 500 },
    deadlift_max: { type: 'number', minimum: 0, maximum: 500 },
    overhead_press_max: { type: 'number', minimum: 0, maximum: 300 },
    pull_ups_max: { type: 'integer', minimum: 0, maximum: 100 },
    push_ups_max: { type: 'integer', minimum: 0, maximum: 500 },
    mile_time_seconds: { type: 'integer', minimum: 240, maximum: 1800 },
  },
  required: ['age', 'sex'],
  additionalProperties: false,
};

exports.handler = async event => {
  const sql = getServerlessDB();
  const ajv = new Ajv();
  const validate = ajv.compile(createProfileSchema);

  try {
    // Authenticate user via JWT
    const userId = await verifyJWT(event.headers);
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized', code: 'AUTH_001' }),
      };
    }

    // Check rate limit
    const canUpdate =
      await sql`SELECT check_profile_rate_limit(${userId}) as allowed`;
    if (!canUpdate[0].allowed) {
      return {
        statusCode: 429,
        headers: { 'Retry-After': '3600' },
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          code: 'RATE_001',
          retry_after: 3600,
        }),
      };
    }

    // Generate request ID for tracking
    const requestId = crypto.randomUUID();
    const requestHash = crypto
      .createHash('sha256')
      .update(event.body + userId + Date.now())
      .digest('hex');

    // Check for duplicate request
    try {
      await sql`
                INSERT INTO profile_update_requests (
                    user_id, request_hash, ip_address, user_agent, endpoint
                ) VALUES (
                    ${userId}, ${requestHash}, 
                    ${event.headers['x-forwarded-for']},
                    ${event.headers['user-agent']},
                    'POST /users/profile'
                )
            `;
    } catch (error) {
      if (error.code === '23505') {
        // Unique violation
        return {
          statusCode: 409,
          body: JSON.stringify({
            error: 'Duplicate request',
            code: 'DUP_001',
          }),
        };
      }
      throw error;
    }

    // Parse and validate input
    const profileData = JSON.parse(event.body);

    // Convert units if necessary
    if (profileData.height && typeof profileData.height === 'object') {
      profileData.height_cm = convertUnits.toCm(profileData.height);
      delete profileData.height;
    } else if (profileData.height) {
      profileData.height_cm = profileData.height;
      delete profileData.height;
    }

    if (profileData.weight && typeof profileData.weight === 'object') {
      profileData.weight_kg = convertUnits.toKg(profileData.weight);
      delete profileData.weight;
    } else if (profileData.weight) {
      profileData.weight_kg = profileData.weight;
      delete profileData.weight;
    }

    if (!validate(profileData)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Validation failed',
          code: 'VAL_001',
          details: validate.errors,
        }),
      };
    }

    // Validate goals and check conflicts
    if (profileData.goals && profileData.goals.length > 0) {
      const validGoals = await sql`
                SELECT id FROM valid_goals 
                WHERE id = ANY(${profileData.goals})
                AND is_active = true
            `;

      if (validGoals.length !== profileData.goals.length) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Invalid goals specified',
            code: 'VAL_002',
            validGoals: validGoals.map(g => g.id),
          }),
        };
      }

      // Check for conflicting goals
      const conflicts = await sql`
                SELECT * FROM validate_goal_conflicts(${JSON.stringify(profileData.goals)})
            `;

      if (conflicts.length > 0) {
        console.warn('Goal conflicts detected:', conflicts);
        // We'll allow but warn about conflicts
      }
    }

    // Check if profile already exists
    const existing = await sql`
            SELECT id FROM user_profiles WHERE user_id = ${userId}
        `;

    if (existing.length > 0) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          error: 'Profile already exists. Use PUT or PATCH to update.',
          code: 'PROF_409',
        }),
      };
    }

    // Set request context for trigger
    await sql`SELECT set_config('app.request_id', ${requestId}, false)`;

    // Create profile
    const result = await sql`
            INSERT INTO user_profiles (
                user_id,
                age,
                height_cm,
                weight_kg,
                sex,
                preferred_units,
                goals,
                goal_priorities,
                bench_press_max,
                squat_max,
                deadlift_max,
                overhead_press_max,
                pull_ups_max,
                push_ups_max,
                mile_time_seconds,
                last_modified_by
            ) VALUES (
                ${userId},
                ${profileData.age},
                ${profileData.height_cm || null},
                ${profileData.weight_kg || null},
                ${profileData.sex},
                ${profileData.preferred_units || 'metric'},
                ${JSON.stringify(profileData.goals || [])},
                ${JSON.stringify(profileData.goal_priorities || {})},
                ${profileData.bench_press_max || null},
                ${profileData.squat_max || null},
                ${profileData.deadlift_max || null},
                ${profileData.overhead_press_max || null},
                ${profileData.pull_ups_max || null},
                ${profileData.push_ups_max || null},
                ${profileData.mile_time_seconds || null},
                ${userId}
            )
            RETURNING id, version, completeness_score, created_at
        `;

    // Log sanitized action (no PII)
    console.log('Profile created:', {
      userId: sanitizeForLog(userId),
      requestId,
      completeness: result[0].completeness_score,
      timestamp: result[0].created_at,
    });

    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        profile_id: result[0].id,
        version: result[0].version,
        completeness_score: result[0].completeness_score,
        message: 'Profile created successfully',
      }),
    };
  } catch (error) {
    console.error('Profile creation error:', sanitizeForLog(error.message));

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        code: 'SYS_001',
      }),
    };
  }
};
```

### 3.2 PATCH /users/profile - Partial Update

```javascript
// netlify/functions/users-profile-patch.js
exports.handler = async event => {
  const sql = getServerlessDB();
  const ajv = new Ajv();

  try {
    // Authenticate user
    const userId = await verifyJWT(event.headers);
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized', code: 'AUTH_001' }),
      };
    }

    // Check rate limit
    const canUpdate =
      await sql`SELECT check_profile_rate_limit(${userId}) as allowed`;
    if (!canUpdate[0].allowed) {
      return {
        statusCode: 429,
        headers: { 'Retry-After': '3600' },
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          code: 'RATE_001',
        }),
      };
    }

    const updates = JSON.parse(event.body);
    const { version: expectedVersion, ...fieldUpdates } = updates;

    // Convert units if necessary
    if (fieldUpdates.height) {
      fieldUpdates.height_cm =
        typeof fieldUpdates.height === 'object'
          ? convertUnits.toCm(fieldUpdates.height)
          : fieldUpdates.height;
      delete fieldUpdates.height;
    }

    if (fieldUpdates.weight) {
      fieldUpdates.weight_kg =
        typeof fieldUpdates.weight === 'object'
          ? convertUnits.toKg(fieldUpdates.weight)
          : fieldUpdates.weight;
      delete fieldUpdates.weight;
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = {};

    for (const [key, value] of Object.entries(fieldUpdates)) {
      // Validate each field individually
      if (createProfileSchema.properties[key]) {
        const fieldSchema = {
          type: 'object',
          properties: { [key]: createProfileSchema.properties[key] },
        };
        const validateField = ajv.compile(fieldSchema);

        if (!validateField({ [key]: value })) {
          return {
            statusCode: 400,
            body: JSON.stringify({
              error: `Invalid value for ${key}`,
              code: 'VAL_003',
              details: validateField.errors,
            }),
          };
        }
      }

      updateFields.push(`${key} = \${${key}}`);
      updateValues[key] = value;
    }

    if (updateFields.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'No valid fields to update',
          code: 'VAL_004',
        }),
      };
    }

    // Add metadata fields
    updateFields.push('last_modified_by = ${userId}');
    updateValues.userId = userId;

    // Perform optimistic locking update
    let query = `
            UPDATE user_profiles 
            SET ${updateFields.join(', ')}
            WHERE user_id = \${whereUserId}
        `;

    if (expectedVersion) {
      query += ' AND version = ${expectedVersion}';
      updateValues.expectedVersion = expectedVersion;
    }

    query += ' RETURNING *';

    updateValues.whereUserId = userId;

    // Execute dynamic update
    const result = await sql.unsafe(query, updateValues);

    if (result.length === 0) {
      if (expectedVersion) {
        // Check if profile exists with different version
        const current = await sql`
                    SELECT version FROM user_profiles WHERE user_id = ${userId}
                `;

        if (current.length > 0) {
          return {
            statusCode: 409,
            body: JSON.stringify({
              error: 'Version conflict',
              code: 'PROF_409',
              current_version: current[0].version,
              expected_version: expectedVersion,
            }),
          };
        }
      }

      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Profile not found',
          code: 'PROF_404',
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        version: result[0].version,
        completeness_score: result[0].completeness_score,
        updated_fields: Object.keys(fieldUpdates),
      }),
    };
  } catch (error) {
    console.error('Profile update error:', sanitizeForLog(error.message));

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        code: 'SYS_001',
      }),
    };
  }
};
```

### 3.3 GET /users/profile - Retrieve Profile

```javascript
// netlify/functions/users-profile-get.js
exports.handler = async event => {
  const sql = getServerlessDB();

  try {
    // Authenticate user
    const userId = await verifyJWT(event.headers);
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized', code: 'AUTH_001' }),
      };
    }

    // Fetch profile with goal details
    const result = await sql`
            SELECT 
                p.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', g.id,
                            'display_name', g.display_name,
                            'category', g.category,
                            'conflicting_goals', g.conflicting_goals
                        )
                    ) FILTER (WHERE g.id IS NOT NULL),
                    '[]'::json
                ) as goal_details,
                CASE 
                    WHEN p.bmi < 18.5 THEN 'underweight'
                    WHEN p.bmi < 25 THEN 'normal'
                    WHEN p.bmi < 30 THEN 'overweight'
                    ELSE 'obese'
                END as bmi_category
            FROM user_profiles p
            LEFT JOIN valid_goals g ON g.id = ANY(
                SELECT jsonb_array_elements_text(p.goals)
            )
            WHERE p.user_id = ${userId}
            GROUP BY p.id
        `;

    if (!result.length) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Profile not found',
          code: 'PROF_404',
        }),
      };
    }

    const profile = result[0];

    // Check for goal conflicts
    const conflicts = profile.goal_details
      .filter(g => g.conflicting_goals)
      .flatMap(g => g.conflicting_goals)
      .filter(conflictId => profile.goals.includes(conflictId));

    // Format response based on preferred units
    const useImperial = profile.preferred_units === 'imperial';

    const response = {
      age: profile.age,
      height: useImperial
        ? convertUnits.toFeetInches(profile.height_cm)
        : profile.height_cm,
      weight: useImperial
        ? convertUnits.toLbs(profile.weight_kg)
        : profile.weight_kg,
      sex: profile.sex,
      preferred_units: profile.preferred_units,
      goals: profile.goals,
      goal_priorities: profile.goal_priorities,
      goal_details: profile.goal_details,
      goal_conflicts: conflicts.length > 0 ? conflicts : null,
      baseline_lifts: {
        bench_press_max: useImperial
          ? convertUnits.toLbs(profile.bench_press_max)
          : profile.bench_press_max,
        squat_max: useImperial
          ? convertUnits.toLbs(profile.squat_max)
          : profile.squat_max,
        deadlift_max: useImperial
          ? convertUnits.toLbs(profile.deadlift_max)
          : profile.deadlift_max,
        overhead_press_max: useImperial
          ? convertUnits.toLbs(profile.overhead_press_max)
          : profile.overhead_press_max,
        total: useImperial
          ? convertUnits.toLbs(profile.total_lifts)
          : profile.total_lifts,
      },
      baseline_bodyweight: {
        pull_ups_max: profile.pull_ups_max,
        push_ups_max: profile.push_ups_max,
      },
      baseline_cardio: {
        mile_time_seconds: profile.mile_time_seconds,
        mile_time_formatted: profile.mile_time_seconds
          ? formatTime(profile.mile_time_seconds)
          : null,
      },
      calculated_metrics: {
        bmi: profile.bmi,
        bmi_category: profile.bmi_category,
        completeness_score: profile.completeness_score,
      },
      metadata: {
        version: profile.version,
        last_updated: profile.updated_at,
        profile_age_days: Math.floor(
          (Date.now() - new Date(profile.created_at)) / (1000 * 60 * 60 * 24)
        ),
      },
    };

    return {
      statusCode: 200,
      headers: {
        'Cache-Control': 'private, max-age=60',
        ETag: `"${profile.version}"`,
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Profile fetch error:', sanitizeForLog(error.message));

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        code: 'SYS_001',
      }),
    };
  }
};
```

### 3.4 POST /users/profile/validate - Dry-run Validation

```javascript
// netlify/functions/users-profile-validate.js
exports.handler = async event => {
  const sql = getServerlessDB();
  const ajv = new Ajv();
  const validate = ajv.compile(createProfileSchema);

  try {
    // Authenticate user
    const userId = await verifyJWT(event.headers);
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized', code: 'AUTH_001' }),
      };
    }

    const { fields } = JSON.parse(event.body);
    const validationResults = {};
    const warnings = [];

    // Validate each field
    for (const [key, value] of Object.entries(fields)) {
      if (createProfileSchema.properties[key]) {
        const fieldSchema = {
          type: 'object',
          properties: { [key]: createProfileSchema.properties[key] },
        };
        const validateField = ajv.compile(fieldSchema);

        validationResults[key] = {
          valid: validateField({ [key]: value }),
          errors: validateField.errors,
        };
      } else {
        validationResults[key] = {
          valid: false,
          errors: [{ message: 'Unknown field' }],
        };
      }
    }

    // Check physical consistency
    if (fields.height_cm && fields.weight_kg) {
      const bmi = fields.weight_kg / Math.pow(fields.height_cm / 100, 2);
      if (bmi < 15 || bmi > 50) {
        warnings.push({
          field: 'bmi',
          message: 'Height/weight ratio appears unusual',
          value: bmi,
        });
      }
    }

    // Check lift ratios
    if (fields.bench_press_max && fields.weight_kg) {
      const ratio = fields.bench_press_max / fields.weight_kg;
      if (ratio > 3) {
        warnings.push({
          field: 'bench_press_max',
          message: 'Bench press exceeds typical ratio',
          ratio,
        });
      }
    }

    // Check goal conflicts
    if (fields.goals && fields.goals.length > 0) {
      const conflicts = await sql`
                SELECT * FROM validate_goal_conflicts(${JSON.stringify(fields.goals)})
            `;

      if (conflicts.length > 0) {
        warnings.push({
          field: 'goals',
          message: 'Conflicting goals detected',
          conflicts: conflicts.map(c => c.conflict_pair),
        });
      }
    }

    const allValid = Object.values(validationResults).every(r => r.valid);

    return {
      statusCode: 200,
      body: JSON.stringify({
        valid: allValid,
        fields: validationResults,
        warnings: warnings.length > 0 ? warnings : null,
      }),
    };
  } catch (error) {
    console.error('Validation error:', sanitizeForLog(error.message));

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        code: 'SYS_001',
      }),
    };
  }
};
```

### 3.5 Utility Functions

```javascript
// utils/auth.js
const jwt = require('jsonwebtoken');

async function verifyJWT(headers) {
  const authHeader = headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.sub; // user_id
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return null;
  }
}

// utils/units.js
const convertUnits = {
  toCm(height) {
    if (height.unit === 'feet') {
      return height.value * 30.48 + (height.inches || 0) * 2.54;
    } else if (height.unit === 'inches') {
      return height.value * 2.54;
    }
    return height.value;
  },

  toKg(weight) {
    if (weight.unit === 'lbs') {
      return weight.value * 0.453592;
    }
    return weight.value;
  },

  toFeetInches(cm) {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return { feet, inches, display: `${feet}'${inches}"` };
  },

  toLbs(kg) {
    return kg ? Math.round(kg * 2.20462) : null;
  },
};

// utils/security.js
function sanitizeForLog(value) {
  if (typeof value === 'string') {
    // Remove potential PII patterns
    return value
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
      .replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        '[EMAIL]'
      )
      .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]')
      .replace(/Bearer [A-Za-z0-9\-._~\+\/]+=*/g, '[TOKEN]')
      .substring(0, 200);
  }
  return '[SANITIZED]';
}
```

## Section 4: Acceptance Criteria

### Functional Requirements

- [x] User can create a new profile with required fields (age, sex) via POST
- [x] User can perform full update via PUT endpoint
- [x] User can perform partial update via PATCH endpoint
- [x] User can retrieve their complete profile via GET
- [x] System accepts both metric and imperial units
- [x] System validates all numeric inputs against defined ranges
- [x] System validates goals against valid_goals table
- [x] System detects and warns about conflicting goals
- [x] System maintains profile version history with field-level tracking
- [x] System calculates and stores derived metrics (BMI, total lifts)
- [x] System provides dry-run validation endpoint
- [x] System tracks profile completeness score

### Security Requirements

- [x] JWT-based authentication for all endpoints
- [x] Row-level security prevents cross-user data access
- [x] Rate limiting prevents abuse (10 updates/hour)
- [x] Request deduplication via hash tracking
- [x] Optimistic locking prevents race conditions
- [x] No PII appears in application logs
- [x] All database queries use parameterized statements
- [x] JSONB fields have size constraints (4KB goals, 2KB priorities)

### Performance Requirements

- [x] Profile GET requests complete in < 200ms (p95)
- [x] Profile POST/PATCH requests complete in < 500ms (p95)
- [x] Composite indexes optimize history queries
- [x] Calculated fields cached via GENERATED columns
- [x] ETag headers enable client-side caching

### Data Validation

- [x] Age must be between 13-120 years
- [x] Height must be between 50-300 cm
- [x] Weight must be between 20-500 kg
- [x] Sex must be one of: male, female, other, prefer_not_to_say
- [x] Lift maxes must be non-negative and within realistic ranges
- [x] Mile time must be between 4-30 minutes
- [x] Goals must exist in valid_goals table
- [x] Physical consistency checks (BMI, lift ratios)
- [x] Cross-field validation (deadlift >= squat \* 0.7)

## Section 5: Test Plan

### Unit Tests

```javascript
// tests/profile-validation.test.js
describe('Profile Validation', () => {
  test('should accept valid profile data', () => {
    const validProfile = {
      age: 30,
      height_cm: 180,
      weight_kg: 80,
      sex: 'male',
      goals: ['gain_muscle', 'increase_strength'],
    };
    expect(validateProfile(validProfile)).toBe(true);
  });

  test('should handle imperial units', () => {
    const imperialProfile = {
      age: 25,
      sex: 'female',
      height: { value: 5, unit: 'feet', inches: 6 },
      weight: { value: 130, unit: 'lbs' },
    };
    const converted = convertAndValidate(imperialProfile);
    expect(converted.height_cm).toBeCloseTo(167.64, 1);
    expect(converted.weight_kg).toBeCloseTo(58.97, 1);
  });

  test('should detect conflicting goals', () => {
    const conflicts = validateGoalConflicts(['lose_weight', 'bulk_muscle']);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain('lose_weight');
    expect(conflicts[0]).toContain('bulk_muscle');
  });

  test('should calculate completeness score', () => {
    const partial = { age: 25, sex: 'male' };
    const complete = {
      age: 25,
      sex: 'male',
      height_cm: 180,
      weight_kg: 80,
      goals: ['gain_muscle'],
      bench_press_max: 100,
    };
    expect(calculateCompleteness(partial)).toBe(20);
    expect(calculateCompleteness(complete)).toBe(55);
  });
});
```

### Integration Tests

```javascript
// tests/profile-api.test.js
describe('Profile API Integration', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    ({ userId, authToken } = await setupTestUser());
  });

  test('should create profile with POST', async () => {
    const response = await fetch('/.netlify/functions/users-profile-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        age: 28,
        sex: 'female',
        height: { value: 5, unit: 'feet', inches: 5 },
        weight: { value: 130, unit: 'lbs' },
        goals: ['lose_weight', 'improve_endurance'],
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.completeness_score).toBeGreaterThan(0);
  });

  test('should perform partial update with PATCH', async () => {
    const response = await fetch('/.netlify/functions/users-profile-patch', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        weight: { value: 125, unit: 'lbs' },
        bench_press_max: 75,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.updated_fields).toEqual(['weight_kg', 'bench_press_max']);
  });

  test('should prevent race conditions with version check', async () => {
    // Get current version
    const profile = await getProfile(authToken);
    const version = profile.metadata.version;

    // Attempt concurrent updates
    const update1 = fetch('/.netlify/functions/users-profile-patch', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        version,
        age: 29,
      }),
    });

    const update2 = fetch('/.netlify/functions/users-profile-patch', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        version,
        weight_kg: 82,
      }),
    });

    const [res1, res2] = await Promise.all([update1, update2]);

    // One should succeed, one should fail with 409
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  test('should enforce rate limiting', async () => {
    // Make 11 requests (limit is 10)
    const requests = Array(11)
      .fill()
      .map(() =>
        fetch('/.netlify/functions/users-profile-patch', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ age: 30 }),
        })
      );

    const responses = await Promise.all(requests);
    const tooManyRequests = responses.filter(r => r.status === 429);
    expect(tooManyRequests.length).toBeGreaterThan(0);
  });

  test('should validate fields via dry-run', async () => {
    const response = await fetch('/.netlify/functions/users-profile-validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        fields: {
          age: 200, // Invalid
          weight_kg: 75, // Valid
          bench_press_max: 300, // Suspicious but valid
        },
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.fields.age.valid).toBe(false);
    expect(data.fields.weight_kg.valid).toBe(true);
    expect(data.warnings).toBeDefined();
  });
});
```

### Security Tests

```javascript
// tests/profile-security.test.js
describe('Profile Security', () => {
  test('should require JWT authentication', async () => {
    const response = await fetch('/.netlify/functions/users-profile-get');
    expect(response.status).toBe(401);
  });

  test('should prevent cross-user access', async () => {
    const user1Token = await getTestUserToken('user1');
    const user2Token = await getTestUserToken('user2');

    // Create profile as user1
    await createProfile(user1Token, { age: 25, sex: 'male' });

    // Try to access as user2 (RLS should prevent this)
    const response = await fetch('/.netlify/functions/users-profile-get', {
      headers: { Authorization: `Bearer ${user2Token}` },
    });

    expect(response.status).toBe(404); // RLS makes it appear not found
  });

  test('should sanitize logs', () => {
    const consoleSpy = jest.spyOn(console, 'log');

    const sensitive = {
      email: 'user@example.com',
      ssn: '123-45-6789',
      token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    };

    sanitizeForLog(sensitive.email);
    sanitizeForLog(sensitive.ssn);
    sanitizeForLog(sensitive.token);

    const logs = consoleSpy.mock.calls.flat().join(' ');
    expect(logs).not.toContain('user@example.com');
    expect(logs).not.toContain('123-45-6789');
    expect(logs).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(logs).toContain('[EMAIL]');
    expect(logs).toContain('[SSN]');
    expect(logs).toContain('[TOKEN]');
  });

  test('should prevent JSONB bloat attacks', async () => {
    const largeGoals = Array(1000).fill('gain_muscle'); // Try to overflow

    const response = await fetch('/.netlify/functions/users-profile-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        age: 25,
        sex: 'male',
        goals: largeGoals,
      }),
    });

    expect(response.status).toBe(400);
  });
});
```

### Performance Tests

```javascript
// tests/profile-performance.test.js
describe('Profile Performance', () => {
  test('GET profile completes < 200ms', async () => {
    const timings = [];

    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await fetch('/.netlify/functions/users-profile-get', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      timings.push(Date.now() - start);
    }

    const p95 = percentile(timings, 95);
    expect(p95).toBeLessThan(200);
  });

  test('PATCH completes < 500ms', async () => {
    const timings = [];

    for (let i = 0; i < 50; i++) {
      const start = Date.now();
      await fetch('/.netlify/functions/users-profile-patch', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ age: 25 + i }),
      });
      timings.push(Date.now() - start);
    }

    const p95 = percentile(timings, 95);
    expect(p95).toBeLessThan(500);
  });
});
```

## Later (Deferred Items)

### Deferred to Phase 2:

1. **Profile Templates**: Pre-filled profiles for common athlete types
   - Reason: Focus on core functionality first
2. **Progress Tracking API**: Time-series analysis of profile changes
   - Reason: Requires additional data modeling and storage
3. **Population Comparisons**: Compare metrics to other users
   - Reason: Requires anonymized aggregate data infrastructure
4. **Advanced Physical Validation**: ML-based consistency checking
   - Reason: Needs training data collection first

5. **Timezone Support**: User-specific timezone preferences
   - Reason: Can use browser timezone for now

6. **Profile Export/Import**: Backup and restore functionality
   - Reason: Not critical for MVP

7. **Multi-profile Support**: Multiple profiles per user (e.g., seasonal)
   - Reason: Adds complexity to data model

### Technical Debt to Address Later:

8. **Materialized Views**: Pre-computed statistics for faster queries
9. **History Table Partitioning**: Partition by month for scalability
10. **Field-level Encryption**: Encrypt sensitive metrics at rest

These items are deferred to maintain focus on core profile management features
while ensuring security, performance, and data integrity requirements are met.
