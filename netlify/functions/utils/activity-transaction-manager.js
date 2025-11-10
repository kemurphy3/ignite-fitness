/**
 * Database Transaction Manager for Activity Deduplication
 * Provides atomic operations with rollback capability for Strava ingestion
 */

const { createClient } = require('@supabase/supabase-js');
const TransactionRollbackManager = require('./transaction-rollback');

class ActivityTransactionManager {
    constructor(supabase) {
        this.supabase = supabase;
        this.transactions = new Map(); // Track active transactions
        this.rollbackManager = new TransactionRollbackManager(supabase);
    }

    /**
     * Execute activity deduplication in a transaction
     * @param {Object} normalized - Normalized activity data
     * @param {string} userId - User ID
     * @param {Set} affectedDates - Set to track affected dates
     * @returns {Promise<Object>} - Result object with status and data
     */
    async executeActivityDedupTransaction(normalized, userId, affectedDates) {
        const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            // Start transaction tracking
            this.rollbackManager.startTransaction(transactionId);
            console.log(`Starting transaction ${transactionId} for activity ${normalized.canonicalExternalId}`);

            // Step 1: Check for existing activity by dedup hash
            const existingActivity = await this.findActivityByDedupHash(normalized.dedupHash, userId);

            let result;
            if (existingActivity) {
                result = await this.handleExistingActivityInTransaction(existingActivity, normalized, userId, affectedDates, transactionId);
            } else {
                // Step 2: Check for likely duplicates
                const likelyDuplicates = await this.findLikelyDuplicatesInTransaction(normalized, userId);

                if (likelyDuplicates.length > 0) {
                    result = await this.handleLikelyDuplicateInTransaction(likelyDuplicates[0], normalized, userId, affectedDates, transactionId);
                } else {
                    result = await this.handleNewActivityInTransaction(normalized, userId, affectedDates, transactionId);
                }
            }

            // Step 3: Commit transaction
            this.rollbackManager.completeTransaction(transactionId);
            console.log(`Transaction ${transactionId} completed successfully`);
            return result;

        } catch (error) {
            // Step 4: Rollback transaction
            console.error(`Transaction ${transactionId} failed, rolling back:`, error);
            await this.rollbackManager.executeRollback(transactionId);
            throw error;
        }
    }

    /**
     * Find activity by dedup hash within transaction
     */
    async findActivityByDedupHash(dedupHash, userId) {
        try {
            const { data, error } = await this.supabase
                .from('activities')
                .select('*')
                .eq('dedup_hash', dedupHash)
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = not found
                throw new Error(`Database error finding activity: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error('Error finding activity by hash:', error);
            throw error;
        }
    }

    /**
     * Find likely duplicates within transaction
     */
    async findLikelyDuplicatesInTransaction(normalized, userId) {
        try {
            const startTs = new Date(normalized.startTs);
            const sixMinutesBefore = new Date(startTs.getTime() - 6 * 60 * 1000);
            const sixMinutesAfter = new Date(startTs.getTime() + 6 * 60 * 1000);

            const { data, error } = await this.supabase
                .from('activities')
                .select('*')
                .eq('user_id', userId)
                .eq('type', normalized.type)
                .gte('start_ts', sixMinutesBefore.toISOString())
                .lte('start_ts', sixMinutesAfter.toISOString());

            if (error) {
                throw new Error(`Database error finding duplicates: ${error.message}`);
            }

            // Filter by duration tolerance
            return data.filter(activity => {
                const duration1 = normalized.durationS || 0;
                const duration2 = activity.duration_s || 0;

                if (duration1 === 0 || duration2 === 0) {return false;}

                const durationDiff = Math.abs(duration1 - duration2);
                const durationTolerance = Math.max(duration1, duration2) * 0.1;

                return durationDiff <= durationTolerance;
            });
        } catch (error) {
            console.error('Error finding likely duplicates:', error);
            throw error;
        }
    }

    /**
     * Handle existing activity within transaction
     */
    async handleExistingActivityInTransaction(existing, normalized, userId, affectedDates, transactionId) {
        const existingRichness = this.calculateRichness(existing) || 0;
        const newRichness = this.calculateRichness(normalized.rawActivity) || 0;

        // If new version is richer, update
        if (newRichness > existingRichness) {
            console.log(`Transaction ${transactionId}: Updating activity ${existing.id} with richer version`);

            // Record original state for rollback
            this.rollbackManager.recordAction(transactionId, 'update', {
                table: 'activities',
                id: existing.id,
                originalValues: {
                    avg_hr: existing.avg_hr,
                    max_hr: existing.max_hr,
                    has_hr: existing.has_hr,
                    has_gps: existing.has_gps,
                    has_power: existing.has_power,
                    distance_m: existing.distance_m,
                    calories_kcal: existing.calories_kcal,
                    source_set: existing.source_set,
                    updated_at: existing.updated_at
                }
            });

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

            // Update activity atomically
            const { data, error } = await this.supabase
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
                throw new Error(`Failed to update activity: ${error.message}`);
            }

            affectedDates.add(new Date(normalized.startTs).toISOString().split('T')[0]);
            return { id: data.id, externalId: normalized.canonicalExternalId, status: 'updated', richness: newRichness };
        }

        // Skip duplicate
        console.log(`Transaction ${transactionId}: Skipping duplicate activity ${existing.id}`);
        return { id: existing.id, externalId: normalized.canonicalExternalId, status: 'skipped_dup', richness: existingRichness };
    }

    /**
     * Handle likely duplicate within transaction
     */
    async handleLikelyDuplicateInTransaction(existing, normalized, userId, affectedDates, transactionId) {
        const existingRichness = this.calculateRichness(existing) || 0;
        const newRichness = this.calculateRichness(normalized.rawActivity) || 0;
        const primaryRichness = newRichness > existingRichness ? newRichness : existingRichness;

        console.log(`Transaction ${transactionId}: Merging activity ${existing.id} with Strava data`);

        // Record original state for rollback
        this.rollbackManager.recordAction(transactionId, 'update', {
            table: 'activities',
            id: existing.id,
            originalValues: {
                avg_hr: existing.avg_hr,
                max_hr: existing.max_hr,
                has_hr: existing.has_hr,
                has_gps: existing.has_gps,
                has_power: existing.has_power,
                distance_m: existing.distance_m,
                calories_kcal: existing.calories_kcal,
                source_set: existing.source_set,
                updated_at: existing.updated_at
            }
        });

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

        // Update existing activity atomically
        const { data, error } = await this.supabase
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
            throw new Error(`Failed to merge activity: ${error.message}`);
        }

        affectedDates.add(new Date(normalized.startTs).toISOString().split('T')[0]);
        return { id: data.id, externalId: normalized.canonicalExternalId, status: 'merged', richness: primaryRichness };
    }

    /**
     * Handle new activity within transaction
     */
    async handleNewActivityInTransaction(normalized, userId, affectedDates, transactionId) {
        console.log(`Transaction ${transactionId}: Inserting new activity ${normalized.canonicalExternalId}`);

        // Record insert action for rollback
        this.rollbackManager.recordAction(transactionId, 'insert', {
            table: 'activities',
            id: null // Will be set after insert
        });

        const { data, error } = await this.supabase
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
                dedup_hash: normalized.dedupHash
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to insert activity: ${error.message}`);
        }

        // Update the rollback action with the actual ID
        const transaction = this.rollbackManager.compensatingActions.get(transactionId);
        if (transaction) {
            const lastAction = transaction.actions[transaction.actions.length - 1];
            if (lastAction && lastAction.type === 'insert') {
                lastAction.data.id = data.id;
            }
        }

        affectedDates.add(new Date(normalized.startTs).toISOString().split('T')[0]);
        return { id: data.id, externalId: normalized.canonicalExternalId, status: 'imported', richness: this.calculateRichness(normalized.rawActivity) };
    }

    /**
     * Attach streams within transaction
     */
    async attachStreamsInTransaction(streamsByActivityId, activitiesById, transactionId) {
        console.log(`Transaction ${transactionId}: Attaching streams to activities`);

        for (const [externalId, streams] of Object.entries(streamsByActivityId)) {
            const activity = Array.from(activitiesById.values()).find(a => a.externalId === externalId);
            if (!activity || !activity.id) {continue;}

            for (const [streamType, streamData] of Object.entries(streams)) {
                try {
                    // Record insert action for rollback
                    this.rollbackManager.recordAction(transactionId, 'insert', {
                        table: 'activity_streams',
                        id: null // Will be set after insert
                    });

                    const { data, error } = await this.supabase
                        .from('activity_streams')
                        .insert({
                            activity_id: activity.id,
                            stream_type: streamType,
                            samples: streamData,
                            sample_rate_hz: this.calculateSampleRate(streamData)
                        })
                        .select()
                        .single();

                    if (error) {
                        throw new Error(`Failed to attach stream ${streamType}: ${error.message}`);
                    }

                    // Update the rollback action with the actual ID
                    const transaction = this.rollbackManager.compensatingActions.get(transactionId);
                    if (transaction) {
                        const lastAction = transaction.actions[transaction.actions.length - 1];
                        if (lastAction && lastAction.type === 'insert') {
                            lastAction.data.id = data.id;
                        }
                    }
                } catch (error) {
                    console.error(`Error attaching stream ${streamType} to activity ${activity.id}:`, error);
                    throw error;
                }
            }
        }
    }

    /**
     * Log ingestion within transaction
     */
    async logIngestionInTransaction(userId, provider, payload, results, transactionId) {
        console.log(`Transaction ${transactionId}: Logging ingestion results`);

        for (const result of results) {
            try {
                // Record insert action for rollback
                this.rollbackManager.recordAction(transactionId, 'insert', {
                    table: 'ingest_log',
                    id: null // Will be set after insert
                });

                const { data, error } = await this.supabase
                    .from('ingest_log')
                    .insert({
                        user_id: userId,
                        provider,
                        external_id: result.externalId,
                        status: result.status,
                        metadata: { error: result.error, richness: result.richness }
                    })
                    .select()
                    .single();

                if (error) {
                    throw new Error(`Failed to log ingestion: ${error.message}`);
                }

                // Update the rollback action with the actual ID
                const transaction = this.rollbackManager.compensatingActions.get(transactionId);
                if (transaction) {
                    const lastAction = transaction.actions[transaction.actions.length - 1];
                    if (lastAction && lastAction.type === 'insert') {
                        lastAction.data.id = data.id;
                    }
                }
            } catch (error) {
                console.error('Error logging ingestion:', error);
                throw error;
            }
        }
    }

    /**
     * Calculate richness score
     */
    calculateRichness(activity) {
        let score = 0.0;

        if (activity.has_heartrate || activity.average_heartrate || activity.max_heartrate) {score += 0.4;}
        if (activity.start_latlng || activity.end_latlng || activity.distance) {score += 0.2;}
        if (activity.device_watts || activity.average_watts) {score += 0.2;}
        if (activity.device_name || activity.device_type) {score += 0.1;}
        if (activity.calories && activity.calories > 0) {score += 0.05;}

        return Math.min(score, 1.0);
    }

    /**
     * Calculate sample rate
     */
    calculateSampleRate(samples) {
        if (!Array.isArray(samples) || samples.length < 2) {return 0;}
        const timeSpan = samples[samples.length - 1].t - samples[0].t;
        return samples.length / timeSpan;
    }
}

module.exports = { ActivityTransactionManager };
