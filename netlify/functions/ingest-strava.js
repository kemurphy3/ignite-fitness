/**
 * Strava Ingest Handler
 * Accepts Strava activity payloads, normalizes, deduplicates, and merges activities
 */

const { createClient } = require('@supabase/supabase-js');

// Mock imports for Node.js environment
let StravaNormalizer, DedupRules, LoadMath;

try {
    // Try to load modules if available in Node.js
    StravaNormalizer = require('../../js/modules/integrations/normalize/stravaNormalizer.js').StravaNormalizer;
} catch (e) {
    // Fallback to inline implementations
    console.warn('StravaNormalizer not available, using inline implementation');
}

/**
 * Process Strava activities through normalization, deduplication, and merging
 */
async function ingestStravaActivities(payload, userId, supabase) {
    const results = [];
    const affectedDates = new Set();
    const activitiesById = new Map(); // Track activities by ID for stream attachment

    console.log(`Processing ${payload.activities?.length || 0} Strava activities for user ${userId}`);

    // Step 1: Normalize all activities
    for (const rawActivity of payload.activities || []) {
        try {
            const normalized = normalizeStravaActivity(rawActivity, userId);
            const dedupHash = buildDedupHash(normalized);
            
            // Check for existing activity by dedup hash
            const existingActivity = await findActivityByDedupHash(dedupHash, userId, supabase);
            
            let result;
            if (existingActivity) {
                // Activity already exists - check if we should update
                result = await handleExistingActivity(existingActivity, normalized, userId, supabase, affectedDates);
            } else {
                // New activity - check for likely duplicates
                const likelyDuplicates = await findLikelyDuplicates(normalized, userId, supabase);
                
                if (likelyDuplicates.length > 0) {
                    // Merge with existing activity
                    result = await handleLikelyDuplicate(likelyDuplicates[0], normalized, userId, supabase, affectedDates);
                } else {
                    // Truly new activity - insert
                    result = await handleNewActivity(normalized, userId, supabase, affectedDates);
                }
            }
            
            results.push(result);
            
            // Store for potential stream attachment
            if (result.status === 'imported' || result.status === 'updated') {
                activitiesById.set(result.id, result);
            }
            
        } catch (error) {
            console.error('Error processing activity:', error);
            results.push({
                id: rawActivity.id,
                externalId: rawActivity.id?.toString(),
                status: 'error',
                error: error.message
            });
        }
    }

    // Step 2: Attach streams if provided
    if (payload.streams) {
        await attachStreams(payload.streams, activitiesById, supabase);
    }

    // Step 3: Log ingestion
    await logIngestion(userId, 'strava', payload, results, supabase);

    // Step 4: Trigger aggregate recalculation for affected dates
    if (affectedDates.size > 0) {
        console.log(`Triggering aggregate recalculation for ${affectedDates.size} dates`);
        for (const date of affectedDates) {
            await triggerAggregateRecalculation(userId, date, supabase);
        }
    }

    return results;
}

/**
 * Normalize Strava activity to internal format
 */
function normalizeStravaActivity(rawActivity, userId) {
    return {
        userId: userId,
        canonicalSource: 'strava',
        canonicalExternalId: rawActivity.id?.toString(),
        type: mapStravaActivityType(rawActivity.type),
        name: rawActivity.name || 'Untitled Activity',
        startTs: rawActivity.start_date,
        endTs: rawActivity.start_date ? 
            new Date(new Date(rawActivity.start_date).getTime() + (rawActivity.moving_time || 0) * 1000).toISOString() : 
            null,
        durationS: rawActivity.moving_time || rawActivity.elapsed_time || 0,
        device: extractDeviceInfo(rawActivity),
        hasHr: !!rawActivity.has_heartrate,
        hasGps: !!rawActivity.start_latlng,
        hasPower: !!rawActivity.device_watts,
        distanceM: rawActivity.distance || 0,
        avgHr: rawActivity.average_heartrate || null,
        maxHr: rawActivity.max_heartrate || null,
        caloriesKcal: rawActivity.calories || null,
        sourceSet: {
            strava: {
                id: rawActivity.id?.toString(),
                richness: calculateRichness(rawActivity)
            }
        },
        isExcluded: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rawActivity: rawActivity // Keep original for potential stream processing
    };
}

/**
 * Build deduplication hash
 */
function buildDedupHash(activity) {
    const { userId, startTs, durationS, type } = activity;
    const durationMinutes = Math.round(durationS / 60);
    const hashInput = `${userId}|${startTs}|${durationMinutes}|${type}`;
    return hashString(hashInput);
}

/**
 * Simple hash function
 */
function hashString(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

/**
 * Calculate richness score for an activity
 */
function calculateRichness(activity) {
    let score = 0.0;

    if (activity.has_heartrate || activity.average_heartrate || activity.max_heartrate) score += 0.4;
    if (activity.start_latlng || activity.end_latlng || activity.distance) score += 0.2;
    if (activity.device_watts || activity.average_watts) score += 0.2;
    if (activity.device_name || activity.device_type) score += 0.1;
    if (activity.calories && activity.calories > 0) score += 0.05;

    return Math.min(score, 1.0);
}

/**
 * Map Strava activity type to internal type
 */
function mapStravaActivityType(stravaType) {
    const typeMap = {
        'Run': 'Run',
        'Ride': 'Ride',
        'Swim': 'Swim',
        'Walk': 'Walk',
        'Hike': 'Hike',
        'WeightTraining': 'Strength',
        'Workout': 'Strength',
        'Yoga': 'Yoga',
        'Soccer': 'Soccer'
    };
    return typeMap[stravaType] || 'Other';
}

/**
 * Extract device information
 */
function extractDeviceInfo(rawActivity) {
    const device = {};
    if (rawActivity.device_name) device.name = rawActivity.device_name;
    if (rawActivity.device_type) device.type = rawActivity.device_type;
    return Object.keys(device).length > 0 ? device : null;
}

/**
 * Find activity by dedup hash
 */
async function findActivityByDedupHash(dedupHash, userId, supabase) {
    try {
        const { data, error } = await supabase
            .from('activities')
            .select('*')
            .eq('dedup_hash', dedupHash)
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            console.error('Error finding activity by hash:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Exception finding activity by hash:', error);
        return null;
    }
}

/**
 * Find likely duplicates (within ±6 minutes, ±10% duration)
 */
async function findLikelyDuplicates(normalized, userId, supabase) {
    try {
        const startTs = new Date(normalized.startTs);
        const sixMinutesBefore = new Date(startTs.getTime() - 6 * 60 * 1000);
        const sixMinutesAfter = new Date(startTs.getTime() + 6 * 60 * 1000);

        const { data, error } = await supabase
            .from('activities')
            .select('*')
            .eq('user_id', userId)
            .eq('type', normalized.type)
            .gte('start_ts', sixMinutesBefore.toISOString())
            .lte('start_ts', sixMinutesAfter.toISOString());

        if (error) {
            console.error('Error finding likely duplicates:', error);
            return [];
        }

        // Filter by duration tolerance
        return data.filter(activity => {
            const duration1 = normalized.durationS || 0;
            const duration2 = activity.duration_s || 0;
            
            if (duration1 === 0 || duration2 === 0) return false;

            const durationDiff = Math.abs(duration1 - duration2);
            const durationTolerance = Math.max(duration1, duration2) * 0.1;

            return durationDiff <= durationTolerance;
        });
    } catch (error) {
        console.error('Exception finding likely duplicates:', error);
        return [];
    }
}

/**
 * Handle existing activity (check for richer version)
 */
async function handleExistingActivity(existing, normalized, userId, supabase, affectedDates) {
    const existingRichness = calculateRichness(existing) || 0;
    const newRichness = calculateRichness(normalized.rawActivity) || 0;

    // If new version is richer, update
    if (newRichness > existingRichness) {
        console.log(`Updating activity ${existing.id} with richer version (richness: ${existingRichness} -> ${newRichness})`);
        
        // Update source set
        const updatedSourceSet = existing.source_set || {};
        updatedSourceSet.strava = normalized.sourceSet.strava;
        updatedSourceSet.merged_from = updatedSourceSet.merged_from || [];
        
        if (existing.canonical_source !== 'strava') {
            updatedSourceSet.merged_from.push({
                canonical_source: existing.canonical_source,
                canonical_external_id: existing.canonical_external_id,
                merged_at: new Date().toISOString()
            });
        }

        // Update activity
        const { data, error } = await supabase
            .from('activities')
            .update({
                avg_hr: normalized.avgHr || existing.avg_hr,
                max_hr: normalized.maxHr || existing.max_hr,
                has_hr: normalized.hasHr || existing.has_hr,
                has_gps: normalized.hasGps || existing.has_gps,
                has_power: normalized.hasPower || existing.has_power,
                distance_m: normalized.distanceM || existing.distance_m,
                calories_kcal: normalized.caloriesKcal || existing.calories_kcal,
                source_set: updatedSourceSet,
                updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating activity:', error);
            return { id: existing.id, externalId: normalized.canonicalExternalId, status: 'error', error: error.message };
        }

        affectedDates.add(new Date(normalized.startTs).toISOString().split('T')[0]);
        return { id: data.id, externalId: normalized.canonicalExternalId, status: 'updated', richness: newRichness };
    }

    // Skip duplicate
    console.log(`Skipping duplicate activity ${existing.id} (richness: ${existingRichness}, new: ${newRichness})`);
    return { id: existing.id, externalId: normalized.canonicalExternalId, status: 'skipped_dup', richness: existingRichness };
}

/**
 * Handle likely duplicate (merge activities)
 */
async function handleLikelyDuplicate(existing, normalized, userId, supabase, affectedDates) {
    const existingRichness = calculateRichness(existing) || 0;
    const newRichness = calculateRichness(normalized.rawActivity) || 0;

    // Determine which is primary based on richness
    const primaryRichness = newRichness > existingRichness ? newRichness : existingRichness;
    // Track merge information for audit trail

    // Update source set
    const updatedSourceSet = existing.source_set || {};
    updatedSourceSet.strava = normalized.sourceSet.strava;
    updatedSourceSet.merged_from = updatedSourceSet.merged_from || [];
    
    if (existing.canonical_source !== 'strava') {
        updatedSourceSet.merged_from.push({
            canonical_source: existing.canonical_source,
            canonical_external_id: existing.canonical_external_id,
            merged_at: new Date().toISOString()
        });
    }

    // Update existing activity with Strava data
    const { data, error } = await supabase
        .from('activities')
        .update({
            avg_hr: normalized.avgHr || existing.avg_hr,
            max_hr: normalized.maxHr || existing.max_hr,
            has_hr: normalized.hasHr || existing.has_hr,
            has_gps: normalized.hasGps || existing.has_gps,
            has_power: normalized.hasPower || existing.has_power,
            distance_m: normalized.distanceM || existing.distance_m,
            calories_kcal: normalized.caloriesKcal || existing.calories_kcal,
            source_set: updatedSourceSet,
            updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

    if (error) {
        console.error('Error merging activity:', error);
        return { id: existing.id, externalId: normalized.canonicalExternalId, status: 'error', error: error.message };
    }

    affectedDates.add(new Date(normalized.startTs).toISOString().split('T')[0]);
    return { id: data.id, externalId: normalized.canonicalExternalId, status: 'merged', richness: primaryRichness };
}

/**
 * Handle new activity (insert)
 */
async function handleNewActivity(normalized, userId, supabase, affectedDates) {
    const dedupHash = buildDedupHash(normalized);

    const { data, error } = await supabase
        .from('activities')
        .insert({
            user_id: userId,
            canonical_source: normalized.canonicalSource,
            canonical_external_id: normalized.canonicalExternalId,
            type: normalized.type,
            name: normalized.name,
            start_ts: normalized.startTs,
            end_ts: normalized.endTs,
            duration_s: normalized.durationS,
            device: normalized.device,
            has_hr: normalized.hasHr,
            has_gps: normalized.hasGps,
            has_power: normalized.hasPower,
            distance_m: normalized.distanceM,
            avg_hr: normalized.avgHr,
            max_hr: normalized.maxHr,
            calories_kcal: normalized.caloriesKcal,
            source_set: normalized.sourceSet,
            is_excluded: normalized.isExcluded,
            dedup_hash: dedupHash
        })
        .select()
        .single();

    if (error) {
        console.error('Error inserting activity:', error);
        return { id: null, externalId: normalized.canonicalExternalId, status: 'error', error: error.message };
    }

    affectedDates.add(new Date(normalized.startTs).toISOString().split('T')[0]);
    return { id: data.id, externalId: normalized.canonicalExternalId, status: 'imported', richness: calculateRichness(normalized.rawActivity) };
}

/**
 * Attach streams to activities
 */
async function attachStreams(streamsByActivityId, activitiesById, supabase) {
    for (const [externalId, streams] of Object.entries(streamsByActivityId)) {
        const activity = Array.from(activitiesById.values()).find(a => a.externalId === externalId);
        if (!activity || !activity.id) continue;

        for (const [streamType, streamData] of Object.entries(streams)) {
            try {
                await supabase
                    .from('activity_streams')
                    .insert({
                        activity_id: activity.id,
                        stream_type: streamType,
                        samples: streamData,
                        sample_rate_hz: calculateSampleRate(streamData)
                    });
            } catch (error) {
                console.error(`Error attaching stream ${streamType} to activity ${activity.id}:`, error);
            }
        }
    }
}

/**
 * Calculate sample rate
 */
function calculateSampleRate(samples) {
    if (!Array.isArray(samples) || samples.length < 2) return 0;
    const timeSpan = samples[samples.length - 1].t - samples[0].t;
    return samples.length / timeSpan;
}

/**
 * Log ingestion results
 */
async function logIngestion(userId, provider, payload, results, supabase) {
    for (const result of results) {
        try {
            await supabase
                .from('ingest_log')
                .insert({
                    user_id: userId,
                    provider: provider,
                    external_id: result.externalId,
                    status: result.status,
                    metadata: { error: result.error, richness: result.richness }
                });
        } catch (error) {
            console.error('Error logging ingestion:', error);
        }
    }
}

/**
 * Trigger aggregate recalculation
 */
async function triggerAggregateRecalculation(userId, date, supabase) {
    // This would typically trigger an async job or queue
    // For now, we'll just log it
    console.log(`Triggering aggregate recalculation for user ${userId} on ${date}`);
    
    // In a real implementation, this would:
    // 1. Query activities for that date
    // 2. Calculate TRIMP, TSS, zones, etc.
    // 3. Update daily_aggregates table
    // 4. Recalculate rolling metrics (ATL, CTL, etc.)
}

/**
 * Main handler function
 */
exports.handler = async function(event, context) {
    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { userId, payload } = JSON.parse(event.body || '{}');

        if (!userId || !payload) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing userId or payload' })
            };
        }

        // Initialize Supabase client
        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Database configuration missing' })
            };
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Process activities
        const results = await ingestStravaActivities(payload, userId, supabase);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ results })
        };

    } catch (error) {
        console.error('Error in ingest-strava handler:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
