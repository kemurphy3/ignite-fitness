# Strava Activity Import Feature Specification v1.0
**Feature:** Strava Activity Import with Resume Support
**Status:** Ready for Implementation
**Last Updated:** 2025-09-25

## Section 1: Summary

Implement a robust Strava activity import system that pulls user activities from Strava's REST API and saves them as sessions in our database. The system supports both historical backfill and incremental imports, handles token refresh automatically, implements deduplication via unique constraints, gracefully manages rate limits with proper resumable imports for large datasets, and correctly handles timezones.

### Key Design Decisions
- Time-boxed imports with continue tokens for resumability (9s budget)
- Timezone-aware storage with both local and UTC times
- Comprehensive field mapping preserving all Strava data
- Activity cache for detecting deletions on Strava
- Proper token decryption using Feature 2's encryption
- UPSERT-based duplicate detection with update tracking
- Network timeout protection with AbortController
- Standardized error responses across all endpoints

### Scope
- 1 PR for database schema and core import logic
- 1 PR for resumable imports and orphan cleanup
- Webhook support deferred (requires public URL)
- Automatic/scheduled imports deferred (on-demand only)

## Section 2: Data Model

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Integration sync state table with resume support
CREATE TABLE integrations_strava (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Sync state
    last_import_after TEXT, -- String to avoid JS precision loss
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_status VARCHAR(20) CHECK (last_status IN ('success', 'partial', 'failed', 'in_progress')),
    last_error TEXT,
    last_error_code VARCHAR(50),
    
    -- Resume support
    import_in_progress BOOLEAN DEFAULT false,
    import_continue_token TEXT, -- Base64 encoded resume state
    import_started_at TIMESTAMP WITH TIME ZONE,
    
    -- Statistics
    total_imported INTEGER DEFAULT 0,
    total_duplicates INTEGER DEFAULT 0,
    total_updated INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_user_strava UNIQUE(user_id)
);

CREATE INDEX idx_integrations_strava_user ON integrations_strava(user_id);
CREATE INDEX idx_integrations_strava_status ON integrations_strava(last_status);

-- Track all Strava activities for orphan detection
CREATE TABLE strava_activity_cache (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id BIGINT NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activity_version TEXT, -- Track Strava's version for update detection
    PRIMARY KEY (user_id, activity_id)
);

CREATE INDEX idx_activity_cache_last_seen ON strava_activity_cache(user_id, last_seen);

-- Extend sessions table for Strava data with timezone support
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS source_id VARCHAR(100);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS external_url TEXT;

-- Timezone-aware date fields
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS utc_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS timezone_offset INTEGER; -- Minutes from UTC

-- Duration fields
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS elapsed_duration INTEGER; -- Total time including stops

-- Rich payload storage
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS payload JSONB;

-- Add constraints for deduplication
ALTER TABLE sessions ADD CONSTRAINT unique_external_activity 
    UNIQUE(user_id, source, source_id);

-- Indexes for efficient lookups
CREATE INDEX idx_sessions_source ON sessions(user_id, source, source_id) 
    WHERE source IS NOT NULL;
CREATE INDEX idx_sessions_source_date ON sessions(user_id, source, utc_date DESC);
CREATE INDEX idx_sessions_payload_version ON sessions((payload->>'version')) 
    WHERE source = 'strava';

-- Activity import log for debugging/audit
CREATE TABLE strava_import_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    run_id UUID NOT NULL,
    
    -- Request details
    requested_after TEXT,
    requested_per_page INTEGER,
    continue_token TEXT,
    
    -- Response details
    page_number INTEGER,
    activities_fetched INTEGER,
    activities_imported INTEGER,
    activities_duplicate INTEGER,
    activities_updated INTEGER,
    activities_failed INTEGER,
    
    -- Errors
    errors JSONB,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    timed_out BOOLEAN DEFAULT false,
    
    CONSTRAINT check_counts CHECK (
        activities_fetched >= activities_imported + activities_duplicate + activities_updated + activities_failed
    )
);

CREATE INDEX idx_import_log_user_run ON strava_import_log(user_id, run_id);
CREATE INDEX idx_import_log_created ON strava_import_log(started_at DESC);

-- Comprehensive sport type mapping
CREATE OR REPLACE FUNCTION map_strava_sport_type(sport_type TEXT)
RETURNS VARCHAR AS $$
BEGIN
    RETURN CASE sport_type
        -- Running
        WHEN 'Run' THEN 'run'
        WHEN 'TrailRun' THEN 'run'
        WHEN 'VirtualRun' THEN 'run'
        
        -- Cycling  
        WHEN 'Ride' THEN 'cardio'
        WHEN 'VirtualRide' THEN 'cardio'
        WHEN 'EBikeRide' THEN 'cardio'
        WHEN 'MountainBikeRide' THEN 'cardio'
        WHEN 'GravelRide' THEN 'cardio'
        
        -- Water
        WHEN 'Swim' THEN 'cardio'
        WHEN 'Kayaking' THEN 'cardio'
        WHEN 'Canoeing' THEN 'cardio'
        WHEN 'Surfing' THEN 'cardio'
        WHEN 'StandUpPaddling' THEN 'cardio'
        WHEN 'Rowing' THEN 'cardio'
        
        -- Gym
        WHEN 'Workout' THEN 'workout'
        WHEN 'WeightTraining' THEN 'workout'
        WHEN 'Crossfit' THEN 'workout'
        
        -- Flexibility
        WHEN 'Yoga' THEN 'flexibility'
        WHEN 'Pilates' THEN 'flexibility'
        
        -- Walking/Hiking
        WHEN 'Walk' THEN 'cardio'
        WHEN 'Hike' THEN 'cardio'
        
        -- Winter sports
        WHEN 'AlpineSki' THEN 'cardio'
        WHEN 'BackcountrySki' THEN 'cardio'
        WHEN 'NordicSki' THEN 'cardio'
        WHEN 'Snowboard' THEN 'cardio'
        WHEN 'Snowshoe' THEN 'cardio'
        WHEN 'IceSkate' THEN 'cardio'
        
        -- Team sports
        WHEN 'Soccer' THEN 'cardio'
        WHEN 'Basketball' THEN 'cardio'
        WHEN 'Tennis' THEN 'cardio'
        WHEN 'Squash' THEN 'cardio'
        WHEN 'Badminton' THEN 'cardio'
        WHEN 'Golf' THEN 'cardio'
        
        -- Default
        ELSE 'cardio'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to clean up orphaned activities
CREATE OR REPLACE FUNCTION cleanup_orphaned_strava_activities(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions
    WHERE user_id = p_user_id
    AND source = 'strava'
    AND source_id NOT IN (
        SELECT activity_id::TEXT 
        FROM strava_activity_cache
        WHERE user_id = p_user_id
        AND last_seen > NOW() - INTERVAL '1 hour'
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

## Section 3: API Specification

### 3.1 POST /integrations/strava/import - Import Activities with Resume Support

```javascript
// netlify/functions/integrations-strava-import.js
const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Import Feature 2's encryption
const { TokenEncryption } = require('./utils/encryption');

// Standardized error response
class ImportError extends Error {
    constructor(code, message, statusCode = 500, details = null) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
    }
    
    toResponse(headers) {
        return {
            statusCode: this.statusCode,
            headers,
            body: JSON.stringify({
                error: {
                    code: this.code,
                    message: this.message,
                    ...(this.details && { details: this.details })
                }
            })
        };
    }
}

// Network fetch with timeout
async function fetchWithTimeout(url, options, timeoutMs = 5000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeout);
        return response;
    } catch (error) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeoutMs}ms`);
        }
        throw error;
    }
}

// Calculate pace
function calculatePace(seconds, meters, unit = 'km') {
    if (!seconds || !meters) return null;
    const divisor = unit === 'km' ? 1000 : 1609.34;
    const minutesPer = (seconds / 60) / (meters / divisor);
    const mins = Math.floor(minutesPer);
    const secs = Math.round((minutesPer - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Map Strava activity to session
function mapStravaActivity(activity, userId) {
    // Parse timezone
    const tzMatch = activity.timezone?.match(/GMT([+-]\d{2}):(\d{2})/);
    const tzOffsetMinutes = tzMatch 
        ? parseInt(tzMatch[1]) * 60 + parseInt(tzMatch[2]) * (tzMatch[1].startsWith('-') ? -1 : 1)
        : 0;
    
    return {
        user_id: userId,
        
        // Use local time for display, UTC for sorting
        date: activity.start_date_local ? new Date(activity.start_date_local) : new Date(activity.start_date),
        utc_date: new Date(activity.start_date),
        timezone: activity.timezone,
        timezone_offset: tzOffsetMinutes,
        
        // Durations
        duration: Math.ceil((activity.moving_time || 0) / 60),
        elapsed_duration: Math.ceil((activity.elapsed_time || 0) / 60),
        
        // Type and naming
        type: 'cardio', // Will be mapped by SQL function
        name: (activity.name || `${activity.sport_type} Activity`).substring(0, 255),
        notes: activity.description?.substring(0, 5000),
        
        // Source tracking
        source: 'strava',
        source_id: String(activity.id),
        external_url: `https://www.strava.com/activities/${activity.id}`,
        
        // Complete payload
        payload: {
            version: activity.version || '1',
            original: activity,
            summary: {
                distance_km: activity.distance ? (activity.distance / 1000).toFixed(2) : null,
                distance_mi: activity.distance ? (activity.distance / 1609.34).toFixed(2) : null,
                
                pace_per_km: calculatePace(activity.moving_time, activity.distance, 'km'),
                pace_per_mi: calculatePace(activity.moving_time, activity.distance, 'mi'),
                
                speed_kmh: activity.average_speed ? (activity.average_speed * 3.6).toFixed(1) : null,
                speed_mph: activity.average_speed ? (activity.average_speed * 2.237).toFixed(1) : null,
                
                elevation_gain_m: activity.total_elevation_gain,
                elevation_gain_ft: activity.total_elevation_gain 
                    ? Math.round(activity.total_elevation_gain * 3.281) : null,
                
                calories: activity.kilojoules ? Math.round(activity.kilojoules * 1.05) : null,
                
                heart_rate: {
                    average: activity.average_heartrate,
                    max: activity.max_heartrate,
                    has_data: activity.has_heartrate
                },
                
                power: {
                    average: activity.average_watts,
                    weighted: activity.weighted_average_watts,
                    max: activity.max_watts,
                    has_data: activity.device_watts
                }
            },
            metadata: {
                is_manual: activity.manual,
                is_private: activity.private,
                is_indoor: activity.trainer,
                is_race: activity.workout_type === 1,
                
                device: activity.device_name,
                gear_id: activity.gear_id,
                
                achievements: activity.achievement_count,
                kudos: activity.kudos_count,
                comments: activity.comment_count,
                suffer_score: activity.suffer_score,
                
                has_photos: activity.photo_count > 0,
                has_gps: !!activity.map?.summary_polyline
            }
        }
    };
}

exports.handler = async (event) => {
    const sql = neon(process.env.DATABASE_URL);
    const encryption = new TokenEncryption();
    
    const headers = {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }
    
    const runId = crypto.randomUUID();
    const importStartTime = Date.now();
    const MAX_RUNTIME_MS = 9000; // 9s budget (1s buffer for Netlify's 10s limit)
    
    try {
        // Authenticate
        const authHeader = event.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new ImportError('AUTH_REQUIRED', 'Authorization required', 401);
        }
        
        const token = authHeader.substring(7);
        let userId;
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.sub;
        } catch (err) {
            throw new ImportError('AUTH_INVALID', 'Invalid token', 401);
        }
        
        // Parse parameters
        const params = event.queryStringParameters || {};
        const body = event.body ? JSON.parse(event.body) : {};
        
        // Handle continue token for resume
        const continueToken = body.continue_token || params.continue_token;
        let resumeState = null;
        
        if (continueToken) {
            try {
                resumeState = JSON.parse(Buffer.from(continueToken, 'base64').toString());
            } catch {
                throw new ImportError('INVALID_CONTINUE_TOKEN', 'Invalid continue token', 400);
            }
        }
        
        // Validate after parameter
        let after = resumeState?.after || params.after || null;
        if (after !== null && after !== undefined) {
            if (!/^\d{1,10}$/.test(String(after))) {
                throw new ImportError('INVALID_PARAM', 'Invalid after parameter - must be unix timestamp', 400);
            }
            
            const afterNum = parseInt(after);
            if (afterNum > Math.floor(Date.now() / 1000)) {
                throw new ImportError('INVALID_PARAM', 'after parameter cannot be in the future', 400);
            }
        }
        
        const perPage = Math.min(Math.max(parseInt(params.per_page) || 30, 1), 100);
        
        // Get user's Strava token
        const tokenResult = await sql`
            SELECT 
                encrypted_access_token,
                encrypted_refresh_token,
                expires_at,
                encryption_key_version
            FROM strava_tokens
            WHERE user_id = ${userId}
        `;
        
        if (!tokenResult.length) {
            throw new ImportError(
                'STRAVA_NOT_CONNECTED',
                'Strava account not connected. Please connect your account first.',
                403,
                { connect_url: '/settings/integrations/strava' }
            );
        }
        
        // Check and refresh token if needed
        const tokenData = tokenResult[0];
        let accessToken;
        
        if (new Date(tokenData.expires_at) <= new Date()) {
            // Call Feature 2's refresh endpoint
            const refreshResponse = await fetchWithTimeout(
                `${process.env.URL}/.netlify/functions/strava-refresh-token`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                },
                10000
            );
            
            if (!refreshResponse.ok) {
                throw new ImportError('TOKEN_REFRESH_FAILED', 'Failed to refresh Strava token', 502);
            }
            
            // Get refreshed token
            const newTokenResult = await sql`
                SELECT encrypted_access_token
                FROM strava_tokens
                WHERE user_id = ${userId}
            `;
            
            accessToken = await encryption.decrypt(newTokenResult[0].encrypted_access_token);
        } else {
            accessToken = await encryption.decrypt(tokenData.encrypted_access_token);
        }
        
        // Get or create sync state
        let syncState = await sql`
            SELECT * FROM integrations_strava
            WHERE user_id = ${userId}
        `;
        
        if (!syncState.length) {
            await sql`
                INSERT INTO integrations_strava (user_id)
                VALUES (${userId})
            `;
            syncState = [{ last_import_after: null }];
        }
        
        // Check if import already in progress
        if (syncState[0].import_in_progress && !continueToken) {
            const inProgressFor = Date.now() - new Date(syncState[0].import_started_at).getTime();
            if (inProgressFor < 60000) { // Less than 1 minute
                throw new ImportError(
                    'IMPORT_IN_PROGRESS',
                    'Import already in progress. Please wait or provide continue_token.',
                    409
                );
            }
        }
        
        // Mark as in progress
        await sql`
            UPDATE integrations_strava
            SET import_in_progress = true,
                import_started_at = NOW()
            WHERE user_id = ${userId}
        `;
        
        // Initialize state
        let page = resumeState?.page || 1;
        let lastActivityId = resumeState?.lastActivityId || null;
        let maxActivityTime = resumeState?.maxActivityTime || after || syncState[0].last_import_after || '0';
        
        if (!after && syncState[0].last_import_after) {
            after = syncState[0].last_import_after;
        }
        
        // Import results
        const results = {
            imported: resumeState?.imported || 0,
            duplicates: resumeState?.duplicates || 0,
            updated: resumeState?.updated || 0,
            failed: resumeState?.failed || 0,
            deleted: 0,
            pages_processed: resumeState?.pages_processed || 0,
            errors: []
        };
        
        let hasMore = true;
        const maxPages = 20;
        const maxActivities = 1000;
        
        // Main import loop with time boxing
        while (hasMore && page <= maxPages && 
               results.imported + results.duplicates < maxActivities) {
            
            // Check time budget
            if (Date.now() - importStartTime > MAX_RUNTIME_MS) {
                // Save progress and return partial
                const newContinueToken = Buffer.from(JSON.stringify({
                    page,
                    after,
                    lastActivityId,
                    maxActivityTime,
                    ...results
                })).toString('base64');
                
                await sql`
                    UPDATE integrations_strava
                    SET 
                        import_continue_token = ${newContinueToken},
                        last_status = 'partial'
                    WHERE user_id = ${userId}
                `;
                
                return {
                    statusCode: 206, // Partial Content
                    headers,
                    body: JSON.stringify({
                        status: 'partial',
                        message: 'Import in progress. Call again with continue_token to resume.',
                        continue_token: newContinueToken,
                        ...results
                    })
                };
            }
            
            const pageStartTime = Date.now();
            
            // Build Strava API URL
            const stravaUrl = new URL('https://www.strava.com/api/v3/athlete/activities');
            stravaUrl.searchParams.append('per_page', String(perPage));
            
            // Use cursor-based pagination if available
            if (lastActivityId) {
                stravaUrl.searchParams.append('before', String(lastActivityId));
            } else {
                stravaUrl.searchParams.append('page', String(page));
            }
            
            if (after) {
                stravaUrl.searchParams.append('after', String(after));
            }
            
            // Fetch with retries
            let stravaResponse;
            let retries = 3;
            let backoffMs = 1000;
            
            while (retries > 0) {
                try {
                    stravaResponse = await fetchWithTimeout(
                        stravaUrl.toString(),
                        { headers: { 'Authorization': `Bearer ${accessToken}` } },
                        5000
                    );
                    
                    if (stravaResponse.status === 429) {
                        // Parse rate limit headers correctly
                        const retryAfterHeader = stravaResponse.headers.get('Retry-After');
                        const rateLimitUsage = stravaResponse.headers.get('X-RateLimit-Usage');
                        
                        const waitMs = retryAfterHeader 
                            ? parseInt(retryAfterHeader) * 1000 
                            : backoffMs;
                        
                        if (rateLimitUsage) {
                            const [fifteenMin, daily] = rateLimitUsage.split(',').map(Number);
                            console.log(`Rate limit: ${fifteenMin}/600 (15min), ${daily}/1000 (daily)`);
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, waitMs));
                        backoffMs = Math.min(backoffMs * 2, 30000);
                        retries--;
                        continue;
                    }
                    
                    break;
                    
                } catch (error) {
                    console.error('Strava API error:', error);
                    retries--;
                    if (retries === 0) throw error;
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                    backoffMs = Math.min(backoffMs * 2, 30000);
                }
            }
            
            // Handle Strava disconnection
            if (stravaResponse.status === 401) {
                await sql`
                    DELETE FROM strava_tokens WHERE user_id = ${userId};
                    UPDATE integrations_strava 
                    SET last_error = 'Strava access revoked',
                        last_error_code = 'STRAVA_REVOKED',
                        import_in_progress = false
                    WHERE user_id = ${userId}
                `;
                
                throw new ImportError(
                    'STRAVA_REVOKED',
                    'Strava access was revoked. Please reconnect your account.',
                    403
                );
            }
            
            if (!stravaResponse.ok) {
                throw new Error(`Strava API error: ${stravaResponse.status}`);
            }
            
            const activities = await stravaResponse.json();
            
            if (!Array.isArray(activities) || activities.length === 0) {
                hasMore = false;
                break;
            }
            
            // Update cursor for next page
            if (activities.length > 0) {
                lastActivityId = activities[activities.length - 1].id;
            }
            
            // Process activities in transaction
            const pageResults = await sql.begin(async sql => {
                const pageImported = [];
                const pageDuplicates = [];
                const pageUpdated = [];
                const pageFailed = [];
                
                for (const activity of activities) {
                    try {
                        // Map activity
                        const sessionData = mapStravaActivity(activity, userId);
                        
                        // Get sport type from SQL function
                        const sportType = await sql`
                            SELECT map_strava_sport_type(${activity.sport_type}) as type
                        `;
                        sessionData.type = sportType[0].type;
                        
                        // UPSERT with duplicate detection
                        const upsertResult = await sql`
                            INSERT INTO sessions ${sql(sessionData)}
                            ON CONFLICT (user_id, source, source_id)
                            DO UPDATE SET
                                date = EXCLUDED.date,
                                utc_date = EXCLUDED.utc_date,
                                timezone = EXCLUDED.timezone,
                                timezone_offset = EXCLUDED.timezone_offset,
                                duration = EXCLUDED.duration,
                                elapsed_duration = EXCLUDED.elapsed_duration,
                                name = EXCLUDED.name,
                                notes = EXCLUDED.notes,
                                payload = EXCLUDED.payload,
                                updated_at = NOW()
                            RETURNING 
                                id,
                                (xmax = 0) as was_inserted,
                                payload->>'version' as old_version
                        `;
                        
                        // Track in activity cache
                        await sql`
                            INSERT INTO strava_activity_cache (user_id, activity_id, activity_version)
                            VALUES (${userId}, ${activity.id}, ${activity.version || '1'})
                            ON CONFLICT (user_id, activity_id)
                            DO UPDATE SET 
                                last_seen = NOW(),
                                activity_version = EXCLUDED.activity_version
                        `;
                        
                        // Categorize result
                        if (upsertResult[0].was_inserted) {
                            pageImported.push(activity.id);
                        } else if (upsertResult[0].old_version !== (activity.version || '1')) {
                            pageUpdated.push(activity.id);
                        } else {
                            pageDuplicates.push(activity.id);
                        }
                        
                        // Track max activity time
                        const activityTime = Math.floor(new Date(activity.start_date).getTime() / 1000);
                        if (activityTime > parseInt(maxActivityTime)) {
                            maxActivityTime = String(activityTime);
                        }
                        
                    } catch (error) {
                        console.error(`Failed to import activity ${activity.id}:`, error.message);
                        pageFailed.push({
                            activity_id: activity.id,
                            name: activity.name,
                            error: error.message
                        });
                    }
                }
                
                // Log import
                await sql`
                    INSERT INTO strava_import_log (
                        user_id, run_id, page_number,
                        requested_after, requested_per_page,
                        activities_fetched, activities_imported,
                        activities_duplicate, activities_updated,
                        activities_failed, errors,
                        completed_at, duration_ms
                    ) VALUES (
                        ${userId}, ${runId}, ${page},
                        ${after}, ${perPage},
                        ${activities.length}, ${pageImported.length},
                        ${pageDuplicates.length}, ${pageUpdated.length},
                        ${pageFailed.length}, 
                        ${pageFailed.length > 0 ? JSON.stringify(pageFailed) : null},
                        NOW(), ${Date.now() - pageStartTime}
                    )
                `;
                
                return {
                    imported: pageImported.length,
                    duplicates: pageDuplicates.length,
                    updated: pageUpdated.length,
                    failed: pageFailed.length,
                    errors: pageFailed
                };
            });
            
            // Accumulate results
            results.imported += pageResults.imported;
            results.duplicates += pageResults.duplicates;
            results.updated += pageResults.updated;
            results.failed += pageResults.failed;
            if (pageResults.errors.length > 0) {
                results.errors.push(...pageResults.errors.slice(0, 5)); // Limit errors
            }
            results.pages_processed++;
            
            page++;
            hasMore = activities.length === perPage;
        }
        
        // Clean up orphaned activities
        const deletedCount = await sql`
            SELECT cleanup_orphaned_strava_activities(${userId}) as count
        `;
        results.deleted = deletedCount[0].count;
        
        // Update sync state
        const finalStatus = results.failed > 0 ? 'partial' : 'success';
        
        await sql`
            UPDATE integrations_strava
            SET 
                last_import_after = ${maxActivityTime},
                last_run_at = NOW(),
                last_status = ${finalStatus},
                last_error = ${results.errors.length > 0 ? JSON.stringify(results.errors[0]) : null},
                last_error_code = ${results.errors.length > 0 ? 'PARTIAL_FAILURE' : null},
                total_imported = total_imported + ${results.imported},
                total_duplicates = total_duplicates + ${results.duplicates},
                total_updated = total_updated + ${results.updated},
                total_failed = total_failed + ${results.failed},
                import_in_progress = false,
                import_continue_token = null,
                updated_at = NOW()
            WHERE user_id = ${userId}
        `;
        
        console.log(`Strava import complete for user:`, {
            user_hash: crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8),
            imported: results.imported,
            updated: results.updated,
            duplicates: results.duplicates,
            deleted: results.deleted,
            failed: results.failed,
            duration_ms: Date.now() - importStartTime
        });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: 'complete',
                imported: results.imported,
                updated: results.updated,
                duplicates: results.duplicates,
                deleted: results.deleted,
                skipped: results.failed,
                pages_processed: results.pages_processed,
                ...(results.errors.length > 0 && { 
                    partial_errors: results.errors 
                })
            })
        };
        
    } catch (error) {
        console.error('Import error:', error);
        
        // Mark as failed
        await sql`
            UPDATE integrations_strava
            SET 
                last_run_at = NOW(),
                last_status = 'failed',
                last_error = ${error.message},
                last_error_code = ${error.code || 'UNKNOWN'},
                import_in_progress = false,
                updated_at = NOW()
            WHERE user_id = ${userId}
        `.catch(console.error);
        
        if (error instanceof ImportError) {
            return error.toResponse(headers);
        }
        
        return {
            statusCode: 503,
            headers,
            body: JSON.stringify({
                error: {
                    code: 'IMPORT_FAILED',
                    message: 'Import failed',
                    details: error.message
                }
            })
        };
    }
};

/* Example Requests and Responses:

Initial Import:
POST /integrations/strava/import?after=1704067200&per_page=50
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Response (Complete):
{
  "status": "complete",
  "imported": 47,
  "updated": 3,
  "duplicates": 12,
  "deleted": 2,
  "skipped": 1,
  "pages_processed": 2,
  "partial_errors": [
    {
      "activity_id": "9876543210",
      "name": "Morning Run",
      "error": "Invalid activity data"
    }
  ]
}

Response (Partial - Time Limit):
{
  "status": "partial",
  "message": "Import in progress. Call again with continue_token to resume.",
  "continue_token": "eyJwYWdlIjozLCJhZnRlciI6IjE3MDQwNjcyMDAiLCJsYXN0QWN0aXZpdHlJZCI6IjEyMzQ1Njc4OSIsIm1heEFjdGl2aXR5VGltZSI6IjE3MDUwMDAwMDAiLCJpbXBvcnRlZCI6MTAwLCJkdXBsaWNhdGVzIjoyMCwidXBkYXRlZCI6NX0=",
  "imported": 100,
  "updated": 5,
  "duplicates": 20,
  "deleted": 0,
  "skipped": 0,
  "pages_processed": 3
}

Resume Import:
POST /integrations/strava/import
{
  "continue_token": "eyJwYWdlIjozLCJhZnRlciI6IjE3MDQwNjcyMDAi..."
}

Error Response:
{
  "error": {
    "code": "STRAVA_NOT_CONNECTED",
    "message": "Strava account not connected. Please connect your account first.",
    "details": {
      "connect_url": "/settings/integrations/strava"
    }
  }
}
*/
```

### 3.2 GET /integrations/strava/status - Get Sync Status

```javascript
// netlify/functions/integrations-strava-status.js
exports.handler = async (event) => {
    const sql = neon(process.env.DATABASE_URL);
    
    const headers = {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }
    
    try {
        // Authenticate
        const authHeader = event.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    error: {
                        code: 'AUTH_REQUIRED',
                        message: 'Authorization required'
                    }
                })
            };
        }
        
        const token = authHeader.substring(7);
        const jwt = require('jsonwebtoken');
        let userId;
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.sub;
        } catch (err) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    error: {
                        code: 'AUTH_INVALID',
                        message: 'Invalid token'
                    }
                })
            };
        }
        
        // Get sync status
        const syncState = await sql`
            SELECT 
                last_import_after,
                last_run_at,
                last_status,
                last_error,
                last_error_code,
                total_imported,
                total_duplicates,
                total_updated,
                total_failed,
                import_in_progress,
                import_continue_token,
                import_started_at,
                created_at,
                updated_at
            FROM integrations_strava
            WHERE user_id = ${userId}
        `;
        
        if (!syncState.length) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    connected: false,
                    last_import_after: null,
                    last_run_at: null,
                    last_status: null,
                    import_in_progress: false,
                    statistics: {
                        total_imported: 0,
                        total_duplicates: 0,
                        total_updated: 0,
                        total_failed: 0
                    }
                })
            };
        }
        
        const state = syncState[0];
        
        // Check Strava connection
        const tokenCheck = await sql`
            SELECT expires_at 
            FROM strava_tokens 
            WHERE user_id = ${userId}
        `;
        
        const connected = tokenCheck.length > 0;
        const tokenValid = connected && new Date(tokenCheck[0].expires_at) > new Date();
        
        // Get recent imports
        const recentImports = await sql`
            SELECT 
                run_id,
                MIN(started_at) as started_at,
                MAX(completed_at) as completed_at,
                SUM(activities_imported) as total_imported,
                SUM(activities_duplicate) as total_duplicate,
                SUM(activities_updated) as total_updated,
                SUM(activities_failed) as total_failed,
                COUNT(*) as pages_processed,
                BOOL_OR(timed_out) as was_partial
            FROM strava_import_log
            WHERE user_id = ${userId}
            AND started_at > NOW() - INTERVAL '7 days'
            GROUP BY run_id
            ORDER BY started_at DESC
            LIMIT 5
        `;
        
        // Calculate import progress if in progress
        let importProgress = null;
        if (state.import_in_progress && state.import_started_at) {
            const elapsed = Date.now() - new Date(state.import_started_at).getTime();
            importProgress = {
                started_at: state.import_started_at,
                elapsed_ms: elapsed,
                has_continue_token: !!state.import_continue_token
            };
        }
        
        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Cache-Control': 'private, max-age=5'
            },
            body: JSON.stringify({
                connected,
                token_valid: tokenValid,
                last_import_after: state.last_import_after,
                last_import_date: state.last_import_after 
                    ? new Date(parseInt(state.last_import_after) * 1000).toISOString()
                    : null,
                last_run_at: state.last_run_at,
                last_status: state.last_status,
                last_error: state.last_error,
                last_error_code: state.last_error_code,
                import_in_progress: state.import_in_progress,
                import_progress: importProgress,
                continue_token: state.import_continue_token,
                statistics: {
                    total_imported: state.total_imported,
                    total_duplicates: state.total_duplicates,
                    total_updated: state.total_updated,
                    total_failed: state.total_failed
                },
                recent_imports: recentImports.map(imp => ({
                    run_id: imp.run_id,
                    started_at: imp.started_at,
                    completed_at: imp.completed_at,
                    duration_ms: imp.completed_at 
                        ? new Date(imp.completed_at) - new Date(imp.started_at)
                        : null,
                    imported: parseInt(imp.total_imported),
                    duplicates: parseInt(imp.total_duplicate),
                    updated: parseInt(imp.total_updated),
                    failed: parseInt(imp.total_failed),
                    pages: parseInt(imp.pages_processed),
                    was_partial: imp.was_partial
                }))
            })
        };
        
    } catch (error) {
        console.error('Status error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: {
                    code: 'STATUS_ERROR',
                    message: 'Failed to get status'
                }
            })
        };
    }
};
```

## Section 4: Import Logic

### Token Management
1. Check token expiry before each import
2. Auto-refresh using Feature 2's `/strava-refresh-token` endpoint  
3. Proper decryption using TokenEncryption class
4. Handle 401s by cleaning up tokens and marking as disconnected

### Pagination Strategy
- Prefer cursor-based with activity ID for stability
- Fallback to page numbers if no cursor available
- Track `lastActivityId` in continue token
- Update `last_import_after` to max activity timestamp seen

### Time-Boxing & Resume
```javascript
// 9-second time budget with resume support
const MAX_RUNTIME_MS = 9000;

if (Date.now() - importStartTime > MAX_RUNTIME_MS) {
    // Save state
    const continueToken = Buffer.from(JSON.stringify({
        page,
        after,
        lastActivityId,
        maxActivityTime,
        ...currentResults
    })).toString('base64');
    
    // Return 206 Partial Content
    return {
        statusCode: 206,
        body: JSON.stringify({
            status: 'partial',
            continue_token: continueToken,
            ...currentResults
        })
    };
}
```

### Deduplication & Update Detection
```sql
-- UPSERT with change detection
INSERT INTO sessions ... 
ON CONFLICT (user_id, source, source_id)
DO UPDATE SET ... 
RETURNING 
    id,
    (xmax = 0) as was_inserted,  -- true = new insert
    payload->>'version' as old_version  -- compare versions
```

### Orphan Cleanup
```sql
-- After import, remove activities no longer on Strava
DELETE FROM sessions
WHERE source = 'strava'
AND source_id NOT IN (
    SELECT activity_id::TEXT FROM strava_activity_cache
    WHERE last_seen > NOW() - INTERVAL '1 hour'
);
```

### Error Handling
- Network timeout protection with AbortController (5s)
- Exponential backoff for rate limits (correctly reading `Retry-After` header)
- Detect Strava disconnection (401) and clean up tokens
- Partial failures tracked but don't block import
- Standardized error responses

## Section 5: Acceptance Criteria

### Functional Requirements
- [x] Import fetches activities from Strava API with resume support
- [x] Time-boxed execution returns 206 with continue_token
- [x] Automatic token refresh when expired (via Feature 2)
- [x] Both local and UTC times stored with timezone info
- [x] Complete field mapping including power, HR, achievements
- [x] Deduplication with update detection via UPSERT
- [x] Orphaned activities cleaned up after import
- [x] Incremental import uses string `last_import_after` (no precision loss)
- [x] Backfill supports custom `after` parameter
- [x] Status endpoint shows in-progress imports

### Security & Validation
- [x] JWT authentication required for all endpoints
- [x] Users can only import their own activities
- [x] `after` parameter validated as unix timestamp string
- [x] `after` cannot be in the future
- [x] `per_page` limited to 1-100
- [x] Total activities capped at 1000 per complete import
- [x] No tokens logged, user IDs hashed in logs
- [x] Token decryption using Feature 2's encryption

### Error Handling
- [x] Standardized error envelope: `{ error: { code, message, details? } }`
- [x] 401 for missing/invalid JWT
- [x] 403 for Strava not connected or revoked
- [x] 206 for partial import with continue_token
- [x] 409 for import already in progress
- [x] 429 handled with exponential backoff
- [x] 502 for token refresh failures
- [x] 503 for internal failures

### Performance
- [x] 9-second time budget for Lambda execution
- [x] Network requests timeout after 5 seconds
- [x] Rate limiting with correct header parsing
- [x] Connection reuse via Neon pooling
- [x] Maximum 20 pages per complete import run
- [x] Resume support for large imports

## Section 6: Test Plan

### Unit Tests

```javascript
// tests/strava-import.test.js
describe('Strava Import', () => {
    test('maps activities with correct timezone', () => {
        const activity = {
            id: 123456789,
            name: 'Morning Run',
            sport_type: 'Run',
            start_date: '2024-01-15T12:00:00Z', // UTC
            start_date_local: '2024-01-15T07:00:00Z', // Local time
            timezone: '(GMT-05:00) America/New_York',
            moving_time: 1800,
            elapsed_time: 2000,
            distance: 5000,
            version: 'abc123'
        };
        
        const session = mapStravaActivity(activity, 'user-123');
        
        expect(session.date).toEqual(new Date('2024-01-15T07:00:00Z'));
        expect(session.utc_date).toEqual(new Date('2024-01-15T12:00:00Z'));
        expect(session.timezone_offset).toBe(-300); // -5 hours in minutes
        expect(session.duration).toBe(30); // moving time
        expect(session.elapsed_duration).toBe(34); // elapsed time rounded up
        expect(session.payload.version).toBe('abc123');
    });
    
    test('handles missing optional fields gracefully', () => {
        const minimal = {
            id: 123,
            sport_type: 'Workout',
            start_date: '2024-01-15T12:00:00Z'
        };
        
        const session = mapStravaActivity(minimal, 'user-123');
        
        expect(session.name).toBe('Workout Activity');
        expect(session.duration).toBe(0);
        expect(session.payload.summary.distance_km).toBeNull();
        expect(session.payload.metadata.has_gps).toBe(false);
    });
    
    test('validates after parameter correctly', () => {
        expect(validateAfterParam('1704067200')).toBe(true);
        expect(validateAfterParam('99999999999')).toBe(false); // Too far future
        expect(validateAfterParam('-1')).toBe(false);
        expect(validateAfterParam('abc')).toBe(false);
    });
});
```

### Integration Tests

```javascript
// tests/strava-import-integration.test.js
describe('Strava Import API', () => {
    test('resumes import with continue token', async () => {
        // Mock timeout on first call
        const firstResponse = await fetch('/.netlify/functions/integrations-strava-import', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        expect(firstResponse.status).toBe(206); // Partial
        const firstData = await firstResponse.json();
        expect(firstData.status).toBe('partial');
        expect(firstData.continue_token).toBeDefined();
        
        // Resume with token
        const resumeResponse = await fetch('/.netlify/functions/integrations-strava-import', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                continue_token: firstData.continue_token
            })
        });
        
        expect(resumeResponse.status).toBe(200);
        const resumeData = await resumeResponse.json();
        expect(resumeData.status).toBe('complete');
        expect(resumeData.imported).toBeGreaterThan(firstData.imported);
    });
    
    test('detects and counts updates vs duplicates', async () => {
        // Import activity
        const activity1 = { id: 123, version: 'v1', name: 'Run', ...baseActivity };
        mockStravaResponse([activity1]);
        
        const response1 = await importActivities(token);
        expect(response1.imported).toBe(1);
        expect(response1.duplicates).toBe(0);
        expect(response1.updated).toBe(0);
        
        // Same activity, same version = duplicate
        mockStravaResponse([activity1]);
        const response2 = await importActivities(token);
        expect(response2.imported).toBe(0);
        expect(response2.duplicates).toBe(1);
        expect(response2.updated).toBe(0);
        
        // Same activity, new version = update
        const activity1Updated = { ...activity1, version: 'v2', name: 'Morning Run' };
        mockStravaResponse([activity1Updated]);
        const response3 = await importActivities(token);
        expect(response3.imported).toBe(0);
        expect(response3.duplicates).toBe(0);
        expect(response3.updated).toBe(1);
    });
    
    test('cleans up deleted activities', async () => {
        // Import 3 activities
        const activities = [
            { id: 1, ...baseActivity },
            { id: 2, ...baseActivity },
            { id: 3, ...baseActivity }
        ];
        mockStravaResponse(activities);
        
        const response1 = await importActivities(token);
        expect(response1.imported).toBe(3);
        
        // Import again with only 2 activities (one deleted on Strava)
        mockStravaResponse([activities[0], activities[2]]);
        const response2 = await importActivities(token);
        expect(response2.deleted).toBe(1); // Activity 2 was deleted
    });
    
    test('handles Strava disconnection gracefully', async () => {
        // Mock 401 from Strava
        nock('https://www.strava.com')
            .get('/api/v3/athlete/activities')
            .reply(401);
        
        const response = await fetch('/.netlify/functions/integrations-strava-import', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.error.code).toBe('STRAVA_REVOKED');
        
        // Verify token was cleaned up
        const tokenExists = await checkTokenExists(userId);
        expect(tokenExists).toBe(false);
    });
    
    test('respects time budget and returns partial', async () => {
        // Mock many pages of activities
        for (let i = 1; i <= 50; i++) {
            nock('https://www.strava.com')
                .get('/api/v3/athlete/activities')
                .query(true)
                .delay(500) // Simulate slow responses
                .reply(200, Array(30).fill(baseActivity));
        }
        
        const start = Date.now();
        const response = await importActivities(token);
        const duration = Date.now() - start;
        
        expect(duration).toBeLessThan(10000); // Under 10s
        expect(response.status).toBe(206); // Partial
        expect(response.continue_token).toBeDefined();
    });
});
```

## Later (Deferred Items)

### Deferred to Phase 2:

1. **Webhook Support**
   - **Reason**: Requires public URL and webhook verification challenge
   - **Future**: Implement POST /integrations/strava/webhook with challenge response
   - **Benefit**: Real-time activity updates instead of polling

2. **Automatic/Scheduled Imports**
   - **Reason**: Requires job scheduling infrastructure (cron, queues)
   - **Future**: Daily import job checking all connected users
   - **Complexity**: Need to handle concurrent imports, quotas

3. **Activity Details Import** 
   - **Reason**: Requires additional API calls per activity (rate limit intensive)
   - **Future**: Import full streams (GPS, HR, power) for detailed analysis
   - **Storage**: Would need efficient time-series storage

4. **Bulk Activity Updates**
   - **Reason**: Complex conflict resolution for mass updates
   - **Future**: Allow updating multiple activities from Strava
   - **Use case**: Bulk privacy changes, gear updates

5. **Import Filtering**
   - **Reason**: Adds UI complexity for initial version
   - **Future**: Filter by sport type, date range, privacy
   - **Benefit**: More control over what gets imported

### Technical Debt to Address:

6. **Rate Limit Optimization**: Current approach is conservative; could batch requests better
7. **Compression**: Large payloads could benefit from gzip
8. **Caching**: Token decryption could be cached for duration of import
9. **Metrics**: Add CloudWatch metrics for import success rates
10. **Retry Queue**: Failed activities could be queued for retry

These items are deferred to keep initial implementation focused on core functionality while ensuring data integrity, proper timezone handling, and resumable imports for large datasets.